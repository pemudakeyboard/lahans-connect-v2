import { LeaveService } from './leave.service';
import { ParameterService } from '../../core/config/parameter.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unit tests for LeaveService (S7-M3).
 *
 * The proration formula is the riskiest rule (CONTEXT.md: "Join 3 Mar 2024 →
 * granted 3 Mar 2025 → 10 days (Mar–Dec). Not days-based."). We test it through
 * runAnnualGrant with a mocked overlay so the behavioral rule is locked.
 */

describe('LeaveService', () => {
  type Bal = {
    id: string;
    entitlement_days: unknown;
    prorate_days: number;
    entitlement: number;
    isProrated: boolean;
  };

  const makeService = (balances: Bal[] = []) => {
    const prisma = {
      leave_types: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lt-cutitahunan',
          code: 'CUTI_TAHUNAN',
          name: 'Cuti Tahunan',
          deduct_quota: true,
          deduct_salary: false,
        }),
      },
      employees: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      leave_balances: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: { entitlement_days: number } }) => {
          const b: Bal = {
            id: Math.random().toString(36),
            entitlement_days: data.entitlement_days,
            prorate_days: 0,
            entitlement: data.entitlement_days,
            isProrated: false,
          };
          balances.push(b);
          return Promise.resolve(b);
        }),
      },
      leave_balance_ledger: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: { days: number; notes: string } }) => {
            const last = balances[balances.length - 1];
            if (last) {
              last.prorate_days = data.days;
              last.isProrated = /prorata/.test(data.notes);
            }
            return Promise.resolve({});
          }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(prisma);
      }),
    } as unknown as PrismaService;
    const params = {
      resolveNumber: jest.fn().mockImplementation(async (key: string) => {
        if (key === 'LEAVE.ANNUAL_DAYS') return 12;
        if (key === 'LEAVE.FULL_ENTITLEMENT_SERVICE_MONTHS') return 12;
        return null;
      }),
    } as unknown as ParameterService;
    const config = {} as ConfigService;
    const svc = new LeaveService(prisma, params, config);
    return { svc, balances, prisma };
  };

  it('prorates a March anniversary to 10 days (Mar–Dec)', async () => {
    const { svc, balances } = makeService();
    const joinDate = new Date('2024-03-03');
    const anniversary = new Date('2025-03-03');
    (svc as unknown as { prisma: PrismaService }).prisma.employees.findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'emp-1', join_date: joinDate, is_active: true, leave_eligible: true },
      ]);
    await svc.runAnnualGrant(anniversary, 'actor-1');
    expect(balances).toHaveLength(1);
    expect(balances[0].entitlement_days).toBe(10);
    expect(balances[0].isProrated).toBe(true);
  });

  it('grants a single day for a December anniversary', async () => {
    const { svc, balances } = makeService();
    const joinDate = new Date('2024-12-15');
    const anniversary = new Date('2025-12-15');
    (svc as unknown as { prisma: PrismaService }).prisma.employees.findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'emp-2', join_date: joinDate, is_active: true, leave_eligible: true },
      ]);
    await svc.runAnnualGrant(anniversary, 'actor-1');
    expect(balances[0].entitlement_days).toBe(1);
  });

  it('grants the full annual days for year-2+ (prior grant exists)', async () => {
    const { svc, balances } = makeService();
    const prisma = (svc as unknown as { prisma: PrismaService }).prisma;
    prisma.leave_balances.findFirst = jest.fn().mockResolvedValue({ id: 'prior-grant' });
    prisma.employees.findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'emp-3', join_date: new Date('2023-01-10'), is_active: true, leave_eligible: true },
      ]);
    await svc.runAnnualGrant(new Date('2026-01-10'), 'actor-1');
    expect(balances).toHaveLength(1);
    expect(balances[0].entitlement_days).toBe(12);
    expect(balances[0].isProrated).toBe(false);
  });

  it('skips an employee whose anniversary has not yet arrived', async () => {
    const { svc, balances } = makeService();
    (svc as unknown as { prisma: PrismaService }).prisma.employees.findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'emp-4', join_date: new Date('2024-12-01'), is_active: true, leave_eligible: true },
      ]);
    await svc.runAnnualGrant(new Date('2025-06-01'), 'actor-1');
    expect(balances).toHaveLength(0);
  });

  it('prorates to full days for a January anniversary year-1', async () => {
    const { svc, balances } = makeService();
    (svc as unknown as { prisma: PrismaService }).prisma.employees.findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'emp-5', join_date: new Date('2024-01-05'), is_active: true, leave_eligible: true },
      ]);
    await svc.runAnnualGrant(new Date('2025-01-05'), 'actor-1');
    expect(balances[0].entitlement_days).toBe(12);
    expect(balances[0].isProrated).toBe(true); // year-1 grant is still prorated type
  });
});
