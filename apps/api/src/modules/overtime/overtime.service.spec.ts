import { OvertimeService } from './overtime.service';
import { ParameterService } from '../../core/config/parameter.service';
import { TemporalResolver } from '../../core/temporal/temporal-resolver';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

/**
 * Unit tests for OvertimeService (S8-M3).
 *
 * The calculation is the riskiest rule (source doc "LEMBUR & ABSEN"):
 *   GAJI POKOK ÷ 173 × multiplier × hours  (holiday ×2 for NON-STAFF/STAFF).
 * We test it through the private calculate() via a narrow public surface
 * (create path) with a mocked overlay so the behavioral rule is locked.
 */

describe('OvertimeService', () => {
  type Calc = {
    calculated_amount: Prisma.Decimal | null;
    trace: object | null;
    formula: string;
  };

  // Resolve the private calculate() through a cast so the formula is tested
  // without a full DB stack.
  const calc = (svc: OvertimeService, hours: number, rule: Record<string, unknown>) =>
    (
      svc as unknown as {
        calculate: (
          employeeId: string,
          date: Date,
          dayType: string,
          rule: Record<string, unknown>,
          hours: number,
        ) => Promise<Calc>;
      }
    ).calculate('emp-1', new Date('2026-08-10'), 'WEEKDAY', rule, hours);

  const makeService = (opts: { divisor?: number; salary?: number } = {}) => {
    const prisma = {
      employees: { findUnique: jest.fn() },
      holidays: { findFirst: jest.fn().mockResolvedValue(null) },
      payroll_components: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pc-basic', code: 'BASIC_SALARY' }),
      },
      approval_workflows: { findUnique: jest.fn() },
      overtime_requests: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      approval_instances: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      approval_tasks: { create: jest.fn(), update: jest.fn() },
      approval_workflow_steps: { findUnique: jest.fn() },
      payroll_periods: { findFirst: jest.fn().mockResolvedValue(null) },
      payroll_feeder_lines: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(prisma);
      }),
    } as unknown as PrismaService;
    const params = {
      resolveNumber: jest.fn().mockImplementation(async (key: string) => {
        if (key === 'PAYROLL.ABSENCE_DIVISOR') return opts.divisor ?? 173;
        return null;
      }),
    } as unknown as ParameterService;
    const temporal = {
      findActive: jest.fn().mockResolvedValue(null),
    } as unknown as TemporalResolver;
    const config = { reserveNextNumber: jest.fn() } as unknown as ConfigService;
    const svc = new OvertimeService(prisma, params, temporal, config);
    return { svc, prisma, temporal, params };
  };

  it('hourly divisor: gaji_pokok ÷ 173 × 1 × hours (STAFF weekday)', async () => {
    const { svc } = makeService({ divisor: 173, salary: 1730000 });
    (svc as unknown as { basicSalary: () => Promise<number | null> }).basicSalary = jest
      .fn()
      .mockResolvedValue(1730000);
    const rule = {
      id: 'rule-1',
      calc_method: 'HOURLY_DIVISOR',
      divisor: 173,
      multiplier: new Prisma.Decimal(1),
      flat_amount: null,
      max_hours_per_day: null,
      effective_from: new Date('2026-01-01'),
      effective_to: null,
    };
    const r = await calc(svc, 3, rule);
    expect(r.formula).toBe('HOURLY_DIVISOR');
    expect(Number(r.calculated_amount)).toBe(30000);
    // trace carries the provable steps
    expect((r.trace as { steps: { label: string }[] }).steps.length).toBeGreaterThanOrEqual(3);
  });

  it('holiday ×2: gaji_pokok ÷ 173 × 2 × hours (NON-STAFF national holiday)', async () => {
    const { svc } = makeService({ divisor: 173, salary: 1730000 });
    (svc as unknown as { basicSalary: () => Promise<number | null> }).basicSalary = jest
      .fn()
      .mockResolvedValue(1730000);
    const rule = {
      id: 'rule-2',
      calc_method: 'HOURLY_DIVISOR',
      divisor: 173,
      multiplier: new Prisma.Decimal(2),
      flat_amount: null,
      max_hours_per_day: null,
      effective_from: new Date('2026-01-01'),
      effective_to: null,
    };
    const r = await calc(svc, 3, rule);
    expect(Number(r.calculated_amount)).toBe(60000);
  });

  it('flat per day: flat_amount × 1 day', async () => {
    const { svc } = makeService();
    const rule = {
      id: 'rule-3',
      calc_method: 'FLAT_PER_DAY',
      divisor: null,
      multiplier: null,
      flat_amount: new Prisma.Decimal(150000),
      max_hours_per_day: null,
      effective_from: new Date('2026-01-01'),
      effective_to: null,
    };
    const r = await calc(svc, 1, rule);
    expect(r.formula).toBe('FLAT_PER_DAY');
    expect(Number(r.calculated_amount)).toBe(150000);
    expect(r.calculated_amount?.toFixed(2)).toBe('150000.00');
  });

  it('NONE (Manager): no overtime amount, trace still records zero', async () => {
    const { svc } = makeService();
    const rule = {
      id: 'rule-4',
      calc_method: 'NONE',
      divisor: null,
      multiplier: null,
      flat_amount: null,
      max_hours_per_day: null,
      effective_from: new Date('2026-01-01'),
      effective_to: null,
    };
    const r = await calc(svc, 4, rule);
    expect(r.formula).toBe('NONE');
    expect(r.calculated_amount).toBeNull();
    expect((r.trace as { result: string }).result).toBe('0');
  });

  it('classifyDayType: weekend → WEEKEND, national holiday → NATIONAL_HOLIDAY', async () => {
    const { svc, prisma } = makeService();
    // Saturday
    (prisma.holidays.findFirst as jest.Mock).mockResolvedValue(null);
    const weekend = await (
      svc as unknown as {
        classifyDayType: (d: Date) => Promise<string>;
      }
    ).classifyDayType(new Date('2026-08-08')); // Saturday
    expect(weekend).toBe('WEEKEND');

    // National holiday
    (prisma.holidays.findFirst as jest.Mock).mockResolvedValue({
      holiday_type: 'NATIONAL',
    });
    const national = await (
      svc as unknown as {
        classifyDayType: (d: Date) => Promise<string>;
      }
    ).classifyDayType(new Date('2026-08-17')); // Indonesian Independence Day
    expect(national).toBe('NATIONAL_HOLIDAY');
  });
});
