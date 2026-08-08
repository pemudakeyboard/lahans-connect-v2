import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ParameterService } from '../../core/config/parameter.service';
import { ConfigService } from '../config/config.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

type Tx = Prisma.TransactionClient;

/**
 * S7-M3 — Cuti & Izin (BP-04, BP-05; BR-C01..C13).
 *
 * Owns the leave lifecycle: pengajuan (Cuti/Izin), saldo & ledger, prorata,
 * advance, approval, cancellation, and the automated post-approval effects.
 *
 * Domain rules (CONTEXT.md) honored here:
 *  - Cuti Tahunan: 12 working days/year, granted on the ANNIVERSARY date, year-1
 *    prorated months-based (1 day per month remaining), never batched Jan 1.
 *  - Cuti Advance: max `LEAVE.ADVANCE_MAX_DAYS` working days, drawn down from
 *    the future entitlement, clawed back on early resignation.
 *  - Izin: (Gaji Pokok ÷ 25) × days — the divisor 25 is read from
 *    `PAYROLL.ABSENCE_MINUTES_DIVISOR` (a system_parameters row), never a literal.
 *  - Approval chains are per-document (CUTI: Atasan → Division Head; IZIN:
 *    Atasan → Dept. Comben) — resolved from approval_workflows by code.
 *  - Every absence day marks attendance_daily (CUTI/IZIN/SAKIT) so the
 *    attendance ladder and meal/transport allowances are computed downstream.
 *
 * ZERO HARDCODE: all policy numbers come from system_parameters via
 * ParameterService.resolve(key, asOf) — no literals for 12, 25, 3, 7, 2, ...
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParameterService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // SALDO — balance query (the "Hak | Terpakai | Pending | Sisa" card)
  // -------------------------------------------------------------------------

  async getBalance(employeeId: string, asOf?: string) {
    const date = asOf ? new Date(asOf) : new Date();
    const year = date.getFullYear();
    const rows = await this.prisma.leave_balances.findMany({
      where: { employee_id: employeeId, period_year: year },
      include: { leave_type: true },
      orderBy: { leave_type: { code: 'asc' } },
    });
    return rows.map((r) => ({
      leave_type_id: r.leave_type_id,
      code: r.leave_type.code,
      name: r.leave_type.name,
      entitlement_days: r.entitlement_days,
      prorate_days: r.prorate_days,
      carried_over_days: r.carried_over_days,
      used_days: r.used_days,
      advance_used_days: r.advance_used_days,
      pending_days: r.pending_days,
      balance_days: r.balance_days,
    }));
  }

  /** Ledger history for one balance (append-only, newest first). */
  async getLedger(employeeId: string, leaveTypeId?: string) {
    const balances = await this.prisma.leave_balances.findMany({
      where: {
        employee_id: employeeId,
        ...(leaveTypeId ? { leave_type_id: leaveTypeId } : {}),
      },
      select: { id: true },
    });
    return this.prisma.leave_balance_ledger.findMany({
      where: { leave_balance_id: { in: balances.map((b) => b.id) } },
      orderBy: { created_at: 'desc' },
    });
  }

  // -------------------------------------------------------------------------
  // PENGAJUAN — create a leave request
  // -------------------------------------------------------------------------

  async create(
    employeeId: string,
    _actorId: string,
    dto: CreateLeaveRequestDto,
    opts: { adminOverride?: boolean } = {},
  ) {
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan.');
    if (!employee.leave_eligible && !opts.adminOverride) {
      throw new ForbiddenException({
        code: 'LEAVE_NOT_ELIGIBLE',
        message: 'Karyawan ini tidak memenuhi syarat cuti (leave_eligible = false).',
      });
    }

    const leaveType = await this.prisma.leave_types.findUnique({
      where: { id: dto.leave_type_id },
    });
    if (!leaveType || !leaveType.is_active) {
      throw new NotFoundException('Jenis cuti tidak ditemukan.');
    }

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Tanggal mulai/selesai tidak valid.');
    }
    if (start > end) {
      throw new BadRequestException('Tanggal mulai tidak boleh melewati tanggal selesai.');
    }

    const asOf = start;
    const now = new Date();

    // -- Notice period (BR-C07: cuti H-7 kerja; BR-C08: izin H-1) -------------
    if (!dto.is_emergency && !opts.adminOverride) {
      const noticeDays = leaveType.min_notice_days;
      if (noticeDays != null && start < this.addWorkingDays(now, noticeDays)) {
        throw new ConflictException({
          code: 'LEAVE_NOTICE_TOO_SHORT',
          message: `Pengajuan harus minimal H-${noticeDays} sebelum tanggal cuti. Gunakan jalur darurat bila mendesak.`,
        });
      }
    }

    // -- Backdate (is_emergency) ----------------------------------------------
    if (dto.is_backdated && !leaveType.allow_backdate && !opts.adminOverride) {
      throw new ConflictException({
        code: 'LEAVE_BACKDATE_NOT_ALLOWED',
        message: `Jenis cuti ${leaveType.name} tidak mengizinkan input mundur.`,
      });
    }

    // -- Attachment requirement ----------------------------------------------
    if (leaveType.requires_attachment && !dto.attachment_urls && !opts.adminOverride) {
      throw new BadRequestException({
        code: 'LEAVE_ATTACHMENT_REQUIRED',
        message: `Jenis cuti ${leaveType.name} wajib melampirkan dokumen pendukung.`,
      });
    }

    // -- Compute the working-day list ------------------------------------------
    const { days, totalDays } = await this.computeWorkingDays(employee, start, end, asOf);

    if (totalDays <= 0) {
      throw new BadRequestException('Tidak ada hari kerja dalam rentang tanggal yang dipilih.');
    }

    // Per-request max days (BR-C05: Cuti Advance max 3, CUTI_TAHUNAN max 12)
    if (leaveType.max_days_per_request != null && totalDays > leaveType.max_days_per_request) {
      throw new ConflictException({
        code: 'LEAVE_MAX_DAYS_EXCEEDED',
        message: `Maksimum ${leaveType.max_days_per_request} hari per pengajuan untuk ${leaveType.name}.`,
      });
    }

    // -- Quota / advance validation -------------------------------------------
    let advanceUsedDays = 0;
    if (leaveType.deduct_quota) {
      const service = this.serviceMonths(employee.join_date, start);
      const fullEntitlementMonths = await this.loadNumber(
        'LEAVE.FULL_ENTITLEMENT_SERVICE_MONTHS',
        asOf,
      );
      if (leaveType.code === 'CUTI_TAHUNAN' && service < fullEntitlementMonths) {
        throw new ConflictException({
          code: 'LEAVE_ENTITLEMENT_NOT_EARNED',
          message:
            'Hak cuti tahunan belum diperoleh (perlu 12 bulan masa kerja). Gunakan Cuti di Muka (maks. 3 hari).',
        });
      }
      if (leaveType.code === 'CUTI_ADVANCE') {
        const advanceMax = await this.loadNumber('LEAVE.ADVANCE_MAX_DAYS', asOf);
        if (totalDays > advanceMax) {
          throw new ConflictException({
            code: 'LEAVE_ADVANCE_EXCEEDED',
            message: `Cuti di muka maksimal ${advanceMax} hari kerja.`,
          });
        }
        advanceUsedDays = totalDays;
      }
    }

    // -- Overlap check ---------------------------------------------------------
    const overlap = await this.prisma.leave_requests.findFirst({
      where: {
        employee_id: employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: days.map((d) => ({ start_date: { lte: d.date }, end_date: { gte: d.date } })),
      },
    });
    if (overlap) {
      throw new ConflictException({
        code: 'LEAVE_OVERLAP',
        message: `Terdapat pengajuan lain yang tumpang tindih (${overlap.doc_number}).`,
      });
    }

    // -- Doc number + workflow -------------------------------------------------
    const docSeq = leaveType.code === 'IZIN' ? 'DOC_IZIN' : 'DOC_LEAVE';
    const { nextNumber } = await this.config.reserveNextNumber(docSeq, {
      scopeType: 'BRANCH',
      scopeRefId: employee.branch_id ?? undefined,
    });

    const workflow = await this.prisma.approval_workflows.findUnique({
      where: { code: leaveType.workflow_code ?? 'CUTI' },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    // Create in one transaction: request + days + pending balance + approval instance.
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leave_requests.create({
        data: {
          doc_number: nextNumber,
          employee_id: employeeId,
          leave_type_id: leaveType.id,
          start_date: start,
          end_date: end,
          total_days: totalDays,
          reason: dto.reason,
          is_emergency: dto.is_emergency ?? false,
          is_backdated: dto.is_backdated ?? false,
          attachment_urls: dto.attachment_urls
            ? (JSON.parse(dto.attachment_urls) as string[])
            : undefined,
          status: 'PENDING',
          submitted_at: now,
        },
      });

      for (const d of days) {
        await tx.leave_request_days.create({
          data: {
            leave_request_id: created.id,
            leave_date: d.date,
            day_portion: d.portion,
            is_counted: d.isCounted,
          },
        });
      }

      // Hold the pending balance NOW so the "Sisa" card is correct while PENDING.
      if (leaveType.deduct_quota) {
        const balance = await this.balanceFor(tx, employeeId, leaveType.id, start);
        if (balance) {
          await tx.leave_balances.update({
            where: { id: balance.id },
            data: {
              pending_days: balance.pending_days.plus(new Prisma.Decimal(totalDays)),
            },
          });
        }
      }

      // Approval instance (only when a workflow exists)
      let approval_instance_id: string | null = null;
      if (workflow) {
        const instance = await tx.approval_instances.create({
          data: {
            workflow_id: workflow.id,
            workflow_version: workflow.version,
            document_type: 'LEAVE_REQUEST',
            document_id: created.id,
            current_step_order: 1,
            status: 'PENDING',
          },
        });
        approval_instance_id = instance.id;

        const firstStep = workflow.steps[0];
        if (firstStep) {
          const assignee = await this.resolveStepAssignee(tx, employeeId, firstStep);
          if (assignee) {
            await tx.approval_tasks.create({
              data: {
                approval_instance_id: instance.id,
                step_order: firstStep.step_order,
                assignee_user_id: assignee,
                status: 'PENDING',
              },
            });
          }
        }
      }

      return tx.leave_requests.update({
        where: { id: created.id },
        data: { approval_instance_id },
        include: { leave_type: true, days: true },
      });
    });

    return {
      ...request,
      advance_used_days: advanceUsedDays,
      total_days_working: totalDays,
    };
  }

  // -------------------------------------------------------------------------
  // LIST / APPROVAL
  // -------------------------------------------------------------------------

  async listMyRequests(employeeId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leave_requests.count({ where: { employee_id: employeeId } }),
      this.prisma.leave_requests.findMany({
        where: { employee_id: employeeId },
        include: { leave_type: true, days: { orderBy: { leave_date: 'asc' } } },
        orderBy: { submitted_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  /** Requests awaiting the given user's action (approval inbox). */
  async listInbox(userId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.approval_instancesWhereInput = {
      document_type: 'LEAVE_REQUEST',
      tasks: { some: { assignee_user_id: userId, status: 'PENDING' } },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.approval_instances.count({ where }),
      this.prisma.approval_instances.findMany({
        where,
        include: { tasks: { orderBy: { step_order: 'asc' } } },
        orderBy: { started_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // approval_instances has no declared relation back to leave_requests (only
    // document_id); fetch the attached requests by id in one query.
    const ids = rows.map((r) => r.document_id);
    const requests = await this.prisma.leave_requests.findMany({
      where: { id: { in: ids } },
      include: {
        leave_type: true,
        employee: { select: { full_name: true, nik: true } },
      },
    });
    const byId = new Map(requests.map((r) => [r.id, r]));
    return {
      total,
      page,
      pageSize,
      rows: rows.map((r) => ({ ...r, request: byId.get(r.document_id) ?? null })),
    };
  }

  /**
   * Approve (or reject/return) the current step. Once all steps are approved the
   * request flips to APPROVED and the automated effects run (debit balance,
   * attendance_daily rows, ledger entries).
   */
  async decide(
    id: string,
    actorId: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    comment?: string,
  ) {
    const request = await this.prisma.leave_requests.findUnique({
      where: { id },
      include: { leave_type: true },
    });
    if (!request) throw new NotFoundException('Pengajuan cuti tidak ditemukan.');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Pengajuan ini sudah diputuskan.');
    }
    if (!request.approval_instance_id) {
      throw new ConflictException('Pengajuan ini tidak memiliki alur approval.');
    }

    const instance = await this.prisma.approval_instances.findUnique({
      where: { id: request.approval_instance_id },
      include: { tasks: { orderBy: { step_order: 'asc' } } },
    });
    if (!instance) throw new NotFoundException('Instansi approval tidak ditemukan.');

    const currentTask = instance.tasks.find(
      (t) => t.step_order === instance.current_step_order && t.status === 'PENDING',
    );
    if (!currentTask || currentTask.assignee_user_id !== actorId) {
      throw new ForbiddenException('Bukan giliran Anda untuk memutuskan pengajuan ini.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.approval_tasks.update({
        where: { id: currentTask.id },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RETURNED',
          action,
          comments: comment,
          acted_at: new Date(),
        },
      });

      if (action === 'REJECT' || action === 'RETURN') {
        const newStatus = action === 'REJECT' ? 'REJECTED' : 'RETURNED';
        await tx.approval_instances.update({
          where: { id: instance.id },
          data: { status: newStatus, completed_at: new Date() },
        });
        await tx.leave_requests.update({
          where: { id },
          data: { status: newStatus, decided_at: new Date() },
        });
        await this.releasePending(tx, request);
        return { id, status: newStatus };
      }

      // APPROVE: advance to the next step, or finalize.
      const nextStep = instance.tasks.find((t) => t.step_order > instance.current_step_order);
      if (nextStep) {
        // approver_type/approver_ref live on approval_workflow_steps, not on the
        // task — resolve them from the workflow definition.
        const stepDef = await tx.approval_workflow_steps.findUnique({
          where: {
            workflow_id_step_order: {
              workflow_id: instance.workflow_id,
              step_order: nextStep.step_order,
            },
          },
        });
        const assignee = stepDef
          ? await this.resolveStepAssignee(tx, request.employee_id, {
              approver_type: stepDef.approver_type,
              approver_ref: stepDef.approver_ref,
            })
          : null;
        await tx.approval_instances.update({
          where: { id: instance.id },
          data: { current_step_order: nextStep.step_order },
        });
        await tx.approval_tasks.create({
          data: {
            approval_instance_id: instance.id,
            step_order: nextStep.step_order,
            assignee_user_id: assignee ?? (currentTask.assignee_user_id as string),
            status: 'PENDING',
          },
        });
        return { id, status: 'PENDING', next_step: nextStep.step_order };
      }

      // All steps approved → finalize and apply the automated effects.
      await tx.approval_instances.update({
        where: { id: instance.id },
        data: { status: 'APPROVED', completed_at: new Date() },
      });
      await tx.leave_requests.update({
        where: { id },
        data: { status: 'APPROVED', decided_at: new Date() },
      });
      await this.applyApprovedEffects(tx, {
        id: request.id,
        employee_id: request.employee_id,
        leave_type_id: request.leave_type_id,
        start_date: request.start_date,
        leave_type: request.leave_type,
      });
      return { id, status: 'APPROVED' };
    });
  }

  async cancel(id: string, _actorId: string) {
    const request = await this.prisma.leave_requests.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Pengajuan cuti tidak ditemukan.');
    if (!['PENDING', 'RETURNED'].includes(request.status)) {
      throw new ConflictException('Hanya pengajuan PENDING/RETURNED yang dapat dibatalkan.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.leave_requests.update({ where: { id }, data: { status: 'CANCELED' } });
      if (request.approval_instance_id) {
        await tx.approval_instances.update({
          where: { id: request.approval_instance_id },
          data: { status: 'CANCELED', completed_at: new Date() },
        });
      }
      await this.releasePending(tx, request);
      return { id, status: 'CANCELED' };
    });
  }

  // -------------------------------------------------------------------------
  // GRANT — anniversary-based entitlement (CONTEXT.md "Leave grant event")
  // -------------------------------------------------------------------------

  /**
   * Grant next year's Cuti Tahunan for every eligible employee. Called by a
   * daily job (or the admin screen). Year-1 grants are prorated months-based;
   * year-2+ grants are the flat annual days.
   */
  async runAnnualGrant(asOf: Date, actorId: string) {
    const annualDays = await this.loadNumber('LEAVE.ANNUAL_DAYS', asOf);
    const fullEntitlementMonths = await this.loadNumber(
      'LEAVE.FULL_ENTITLEMENT_SERVICE_MONTHS',
      asOf,
    );
    const leaveType = await this.prisma.leave_types.findUnique({
      where: { code: 'CUTI_TAHUNAN' },
    });
    if (!leaveType) throw new NotFoundException('Cuti Tahunan belum dikonfigurasi.');

    const year = asOf.getFullYear();
    const employees = await this.prisma.employees.findMany({
      where: { is_active: true, leave_eligible: true },
    });

    let granted = 0;
    for (const emp of employees) {
      if (!emp.join_date) continue;
      const anniversary = new Date(year, emp.join_date.getMonth(), emp.join_date.getDate());
      if (anniversary > asOf) continue; // not yet due this year

      const serviceMonths = this.serviceMonths(emp.join_date, anniversary);
      // The grant on the 12-month anniversary is ALWAYS prorated: the employee
      // has just earned the entitlement, so the first grant is months-based
      // (1 day per month from anniversary month to December). Employees who
      // were already granted in an earlier year get the flat annual days.
      const hasPriorGrant = await this.prisma.leave_balances.findFirst({
        where: {
          employee_id: emp.id,
          leave_type_id: leaveType.id,
          period_year: { lt: year },
        },
      });
      const isFirst = !hasPriorGrant;
      const entitlement =
        isFirst || serviceMonths < fullEntitlementMonths
          ? this.prorateDays(emp.join_date, anniversary)
          : annualDays;

      const existing = await this.prisma.leave_balances.findUnique({
        where: {
          employee_id_leave_type_id_period_year: {
            employee_id: emp.id,
            leave_type_id: leaveType.id,
            period_year: year,
          },
        },
      });
      if (existing) continue; // already granted this year

      const validFrom = anniversary;
      const expiresAt = new Date(
        validFrom.getFullYear() + 1,
        validFrom.getMonth(),
        validFrom.getDate(),
      );

      await this.prisma.$transaction(async (tx) => {
        const balance = await tx.leave_balances.create({
          data: {
            employee_id: emp.id,
            leave_type_id: leaveType.id,
            period_year: year,
            entitlement_days: entitlement,
            prorate_days: isFirst ? entitlement : 0,
            carried_over_days: 0,
            used_days: 0,
            advance_used_days: 0,
            pending_days: 0,
            expired_days: 0,
            balance_days: entitlement,
            valid_from: validFrom,
            expires_at: expiresAt,
          },
        });
        await tx.leave_balance_ledger.create({
          data: {
            leave_balance_id: balance.id,
            entry_type: 'GRANT',
            days: entitlement,
            reference_type: 'SYSTEM_ANNUAL_GRANT',
            notes: `Hak cuti tahunan ${year} (${isFirst ? 'prorata' : 'penuh'} ${entitlement} hari)`,
            created_by: actorId,
          },
        });
      });
      granted += 1;
    }
    return { granted };
  }

  /**
   * Prorate CONTEXT.md: first-year grant = 1 day per month from the anniversary
   * month to December. Join 3 Mar → anniversary 3 Mar → 10 days (Mar..Dec).
   * Computed as months from the anniversary to Jan 1 of the following year
   * (which spans the anniversary month through December inclusive).
   */
  private prorateDays(joinDate: Date, anniversary: Date): number {
    const jan1NextYear = new Date(anniversary.getFullYear() + 1, 0, 1);
    void joinDate;
    return (
      (jan1NextYear.getFullYear() - anniversary.getFullYear()) * 12 +
      (jan1NextYear.getMonth() - anniversary.getMonth())
    );
  }

  // -------------------------------------------------------------------------
  // INTERNAL — helpers
  // -------------------------------------------------------------------------

  private serviceMonths(joinDate: Date | null, asOf: Date): number {
    if (!joinDate) return 0;
    let months =
      (asOf.getFullYear() - joinDate.getFullYear()) * 12 + (asOf.getMonth() - joinDate.getMonth());
    if (asOf.getDate() < joinDate.getDate()) months -= 1;
    return Math.max(0, months);
  }

  /**
   * Read a policy number from system_parameters. BRD §13 #1 forbids hardcoding
   * policy numbers as literals, so a missing row is a config error — fail fast
   * rather than silently fall back to a guessed value.
   */
  private async loadNumber(key: string, asOf: Date): Promise<number> {
    const p = await this.params.resolveNumber(key, asOf);
    if (p == null) {
      throw new ConflictException({
        code: 'PARAM_MISSING',
        message: `Parameter kebijakan ${key} belum dikonfigurasi di system_parameters.`,
      });
    }
    return p;
  }

  /**
   * Compute the working-day list between start and end, excluding non-working
   * days (per the employee's schedule) and holidays.
   */
  private async computeWorkingDays(employee: { id: string }, start: Date, end: Date, asOf: Date) {
    // Highest-priority schedule assignment for this employee.
    const assignment = await this.prisma.schedule_assignments.findFirst({
      where: {
        scope_type: 'EMPLOYEE',
        scope_ref_id: employee.id,
        effective_from: { lte: asOf },
        OR: [{ effective_to: null }, { effective_to: { gte: asOf } }],
      },
      orderBy: { priority: 'asc' },
      include: { work_schedule: { include: { days: true } } },
    });

    // Fall back to the first active schedule when no assignment exists.
    const schedule =
      assignment?.work_schedule ??
      (await this.prisma.work_schedules.findFirst({
        where: { is_active: true },
        include: { days: true },
      }));

    const workingDays = new Set(
      (schedule?.days ?? []).filter((d) => d.is_working_day).map((d) => d.day_of_week),
    );

    // Holidays (national + company) on the leave range.
    const holidays = await this.prisma.holidays.findMany({
      where: {
        date: { gte: this.startOfDay(start), lte: this.endOfDay(end) },
      },
    });
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    const result: { date: Date; portion: string; isCounted: boolean }[] = [];
    let cursor = this.startOfDay(start);
    const endDay = this.startOfDay(end);
    while (cursor <= endDay) {
      const dow = cursor.getDay();
      const iso = cursor.toISOString().slice(0, 10);
      const isWorking = workingDays.has(dow);
      const isHoliday = holidayDates.has(iso);
      result.push({
        date: cursor,
        portion: 'FULL',
        isCounted: isWorking && !isHoliday,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }

    const totalDays = result.filter((d) => d.isCounted).length;
    return { days: result, totalDays };
  }

  private async balanceFor(tx: Tx, employeeId: string, leaveTypeId: string, asOf: Date) {
    const year = asOf.getFullYear();
    return tx.leave_balances.findUnique({
      where: {
        employee_id_leave_type_id_period_year: {
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          period_year: year,
        },
      },
    });
  }

  /** Release held pending balance when a request is rejected/returned/canceled. */
  private async releasePending(
    tx: Tx,
    request: {
      employee_id: string;
      leave_type_id: string;
      start_date: Date;
      total_days: Prisma.Decimal;
    },
  ) {
    const leaveType = await tx.leave_types.findUnique({
      where: { id: request.leave_type_id },
    });
    if (!leaveType?.deduct_quota) return;
    const balance = await this.balanceFor(
      tx,
      request.employee_id,
      request.leave_type_id,
      request.start_date,
    );
    if (!balance) return;
    const released = Math.max(0, Number(balance.pending_days) - Number(request.total_days));
    await tx.leave_balances.update({
      where: { id: balance.id },
      data: { pending_days: new Prisma.Decimal(released) },
    });
  }

  /**
   * Post-approval effects (BRD BP-04): debit the balance, record the ledger,
   * and stamp attendance_daily rows for each leave day.
   */
  private async applyApprovedEffects(
    tx: Tx,
    request: {
      id: string;
      employee_id: string;
      leave_type_id: string;
      start_date: Date;
      leave_type: { code: string; deduct_quota: boolean };
    },
  ) {
    if (request.leave_type.deduct_quota) {
      const req = await tx.leave_requests.findUnique({ where: { id: request.id } });
      const balance = await this.balanceFor(
        tx,
        request.employee_id,
        request.leave_type_id,
        request.start_date,
      );
      if (balance && req) {
        const used = balance.used_days.plus(req.total_days);
        const pending = Math.max(0, Number(balance.pending_days) - Number(req.total_days));
        const balanceDays = balance.balance_days.minus(req.total_days);
        await tx.leave_balances.update({
          where: { id: balance.id },
          data: {
            used_days: used,
            pending_days: new Prisma.Decimal(pending),
            balance_days: balanceDays,
          },
        });
        await tx.leave_balance_ledger.create({
          data: {
            leave_balance_id: balance.id,
            entry_type: 'USE',
            days: req.total_days,
            reference_type: 'LEAVE_REQUEST',
            reference_id: request.id,
            notes: `Cuti terpakai ${req.total_days} hari`,
          },
        });
      }
    }

    // Stamp attendance_daily for each leave day.
    const days = await tx.leave_request_days.findMany({
      where: { leave_request_id: request.id },
    });
    const code = request.leave_type.code;
    const statusCode = code === 'SAKIT' ? 'SAKIT' : code.startsWith('CUTI') ? 'CUTI' : 'IZIN';
    for (const d of days) {
      await tx.attendance_daily.upsert({
        where: {
          employee_id_work_date: {
            employee_id: request.employee_id,
            work_date: d.leave_date,
          },
        },
        create: {
          employee_id: request.employee_id,
          work_date: d.leave_date,
          status: statusCode,
          source: 'SYSTEM',
        },
        update: {}, // do not overwrite a more specific (e.g. DINAS) status
      });
    }
  }

  // -------------------------------------------------------------------------
  // APPROVAL STEP RESOLUTION
  // -------------------------------------------------------------------------

  private async resolveStepAssignee(
    tx: Tx,
    employeeId: string,
    step: { approver_type: string; approver_ref?: string | null },
  ): Promise<string | null> {
    switch (step.approver_type) {
      case 'DIRECT_SUPERVISOR': {
        const line = await tx.reporting_lines.findFirst({
          where: { employee_id: employeeId, line_type: 'DIRECT', effective_to: null },
          orderBy: { effective_from: 'desc' },
        });
        if (!line) return null;
        const user = await tx.users.findFirst({
          where: { employee_id: line.supervisor_id, status: 'ACTIVE' },
        });
        return user?.id ?? null;
      }
      case 'DIVISION_HEAD': {
        const employee = await tx.employees.findUnique({
          where: { id: employeeId },
          include: {
            job_position: { include: { department: { include: { division: true } } } },
          },
        });
        const divisionId = employee?.job_position?.department?.division?.id;
        if (!divisionId) return null;
        const head = await tx.employees.findFirst({
          where: {
            job_position: { department: { division_id: divisionId } },
            is_active: true,
          },
          include: { user: true },
        });
        return head?.user?.id ?? null;
      }
      case 'SPECIFIC_GROUP': {
        if (!step.approver_ref) return null;
        const member = await tx.users.findFirst({
          where: {
            group_memberships: { some: { group: { code: step.approver_ref, is_active: true } } },
            status: 'ACTIVE',
          },
        });
        return member?.id ?? null;
      }
      default:
        return null;
    }
  }

  /** Approximate notice window: `days` working days ahead (weekends skipped). */
  private addWorkingDays(from: Date, days: number): Date {
    const cursor = new Date(from);
    let added = 0;
    while (added < days) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      if (dow === 0 || dow === 6) continue;
      added += 1;
    }
    return cursor;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
}
