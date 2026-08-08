import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { DelegationService } from '../../core/delegation/delegation.service';
import { PayrollScopeService } from '../payroll/payroll-scope.service';
import {
  AssignmentRow,
  isAssignmentEffective,
  rankAssignments,
  resolveShiftWindow,
  scopeRefsFor,
  ShiftWindow,
} from './shift-resolver';
import {
  AssignScheduleDto,
  CreateDelegationDto,
  CreateOverrideDto,
  CreateShiftDefinitionDto,
  CreateShiftPatternDto,
} from './dto/shift-config.dto';

/**
 * M2B — Roster Management (FR-M2B-001..004, FR-M0-060/061).
 *
 * Owns the roster layer ABOVE the schedule master data:
 *   * shift definitions (NORMAL/PAGI/SIANG/MALAM) — configurable per company,
 *     seeded from the SOP hours but admin-editable (never hardcoded);
 *   * rotation patterns (SHIFT work_schedules) — cycle_length + ordered
 *     shift codes, per-branch/manufacturing-unit via BRANCH-scope assignments;
 *   * bulk schedule assignment (employee → work_schedule);
 *   * per-date roster overrides (shift swap / day off);
 *   * the roster calendar (one row per employee × date, branch-filterable).
 *
 * Delegation (FR-M0-060/061): every roster duty can be delegated. A delegator
 * with an active outgoing ROSTER delegation is blocked from acting, and the
 * approval chain for roster changes resolves assignees through
 * DelegationService so a delegate handles the delegator's tasks.
 *
 * No-block (user override of FR-M2B-006): a missing schedule never blocks
 * period close — the attendance derivation flags NO_SCHEDULE and the roster
 * screen badges it. `collectBlockers` intentionally stays empty.
 *
 * ZERO HARDCODE: shift times/break/tolerance come from shift_definitions rows,
 * never literals. Scope axes (individu > jabatan > golongan > cabang > entitas)
 * come from shift-resolver.
 */
@Injectable()
export class RosterService {
  /** Module code used for roster delegations (FR-M0-060). */
  static readonly MODULE = 'ROSTER';

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly delegation: DelegationService,
  ) {}

  // -------------------------------------------------------------------------
  // SHIFT DEFINITIONS (FR-M2B-002) — configurable, seeded from SOP defaults
  // -------------------------------------------------------------------------

  async listShifts(user: CurrentUser) {
    const companyId = await this.resolveCompanyId(user);
    return this.prisma.shift_definitions.findMany({
      where: { company_id: companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createShift(user: CurrentUser, dto: CreateShiftDefinitionDto) {
    await this.guardActiveDelegation(user.userId);
    const companyId = await this.resolveCompanyId(user);
    return this.prisma.shift_definitions.create({
      data: {
        company_id: companyId,
        code: dto.code,
        name: dto.name,
        start_time: dto.start_time ?? null,
        end_time: dto.end_time ?? null,
        break_minutes: dto.break_minutes ?? 60,
        late_tolerance_minutes: dto.late_tolerance_minutes ?? 0,
        crosses_midnight: dto.crosses_midnight ?? this.infersCrossesMidnight(dto),
        cover_end_date: dto.cover_end_date ?? false,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updateShift(user: CurrentUser, id: string, dto: CreateShiftDefinitionDto) {
    await this.guardActiveDelegation(user.userId);
    const companyId = await this.resolveCompanyId(user);
    const existing = await this.prisma.shift_definitions.findFirst({
      where: { id, company_id: companyId },
    });
    if (!existing) throw new NotFoundException('Shift definition tidak ditemukan.');
    return this.prisma.shift_definitions.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        start_time: dto.start_time ?? null,
        end_time: dto.end_time ?? null,
        break_minutes: dto.break_minutes ?? existing.break_minutes,
        late_tolerance_minutes: dto.late_tolerance_minutes ?? existing.late_tolerance_minutes,
        crosses_midnight: dto.crosses_midnight ?? existing.crosses_midnight,
        cover_end_date: dto.cover_end_date ?? existing.cover_end_date,
        is_active: dto.is_active ?? existing.is_active,
      },
    });
  }

  async deleteShift(user: CurrentUser, id: string) {
    await this.guardActiveDelegation(user.userId);
    const companyId = await this.resolveCompanyId(user);
    const existing = await this.prisma.shift_definitions.findFirst({
      where: { id, company_id: companyId },
    });
    if (!existing) throw new NotFoundException('Shift definition tidak ditemukan.');
    const inUse = await this.prisma.shift_rotations.findFirst({
      where: { shift_definition_id: id },
      select: { id: true },
    });
    if (inUse) {
      throw new ConflictException({
        code: 'SHIFT_IN_USE',
        message: 'Shift ini dipakai oleh rotasi; nonaktifkan saja.',
      });
    }
    return this.prisma.shift_definitions.delete({ where: { id } });
  }

  /** A shift whose start ≥ end is a night shift UNLESS the caller says otherwise. */
  private infersCrossesMidnight(dto: { start_time?: string; end_time?: string }): boolean {
    if (!dto.start_time || !dto.end_time) return false;
    const [sh, sm] = dto.start_time.split(':').map(Number);
    const [eh, em] = dto.end_time.split(':').map(Number);
    return sh * 60 + sm >= eh * 60 + em;
  }

  // -------------------------------------------------------------------------
  // ROTATION PATTERNS (FR-M2B-002) — SHIFT schedules
  // -------------------------------------------------------------------------

  async listPatterns(user: CurrentUser) {
    const companyId = await this.resolveCompanyId(user);
    return this.prisma.shift_patterns.findMany({
      where: { company_id: companyId },
      include: {
        rotations: {
          orderBy: { day_index: 'asc' },
          include: { shift_definition: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createPattern(user: CurrentUser, dto: CreateShiftPatternDto) {
    await this.guardActiveDelegation(user.userId);
    const companyId = await this.resolveCompanyId(user);
    // 7 = shift_patterns.cycle_length column default (schema), not a policy number.
    // eslint-disable-next-line lahans/no-magic-policy-numbers
    const cycle = dto.cycle_length ?? 7;
    if (dto.day_indexes.length !== dto.shift_codes.length) {
      throw new BadRequestException('day_indexes dan shift_codes harus sama panjang.');
    }
    const maxIndex = Math.max(...dto.day_indexes);
    if (maxIndex >= cycle) {
      throw new BadRequestException(
        `day_index terbesar (${maxIndex}) harus < cycle_length (${cycle}).`,
      );
    }
    const shifts = await this.prisma.shift_definitions.findMany({
      where: { company_id: companyId, is_active: true, code: { in: dto.shift_codes } },
    });
    const byCode = new Map(shifts.map((s) => [s.code, s.id]));
    const unknown = dto.shift_codes.filter((c) => c !== 'OFF' && !byCode.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(`Shift tidak dikenal: ${unknown.join(', ')}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const pattern = await tx.shift_patterns.create({
        data: {
          company_id: companyId,
          code: dto.code,
          name: dto.name,
          cycle_length: cycle,
          is_active: dto.is_active ?? true,
        },
      });
      for (let i = 0; i < dto.shift_codes.length; i++) {
        const code = dto.shift_codes[i];
        const isOff = code === 'OFF';
        await tx.shift_rotations.create({
          data: {
            shift_pattern_id: pattern.id,
            day_index: dto.day_indexes[i],
            shift_definition_id: isOff ? null : (byCode.get(code) ?? null),
            is_working_day: !isOff,
          },
        });
      }
      return tx.shift_patterns.findUnique({
        where: { id: pattern.id },
        include: { rotations: { include: { shift_definition: true } } },
      });
    });
  }

  // -------------------------------------------------------------------------
  // BULK ASSIGNMENT (FR-M2B-003) — employee → schedule, per branch/unit
  // -------------------------------------------------------------------------

  async assignSchedules(user: CurrentUser, dto: AssignScheduleDto) {
    await this.guardActiveDelegation(user.userId);
    const companyId = await this.resolveCompanyId(user);
    const schedule = await this.prisma.work_schedules.findFirst({
      where: { id: dto.work_schedule_id, company_id: companyId },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('Jadwal kerja tidak ditemukan.');

    const emps = await this.prisma.employees.findMany({
      where: { id: { in: dto.employee_ids }, is_active: true },
      select: { id: true },
    });
    const found = new Set(emps.map((e) => e.id));
    const missing = dto.employee_ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Karyawan tidak ditemukan/tidak aktif: ${missing.join(', ')}`);
    }

    const asOf = new Date();
    let assigned = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const empId of dto.employee_ids) {
        const existing = await tx.schedule_assignments.findFirst({
          where: { scope_type: 'EMPLOYEE', scope_ref_id: empId, effective_to: null },
        });
        if (existing) {
          await tx.schedule_assignments.update({
            where: { id: existing.id },
            data: { work_schedule_id: dto.work_schedule_id, effective_from: asOf },
          });
        } else {
          await tx.schedule_assignments.create({
            data: {
              work_schedule_id: dto.work_schedule_id,
              scope_type: 'EMPLOYEE',
              scope_ref_id: empId,
              priority: 1,
              effective_from: asOf,
              effective_to: null,
            },
          });
        }
        assigned++;
      }
    });
    return { assigned };
  }

  // -------------------------------------------------------------------------
  // SCHEDULE OVERRIDES (FR-M2B-004) — per-date roster rows
  // -------------------------------------------------------------------------

  async createOverride(user: CurrentUser, dto: CreateOverrideDto) {
    await this.guardActiveDelegation(user.userId);
    const emp = await this.prisma.employees.findUnique({
      where: { id: dto.employee_id },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException('Karyawan tidak ditemukan.');
    if (dto.work_schedule_id) {
      const sched = await this.prisma.work_schedules.findUnique({
        where: { id: dto.work_schedule_id },
        select: { id: true },
      });
      if (!sched) throw new NotFoundException('Jadwal kerja tidak ditemukan.');
    }
    const workDate = this.parseDate(dto.work_date);

    return this.prisma.schedule_overrides.upsert({
      where: {
        employee_id_work_date: { employee_id: dto.employee_id, work_date: workDate },
      },
      create: {
        employee_id: dto.employee_id,
        work_date: workDate,
        work_schedule_id: dto.work_schedule_id ?? null,
        is_day_off: dto.is_day_off ?? false,
        reason: dto.reason,
        created_by: user.userId,
      },
      update: {
        work_schedule_id: dto.work_schedule_id ?? null,
        is_day_off: dto.is_day_off ?? false,
        reason: dto.reason,
        created_by: user.userId,
      },
    });
  }

  async listOverrides(
    user: CurrentUser,
    query: { from?: string; to?: string; employeeId?: string },
  ) {
    const empWhere = await this.scope.employeeWhere(user, 'roster.override.read');
    const where: Prisma.schedule_overridesWhereInput = { employee: empWhere };
    if (query.from)
      where.work_date = {
        ...(where.work_date as object),
        gte: this.startOfDay(new Date(query.from)),
      };
    if (query.to)
      where.work_date = { ...(where.work_date as object), lte: this.endOfDay(new Date(query.to)) };
    if (query.employeeId) {
      const inScope = await this.prisma.employees.findFirst({
        where: { id: query.employeeId, ...empWhere },
        select: { id: true },
      });
      if (!inScope) {
        throw new ConflictException({
          code: 'ROSTER_SCOPE',
          message: 'Karyawan di luar cakupan Anda.',
        });
      }
      where.employee_id = query.employeeId;
    }
    return this.prisma.schedule_overrides.findMany({
      where,
      include: { employee: { select: { nik: true, full_name: true } } },
      orderBy: [{ work_date: 'desc' }, { employee: { nik: 'asc' } }],
    });
  }

  // -------------------------------------------------------------------------
  // ROSTER CALENDAR (FR-M2B-001/013) — one row per employee × date
  // -------------------------------------------------------------------------

  async calendar(user: CurrentUser, query: { from: string; to: string; branchId?: string }) {
    const from = this.startOfDay(new Date(query.from));
    const to = this.endOfDay(new Date(query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Rentang tanggal tidak valid.');
    }
    const empWhere = await this.scope.employeeWhere(user, 'roster.calendar.read');
    const where: Prisma.employeesWhereInput = { is_active: true, ...empWhere };
    if (query.branchId) where.branch_id = query.branchId;

    const employees = await this.prisma.employees.findMany({
      where,
      select: {
        id: true,
        nik: true,
        full_name: true,
        branch_id: true,
        job_position_id: true,
        job_grade_id: true,
        branch: { select: { company_id: true } },
      },
      orderBy: { nik: 'asc' },
    });

    const overrides = await this.prisma.schedule_overrides.findMany({
      where: {
        employee_id: { in: employees.map((e) => e.id) },
        work_date: { gte: from, lte: to },
      },
    });

    const rows: Record<
      string,
      {
        employee_id: string;
        nik: string;
        full_name: string;
        work_date: string;
        shift_code: string | null;
        start_time: string | null;
        end_time: string | null;
        is_working_day: boolean;
        crosses_midnight: boolean;
        source: 'SCHEDULE' | 'OVERRIDE';
        override: { work_schedule_id: string | null; is_day_off: boolean; reason: string } | null;
      }
    > = {};

    // Batch resolution: fetch each employee's assignments ONCE, then resolve every
    // date in-memory (no N+1 query per cell). Overrides load per employee below.
    for (const emp of employees) {
      const assignments = await this.assignmentsFor(emp);
      const empOverrides = overrides.filter((o) => o.employee_id === emp.id);
      const overrideByDate = new Map(
        empOverrides.map((o) => [o.work_date.toISOString().slice(0, 10), o]),
      );
      let cursor = from;
      while (cursor <= to) {
        const iso = cursor.toISOString().slice(0, 10);
        const ov = overrideByDate.get(iso) ?? null;
        // Override wins over the assignment; day-off overrides short-circuit.
        const window: (ShiftWindow & { scheduleId: string | null }) | null = ov
          ? await this.windowForOverride(emp.id, cursor, ov)
          : this.windowFromAssignments(assignments, cursor);
        rows[`${emp.id}|${iso}`] = {
          employee_id: emp.id,
          nik: emp.nik,
          full_name: emp.full_name,
          work_date: iso,
          shift_code: window?.shiftCode ?? null,
          start_time: window?.start_time ?? null,
          end_time: window?.end_time ?? null,
          is_working_day: ov
            ? !ov.is_day_off && (window?.is_working_day ?? true)
            : (window?.is_working_day ?? true),
          crosses_midnight: window?.crosses_midnight ?? false,
          source: ov ? 'OVERRIDE' : 'SCHEDULE',
          override: ov
            ? {
                work_schedule_id: ov.work_schedule_id,
                is_day_off: ov.is_day_off,
                reason: ov.reason,
              }
            : null,
        };
        // Advance by one UTC day. `startOfDay` normalizes to UTC midnight, so stay
        // on the UTC clock — a Date(y,m,d+1) constructor would create a LOCAL
        // midnight that lands a day behind on a +07:00 machine (infinite loop).
        cursor = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1),
        );
      }
    }
    return {
      branchId: query.branchId ?? null,
      from: query.from,
      to: query.to,
      rows: Object.values(rows),
    };
  }

  /** Fetch the schedule_assignments rows that could apply to an employee. */
  private async assignmentsFor(emp: {
    id: string;
    job_position_id: string | null;
    job_grade_id: string | null;
    branch_id: string | null;
    branch: { company_id: string } | null;
  }): Promise<AssignmentRow[]> {
    const refs = scopeRefsFor({
      employee_id: emp.id,
      job_position_id: emp.job_position_id,
      job_grade_id: emp.job_grade_id,
      branch_id: emp.branch_id,
      company_id: emp.branch?.company_id ?? null,
      entity_company_id: emp.branch?.company_id ?? null,
    });
    return this.prisma.schedule_assignments.findMany({
      where: { OR: refs.map((r) => ({ scope_type: r.scope_type, scope_ref_id: r.scope_ref_id })) },
      include: {
        work_schedule: {
          include: {
            shift_pattern: { include: { rotations: { include: { shift_definition: true } } } },
            days: true,
          },
        },
      },
    });
  }

  /**
   * Resolve a date from an employee's pre-fetched assignments (batched calendar
   * path — no per-date DB query). Mirrors resolveWorkSchedule's ranking.
   */
  private windowFromAssignments(
    assignments: AssignmentRow[],
    date: Date,
  ): (ShiftWindow & { scheduleId: string | null }) | null {
    const effective = assignments.filter((a) => isAssignmentEffective(a, date));
    const winner = rankAssignments(effective, date);
    if (!winner) return null;
    return resolveShiftWindow(winner, date);
  }

  /** Override resolution: day-off short-circuits; otherwise the override's own schedule. */
  private async windowForOverride(
    employeeId: string,
    date: Date,
    ov: { work_schedule_id: string | null; is_day_off: boolean },
  ): Promise<(ShiftWindow & { scheduleId: string | null }) | null> {
    if (ov.is_day_off) {
      return {
        scheduleId: null,
        shiftCode: null,
        start_time: null,
        end_time: null,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        is_working_day: false,
        crosses_midnight: false,
      };
    }
    if (ov.work_schedule_id) {
      const schedule = await this.prisma.work_schedules.findUnique({
        where: { id: ov.work_schedule_id },
        include: {
          shift_pattern: { include: { rotations: { include: { shift_definition: true } } } },
          days: true,
        },
      });
      if (schedule) {
        const assignment: AssignmentRow = {
          effective_from: date,
          effective_to: date,
          priority: 1,
          scope_type: 'EMPLOYEE',
          scope_ref_id: employeeId,
          work_schedule: {
            id: schedule.id,
            code: schedule.code,
            name: schedule.name,
            schedule_type: schedule.schedule_type,
            shift_pattern: schedule.shift_pattern,
            days: schedule.days,
          },
        };
        return resolveShiftWindow(assignment, date);
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // SHARED RESOLVER — used by attendance + leave (FR-M2B-003)
  // -------------------------------------------------------------------------

  /**
   * Resolve the concrete shift window for an employee on a date using the
   * 5-level priority (individu > jabatan > golongan > cabang > entitas), then
   * applying any per-date override. Attendance derivation and leave
   * computeWorkingDays both call this so a roster change is honored everywhere.
   */
  async resolveWorkSchedule(
    employeeId: string,
    date: Date,
    client?: Prisma.TransactionClient | PrismaService,
  ): Promise<(ShiftWindow & { scheduleId: string | null }) | null> {
    const db = client ?? this.prisma;
    const emp = await db.employees.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        job_position_id: true,
        job_grade_id: true,
        branch_id: true,
        branch: { select: { company_id: true } },
      },
    });
    if (!emp) return null;

    // The employees table has no company_id — the company is reached via
    // branch.company_id (entity-level assignments use the same company).
    const refs = scopeRefsFor({
      employee_id: emp.id,
      job_position_id: emp.job_position_id,
      job_grade_id: emp.job_grade_id,
      branch_id: emp.branch_id,
      company_id: emp.branch?.company_id ?? null,
      entity_company_id: emp.branch?.company_id ?? null,
    });
    const assignments = await db.schedule_assignments.findMany({
      where: {
        OR: refs.map((r) => ({ scope_type: r.scope_type, scope_ref_id: r.scope_ref_id })),
      },
      include: {
        work_schedule: {
          include: {
            shift_pattern: { include: { rotations: { include: { shift_definition: true } } } },
            days: true,
          },
        },
      },
    });
    const effective = assignments.filter((a) => isAssignmentEffective(a, date));
    const winner = rankAssignments(effective, date);
    if (!winner) return null;
    return resolveShiftWindow(winner, date);
  }

  // -------------------------------------------------------------------------
  // EMPLOYEE SCHEDULE SNAPSHOT (Ticket 04 — read-only "Jadwal Kerja" card)
  // -------------------------------------------------------------------------

  /**
   * Resolve an employee's currently active schedule for a date, including the
   * schedule's own metadata (code/name/type) — unlike resolveWorkSchedule,
   * which only returns the concrete shift window. Fed by the same 5-level
   * priority pipeline (scopeRefsFor → isAssignmentEffective → rankAssignments →
   * resolveShiftWindow), so the card always agrees with the roster calendar.
   * Enforces the same employee data-scope as the calendar (roster.calendar.read),
   * so a SELF-scope EMPLOYEE can only read their own schedule.
   * Returns null when the employee is not found or has no schedule.
   */
  async resolveEmployeeSchedule(
    user: CurrentUser,
    employeeId: string,
    date: Date,
  ): Promise<{
    schedule: {
      id: string;
      code: string;
      name: string;
      schedule_type: string;
    } | null;
    scope: { type: string; refId: string; priority: number } | null;
    window: ShiftWindow | null;
  } | null> {
    const empWhere = await this.scope.employeeWhere(user, 'roster.calendar.read');
    const emp = await this.prisma.employees.findFirst({
      // AND both constraints: a SELF scope's { id } must not be dropped in
      // favour of the requested id (object-literal spread would collapse the
      // duplicate `id` key), and the requested id must not be dropped either.
      where: { AND: [{ id: employeeId }, empWhere] },
      select: {
        id: true,
        job_position_id: true,
        job_grade_id: true,
        branch_id: true,
        branch: { select: { company_id: true } },
      },
    });
    if (!emp) {
      // Distinguish "exists but out of scope" from "no such employee". A
      // company-wide scope ({} where) simply means the employee doesn't exist.
      const inScope = Object.keys(empWhere).length === 0;
      if (!inScope) {
        throw new ConflictException({
          code: 'ROSTER_SCOPE',
          message: 'Karyawan di luar cakupan Anda.',
        });
      }
      return null;
    }

    const refs = scopeRefsFor({
      employee_id: emp.id,
      job_position_id: emp.job_position_id,
      job_grade_id: emp.job_grade_id,
      branch_id: emp.branch_id,
      company_id: emp.branch?.company_id ?? null,
      entity_company_id: emp.branch?.company_id ?? null,
    });
    const assignments = await this.prisma.schedule_assignments.findMany({
      where: {
        OR: refs.map((r) => ({ scope_type: r.scope_type, scope_ref_id: r.scope_ref_id })),
      },
      include: {
        work_schedule: {
          include: {
            shift_pattern: { include: { rotations: { include: { shift_definition: true } } } },
            days: true,
          },
        },
      },
    });
    const effective = assignments.filter((a) => isAssignmentEffective(a, date));
    const winner = rankAssignments(effective, date);
    if (!winner) return { schedule: null, scope: null, window: null };
    return {
      schedule: winner.work_schedule
        ? {
            id: winner.work_schedule.id,
            code: winner.work_schedule.code,
            name: winner.work_schedule.name,
            schedule_type: winner.work_schedule.schedule_type,
          }
        : null,
      scope: {
        type: winner.scope_type,
        refId: winner.scope_ref_id,
        priority: winner.priority,
      },
      window: resolveShiftWindow(winner, date),
    };
  }

  // -------------------------------------------------------------------------
  // DELEGATION (FR-M0-060/061) — roster duties are delegable
  // -------------------------------------------------------------------------

  /** Block a delegator whose ROSTER duties are currently delegated away. */
  async guardActiveDelegation(actorId: string) {
    const mine = await this.prisma.approval_delegations.findFirst({
      where: {
        delegator_user_id: actorId,
        is_active: true,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
      include: { delegate: { select: { login_nik: true } } },
    });
    if (mine && this.coversRoster(mine.module_codes)) {
      throw new ConflictException({
        code: 'ROSTER_DELEGATED',
        message: `Tugas roster Anda sedang didelegasikan (${mine.delegate?.login_nik ?? 'delegate'}); batalkan delegasi untuk bertindak.`,
      });
    }
  }

  async createDelegation(user: CurrentUser, dto: CreateDelegationDto) {
    const delegate = await this.prisma.users.findUnique({
      where: { id: dto.delegate_user_id },
      select: { id: true, status: true },
    });
    if (!delegate || delegate.status !== 'ACTIVE') {
      throw new NotFoundException('User delegate tidak ditemukan/tidak aktif.');
    }
    if (delegate.id === user.userId) {
      throw new BadRequestException('Tidak dapat mendelegasikan ke diri sendiri.');
    }
    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Rentang tanggal delegasi tidak valid.');
    }
    const module_codes = dto.module_codes ?? ['*'];
    return this.prisma.approval_delegations.create({
      data: {
        delegator_user_id: user.userId,
        delegate_user_id: dto.delegate_user_id,
        module_codes: module_codes as unknown as Prisma.InputJsonValue,
        start_date: start,
        end_date: end,
        reason: dto.reason,
        is_active: true,
      },
    });
  }

  async listDelegations(user: CurrentUser) {
    const [mine, toMe] = await Promise.all([
      this.prisma.approval_delegations.findMany({
        where: { OR: [{ delegator_user_id: user.userId }, { delegate_user_id: user.userId }] },
        include: {
          delegator: { select: { login_nik: true, employee: { select: { full_name: true } } } },
          delegate: { select: { login_nik: true, employee: { select: { full_name: true } } } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.delegation.activeDelegators(user.userId, RosterService.MODULE),
    ]);
    return { mine, delegatingToMe: toMe };
  }

  async cancelDelegation(user: CurrentUser, id: string) {
    const del = await this.prisma.approval_delegations.findUnique({ where: { id } });
    if (!del || del.delegator_user_id !== user.userId) {
      throw new NotFoundException('Delegasi tidak ditemukan.');
    }
    return this.prisma.approval_delegations.update({
      where: { id },
      data: { is_active: false },
    });
  }

  private coversRoster(moduleCodes: Prisma.JsonValue): boolean {
    if (moduleCodes == null) return true;
    const codes = Array.isArray(moduleCodes) ? (moduleCodes as string[]) : [];
    return codes.length === 0 || codes.includes('*') || codes.includes(RosterService.MODULE);
  }

  // -------------------------------------------------------------------------
  // INTERNAL helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve the company the roster works on. Prefers the user's COMPANY scope
   * binding; falls back to the first company (the demo "LMN" group). Shift
   * config is per-company so a multi-company deployment edits each unit's
   * shifts without code changes.
   */
  private async resolveCompanyId(user: CurrentUser): Promise<string> {
    const binding = await this.prisma.user_scope_bindings.findFirst({
      where: { user_id: user.userId, scope_type: 'COMPANY' },
      select: { scope_ref_id: true },
    });
    if (binding) return binding.scope_ref_id;
    const company = await this.prisma.companies.findFirst({ select: { id: true } });
    if (!company) throw new NotFoundException('Perusahaan belum dikonfigurasi.');
    return company.id;
  }

  private parseDate(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Tanggal tidak valid.');
    return this.startOfDay(d);
  }

  private startOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private endOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }
}
