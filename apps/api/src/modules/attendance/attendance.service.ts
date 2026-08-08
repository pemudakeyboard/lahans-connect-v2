import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ParameterService } from '../../core/config/parameter.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { PayrollScopeService } from '../payroll/payroll-scope.service';
import { RosterService } from '../roster/roster.service';
import { deriveDailyFields, DerivationScheduleDay } from './attendance-derivation';
import { ClockInDto } from './dto/clock-in.dto';
import { CreateCorrectionDto } from './dto/create-correction.dto';

type Tx = Prisma.TransactionClient;

/**
 * S6 — Absensi (BRD §6.4, FR-M2-001..012).
 *
 * Owns clock-in/out with geofence, daily derivation into `attendance_daily`,
 * data-scoped daily recap, and employee self-service corrections with an
 * Atasan → Comben approval chain.
 *
 * ZERO HARDCODE: the geofence radius comes from `branch.geofence_radius_m` or
 * `ATTENDANCE.GEOFENCE_RADIUS_M` (system_parameters) via ParameterService —
 * never a literal. Schedule start/end/break/tolerance drive every derived
 * minute; the schedule itself is admin-configurable master data (work-schedules,
 * work-schedule-days, schedule-assignments), never hardcoded.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParameterService,
    private readonly scope: PayrollScopeService,
    private readonly roster: RosterService,
  ) {}

  // -------------------------------------------------------------------------
  // CLOCK-IN/OUT (FR-M2-002/006) + geofence (BR-A01..A04)
  // -------------------------------------------------------------------------

  async clock(employeeId: string, dto: ClockInDto) {
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan.');

    // FR-M2-006 idempotency: a client retrying the same clock keeps the same log.
    if (dto.client_request_id) {
      const existing = await this.prisma.attendance_logs.findUnique({
        where: { client_request_id: dto.client_request_id },
      });
      if (existing) return { log: existing, idempotent: true };
    }

    const now = new Date();
    const geofence = await this.resolveGeofence(employee.branch, dto, now);

    return this.prisma.$transaction(async (tx) => {
      // Duplicate guards (BRD §7.3 — one IN and one OUT per day).
      const todayRow = await tx.attendance_logs.findFirst({
        where: {
          employee_id: employeeId,
          server_time: { gte: this.startOfDay(now), lte: this.endOfDay(now) },
        },
        orderBy: { server_time: 'desc' },
      });
      if (dto.log_type === 'IN') {
        const alreadyIn = await tx.attendance_logs.findFirst({
          where: {
            employee_id: employeeId,
            log_type: 'IN',
            server_time: { gte: this.startOfDay(now), lte: this.endOfDay(now) },
          },
        });
        if (alreadyIn) {
          throw new ConflictException({
            code: 'ATTENDANCE_ALREADY_IN',
            message: 'Absen masuk hari ini sudah tercatat.',
          });
        }
      } else {
        if (!todayRow) {
          throw new ConflictException({
            code: 'ATTENDANCE_OUT_WITHOUT_IN',
            message: 'Belum ada absen masuk hari ini.',
          });
        }
        if (todayRow.log_type === 'OUT') {
          throw new ConflictException({
            code: 'ATTENDANCE_ALREADY_OUT',
            message: 'Absen pulang hari ini sudah tercatat.',
          });
        }
      }

      const log = await tx.attendance_logs.create({
        data: {
          employee_id: employeeId,
          log_type: dto.log_type,
          server_time: now,
          device_time: dto.device_time ? new Date(dto.device_time) : null,
          latitude: dto.latitude != null ? new Prisma.Decimal(dto.latitude).toFixed(6) : null,
          longitude: dto.longitude != null ? new Prisma.Decimal(dto.longitude).toFixed(6) : null,
          gps_accuracy_m:
            dto.gps_accuracy_m != null
              ? // toFixed width is Decimal(8,2) column precision, not a policy number.
                // eslint-disable-next-line lahans/no-magic-policy-numbers
                new Prisma.Decimal(dto.gps_accuracy_m).toFixed(2)
              : null,
          photo_url: dto.photo_url ?? null,
          branch_id: employee.branch_id,
          distance_from_geofence_m:
            geofence.distance != null
              ? // toFixed width is Decimal(10,2) column precision, not a policy number.
                // eslint-disable-next-line lahans/no-magic-policy-numbers
                new Prisma.Decimal(geofence.distance).toFixed(2)
              : null,
          is_out_of_zone: geofence.out_of_zone,
          is_mock_location: dto.is_mock_location ?? false,
          is_offline_sync: dto.is_offline_sync ?? false,
          device_id: dto.device_id ?? null,
          app_version: dto.app_version ?? null,
          raw_payload: dto.raw_payload as Prisma.InputJsonValue | undefined,
          client_request_id: dto.client_request_id ?? null,
        },
      });

      // Derive/refresh the daily row for the work date. `deriveTx` already
      // re-derives MOCK_LOCATION / OUT_OF_ZONE from its flags — only anomalies
      // without a dedicated flag are pushed here (avoid double-listing).
      const workDate = this.startOfDay(now);
      const anomalies: string[] = [];
      if (geofence.noData) anomalies.push('NO_GEOFENCE_DATA');
      await this.deriveTx(tx, employeeId, workDate, {
        is_mock_location: dto.is_mock_location ?? false,
        is_out_of_zone: geofence.out_of_zone,
        anomalyCodes: anomalies,
      });

      return { log, geofence, idempotent: false };
    });
  }

  /**
   * Geofence check (BR-A01..A04). Hard on GEOFENCE_STRICT (out-of-zone → 403),
   * soft on GEOFENCE_TRACKED (flag `is_out_of_zone` + anomaly). Missing branch
   * coords or missing GPS never blocks — we set a NO_GEOFENCE_DATA anomaly so
   * the web demo can clock without GPS (fail-open).
   */
  private async resolveGeofence(
    branch: {
      latitude: Prisma.Decimal | null;
      longitude: Prisma.Decimal | null;
      geofence_radius_m: number;
      attendance_policy: string;
    } | null,
    dto: ClockInDto,
    asOf: Date,
  ): Promise<{
    distance: number | null;
    out_of_zone: boolean;
    radius: number;
    policy: string;
    noData: boolean;
  }> {
    const policy = branch?.attendance_policy ?? 'GEOFENCE_TRACKED';
    const radius =
      branch && branch.geofence_radius_m > 0
        ? branch.geofence_radius_m
        : await this.loadNumber('ATTENDANCE.GEOFENCE_RADIUS_M', asOf);

    const hasGps = dto.latitude != null && dto.longitude != null;
    const hasBranchCoords = branch?.latitude != null && branch?.longitude != null;
    const noData = !hasGps || !hasBranchCoords;

    let distance: number | null = null;
    let out_of_zone = false;
    if (hasGps && hasBranchCoords) {
      distance = haversineMeters(
        Number(branch.latitude),
        Number(branch.longitude),
        Number(dto.latitude),
        Number(dto.longitude),
      );
      out_of_zone = distance > radius;
    }

    if (policy === 'GEOFENCE_STRICT' && out_of_zone) {
      throw new ForbiddenException({
        code: 'GEOFENCE_DENIED',
        message: `Lokasi Anda di luar radius geofence (${Math.round(distance ?? 0)} m > ${radius} m).`,
      });
    }

    return { distance, out_of_zone, radius, policy, noData };
  }

  // -------------------------------------------------------------------------
  // DAILY DERIVATION (FR-M2-001..004) — inside every clock + finalize
  // -------------------------------------------------------------------------

  /**
   * Derive (or refresh) the `attendance_daily` row for one employee+date from
   * the day's logs, the resolved schedule, and the holiday calendar. Called
   * inside every clock transaction and by `finalizeDay`.
   */
  async deriveTx(
    tx: Tx,
    employeeId: string,
    date: Date,
    flags?: { is_mock_location?: boolean; is_out_of_zone?: boolean; anomalyCodes?: string[] },
  ) {
    // Freeze guard: a day stamped by leave/overtime approval (CUTI/SAKIT/IZIN/
    // LIBUR/DINAS) or by an approved correction (source=MANUAL) is never
    // overwritten by clock/finalize derivation — a manual override is the
    // source of truth once it exists (mirrors leave `update:{}` stamp semantics).
    const existing = await tx.attendance_daily.findUnique({
      where: { employee_id_work_date: { employee_id: employeeId, work_date: date } },
    });
    if (
      existing &&
      (['CUTI', 'SAKIT', 'IZIN', 'LIBUR', 'DINAS'].includes(existing.status) ||
        existing.source === 'MANUAL')
    ) {
      return existing;
    }

    const logs = await tx.attendance_logs.findMany({
      where: {
        employee_id: employeeId,
        server_time: { gte: date, lte: this.endOfDay(date) },
      },
      orderBy: { server_time: 'asc' },
    });
    const firstIn = logs.find((l) => l.log_type === 'IN')?.server_time ?? null;
    const lastOut = [...logs].reverse().find((l) => l.log_type === 'OUT')?.server_time ?? null;

    const scheduleDay = await this.resolveScheduleDay(tx, employeeId, date);
    const isHoliday = await this.isHoliday(tx, date);
    const isPast = date.getTime() < this.startOfDay(new Date()).getTime();

    const anomalies = [...(flags?.anomalyCodes ?? [])];
    if (flags?.is_mock_location) anomalies.push('MOCK_LOCATION');
    if (flags?.is_out_of_zone) anomalies.push('OUT_OF_ZONE');

    const result = deriveDailyFields({
      date,
      scheduleDay,
      isHoliday,
      firstIn,
      lastOut,
      hasAnyLog: logs.length > 0,
      isPast,
      anomalyCodes: anomalies,
    });

    return tx.attendance_daily.upsert({
      where: { employee_id_work_date: { employee_id: employeeId, work_date: date } },
      create: {
        employee_id: employeeId,
        work_date: date,
        schedule_id: scheduleDay?.scheduleId ?? null,
        first_in_at: firstIn,
        last_out_at: lastOut,
        status: result.status,
        late_minutes: result.late_minutes,
        early_leave_minutes: result.early_leave_minutes,
        work_minutes: result.work_minutes,
        overtime_minutes: result.overtime_minutes,
        is_anomaly: result.is_anomaly,
        anomaly_reasons: (result.anomaly_reasons ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      },
      update: {
        schedule_id: scheduleDay?.scheduleId ?? null,
        first_in_at: firstIn,
        last_out_at: lastOut,
        status: result.status,
        late_minutes: result.late_minutes,
        early_leave_minutes: result.early_leave_minutes,
        work_minutes: result.work_minutes,
        overtime_minutes: result.overtime_minutes,
        is_anomaly: result.is_anomaly,
        anomaly_reasons: (result.anomaly_reasons ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Resolve the employee's schedule for a date. M2B: delegates to the shared
   * roster resolver (5-level priority individu > jabatan > golongan > cabang >
   * entitas, SHIFT rotation, night-shift rollover) so a roster change is
   * honored here too. Runs on the transaction client so clock/finalize stay
   * atomic.
   */
  private async resolveScheduleDay(
    tx: Tx,
    employeeId: string,
    date: Date,
  ): Promise<(DerivationScheduleDay & { scheduleId: string | null }) | null> {
    return this.roster.resolveWorkSchedule(employeeId, date, tx);
  }

  private async isHoliday(tx: Tx, date: Date): Promise<boolean> {
    const h = await tx.holidays.findFirst({
      where: { date: { gte: this.startOfDay(date), lte: this.endOfDay(date) }, is_active: true },
    });
    return h != null;
  }

  // -------------------------------------------------------------------------
  // LIST / TODAY / FINALIZE (FR-M2-008..010, data-scoped)
  // -------------------------------------------------------------------------

  /** Scoped daily recap — a Comben/HCGA user sees only their division/branch. */
  async listDaily(
    user: CurrentUser,
    query: { page?: number; pageSize?: number; from?: string; to?: string; employeeId?: string },
  ) {
    const empWhere = await this.scope.employeeWhere(user, 'attendance.daily.read');
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.attendance_dailyWhereInput = { employee: empWhere };
    if (query.from) where.work_date = { ...(where.work_date as object), gte: new Date(query.from) };
    if (query.to) where.work_date = { ...(where.work_date as object), lte: new Date(query.to) };
    if (query.employeeId) {
      // Optional filter must be inside the caller's scope (enforcement, not UI).
      const inScope = await this.prisma.employees.findFirst({
        where: { id: query.employeeId, ...empWhere },
        select: { id: true },
      });
      if (!inScope) {
        throw new ForbiddenException({
          code: 'ATTENDANCE_SCOPE',
          message: 'Karyawan di luar cakupan Anda.',
        });
      }
      where.employee_id = query.employeeId;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendance_daily.count({ where }),
      this.prisma.attendance_daily.findMany({
        where,
        orderBy: [{ work_date: 'desc' }, { employee: { nik: 'asc' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { employee: { select: { nik: true, full_name: true } } },
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  /** Today card for the web demo: daily row, last log, schedule window, geofence. */
  async today(user: CurrentUser) {
    if (!user.employeeId) throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    const employeeId = user.employeeId;
    const now = new Date();
    const workDate = this.startOfDay(now);
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: { branch: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan.');

    const [daily, lastLog, logs] = await Promise.all([
      this.prisma.attendance_daily.findUnique({
        where: { employee_id_work_date: { employee_id: employeeId, work_date: workDate } },
      }),
      this.prisma.attendance_logs.findFirst({
        where: { employee_id: employeeId, server_time: { gte: workDate, lte: this.endOfDay(now) } },
        orderBy: { server_time: 'desc' },
      }),
      this.prisma.attendance_logs.findMany({
        where: { employee_id: employeeId, server_time: { gte: workDate, lte: this.endOfDay(now) } },
        orderBy: { server_time: 'asc' },
      }),
    ]);

    const scheduleDay = await this.resolveScheduleDay(
      this.prisma as unknown as Tx,
      employeeId,
      now,
    );
    const radius =
      employee.branch && employee.branch.geofence_radius_m > 0
        ? employee.branch.geofence_radius_m
        : await this.loadNumber('ATTENDANCE.GEOFENCE_RADIUS_M', now);

    return {
      date: workDate.toISOString().slice(0, 10),
      daily,
      lastLog,
      logs,
      schedule: scheduleDay,
      geofence: {
        radius,
        policy: employee.branch?.attendance_policy ?? 'GEOFENCE_TRACKED',
        branchLatitude: employee.branch?.latitude?.toString() ?? null,
        branchLongitude: employee.branch?.longitude?.toString() ?? null,
      },
    };
  }

  /** COMBEN end-of-day run: re-derive every scoped employee's daily row. */
  async finalizeDay(user: CurrentUser, date: string, employeeId?: string) {
    const empWhere = await this.scope.employeeWhere(user, 'attendance.daily.write');
    const target = this.startOfDay(new Date(date));
    if (Number.isNaN(target.getTime())) throw new BadRequestException('Tanggal tidak valid.');

    let emps: { id: string }[] = [];
    if (employeeId) {
      const inScope = await this.prisma.employees.findFirst({
        where: { id: employeeId, ...empWhere },
        select: { id: true },
      });
      if (!inScope) {
        throw new ForbiddenException({
          code: 'ATTENDANCE_SCOPE',
          message: 'Karyawan di luar cakupan Anda.',
        });
      }
      emps = [{ id: employeeId }];
    } else {
      emps = await this.prisma.employees.findMany({
        where: { ...empWhere, is_active: true },
        select: { id: true },
      });
    }

    let finalized = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const e of emps) {
        await this.deriveTx(tx, e.id, target);
        finalized++;
      }
    });
    return { date: target.toISOString().slice(0, 10), finalized };
  }

  // -------------------------------------------------------------------------
  // CORRECTIONS — self-service with Atasan → Comben approval (FR-M2-012)
  // -------------------------------------------------------------------------

  async createCorrection(employeeId: string, actorId: string, dto: CreateCorrectionDto) {
    const daily = await this.prisma.attendance_daily.findUnique({
      where: { id: dto.attendance_daily_id },
    });
    if (!daily) throw new NotFoundException('Rekap kehadiran tidak ditemukan.');
    if (daily.employee_id !== employeeId) {
      throw new ForbiddenException('Anda hanya dapat mengoreksi kehadiran sendiri.');
    }

    // FR-M2-012: a day inside a CLOSED payroll period cannot be corrected.
    if (daily.payroll_period_id) {
      const period = await this.prisma.payroll_periods.findUnique({
        where: { id: daily.payroll_period_id },
      });
      if (period?.status === 'CLOSED') {
        throw new ConflictException({
          code: 'ATTENDANCE_PERIOD_CLOSED',
          message: 'Periode penggajian sudah ditutup; koreksi kehadiran tidak dapat diajukan.',
        });
      }
    }

    // Reason must exist in reference_data (no frontend arrays).
    const reason = await this.prisma.reference_data.findFirst({
      where: { category: 'ATTENDANCE_CORRECTION_REASON', code: dto.reason_code },
    });
    if (!reason) {
      throw new BadRequestException({
        code: 'CORRECTION_REASON_INVALID',
        message: `Alasan koreksi tidak dikenal: ${dto.reason_code}`,
      });
    }

    const workflow = await this.prisma.approval_workflows.findUnique({
      where: { code: 'ATTENDANCE_CORRECTION' },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.attendance_corrections.create({
        data: {
          attendance_daily_id: daily.id,
          requested_by: actorId,
          reason_code: dto.reason_code,
          notes: dto.notes ?? null,
          proposed_values: dto.proposed_values as unknown as Prisma.InputJsonValue | undefined,
          status: 'PENDING',
        },
      });

      let approval_instance_id: string | null = null;
      if (workflow) {
        const instance = await tx.approval_instances.create({
          data: {
            workflow_id: workflow.id,
            workflow_version: workflow.version,
            document_type: 'ATTENDANCE_CORRECTION',
            document_id: correction.id,
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

      return tx.attendance_corrections.update({
        where: { id: correction.id },
        data: { approval_instance_id },
      });
    });
  }

  async listMyCorrections(employeeId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    // attendance_corrections has no Prisma relations (plain UUID FKs), so scope
    // by joining the daily row's employee_id via a where-in on daily ids.
    const myDaily = await this.prisma.attendance_daily.findMany({
      where: { employee_id: employeeId },
      select: { id: true },
    });
    const dailyIds = myDaily.map((d) => d.id);
    const where: Prisma.attendance_correctionsWhereInput =
      dailyIds.length > 0 ? { attendance_daily_id: { in: dailyIds } } : { id: '__none__' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendance_corrections.count({ where }),
      this.prisma.attendance_corrections.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  /** Approval inbox for corrections assigned to the user (Atasan/Comben). */
  async listCorrectionInbox(userId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.approval_instancesWhereInput = {
      document_type: 'ATTENDANCE_CORRECTION',
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
    const ids = rows.map((r) => r.document_id);
    const corrections = await this.prisma.attendance_corrections.findMany({
      where: { id: { in: ids } },
    });
    // attendance_corrections has no relations — enrich with the daily + employee
    // via a second query keyed on the plain FKs.
    const dailyIds = corrections.map((c) => c.attendance_daily_id);
    const dailies = dailyIds.length
      ? await this.prisma.attendance_daily.findMany({
          where: { id: { in: dailyIds } },
        })
      : [];
    const empIds = dailies.map((d) => d.employee_id);
    const emps = empIds.length
      ? await this.prisma.employees.findMany({
          where: { id: { in: empIds } },
          select: { id: true, full_name: true, nik: true },
        })
      : [];
    const empById = new Map(emps.map((e) => [e.id, e]));
    const dailyById = new Map(dailies.map((d) => [d.id, d]));
    const byId = new Map(
      corrections.map((c) => [
        c.id,
        {
          ...c,
          attendance_daily: (() => {
            const d = dailyById.get(c.attendance_daily_id);
            return d ? { ...d, employee: empById.get(d.employee_id) ?? null } : null;
          })(),
        },
      ]),
    );
    return {
      total,
      page,
      pageSize,
      rows: rows.map((r) => ({ ...r, correction: byId.get(r.document_id) ?? null })),
    };
  }

  /** Decide a correction step (mirror of overtime.decide, no feeder write). */
  async decideCorrection(
    id: string,
    actorId: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    comment?: string,
  ) {
    const correction = await this.prisma.attendance_corrections.findUnique({ where: { id } });
    if (!correction) throw new NotFoundException('Koreksi kehadiran tidak ditemukan.');
    if (correction.status !== 'PENDING') {
      throw new ConflictException('Koreksi ini sudah diputuskan.');
    }
    if (!correction.approval_instance_id) {
      throw new ConflictException('Koreksi ini tidak memiliki alur approval.');
    }

    const instance = await this.prisma.approval_instances.findUnique({
      where: { id: correction.approval_instance_id },
      include: { tasks: { orderBy: { step_order: 'asc' } } },
    });
    if (!instance) throw new NotFoundException('Instansi approval tidak ditemukan.');

    const currentTask = instance.tasks.find(
      (t) => t.step_order === instance.current_step_order && t.status === 'PENDING',
    );
    if (!currentTask || currentTask.assignee_user_id !== actorId) {
      throw new ForbiddenException('Bukan giliran Anda untuk memutuskan koreksi ini.');
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
        await tx.attendance_corrections.update({
          where: { id },
          data: { status: newStatus },
        });
        return { id, status: newStatus };
      }

      // APPROVE: advance, or finalize → apply the corrected values (FR-M2-012).
      const nextStep = instance.tasks.find((t) => t.step_order > instance.current_step_order);
      if (nextStep) {
        const stepDef = await tx.approval_workflow_steps.findUnique({
          where: {
            workflow_id_step_order: {
              workflow_id: instance.workflow_id,
              step_order: nextStep.step_order,
            },
          },
        });
        const assignee = stepDef
          ? await this.resolveStepAssignee(tx, correction.requested_by, {
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

      await tx.approval_instances.update({
        where: { id: instance.id },
        data: { status: 'APPROVED', completed_at: new Date() },
      });
      const daily = await tx.attendance_daily.findUnique({
        where: { id: correction.attendance_daily_id },
      });
      if (daily) {
        const pv = (correction.proposed_values ?? {}) as Record<string, unknown>;
        await tx.attendance_daily.update({
          where: { id: daily.id },
          data: {
            first_in_at: pv.first_in_at ? new Date(String(pv.first_in_at)) : daily.first_in_at,
            last_out_at: pv.last_out_at ? new Date(String(pv.last_out_at)) : daily.last_out_at,
            status: typeof pv.status === 'string' ? (pv.status as string) : daily.status,
            late_minutes:
              typeof pv.late_minutes === 'number' ? pv.late_minutes : daily.late_minutes,
            early_leave_minutes:
              typeof pv.early_leave_minutes === 'number'
                ? pv.early_leave_minutes
                : daily.early_leave_minutes,
            work_minutes:
              typeof pv.work_minutes === 'number' ? pv.work_minutes : daily.work_minutes,
            source: 'MANUAL',
            is_anomaly: false,
            anomaly_reasons: Prisma.JsonNull as unknown as Prisma.InputJsonValue,
          },
        });
      }
      await tx.attendance_corrections.update({
        where: { id },
        data: { status: 'APPROVED' },
      });
      return { id, status: 'APPROVED' };
    });
  }

  async cancelCorrection(id: string, actorId: string) {
    const correction = await this.prisma.attendance_corrections.findUnique({ where: { id } });
    if (!correction) throw new NotFoundException('Koreksi kehadiran tidak ditemukan.');
    if (correction.requested_by !== actorId) {
      throw new ForbiddenException('Anda hanya dapat membatalkan koreksi sendiri.');
    }
    if (!['PENDING', 'RETURNED'].includes(correction.status)) {
      throw new ConflictException('Hanya koreksi PENDING/RETURNED yang dapat dibatalkan.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.attendance_corrections.update({ where: { id }, data: { status: 'CANCELED' } });
      if (correction.approval_instance_id) {
        await tx.approval_instances.update({
          where: { id: correction.approval_instance_id },
          data: { status: 'CANCELED', completed_at: new Date() },
        });
      }
      return { id, status: 'CANCELED' };
    });
  }

  // -------------------------------------------------------------------------
  // INTERNAL helpers
  // -------------------------------------------------------------------------

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

  /**
   * Work-day boundaries in the app's canonical timezone (Asia/Jakarta, UTC+7).
   * `work_date` is stored as UTC midnight of the Indonesian day — the same
   * convention used by the seed + payroll cutoff boundaries — so a clock at
   * 2026-08-08T01:00Z (08:00 WIB) derives into work_date 2026-08-08T00:00Z.
   */
  private startOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private endOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }
}

/** Great-circle distance in meters (not a policy number — earth radius). */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}
