import { PayrollScopeService } from './payroll-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

/**
 * M6 — PayrollScopeService unit tests.
 *
 * The BRD mandate (FR-M0-031 on the feeder): a Comben user bound to the SALES
 * division must resolve to exactly the sales employees; the PABRIK-bound user
 * only the operators. These tests lock the query-level enforcement — no UI
 * filter can ever leak rows across the division axis.
 */

const makeUser = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  userId: 'u-1',
  employeeId: 'emp-1',
  groups: ['COMBEN'],
  permissions: ['payroll.feeder.read'],
  scopes: { 'payroll.feeder.read': 'DIVISION' },
  maskedFields: [],
  ...over,
});

const makeService = (bindings: unknown[]) => {
  const prisma = {
    user_scope_bindings: {
      findMany: jest.fn().mockResolvedValue(bindings),
    },
    employees: {
      findMany: jest.fn().mockResolvedValue([{ id: 'emp-s1' }, { id: 'emp-p1' }]),
    },
  } as unknown as PrismaService;
  return new PayrollScopeService(prisma);
};

describe('PayrollScopeService', () => {
  describe('employeeWhere — DIVISION axis (sales vs pabrik)', () => {
    it('SALES-bound user resolves to the SALES division only', async () => {
      const svc = makeService([{ scope_type: 'DIVISION', scope_ref_id: 'div-sales' }]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'DIVISION' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({
        job_position: { department: { division_id: { in: ['div-sales'] } } },
      });
    });

    it('PABRIK-bound user resolves to the PABRIK division only', async () => {
      const svc = makeService([{ scope_type: 'DIVISION', scope_ref_id: 'div-pabrik' }]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'DIVISION' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({
        job_position: { department: { division_id: { in: ['div-pabrik'] } } },
      });
    });

    it('a DIVISION-granted user with NO binding rows sees nothing (enforced deny)', async () => {
      const svc = makeService([]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'DIVISION' }, employeeId: 'emp-1' }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({ id: 'emp-1' }); // self-only fallback
    });

    it('a user with no employee row and no binding rows resolves to a denied id', async () => {
      const svc = makeService([]);
      const where = await svc.employeeWhere(
        makeUser({ employeeId: undefined, scopes: { 'payroll.feeder.read': 'DIVISION' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({ id: '__denied__' }); // no rows can ever match
    });

    it('COMPANY binding wins over DIVISION (finest present granularity)', async () => {
      const svc = makeService([
        { scope_type: 'DIVISION', scope_ref_id: 'div-sales' },
        { scope_type: 'COMPANY', scope_ref_id: 'comp-1' },
      ]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'DIVISION' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({ branch: { company_id: { in: ['comp-1'] } } });
    });

    it('BRANCH binding used when only branches are bound', async () => {
      const svc = makeService([{ scope_type: 'BRANCH', scope_ref_id: 'branch-pbr' }]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'BRANCH' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({ branch_id: { in: ['branch-pbr'] } });
    });
  });

  describe('scope widths', () => {
    it('ALL/ENTITY/COMPANY scope returns an empty filter (whole company)', async () => {
      const svc = makeService([]);
      for (const scope of ['ALL', 'ENTITY', 'COMPANY']) {
        const where = await svc.employeeWhere(
          makeUser({ scopes: { 'payroll.feeder.read': scope } }),
          'payroll.feeder.read',
        );
        expect(where).toEqual({});
      }
    });

    it('CUSTOM scope fails closed (self-only)', async () => {
      const svc = makeService([]);
      const where = await svc.employeeWhere(
        makeUser({ scopes: { 'payroll.feeder.read': 'CUSTOM' } }),
        'payroll.feeder.read',
      );
      expect(where).toEqual({ id: 'emp-1' });
    });

    it('missing scope defaults to SELF (own employee row)', async () => {
      const svc = makeService([]);
      const where = await svc.employeeWhere(makeUser({ scopes: {} }), 'payroll.feeder.read');
      expect(where).toEqual({ id: 'emp-1' });
    });
  });

  describe('scopedEmployeeIds / isCompanyScope', () => {
    it('scopedEmployeeIds returns the rows matched by employeeWhere', async () => {
      const svc = makeService([{ scope_type: 'DIVISION', scope_ref_id: 'div-pabrik' }]);
      const ids = await svc.scopedEmployeeIds(
        makeUser({ scopes: { 'payroll.feeder.read': 'DIVISION' } }),
        'payroll.feeder.read',
      );
      expect(ids).toEqual(['emp-s1', 'emp-p1']);
    });

    it('isCompanyScope is true only for ALL/ENTITY/COMPANY', () => {
      const svc = makeService([]);
      expect(svc.isCompanyScope(makeUser({ scopes: { p: 'ALL' } }), 'p')).toBe(true);
      expect(svc.isCompanyScope(makeUser({ scopes: { p: 'COMPANY' } }), 'p')).toBe(true);
      expect(svc.isCompanyScope(makeUser({ scopes: { p: 'DIVISION' } }), 'p')).toBe(false);
      expect(svc.isCompanyScope(makeUser({ scopes: { p: 'SELF' } }), 'p')).toBe(false);
    });
  });
});
