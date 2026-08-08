import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { ParameterService } from '../../core/config/parameter.service';
import { CalculationTraceBuilder } from '../../core/rules/calculation-trace';

type Tx = Prisma.TransactionClient;

/**
 * M6 — Feeder aggregation engine (BRD §11.4 UAT-M6-01).
 *
 * Computes the per-employee payroll feeder lines for one payroll period:
 *   - BASIC_SALARY         assignment.amount (FIXED)
 *   - TUNJANGAN_MAKAN      rate × paid_days
 *   - TUNJANGAN_TRANSPORT  rate × paid_days
 *   - TUNJANGAN_KEHADIRAN  base × ladder% (absence-days bucket)
 *   - POTONGAN_IZIN        −(GP ÷ 25) × izin_days  (DEDUCTION)
 *   - LEMBUR               Σ approved overtime_requests.calculated_amount
 *
 * Idempotency: DELETE-then-recreate non-manual lines for the scoped employees;
 * manual overrides (is_manual_override=true) are preserved. All temporal reads
 * use cutoff_end as asOf (UAT-M6-04/05 structural).
 *
 * ZERO HARDCODE: the izin divisor comes from `PAYROLL.ABSENCE_MINUTES_DIVISOR`
 * via ParameterService — never a literal.
 */
@Injectable()
export class PayrollAggregator {
  constructor(private readonly params: ParameterService) {}

  /**
   * Aggregate the 6 components for `employeeIds` into the period's feeder.
   * Runs inside the caller's transaction (period lock/close).
   */
  async aggregate(
    tx: Tx,
    period: { id: string; cutoff_start: Date; cutoff_end: Date },
    employeeIds: string[],
  ): Promise<{ employeeCount: number; lineCount: number }> {
    if (employeeIds.length === 0) {
      return { employeeCount: 0, lineCount: 0 };
    }

    const start = period.cutoff_start;
    const end = period.cutoff_end;

    // -- Batch load (8 queries, employee-count-independent -> NFR 300 rows ≪ 60 s)
    const employees = await tx.employees.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        nik: true,
        full_name: true,
        job_grade: { select: { code: true } },
        job_position: { select: { attendance_rule_set: true } },
      },
    });
    const daily = await tx.attendance_daily.findMany({
      where: { employee_id: { in: employeeIds }, work_date: { gte: start, lte: end } },
      select: { employee_id: true, status: true },
    });
    const overtime = await tx.overtime_requests.findMany({
      where: {
        employee_id: { in: employeeIds },
        status: 'APPROVED',
        overtime_date: { gte: start, lte: end },
      },
      select: {
        id: true,
        employee_id: true,
        overtime_date: true,
        planned_hours: true,
        actual_hours: true,
        calculated_amount: true,
        calculation_trace: true,
      },
    });

    // Allowance rule ladder effective at cutoff_end.
    const ruleRows = await tx.attendance_allowance_rules.findMany({
      where: {
        effective_from: { lte: end },
        OR: [{ effective_to: null }, { effective_to: { gte: end } }],
      },
      select: {
        id: true,
        rule_set_code: true,
        absence_days_min: true,
        absence_days_max: true,
        percentage: true,
        effective_from: true,
      },
    });

    // Component assignments effective at cutoff_end (per component).
    const componentCodes = [
      'BASIC_SALARY',
      'TUNJANGAN_MAKAN',
      'TUNJANGAN_TRANSPORT',
      'TUNJANGAN_KEHADIRAN',
    ] as const;
    const components = await tx.payroll_components.findMany({
      where: { code: { in: [...componentCodes] }, is_active: true },
      select: { id: true, code: true, calc_method: true },
    });
    const compByCode = new Map(components.map((c) => [c.code, c]));
    const assigRows = await tx.employee_component_assignments.findMany({
      where: {
        employee_id: { in: employeeIds },
        payroll_component_id: { in: components.map((c) => c.id) },
        effective_from: { lte: end },
        OR: [{ effective_to: null }, { effective_to: { gte: end } }],
      },
      select: {
        id: true,
        employee_id: true,
        payroll_component_id: true,
        amount: true,
        qty: true,
        effective_from: true,
      },
    });

    // -- Group by employee, keep the latest effective_from per component.
    const assignByEmp = new Map<string, Map<string, (typeof assigRows)[number]>>();
    for (const a of assigRows) {
      if (!assignByEmp.has(a.employee_id)) assignByEmp.set(a.employee_id, new Map());
      const cur = assignByEmp.get(a.employee_id)!.get(a.payroll_component_id);
      if (!cur || a.effective_from > cur.effective_from) {
        assignByEmp.get(a.employee_id)!.set(a.payroll_component_id, a);
      }
    }

    // -- Day buckets per employee.
    const dailyByEmp = new Map<string, { present: number; absence: number; izin: number }>();
    for (const d of daily) {
      const b = dailyByEmp.get(d.employee_id) ?? { present: 0, absence: 0, izin: 0 };
      if (PRESENT_STATUSES.includes(d.status)) b.present++;
      if (ABSENCE_STATUSES.includes(d.status)) b.absence++;
      if (IZIN_STATUSES.includes(d.status)) b.izin++;
      dailyByEmp.set(d.employee_id, b);
    }

    // -- Overtime consolidated per employee.
    const otByEmp = new Map<string, { reqIds: string[]; hours: number; amount: number }>();
    for (const o of overtime) {
      const h = Number(o.actual_hours ?? o.planned_hours ?? 0);
      const a = o.calculated_amount ? Number(o.calculated_amount) : 0;
      const cur = otByEmp.get(o.employee_id) ?? { reqIds: [], hours: 0, amount: 0 };
      cur.reqIds.push(o.id);
      cur.hours += h;
      cur.amount += a;
      otByEmp.set(o.employee_id, cur);
    }

    // -- Delete-then-recreate (non-manual only) for these employees.
    await tx.payroll_feeder_lines.deleteMany({
      where: {
        payroll_period_id: period.id,
        employee_id: { in: employeeIds },
        is_manual_override: false,
      },
    });

    // -- Build lines.
    const lines: Prisma.payroll_feeder_linesCreateManyInput[] = [];
    for (const emp of employees) {
      const buckets = dailyByEmp.get(emp.id) ?? { present: 0, absence: 0, izin: 0 };
      const assigns = assignByEmp.get(emp.id) ?? new Map();
      const ruleSet =
        emp.job_position?.attendance_rule_set ??
        (emp.job_grade?.code === 'NON_STAFF' ? 'NON_STAFF_DEFAULT' : null);

      // BASIC_SALARY
      const basic = assigns.get(compByCode.get('BASIC_SALARY')!.id);
      if (basic?.amount != null) {
        const trace = new CalculationTraceBuilder()
          .formulaName('BASIC_SALARY_FIXED')
          .input('basic_salary', basic.amount.toString())
          .input('paramVersion', basic.effective_from.toISOString())
          .step('amount', basic.amount.toString(), basic.amount.toString());
        lines.push(
          this.line(period.id, emp.id, 'BASIC_SALARY', 1, basic.amount, trace.build(basic.amount)),
        );
      }

      // TUNJANGAN_MAKAN / TUNJANGAN_TRANSPORT — rate × paid_days
      for (const code of ['TUNJANGAN_MAKAN', 'TUNJANGAN_TRANSPORT'] as const) {
        const comp = compByCode.get(code);
        const a = comp ? assigns.get(comp.id) : undefined;
        if (!comp || !a?.amount) continue;
        const paidDays = buckets.present;
        const amount = a.amount.mul(paidDays);
        const trace = new CalculationTraceBuilder()
          .formulaName(`${code}_PER_DAY`)
          .input('rate', a.amount.toString())
          .input('paid_days', paidDays)
          .input('absence_days', buckets.absence)
          .step('rate × paid_days', `${a.amount} × ${paidDays}`, amount.toString());
        lines.push(this.line(period.id, emp.id, code, paidDays, amount, trace.build(amount)));
      }

      // TUNJANGAN_KEHADIRAN — base × ladder% (absence bucket)
      if (ruleSet && buckets.absence >= 0) {
        const comp = compByCode.get('TUNJANGAN_KEHADIRAN');
        const a = comp ? assigns.get(comp.id) : undefined;
        if (comp && a?.amount) {
          const rule = this.matchRule(ruleRows, ruleSet, buckets.absence);
          const pct = rule ? Number(rule.percentage) : 100;
          const amount = a.amount.mul(pct).div(100);
          const trace = new CalculationTraceBuilder()
            .formulaName('TUNJANGAN_KEHADIRAN_LADDER')
            .rule(rule?.id, rule?.effective_from.toISOString())
            .input('rule_set_code', ruleSet)
            .input('absence_days', buckets.absence)
            .input('pct', pct)
            .input('base', a.amount.toString())
            .step('base × pct/100', `${a.amount} × ${pct}/100`, amount.toString());
          lines.push(
            this.line(
              period.id,
              emp.id,
              'TUNJANGAN_KEHADIRAN',
              buckets.absence,
              amount,
              trace.build(amount),
            ),
          );
        }
      }

      // POTONGAN_IZIN — −(GP ÷ 25) × izin_days (DEDUCTION)
      if (buckets.izin > 0) {
        if (basic?.amount != null) {
          const divisor = await this.loadIzinDivisor(end);
          const gpd = Number(basic.amount) / divisor;
          const amount = gpd * buckets.izin;
          const neg = new Prisma.Decimal(amount).neg();
          // toFixed width is display precision, not a policy number.
          // eslint-disable-next-line lahans/no-magic-policy-numbers
          const r2 = (n: number) => n.toFixed(2);
          const trace = new CalculationTraceBuilder()
            .formulaName('POTONGAN_IZIN')
            .input('GP', basic.amount.toString())
            .input('divisor', divisor)
            .input('izin_days', buckets.izin)
            .step('GP ÷ divisor', `${basic.amount} ÷ ${divisor}`, r2(gpd))
            .step('× izin_days (neg)', `${r2(gpd)} × ${buckets.izin}`, neg.toString());
          lines.push(
            this.line(
              period.id,
              emp.id,
              'POTONGAN_IZIN',
              buckets.izin,
              neg,
              trace.build(neg.toString()),
            ),
          );
        }
      }

      // LEMBUR — consolidated from approved overtime_requests
      const ot = otByEmp.get(emp.id);
      if (ot && ot.amount > 0) {
        const amount = new Prisma.Decimal(ot.amount);
        const trace = new CalculationTraceBuilder()
          .formulaName('LEMBUR_CONSOLIDATED')
          .input('request_ids', ot.reqIds.join(','))
          .input('count', ot.reqIds.length)
          .input('hours', ot.hours)
          .step('Σ calculated_amount', ot.reqIds.join(' + '), amount.toString());
        lines.push(
          this.line(period.id, emp.id, 'LEMBUR', ot.hours, amount, trace.build(amount.toString())),
        );
      }
    }

    // -- Insert + stamp attendance_daily.payroll_period_id (same transaction).
    if (lines.length > 0) {
      await tx.payroll_feeder_lines.createMany({ data: lines });
    }
    await tx.attendance_daily.updateMany({
      where: { employee_id: { in: employeeIds }, work_date: { gte: start, lte: end } },
      data: { payroll_period_id: period.id },
    });

    return { employeeCount: employees.length, lineCount: lines.length };
  }

  private line(
    periodId: string,
    employeeId: string,
    componentCode: string,
    quantity: number,
    amount: Prisma.Decimal,
    trace: object,
  ): Prisma.payroll_feeder_linesCreateManyInput {
    return {
      payroll_period_id: periodId,
      employee_id: employeeId,
      component_code: componentCode,
      quantity: new Prisma.Decimal(quantity),
      amount,
      calculation_trace: trace as unknown as Prisma.InputJsonValue,
      is_manual_override: false,
    };
  }

  private matchRule(
    rules: {
      id: string;
      rule_set_code: string;
      absence_days_min: number;
      absence_days_max: number | null;
      percentage: Prisma.Decimal;
      effective_from: Date;
    }[],
    ruleSet: string,
    absenceDays: number,
  ) {
    return rules.find(
      (r) =>
        r.rule_set_code === ruleSet &&
        r.absence_days_min <= absenceDays &&
        (r.absence_days_max === null || r.absence_days_max >= absenceDays),
    );
  }

  private async loadIzinDivisor(asOf: Date): Promise<number> {
    const p = await this.params.resolveNumber('PAYROLL.ABSENCE_MINUTES_DIVISOR', asOf);
    if (p == null) {
      throw new Error(
        'PAYROLL.ABSENCE_MINUTES_DIVISOR belum dikonfigurasi di system_parameters (BRD: zero hardcode).',
      );
    }
    return p;
  }
}

const PRESENT_STATUSES = ['HADIR', 'TERLAMBAT', 'PULANG_CEPAT', 'LIBUR', 'DINAS'];
const ABSENCE_STATUSES = ['IZIN', 'SAKIT', 'CUTI', 'ALPHA'];
const IZIN_STATUSES = ['IZIN', 'ALPHA'];
