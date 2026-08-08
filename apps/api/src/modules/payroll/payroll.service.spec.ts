import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollScopeService } from './payroll-scope.service';
import { PayrollAggregator } from './payroll.aggregator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { Prisma } from '../../generated/prisma';

/**
 * M6 — PayrollService unit tests.
 *
 * The lifecycle is the contract the web screen drives: a scoped Comben user may
 * lock only their own slice (the aggregator gets the scoped employee ids, and
 * only an ALL-scope caller flips the global status). These tests lock that.
 */

const makeUser = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  userId: 'u-comben',
  employeeId: 'emp-1',
  groups: ['COMBEN'],
  permissions: ['payroll.period.close', 'payroll.feeder.override'],
  scopes: {},
  maskedFields: [],
  ...over,
});

const PERIOD = {
  id: 'per-1',
  company_id: 'comp-1',
  code: '2026-08',
  cutoff_start: new Date('2026-07-22'),
  cutoff_end: new Date('2026-08-21'),
  payment_date: null,
  status: 'OPEN' as const,
  closed_by: null,
  closed_at: null,
};

const scopeStub = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    employeeWhere: jest.fn().mockResolvedValue({}),
    scopedEmployeeIds: jest.fn().mockResolvedValue(['emp-s1', 'emp-p1']),
    isCompanyScope: jest.fn().mockReturnValue(false),
    ...over,
  }) as unknown as PayrollScopeService;

const aggStub = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    aggregate: jest.fn().mockResolvedValue({ employeeCount: 2, lineCount: 12 }),
    ...over,
  }) as unknown as PayrollAggregator;

const makePrisma = () => ({
  companies: {
    findFirst: jest.fn().mockResolvedValue({ id: 'comp-1', code: 'LMN', legal_name: 'LMN' }),
  },
  payroll_periods: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([PERIOD]),
    create: jest.fn().mockResolvedValue(PERIOD),
    update: jest.fn().mockResolvedValue(PERIOD),
  },
  leave_requests: { findMany: jest.fn().mockResolvedValue([]) },
  employees: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  attendance_daily: { findMany: jest.fn().mockResolvedValue([]) },
  payroll_components: { findUnique: jest.fn().mockResolvedValue(null) },
  employee_component_assignments: { findMany: jest.fn().mockResolvedValue([]) },
  payroll_feeder_lines: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

const makeService = (
  over: {
    prisma?: ReturnType<typeof makePrisma>;
    scope?: PayrollScopeService;
    agg?: PayrollAggregator;
  } = {},
) => {
  const prisma = over.prisma ?? makePrisma();
  const svc = new PayrollService(
    prisma as unknown as PrismaService,
    over.scope ?? scopeStub(),
    over.agg ?? aggStub(),
  );
  return { svc, prisma };
};

describe('PayrollService', () => {
  describe('openPeriod', () => {
    it('rejects a non-company scoped user', async () => {
      const { svc } = makeService();
      const user = makeUser({ scopes: { 'payroll.period.write': 'DIVISION' } });
      await expect(
        svc.openPeriod(user, {
          code: '2026-09',
          cutoff_start: '2026-08-22',
          cutoff_end: '2026-09-21',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an overlapping period', async () => {
      const scope = scopeStub({ isCompanyScope: jest.fn().mockReturnValue(true) });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_periods.findUnique.mockResolvedValue(null);
      prisma.payroll_periods.findFirst.mockResolvedValue(PERIOD);
      const user = makeUser({ scopes: { 'payroll.period.write': 'COMPANY' } });
      await expect(
        svc.openPeriod(user, {
          code: '2026-08b',
          cutoff_start: '2026-08-01',
          cutoff_end: '2026-08-31',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates an OPEN period when company-scoped and no overlap', async () => {
      const scope = scopeStub({ isCompanyScope: jest.fn().mockReturnValue(true) });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_periods.findUnique.mockResolvedValue(null);
      prisma.payroll_periods.findFirst.mockResolvedValue(null);
      const user = makeUser({ scopes: { 'payroll.period.write': 'COMPANY' } });
      await svc.openPeriod(user, {
        code: '2026-09',
        cutoff_start: '2026-08-22',
        cutoff_end: '2026-09-21',
      });
      expect(prisma.payroll_periods.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: '2026-09', status: 'OPEN' }),
        }),
      );
    });
  });

  describe('validatePeriod — blockers (UAT-M6-03)', () => {
    it('PENDING_LEAVE blocks the period', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.leave_requests.findMany.mockResolvedValue([
        {
          doc_number: 'DOC_LEAVE-42',
          employee: { nik: '20250055', full_name: 'Aan Agustian' },
        },
      ]);
      prisma.employees.findMany.mockResolvedValue([
        { id: 'emp-s1', nik: '20250055', full_name: 'Aan Agustian' },
      ]);
      const res = await svc.validatePeriod(makeUser(), PERIOD.id);
      expect(res.ok).toBe(false);
      expect(res.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'PENDING_LEAVE', docNumber: 'DOC_LEAVE-42' }),
        ]),
      );
      expect(res.blockers).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'NO_ATTENDANCE' })]),
      );
    });

    it('NO_BASIC_SALARY blocks when no assignment at cutoff_end', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([
        { id: 'emp-s1', nik: '20250055', full_name: 'Aan' },
      ]);
      prisma.payroll_components.findUnique.mockResolvedValue({
        id: 'pc-basic',
        code: 'BASIC_SALARY',
      });
      prisma.employee_component_assignments.findMany.mockResolvedValue([]);
      const res = await svc.validatePeriod(makeUser(), PERIOD.id);
      expect(res.ok).toBe(false);
      expect(res.blockers).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'NO_BASIC_SALARY' })]),
      );
    });

    it('ok when no blockers', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([
        { id: 'emp-s1', nik: '20250055', full_name: 'Aan' },
      ]);
      // attendance_daily.findMany is called twice: once for the distinct employee
      // set (must include emp-s1 so NO_ATTENDANCE is not flagged), once for
      // INCOMPLETE rows (empty).
      prisma.attendance_daily.findMany
        .mockResolvedValueOnce([{ employee_id: 'emp-s1' }])
        .mockResolvedValue([]);
      prisma.payroll_components.findUnique.mockResolvedValue({
        id: 'pc-basic',
        code: 'BASIC_SALARY',
      });
      prisma.employee_component_assignments.findMany.mockResolvedValue([{ employee_id: 'emp-s1' }]);
      const res = await svc.validatePeriod(makeUser(), PERIOD.id);
      expect(res.ok).toBe(true);
      expect(res.blockers).toEqual([]);
    });
  });

  describe('lockPeriod — scoped aggregation', () => {
    it('rejects a non-OPEN period', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue({ ...PERIOD, status: 'LOCKED' });
      await expect(svc.lockPeriod(makeUser(), PERIOD.id)).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns 409 with blockers when validation fails', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([]);
      prisma.leave_requests.findMany.mockResolvedValue([
        { doc_number: 'DOC_LEAVE-1', employee: { nik: 'x', full_name: 'y' } },
      ]);
      await expect(svc.lockPeriod(makeUser(), PERIOD.id)).rejects.toMatchObject({
        response: { code: 'PERIOD_BLOCKED' },
      });
    });

    it('aggregates the SCOPED slice and does NOT flip global status for a scoped user', async () => {
      const scope = scopeStub({
        scopedEmployeeIds: jest.fn().mockResolvedValue(['emp-s1']),
        isCompanyScope: jest.fn().mockReturnValue(false),
      });
      const agg = aggStub();
      const { svc, prisma } = makeService({ scope, agg });
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([
        { id: 'emp-s1', nik: '20250055', full_name: 'Aan' },
      ]);
      prisma.attendance_daily.findMany
        .mockResolvedValueOnce([{ employee_id: 'emp-s1' }])
        .mockResolvedValue([]);
      prisma.payroll_components.findUnique.mockResolvedValue({
        id: 'pc-basic',
        code: 'BASIC_SALARY',
      });
      prisma.employee_component_assignments.findMany.mockResolvedValue([{ employee_id: 'emp-s1' }]);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

      const res = await svc.lockPeriod(makeUser(), PERIOD.id);
      expect(agg.aggregate).toHaveBeenCalledWith(expect.anything(), PERIOD, ['emp-s1']);
      expect(prisma.payroll_periods.update).not.toHaveBeenCalled(); // scoped: no global flip
      expect(res.status).toBe('OPEN');
      expect(res.aggregatedEmployees).toBe(2);
    });

    it('ALL-scope caller flips the global status to LOCKED', async () => {
      const scope = scopeStub({
        scopedEmployeeIds: jest.fn().mockResolvedValue(['emp-a', 'emp-b']),
        isCompanyScope: jest.fn().mockReturnValue(true),
      });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([
        { id: 'emp-a', nik: '1', full_name: 'a' },
        { id: 'emp-b', nik: '2', full_name: 'b' },
      ]);
      prisma.attendance_daily.findMany
        .mockResolvedValueOnce([{ employee_id: 'emp-a' }, { employee_id: 'emp-b' }])
        .mockResolvedValue([]);
      prisma.payroll_components.findUnique.mockResolvedValue({
        id: 'pc-basic',
        code: 'BASIC_SALARY',
      });
      prisma.employee_component_assignments.findMany.mockResolvedValue([
        { employee_id: 'emp-a' },
        { employee_id: 'emp-b' },
      ]);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

      const res = await svc.lockPeriod(makeUser(), PERIOD.id);
      expect(prisma.payroll_periods.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'LOCKED' }) }),
      );
      expect(res.status).toBe('LOCKED');
    });
  });

  describe('closePeriod — global status only for company scope', () => {
    it('scoped Comben user validates their slice but does NOT flip global status', async () => {
      const scope = scopeStub({ isCompanyScope: jest.fn().mockReturnValue(false) });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([{ id: 'emp-s1' }]);
      prisma.attendance_daily.findMany.mockResolvedValueOnce([{ employee_id: 'emp-s1' }]);

      const res = (await svc.closePeriod(makeUser(), PERIOD.id)) as {
        status: string;
        companyScope?: boolean;
      };
      expect(prisma.payroll_periods.update).not.toHaveBeenCalled(); // no global flip
      expect(res.status).toBe('OPEN');
      expect(res.companyScope).toBe(false);
    });

    it('ALL-scope caller finalizes the period to CLOSED', async () => {
      const scope = scopeStub({ isCompanyScope: jest.fn().mockReturnValue(true) });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_periods.findUnique.mockResolvedValue(PERIOD);
      prisma.employees.findMany.mockResolvedValue([{ id: 'emp-a' }]);
      prisma.attendance_daily.findMany.mockResolvedValueOnce([{ employee_id: 'emp-a' }]);
      prisma.payroll_periods.update.mockResolvedValue({ ...PERIOD, status: 'CLOSED' });

      const res = await svc.closePeriod(makeUser(), PERIOD.id);
      expect(prisma.payroll_periods.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }),
      );
      expect(res.status).toBe('CLOSED');
    });

    it('rejects a period already closed', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue({ ...PERIOD, status: 'CLOSED' });
      await expect(svc.closePeriod(makeUser(), PERIOD.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('overrideFeederLine — scope on the line', () => {
    it('refuses to override a line already overridden', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_feeder_lines.findUnique.mockResolvedValue({
        id: 'line-1',
        employee_id: 'emp-s1',
        is_manual_override: true,
      });
      prisma.employees.findFirst.mockResolvedValue({ id: 'emp-s1' }); // in scope
      await expect(
        svc.overrideFeederLine(makeUser(), 'line-1', { amount: 100 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('forbids overriding a line outside the user scope', async () => {
      const scope = scopeStub({
        employeeWhere: jest.fn().mockResolvedValue({
          job_position: { department: { division_id: { in: ['div-sales'] } } },
        }),
      });
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_feeder_lines.findUnique.mockResolvedValue({
        id: 'line-pabrik',
        employee_id: 'emp-p1',
        is_manual_override: false,
      });
      prisma.employees.findFirst.mockResolvedValue(null); // pabrik employee not in sales scope
      await expect(
        svc.overrideFeederLine(makeUser(), 'line-pabrik', { amount: 100 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('applies the override within scope', async () => {
      const scope = scopeStub();
      const { svc, prisma } = makeService({ scope });
      prisma.payroll_feeder_lines.findUnique.mockResolvedValue({
        id: 'line-1',
        employee_id: 'emp-s1',
        is_manual_override: false,
      });
      prisma.employees.findFirst.mockResolvedValue({ id: 'emp-s1' });
      prisma.payroll_feeder_lines.update.mockResolvedValue({
        id: 'line-1',
        is_manual_override: true,
      });
      await svc.overrideFeederLine(makeUser(), 'line-1', { amount: 500000, reason: 'koreksi' });
      expect(prisma.payroll_feeder_lines.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Prisma.Decimal(500000),
            is_manual_override: true,
            overridden_by: 'u-comben',
          }),
        }),
      );
    });
  });

  describe('period not found', () => {
    it('requirePeriod throws NotFoundException', async () => {
      const { svc, prisma } = makeService();
      prisma.payroll_periods.findUnique.mockResolvedValue(null);
      await expect(svc.validatePeriod(makeUser(), 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
