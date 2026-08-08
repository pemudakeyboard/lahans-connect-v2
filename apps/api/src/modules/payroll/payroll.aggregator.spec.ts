import { PayrollAggregator } from './payroll.aggregator';
import { ParameterService } from '../../core/config/parameter.service';
import { Prisma } from '../../generated/prisma';

/**
 * M6 — PayrollAggregator unit tests (BRD §11.4 UAT-M6-01).
 *
 * The engine is stateless: it reads attendance/overtime/assignments and emits
 * feeder lines. The riskiest rules are the izin deduction (GP ÷ divisor × days)
 * and the attendance allowance ladder (base × pct). We lock them here with a
 * mocked tx.
 */

const PERIOD = {
  id: 'per-1',
  cutoff_start: new Date('2026-07-22'),
  cutoff_end: new Date('2026-08-21'),
};

const makeTx = () => {
  const tx = {
    employees: { findMany: jest.fn() },
    attendance_daily: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    overtime_requests: { findMany: jest.fn() },
    attendance_allowance_rules: { findMany: jest.fn() },
    payroll_components: { findMany: jest.fn() },
    employee_component_assignments: { findMany: jest.fn() },
    payroll_feeder_lines: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return tx;
};

const makeAggregator = (divisor: number | null = 25) => {
  const params = {
    resolveNumber: jest.fn().mockImplementation(async () => divisor),
  } as unknown as ParameterService;
  return new PayrollAggregator(params);
};

describe('PayrollAggregator', () => {
  it('aggregates BASIC_SALARY + allowances + izin + lembur for one employee', async () => {
    const agg = makeAggregator(25);
    const tx = makeTx();
    tx.employees.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        nik: '20250055',
        full_name: 'Aan Agustian',
        job_grade: { code: 'NON_STAFF' },
        job_position: { attendance_rule_set: 'NON_STAFF_DEFAULT' },
      },
    ]);
    // 22 days present, 1 izin, 1 alpha => izin_bucket = 2
    const days: Array<{ employee_id: string; status: string }> = [];
    for (let i = 0; i < 22; i++) days.push({ employee_id: 'emp-1', status: 'HADIR' });
    days.push({ employee_id: 'emp-1', status: 'IZIN' });
    days.push({ employee_id: 'emp-1', status: 'ALPHA' });
    tx.attendance_daily.findMany.mockResolvedValue(days);

    tx.overtime_requests.findMany.mockResolvedValue([
      {
        id: 'ot-1',
        employee_id: 'emp-1',
        overtime_date: '2026-08-01',
        planned_hours: 2,
        actual_hours: 2,
        calculated_amount: new Prisma.Decimal(40000),
        calculation_trace: { formula: 'x' },
      },
    ]);

    tx.attendance_allowance_rules.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        rule_set_code: 'NON_STAFF_DEFAULT',
        absence_days_min: 1,
        absence_days_max: 2,
        percentage: new Prisma.Decimal(50),
        effective_from: new Date('2026-01-01'),
      },
    ]);

    tx.payroll_components.findMany.mockResolvedValue([
      { id: 'pc-basic', code: 'BASIC_SALARY', calc_method: 'FIXED' },
      { id: 'pc-makan', code: 'TUNJANGAN_MAKAN', calc_method: 'PER_DAY' },
      { id: 'pc-transport', code: 'TUNJANGAN_TRANSPORT', calc_method: 'PER_DAY' },
      { id: 'pc-hadir', code: 'TUNJANGAN_KEHADIRAN', calc_method: 'PERCENTAGE' },
    ]);

    tx.employee_component_assignments.findMany.mockResolvedValue([
      {
        id: 'a-basic',
        employee_id: 'emp-1',
        payroll_component_id: 'pc-basic',
        amount: new Prisma.Decimal(3250000),
        qty: new Prisma.Decimal(1),
        effective_from: new Date('2026-01-01'),
      },
      {
        id: 'a-makan',
        employee_id: 'emp-1',
        payroll_component_id: 'pc-makan',
        amount: new Prisma.Decimal(10000),
        qty: new Prisma.Decimal(1),
        effective_from: new Date('2026-01-01'),
      },
      {
        id: 'a-hadir',
        employee_id: 'emp-1',
        payroll_component_id: 'pc-hadir',
        amount: new Prisma.Decimal(200000),
        qty: new Prisma.Decimal(1),
        effective_from: new Date('2026-01-01'),
      },
    ]);

    const result = await (
      agg.aggregate as unknown as (
        tx: unknown,
        p: unknown,
        ids: string[],
      ) => Promise<{ employeeCount: number; lineCount: number }>
    )(tx, PERIOD, ['emp-1']);

    expect(result.employeeCount).toBe(1);
    // BASIC + MAKAN + KEHADIRAN + IZIN + LEMBUR = 5 lines (no TRANSPORT assignment)
    expect(result.lineCount).toBe(5);

    const created = (tx.payroll_feeder_lines.createMany as jest.Mock).mock.calls[0][0] as {
      data: Array<{ component_code: string; amount: Prisma.Decimal; quantity: Prisma.Decimal }>;
    };
    const byCode = new Map(created.data.map((l) => [l.component_code, l]));
    expect(byCode.get('BASIC_SALARY')?.amount.toString()).toBe('3250000');
    // kehadiran: 200000 × 50/100
    expect(byCode.get('TUNJANGAN_KEHADIRAN')?.amount.toString()).toBe('100000');
    // izin: −(3250000 ÷ 25) × 2 = −260000
    expect(byCode.get('POTONGAN_IZIN')?.amount.toString()).toBe('-260000');
    expect(byCode.get('LEMBUR')?.amount.toString()).toBe('40000');
    // makan: rate × 22 paid days = 10000 × 22
    expect(byCode.get('TUNJANGAN_MAKAN')?.amount.toString()).toBe('220000');

    // attendance stamped with the period
    expect(tx.attendance_daily.updateMany as jest.Mock).toHaveBeenCalledWith({
      where: {
        employee_id: { in: ['emp-1'] },
        work_date: { gte: PERIOD.cutoff_start, lte: PERIOD.cutoff_end },
      },
      data: { payroll_period_id: PERIOD.id },
    });
    // delete-then-recreate: manual lines never touched
    expect(tx.payroll_feeder_lines.deleteMany as jest.Mock).toHaveBeenCalledWith({
      where: {
        payroll_period_id: PERIOD.id,
        employee_id: { in: ['emp-1'] },
        is_manual_override: false,
      },
    });
  });

  it('empty employee list short-circuits (no queries)', async () => {
    const agg = makeAggregator(25);
    const tx = makeTx();
    const result = await (
      agg.aggregate as unknown as (
        tx: unknown,
        p: unknown,
        ids: string[],
      ) => Promise<{ employeeCount: number; lineCount: number }>
    )(tx, PERIOD, []);
    expect(result).toEqual({ employeeCount: 0, lineCount: 0 });
    expect(tx.employees.findMany).not.toHaveBeenCalled();
  });

  it('throws when the izin divisor parameter is missing (zero hardcode)', async () => {
    const agg = makeAggregator(null);
    const tx = makeTx();
    tx.employees.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        nik: 'x',
        full_name: 'x',
        job_grade: { code: 'STAFF' },
        job_position: { attendance_rule_set: null },
      },
    ]);
    tx.attendance_daily.findMany.mockResolvedValue([{ employee_id: 'emp-1', status: 'IZIN' }]);
    tx.overtime_requests.findMany.mockResolvedValue([]);
    tx.attendance_allowance_rules.findMany.mockResolvedValue([]);
    tx.payroll_components.findMany.mockResolvedValue([
      { id: 'pc-basic', code: 'BASIC_SALARY', calc_method: 'FIXED' },
    ]);
    tx.employee_component_assignments.findMany.mockResolvedValue([
      {
        id: 'a-basic',
        employee_id: 'emp-1',
        payroll_component_id: 'pc-basic',
        amount: new Prisma.Decimal(3250000),
        qty: new Prisma.Decimal(1),
        effective_from: new Date('2026-01-01'),
      },
    ]);
    await expect(
      (
        agg.aggregate as unknown as (
          tx: unknown,
          p: unknown,
          ids: string[],
        ) => Promise<{ employeeCount: number; lineCount: number }>
      )(tx, PERIOD, ['emp-1']),
    ).rejects.toThrow('PAYROLL.ABSENCE_MINUTES_DIVISOR');
  });
});
