import { ParameterService } from './parameter.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unit tests for ParameterService (ZERO HARDCODE resolver).
 *
 * The critical invariant: resolve() WITHOUT asOf must throw (BRD 5.3 blocker),
 * and temporal overlaps must resolve to the row effective on the asOf date.
 */
describe('ParameterService', () => {
  type Row = {
    param_key: string;
    param_value: string;
    data_type: string;
    scope_type: string | null;
    scope_ref_id: string | null;
    effective_from: Date;
    effective_to: Date | null;
  };

  /**
   * Mock replicating the real query semantics: filter by param_key + validity on
   * asOf + scope, then order by scope_type DESC (scoped first) then
   * effective_from DESC (latest first). The service reads rows[0].
   */
  const makeService = (rows: Row[]) => {
    const prisma = {
      system_parameters: {
        findMany: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          const key = where.param_key as string;
          const and = (where.AND ?? []) as Record<string, unknown>[];
          const validity = and[0] as { effective_from: { lte: Date }; OR: unknown[] };
          const scopeMatch = and[1] as { OR?: unknown[]; scope_type?: unknown; scope_ref_id?: unknown };
          const asOf = validity.effective_from.lte;
          const scopePairs = (scopeMatch.OR ?? [{ scope_type: null, scope_ref_id: null }]) as {
            scope_type?: string | null;
            scope_ref_id?: string | null;
          }[];
          const valid = rows.filter((r) => {
            if (r.param_key !== key) return false;
            if (r.effective_from > asOf) return false;
            if (r.effective_to && r.effective_to < asOf) return false;
            // scope match: either the exact scope pair or the global fallback
            const ok = scopePairs.some(
              (s) => r.scope_type === (s.scope_type ?? null) && r.scope_ref_id === (s.scope_ref_id ?? null),
            );
            return ok;
          });
          valid.sort((x, y) => {
            const sx = (x.scope_type ?? '').length;
            const sy = (y.scope_type ?? '').length;
            if (sx !== sy) return sy - sx; // scoped (non-empty) first
            return y.effective_from.getTime() - x.effective_from.getTime();
          });
          return Promise.resolve(valid);
        }),
      },
    } as unknown as PrismaService;
    return new ParameterService(prisma);
  };

  it('throws when resolve() is called without asOf (BRD 5.3 blocker)', async () => {
    const svc = makeService([]);
    await expect(svc.resolve('PAYROLL.DIVISOR_173', undefined as unknown as Date)).rejects.toThrow(
      /asOf wajib/,
    );
  });

  it('resolves the row effective on asOf from a set of effective rows', async () => {
    const svc = makeService([
      {
        param_key: 'LEAVE.ANNUAL_DAYS',
        param_value: '12',
        data_type: 'NUMBER',
        scope_type: null,
        scope_ref_id: null,
        effective_from: new Date('2026-01-01'),
        effective_to: null,
      },
      {
        param_key: 'LEAVE.ANNUAL_DAYS',
        param_value: '14',
        data_type: 'NUMBER',
        scope_type: null,
        scope_ref_id: null,
        effective_from: new Date('2026-07-01'),
        effective_to: null,
      },
    ]);
    const before = await svc.resolve('LEAVE.ANNUAL_DAYS', new Date('2026-06-15'));
    expect(before?.value).toBe('12');
    const after = await svc.resolve('LEAVE.ANNUAL_DAYS', new Date('2026-07-15'));
    expect(after?.value).toBe('14');
  });

  it('resolveNumber coerces the value', async () => {
    const svc = makeService([
      {
        param_key: 'OVERTIME.SLA_DAYS',
        param_value: '2',
        data_type: 'NUMBER',
        scope_type: null,
        scope_ref_id: null,
        effective_from: new Date('2026-01-01'),
        effective_to: null,
      },
    ]);
    await expect(svc.resolveNumber('OVERTIME.SLA_DAYS', new Date('2026-08-01'))).resolves.toBe(2);
  });

  it('scope precedence: scoped row wins over global when both effective', async () => {
    const svc = makeService([
      {
        param_key: 'GEOFENCE.RADIUS_M',
        param_value: '150',
        data_type: 'NUMBER',
        scope_type: null,
        scope_ref_id: null,
        effective_from: new Date('2026-01-01'),
        effective_to: null,
      },
      {
        param_key: 'GEOFENCE.RADIUS_M',
        param_value: '350',
        data_type: 'NUMBER',
        scope_type: 'BRANCH',
        scope_ref_id: 'br-1',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
      },
    ]);
    const atBranch = await svc.resolveNumber('GEOFENCE.RADIUS_M', new Date('2026-08-01'), {
      scopeType: 'BRANCH',
      scopeRefId: 'br-1',
    });
    expect(atBranch).toBe(350);
  });
});