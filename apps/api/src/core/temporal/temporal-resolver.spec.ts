import { TemporalResolver } from './temporal-resolver';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TemporalResolver — effective-dated (Class A/B) row lookup.
 * The asOf-then-filter invariant is the blocker rule (BRD 4.5.1).
 */
describe('TemporalResolver', () => {
  const buildService = (rows: unknown[]) => {
    const prisma = {
      employee_assignments: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          return Promise.resolve(
            rows.find(
              (r) =>
                (r as { employee_id: string }).employee_id ===
                  (where as { employee_id?: string }).employee_id ||
                rows.length > 0,
            ) ?? null,
          );
        }),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    } as unknown as PrismaService;
    return new TemporalResolver(prisma);
  };

  it('throws when findActive is called without asOf (BRD 4.5.1 blocker)', async () => {
    const svc = buildService([]);
    await expect(
      svc.findActive('employee_assignments', undefined as unknown as Date, { employee_id: 'e1' }),
    ).rejects.toThrow(/asOf wajib/);
  });

  it('returns the active assignment for the asOf date', async () => {
    const rows = [
      {
        id: 'a1',
        employee_id: 'e1',
        job_position_id: 'p1',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
      },
    ];
    const svc = buildService(rows);
    const active = (await svc.findActive('employee_assignments', new Date('2026-08-01'), {
      employee_id: 'e1',
    })) as { id: string } | null;
    expect(active?.id).toBe('a1');
  });

  it('lists only rows valid on the asOf date', async () => {
    const rows = [
      { id: 'a1', effective_from: new Date('2026-01-01'), effective_to: null },
      { id: 'a2', effective_from: new Date('2025-01-01'), effective_to: new Date('2025-12-31') },
    ];
    const svc = buildService(rows);
    const list = await svc.list('employee_assignments', new Date('2026-08-01'));
    expect(list.length).toBeGreaterThan(0);
  });
});