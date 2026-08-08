import { RosterService } from './roster.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PayrollScopeService } from '../payroll/payroll-scope.service';
import { DelegationService } from '../../core/delegation/delegation.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

/**
 * Unit tests for RosterService.resolveEmployeeSchedule (Ticket 04 — read-only
 * "Jadwal Kerja" card on the employee detail page).
 *
 * The resolution pipeline (scopeRefsFor → rankAssignments → resolveShiftWindow)
 * is pure and already exercised through the roster calendar; here we lock the
 * service boundary: employee data-scope enforcement and winnowing to the
 * winning assignment's schedule metadata.
 */

const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  userId: 'u-1',
  employeeId: 'emp-self',
  groups: ['EMPLOYEE'],
  permissions: ['roster.calendar.read'],
  scopes: { 'roster.calendar.read': 'SELF' },
  maskedFields: [],
  ...over,
});

const makeService = (opts: { scopeWhere?: object } = {}) => {
  const employeesFindFirst = jest.fn();
  const assignmentsFindMany = jest.fn();
  const scope = {
    employeeWhere: jest.fn().mockResolvedValue(opts.scopeWhere ?? {}),
  } as unknown as PayrollScopeService;
  const prisma = {
    employees: { findFirst: employeesFindFirst },
    schedule_assignments: { findMany: assignmentsFindMany },
  } as unknown as PrismaService;
  const delegation = {} as unknown as DelegationService;
  const svc = new RosterService(prisma, scope, delegation);
  return {
    svc,
    prisma: {
      employees: { findFirst: employeesFindFirst },
      schedule_assignments: { findMany: assignmentsFindMany },
    },
    scope,
  };
};

const empRow = (over: object = {}) => ({
  id: 'emp-1',
  job_position_id: 'pos-1',
  job_grade_id: 'grade-1',
  branch_id: 'br-1',
  branch: { company_id: 'co-1' },
  ...over,
});

const assignment = (over: object = {}) => ({
  effective_from: new Date('2026-01-01T00:00:00.000Z'),
  effective_to: null,
  priority: 1,
  scope_type: 'EMPLOYEE',
  scope_ref_id: 'emp-1',
  work_schedule: {
    id: 'ws-1',
    code: 'HO_STANDARD',
    name: 'HO Standard',
    schedule_type: 'FIXED',
    shift_pattern: null,
    days: [
      {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 60,
        late_tolerance_minutes: 0,
      },
    ],
  },
  ...over,
});

describe('RosterService.resolveEmployeeSchedule', () => {
  it('returns the winning schedule + window for an in-scope employee', async () => {
    const { svc, prisma } = makeService();
    prisma.employees.findFirst.mockResolvedValue(empRow());
    prisma.schedule_assignments.findMany.mockResolvedValue([assignment()]);
    const date = new Date('2026-08-10T00:00:00.000Z'); // Monday
    const r = await svc.resolveEmployeeSchedule(user(), 'emp-1', date);
    expect(r?.schedule).toEqual({
      id: 'ws-1',
      code: 'HO_STANDARD',
      name: 'HO Standard',
      schedule_type: 'FIXED',
    });
    expect(r?.window?.start_time).toBe('09:00');
    expect(r?.window?.end_time).toBe('17:00');
    expect(r?.window?.is_working_day).toBe(true);
    expect(r?.scope?.type).toBe('EMPLOYEE');
  });

  it('returns a null schedule (no assignments) for an in-scope employee', async () => {
    const { svc, prisma } = makeService();
    prisma.employees.findFirst.mockResolvedValue(empRow());
    prisma.schedule_assignments.findMany.mockResolvedValue([]);
    const r = await svc.resolveEmployeeSchedule(user(), 'emp-1', new Date('2026-08-10'));
    expect(r?.schedule).toBeNull();
    expect(r?.window).toBeNull();
  });

  it('returns null when the employee does not exist (company-wide scope)', async () => {
    const { svc, prisma } = makeService({ scopeWhere: {} });
    prisma.employees.findFirst.mockResolvedValue(null);
    prisma.schedule_assignments.findMany.mockResolvedValue([]);
    const r = await svc.resolveEmployeeSchedule(user(), 'missing', new Date('2026-08-10'));
    expect(r).toBeNull();
  });

  it('throws ROSTER_SCOPE when the employee is outside the user scope', async () => {
    const { svc, prisma, scope } = makeService({ scopeWhere: { id: 'emp-self' } });
    // The requested employee ('emp-other') is NOT in { id: 'emp-self' } scope →
    // ANDing the scope with the requested id matches no single row (no row has
    // both ids) → findFirst returns null → ROSTER_SCOPE.
    prisma.employees.findFirst.mockResolvedValue(null);
    prisma.schedule_assignments.findMany.mockResolvedValue([]);
    const me = user();
    await expect(
      svc.resolveEmployeeSchedule(me, 'emp-other', new Date('2026-08-10')),
    ).rejects.toMatchObject({ response: { code: 'ROSTER_SCOPE' } });
    expect(scope.employeeWhere).toHaveBeenCalledWith(me, 'roster.calendar.read');
    // The query must AND the scope restriction with the requested id — never
    // let the SELF scope's { id } be dropped in favour of the requested id,
    // nor let the requested id be dropped in favour of the scope.
    expect(prisma.employees.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: [{ id: 'emp-other' }, { id: 'emp-self' }] }),
      }),
    );
  });
});
