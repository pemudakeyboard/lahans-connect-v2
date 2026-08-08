import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ParameterService } from '../../core/config/parameter.service';
import { PayrollScopeService } from '../payroll/payroll-scope.service';
import { RosterService } from '../roster/roster.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

/**
 * S6 — AttendanceService unit tests (mock-overlay pattern).
 *
 * Covers the risky surfaces: geofence hard/soft, idempotency, duplicate guards,
 * derivation freeze, correction CLOSED guard, and final-approve apply.
 */

const makePrisma = () => ({
  employees: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  attendance_logs: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  attendance_daily: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  attendance_corrections: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  approval_workflows: { findUnique: jest.fn() },
  approval_instances: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  approval_tasks: { create: jest.fn(), update: jest.fn() },
  approval_workflow_steps: { findUnique: jest.fn() },
  holidays: { findFirst: jest.fn().mockResolvedValue(null) },
  schedule_assignments: { findFirst: jest.fn() },
  work_schedules: { findFirst: jest.fn() },
  reference_data: { findFirst: jest.fn() },
  payroll_periods: { findUnique: jest.fn() },
  reporting_lines: { findFirst: jest.fn() },
  users: { findFirst: jest.fn() },
  $transaction: jest.fn(),
});

const scopeStub = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    employeeWhere: jest.fn().mockResolvedValue({}),
    ...over,
  }) as unknown as PayrollScopeService;

const paramsStub = (radius: number) =>
  ({
    resolveNumber: jest.fn().mockResolvedValue(radius),
  }) as unknown as ParameterService;

const makeService = (
  opts: {
    prisma?: ReturnType<typeof makePrisma>;
    scope?: PayrollScopeService;
    radius?: number;
  } = {},
) => {
  const prisma = opts.prisma ?? makePrisma();
  // The mock tx is the same object (the service only reads/writes through it).
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  const svc = new AttendanceService(
    prisma as unknown as PrismaService,
    paramsStub(opts.radius ?? 150),
    opts.scope ?? scopeStub(),
    { resolveWorkSchedule: jest.fn().mockResolvedValue(null) } as unknown as RosterService,
  );
  return { svc, prisma };
};

const clockDto = (over: Record<string, unknown> = {}) => ({
  log_type: 'IN',
  latitude: '-6.200000',
  longitude: '106.800000',
  client_request_id: 'req-1',
  ...over,
});

describe('AttendanceService', () => {
  describe('clock — geofence', () => {
    it('STRICT out-of-zone → GEOFENCE_DENIED, no log created', async () => {
      const { svc, prisma } = makeService();
      prisma.employees.findUnique.mockResolvedValue({
        id: 'emp-1',
        branch_id: 'b-1',
        branch: {
          latitude: new Prisma.Decimal('-6.2'),
          longitude: new Prisma.Decimal('106.8'),
          geofence_radius_m: 150,
          attendance_policy: 'GEOFENCE_STRICT',
        },
      });
      prisma.attendance_logs.findUnique.mockResolvedValue(null);
      // Far away: Jakarta airport ~ -6.12, 106.65 → > 150m
      await expect(
        svc.clock('emp-1', clockDto({ latitude: '-6.120000', longitude: '106.650000' }) as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attendance_logs.create).not.toHaveBeenCalled();
    });

    it('TRACKED out-of-zone → log created with is_out_of_zone + anomaly', async () => {
      const { svc, prisma } = makeService();
      prisma.employees.findUnique.mockResolvedValue({
        id: 'emp-1',
        branch_id: 'b-1',
        branch: {
          latitude: new Prisma.Decimal('-6.2'),
          longitude: new Prisma.Decimal('106.8'),
          geofence_radius_m: 150,
          attendance_policy: 'GEOFENCE_TRACKED',
        },
      });
      prisma.attendance_logs.findUnique.mockResolvedValue(null);
      prisma.attendance_logs.findFirst.mockResolvedValue(null); // no prior IN
      prisma.attendance_logs.create.mockResolvedValue({ id: 'log-1' });
      prisma.attendance_daily.upsert.mockResolvedValue({ id: 'daily-1' });

      const res = (await svc.clock(
        'emp-1',
        clockDto({ latitude: '-6.120000', longitude: '106.650000' }) as never,
      )) as { geofence: { out_of_zone: boolean; noData: boolean } };
      expect(res.geofence.out_of_zone).toBe(true);
      expect(prisma.attendance_logs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_out_of_zone: true }),
        }),
      );
    });

    it('missing GPS → fail-open with NO_GEOFENCE_DATA (no block)', async () => {
      const { svc, prisma } = makeService();
      prisma.employees.findUnique.mockResolvedValue({
        id: 'emp-1',
        branch_id: 'b-1',
        branch: {
          latitude: new Prisma.Decimal('-6.2'),
          longitude: new Prisma.Decimal('106.8'),
          geofence_radius_m: 150,
          attendance_policy: 'GEOFENCE_STRICT',
        },
      });
      prisma.attendance_logs.findUnique.mockResolvedValue(null);
      prisma.attendance_logs.findFirst.mockResolvedValue(null);
      prisma.attendance_logs.create.mockResolvedValue({ id: 'log-1' });
      prisma.attendance_daily.upsert.mockResolvedValue({ id: 'daily-1' });
      const res = (await svc.clock(
        'emp-1',
        clockDto({ latitude: undefined, longitude: undefined }) as never,
      )) as { geofence: { noData: boolean; out_of_zone: boolean } };
      expect(res.geofence.noData).toBe(true);
      expect(res.geofence.out_of_zone).toBe(false);
      expect(prisma.attendance_logs.create).toHaveBeenCalled();
    });
  });

  describe('clock — idempotency + duplicate guards', () => {
    it('same client_request_id returns the existing log without creating', async () => {
      const { svc, prisma } = makeService();
      prisma.employees.findUnique.mockResolvedValue({ id: 'emp-1', branch_id: null, branch: null });
      prisma.attendance_logs.findUnique.mockResolvedValue({ id: 'log-existing' });
      const res = await svc.clock('emp-1', clockDto() as never);
      expect(res.idempotent).toBe(true);
      expect(res.log).toEqual({ id: 'log-existing' });
      expect(prisma.attendance_logs.create).not.toHaveBeenCalled();
    });

    it('duplicate IN on the same day → 409 ATTENDANCE_ALREADY_IN', async () => {
      const { svc, prisma } = makeService();
      prisma.employees.findUnique.mockResolvedValue({ id: 'emp-1', branch_id: null, branch: null });
      prisma.attendance_logs.findUnique.mockResolvedValue(null);
      prisma.attendance_logs.findFirst.mockResolvedValue({ id: 'log-in', log_type: 'IN' });
      await expect(svc.clock('emp-1', clockDto() as never)).rejects.toMatchObject({
        response: { code: 'ATTENDANCE_ALREADY_IN' },
      });
    });
  });

  describe('deriveTx — freeze guard', () => {
    it('does not overwrite a CUTI day', async () => {
      const { svc, prisma } = makeService();
      prisma.attendance_daily.findUnique.mockResolvedValue({ id: 'd1', status: 'CUTI' });
      const r = await svc.deriveTx(prisma as never, 'emp-1', new Date('2026-08-06'));
      expect(r.status).toBe('CUTI');
      expect(prisma.attendance_daily.upsert).not.toHaveBeenCalled();
    });
  });

  describe('corrections', () => {
    it('refuses correction on a CLOSED payroll period', async () => {
      const { svc, prisma } = makeService();
      prisma.attendance_daily.findUnique.mockResolvedValue({
        id: 'daily-1',
        employee_id: 'emp-1',
        payroll_period_id: 'per-1',
      });
      prisma.payroll_periods.findUnique.mockResolvedValue({ id: 'per-1', status: 'CLOSED' });
      await expect(
        svc.createCorrection('emp-1', 'u-emp1', {
          attendance_daily_id: 'daily-1',
          reason_code: 'LUPA_ABSEN',
        } as never),
      ).rejects.toMatchObject({ response: { code: 'ATTENDANCE_PERIOD_CLOSED' } });
    });

    it("rejects a correction for someone else's daily row", async () => {
      const { svc, prisma } = makeService();
      prisma.attendance_daily.findUnique.mockResolvedValue({
        id: 'daily-1',
        employee_id: 'emp-OTHER',
        payroll_period_id: null,
      });
      await expect(
        svc.createCorrection('emp-1', 'u-emp1', {
          attendance_daily_id: 'daily-1',
          reason_code: 'LUPA_ABSEN',
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('final-approve applies proposed_values + source MANUAL + clears anomaly', async () => {
      const { svc, prisma } = makeService();
      prisma.attendance_corrections.findUnique.mockResolvedValue({
        id: 'c-1',
        status: 'PENDING',
        approval_instance_id: 'ai-1',
        attendance_daily_id: 'daily-1',
        requested_by: 'u-emp1',
        proposed_values: { status: 'HADIR', late_minutes: 0, work_minutes: 420 },
      });
      prisma.approval_instances.findUnique.mockResolvedValue({
        id: 'ai-1',
        workflow_id: 'wf-1',
        current_step_order: 2,
        tasks: [
          { step_order: 1, status: 'APPROVED', assignee_user_id: 'u-boss' },
          { step_order: 2, status: 'PENDING', assignee_user_id: 'u-comben' },
        ],
      });
      prisma.attendance_daily.findUnique.mockResolvedValue({
        id: 'daily-1',
        first_in_at: null,
        last_out_at: null,
        status: 'INCOMPLETE',
        late_minutes: 0,
        early_leave_minutes: 0,
        work_minutes: 0,
      });
      prisma.attendance_daily.update.mockResolvedValue({});
      prisma.attendance_corrections.update.mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      );

      const res = await svc.decideCorrection('c-1', 'u-comben', 'APPROVE');
      expect(res.status).toBe('APPROVED');
      expect(prisma.attendance_daily.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'HADIR',
            source: 'MANUAL',
            is_anomaly: false,
          }),
        }),
      );
    });
  });
});
