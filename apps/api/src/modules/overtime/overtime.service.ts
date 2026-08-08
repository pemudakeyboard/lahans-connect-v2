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
import { TemporalResolver } from '../../core/temporal/temporal-resolver';
import { ConfigService } from '../config/config.service';
import { CalculationTraceBuilder } from '../../core/rules/calculation-trace';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';

type Tx = Prisma.TransactionClient;

/**
 * S8-M3 — Lembur (BR-C05 / Tintin Compensation & Benefit "LEMBUR & ABSEN").
 *
 * Owns the overtime lifecycle: pengajuan, day-type classification, rate-rule
 * resolution, calculation with trace, approval, and the payroll-feeder handoff.
 *
 * Domain rules (source doc "LEMBUR & ABSEN"):
 *  - GAJI POKOK ÷ 173 × multiplier × hours. The divisor is read from
 *    `PAYROLL.ABSENCE_DIVISOR` (a system_parameters row), never a literal.
 *  - NON-STAFF & STAFF: ×2 on holidays (libur/tanggal merah), ×1 on weekdays.
 *  - SPV: ×1 on all day types.
 *  - MANAGER: no overtime (calc_method NONE).
 *  - A flat-per-day rule (150.000/hari) exists for some grades — the rate rule
 *    drives whether HOURLY_DIVISOR, FLAT_PER_DAY, or NONE applies.
 *  - Approval chain: Atasan → Division Head (approval_workflows.code=OVERTIME).
 *  - Every calculated amount carries a CalculationTrace (BRD §13 rule 5).
 *
 * ZERO HARDCODE: all policy numbers come from system_parameters via
 * ParameterService.resolve(key, asOf) — no literals for 173, 2, 150000, ...
 */
@Injectable()
export class OvertimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParameterService,
    private readonly temporal: TemporalResolver,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // PENGAJUAN — create a request (calculation is previewed, applied on approval)
  // -------------------------------------------------------------------------

  async create(employeeId: string, actorId: string, dto: CreateOvertimeRequestDto) {
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: { branch: true, job_grade: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan.');
    if (!employee.job_grade_id) {
      throw new ConflictException({
        code: 'OT_GRADE_MISSING',
        message: 'Karyawan belum memiliki golongan (job_grade). Lembur tidak dapat dihitung.',
      });
    }

    const overtimeDate = new Date(dto.overtime_date);
    if (Number.isNaN(overtimeDate.getTime())) {
      throw new BadRequestException('Tanggal lembur tidak valid.');
    }
    // Lembur is always in the future (or today) — never backdated unless overridden.
    const now = new Date();
    if (overtimeDate.getTime() < now.setHours(0, 0, 0, 0)) {
      throw new ConflictException({
        code: 'OT_BACKDATE',
        message: 'Lembur tidak dapat diajukan untuk tanggal yang sudah lewat.',
      });
    }

    // -- Day-type classification (WEEKDAY | WEEKEND | NATIONAL_HOLIDAY | JOINT_HOLIDAY)
    const dayType = await this.classifyDayType(overtimeDate);

    // -- Rate rule effective on the overtime date (ZERO HARDCODE: rule-driven)
    const rule = await this.temporal.findActive<{
      id: string;
      calc_method: string;
      divisor: number | null;
      multiplier: Prisma.Decimal | null;
      flat_amount: Prisma.Decimal | null;
      max_hours_per_day: number | null;
      effective_from: Date;
      effective_to: Date | null;
    }>('overtime_rate_rules', overtimeDate, {
      job_grade_id: employee.job_grade_id,
      day_type: dayType,
    });
    if (!rule) {
      throw new ConflictException({
        code: 'OT_RULE_MISSING',
        message: `Tidak ada aturan lembur untuk ${employee.job_grade?.name ?? 'golongan ini'} pada ${dayType}.`,
      });
    }

    // -- Max hours per day guard
    if (rule.max_hours_per_day != null && dto.planned_hours > rule.max_hours_per_day) {
      throw new ConflictException({
        code: 'OT_MAX_HOURS_EXCEEDED',
        message: `Maksimum ${rule.max_hours_per_day} jam lembur per hari untuk golongan ini.`,
      });
    }

    // -- Preview the calculation (trace built now; final calc re-runs on approval
    //    with actual_hours).
    const preview = await this.calculate(
      employeeId,
      overtimeDate,
      dayType,
      rule,
      dto.planned_hours,
    );

    // -- Doc number + workflow
    const { nextNumber } = await this.config.reserveNextNumber('DOC_OVERTIME', {
      scopeType: 'BRANCH',
      scopeRefId: employee.branch_id ?? undefined,
    });
    const workflow = await this.prisma.approval_workflows.findUnique({
      where: { code: 'OVERTIME' },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.overtime_requests.create({
        data: {
          doc_number: nextNumber,
          employee_id: employeeId,
          overtime_date: overtimeDate,
          day_type: dayType,
          planned_start: undefined,
          planned_end: undefined,
          planned_hours: new Prisma.Decimal(dto.planned_hours),
          actual_hours: null,
          rate_rule_id: rule.id,
          calculated_amount: preview.calculated_amount,
          calculation_trace: preview.trace as unknown as Prisma.InputJsonValue,
          reason: dto.reason,
          status: 'PENDING',
        },
      });

      // Approval instance (OVERTIME: Atasan → Division Head)
      let approval_instance_id: string | null = null;
      if (workflow) {
        const instance = await tx.approval_instances.create({
          data: {
            workflow_id: workflow.id,
            workflow_version: workflow.version,
            document_type: 'OVERTIME_REQUEST',
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

      return tx.overtime_requests.update({
        where: { id: created.id },
        data: { approval_instance_id },
      });
    });

    return {
      ...request,
      day_type: dayType,
      preview_amount: preview.calculated_amount?.toString() ?? null,
      trace: preview.trace,
    };
  }

  // -------------------------------------------------------------------------
  // LIST / APPROVAL
  // -------------------------------------------------------------------------

  async listMyRequests(employeeId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.overtime_requests.count({ where: { employee_id: employeeId } }),
      this.prisma.overtime_requests.findMany({
        where: { employee_id: employeeId },
        orderBy: { created_at: 'desc' },
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
      document_type: 'OVERTIME_REQUEST',
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
    const requests = await this.prisma.overtime_requests.findMany({
      where: { id: { in: ids } },
      include: { employee: { select: { full_name: true, nik: true } } },
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
   * request flips to APPROVED and the calculated amount is written to the
   * payroll feeder (LEMBUR row) for the payroll period containing the overtime.
   */
  async decide(
    id: string,
    actorId: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    comment?: string,
    actualHours?: number,
  ) {
    const request = await this.prisma.overtime_requests.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Pengajuan lembur tidak ditemukan.');
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
        await tx.overtime_requests.update({
          where: { id },
          data: { status: newStatus },
        });
        return { id, status: newStatus };
      }

      // APPROVE: advance to the next step, or finalize.
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

      // All steps approved → finalize: re-calculate with actual_hours (or keep
      // planned when none given) and write the payroll feeder line.
      const finalHours = actualHours ?? Number(request.planned_hours ?? 0);
      const rule = await this.temporal.findActive<{
        id: string;
        calc_method: string;
        divisor: number | null;
        multiplier: Prisma.Decimal | null;
        flat_amount: Prisma.Decimal | null;
        max_hours_per_day: number | null;
        effective_from: Date;
        effective_to: Date | null;
      }>('overtime_rate_rules', request.overtime_date, {
        job_grade_id: request.employee_id
          ? await this.employeeGrade(tx, request.employee_id)
          : undefined,
        day_type: request.day_type,
      });

      const calc = rule
        ? await this.calculate(
            request.employee_id,
            request.overtime_date,
            request.day_type,
            rule,
            finalHours,
          )
        : { calculated_amount: null, trace: null, formula: 'NONE' };

      await tx.approval_instances.update({
        where: { id: instance.id },
        data: { status: 'APPROVED', completed_at: new Date() },
      });
      await tx.overtime_requests.update({
        where: { id },
        data: {
          status: 'APPROVED',
          actual_hours: new Prisma.Decimal(finalHours),
          calculated_amount: calc.calculated_amount,
          calculation_trace: (calc.trace ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        },
      });

      // Payroll feeder handoff (LEMBUR component) for the payroll period that
      // contains the overtime date.
      await this.writeFeeder(tx, request.employee_id, request.overtime_date, {
        hours: finalHours,
        amount: calc.calculated_amount,
        trace: calc.trace,
        referenceId: request.id,
      });

      return { id, status: 'APPROVED', amount: calc.calculated_amount?.toString() ?? null };
    });
  }

  async cancel(id: string, _actorId: string) {
    const request = await this.prisma.overtime_requests.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Pengajuan lembur tidak ditemukan.');
    if (!['PENDING', 'RETURNED'].includes(request.status)) {
      throw new ConflictException('Hanya pengajuan PENDING/RETURNED yang dapat dibatalkan.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.overtime_requests.update({ where: { id }, data: { status: 'CANCELED' } });
      if (request.approval_instance_id) {
        await tx.approval_instances.update({
          where: { id: request.approval_instance_id },
          data: { status: 'CANCELED', completed_at: new Date() },
        });
      }
      return { id, status: 'CANCELED' };
    });
  }

  // -------------------------------------------------------------------------
  // CALCULATION — the provable number (trace mandatory)
  // -------------------------------------------------------------------------

  /**
   * Compute the overtime amount for one request.
   *
   *   HOURLY_DIVISOR:  gaji_pokok ÷ divisor × multiplier × hours
   *   FLAT_PER_DAY:    flat_amount × days (nights/spills across dates await M)
   *   NONE:            zero (Manager grade — no overtime entitlement)
   *
   * The trace records rule id, divisor source, inputs, and each intermediate
   * step so the number survives the "prove this Rupiah" question (Persona 2).
   */
  private async calculate(
    employeeId: string,
    overtimeDate: Date,
    dayType: string,
    rule: {
      id: string;
      calc_method: string;
      divisor: number | null;
      multiplier: Prisma.Decimal | null;
      flat_amount: Prisma.Decimal | null;
      effective_from: Date;
      effective_to: Date | null;
    },
    hours: number,
  ): Promise<{ calculated_amount: Prisma.Decimal | null; trace: object | null; formula: string }> {
    const trace = new CalculationTraceBuilder()
      .formulaName(`OT_${dayType}`)
      .rule(rule.id, rule.effective_from.toISOString())
      .input('hours', hours)
      .input('day_type', dayType);

    switch (rule.calc_method) {
      case 'HOURLY_DIVISOR': {
        const divisor =
          rule.divisor ?? (await this.loadNumber('PAYROLL.ABSENCE_DIVISOR', overtimeDate));
        const basicSalary = await this.basicSalary(employeeId, overtimeDate);
        if (basicSalary == null) {
          throw new ConflictException({
            code: 'OT_SALARY_MISSING',
            message:
              'Gaji pokok belum dikonfigurasi untuk karyawan ini. Lembur tidak dapat dihitung.',
          });
        }
        const multiplier = rule.multiplier ? Number(rule.multiplier) : 1;
        const hourlyRate = basicSalary / divisor;
        const amount = hourlyRate * multiplier * hours;
        // toFixed width is display precision, not a policy number.
        // eslint-disable-next-line lahans/no-magic-policy-numbers
        const r2 = (n: number) => n.toFixed(2);
        const rateStr = r2(hourlyRate);
        const multStr = r2(hourlyRate * multiplier);
        const amountStr = r2(amount);
        trace
          .input('basic_salary', basicSalary)
          .input('divisor', divisor)
          .input('multiplier', multiplier)
          .step('gaji_pokok ÷ divisor', `${basicSalary} ÷ ${divisor}`, rateStr)
          .step('× multiplier', `${rateStr} × ${multiplier}`, multStr)
          .step('× hours', `${multStr} × ${hours}`, amountStr);
        return {
          calculated_amount: new Prisma.Decimal(r2(amount)),
          trace: trace.build(r2(amount)),
          formula: 'HOURLY_DIVISOR',
        };
      }
      case 'FLAT_PER_DAY': {
        const flat = rule.flat_amount ? Number(rule.flat_amount) : 0;
        const days = 1; // single-day overtime; multi-day spans are per-request
        const amount = flat * days;
        // toFixed width is display precision, not a policy number.
        // eslint-disable-next-line lahans/no-magic-policy-numbers
        const r2 = (n: number) => n.toFixed(2);
        trace
          .input('flat_amount', flat)
          .input('days', days)
          .step('flat_amount × days', `${flat} × ${days}`, r2(amount));
        return {
          calculated_amount: new Prisma.Decimal(r2(amount)),
          trace: trace.build(r2(amount)),
          formula: 'FLAT_PER_DAY',
        };
      }
      case 'NONE':
      default:
        return {
          calculated_amount: null,
          trace: trace.build(0),
          formula: 'NONE',
        };
    }
  }

  // -------------------------------------------------------------------------
  // INTERNAL — helpers
  // -------------------------------------------------------------------------

  /** Classify a calendar date into the rate-rule day_type. */
  private async classifyDayType(date: Date): Promise<string> {
    const holiday = await this.prisma.holidays.findFirst({
      where: { date: { gte: this.startOfDay(date), lte: this.endOfDay(date) }, is_active: true },
    });
    if (holiday) {
      return holiday.holiday_type === 'JOINT_LEAVE' ? 'JOINT_HOLIDAY' : 'NATIONAL_HOLIDAY';
    }
    const dow = date.getDay();
    return dow === 0 || dow === 6 ? 'WEEKEND' : 'WEEKDAY';
  }

  /** Basic salary (BASIC_SALARY component) effective on asOf. */
  private async basicSalary(employeeId: string, asOf: Date): Promise<number | null> {
    const component = await this.prisma.payroll_components.findUnique({
      where: { code: 'BASIC_SALARY' },
    });
    if (!component) return null;
    const assignment = await this.temporal.findActive<
      { amount: Prisma.Decimal | null } & {
        effective_from: Date;
        effective_to: Date | null;
      }
    >('employee_component_assignments', asOf, {
      employee_id: employeeId,
      payroll_component_id: component.id,
    });
    return assignment?.amount ? Number(assignment.amount) : null;
  }

  private async employeeGrade(tx: Tx, employeeId: string): Promise<string | undefined> {
    const emp = await tx.employees.findUnique({
      where: { id: employeeId },
      select: { job_grade_id: true },
    });
    return emp?.job_grade_id ?? undefined;
  }

  /** Read a policy number from system_parameters (fail-fast on missing). */
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
   * Write the LEMBRU payroll feeder line for the period containing the overtime
   * date. No period → skip (the payroll is likely not opened yet); the approved
   * request itself remains the source of truth.
   */
  private async writeFeeder(
    tx: Tx,
    employeeId: string,
    overtimeDate: Date,
    data: {
      hours: number;
      amount: Prisma.Decimal | null;
      trace: object | null;
      referenceId: string;
    },
  ) {
    const period = await tx.payroll_periods.findFirst({
      where: {
        cutoff_start: { lte: overtimeDate },
        cutoff_end: { gte: overtimeDate },
      },
    });
    // M6: only an OPEN period may receive feeder writes — a LOCKED/CLOSED
    // period is frozen (BRD §11.4). Skip silently: the approved request itself
    // remains the source of truth, and the next aggregation re-reads it.
    if (!period || period.status !== 'OPEN') return;
    await tx.payroll_feeder_lines.create({
      data: {
        payroll_period_id: period.id,
        employee_id: employeeId,
        component_code: 'LEMBUR',
        quantity: new Prisma.Decimal(data.hours),
        amount: data.amount,
        calculation_trace: (data.trace ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      },
    });
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

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
}
