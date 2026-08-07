import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generic resolver for effective-dated (Class A / Class B) rows.
 *
 * BRD 4.5.1:
 *   - Class A (finansial): overtime_rate_rules, bpjs_rates, attendance_allowance_rules,
 *     employee_component_assignments, perdiem_rates, system_parameters
 *   - Class B (struktural): employee_assignments, reporting_lines
 *
 * Rules enforced:
 *   - Every read MUST carry an asOf date.
 *   - The row valid on asOf is the one where effective_from <= asOf < effective_to.
 *   - Overlap is prevented at the DB level by the gist EXCLUDE constraint.
 */
@Injectable()
export class TemporalResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find the row effective on `asOf`. `model` is a Prisma delegate name.
   * `where` must include the FK used to scope the row (e.g. { job_grade_id }).
   */
  async findActive<T extends { effective_from: Date; effective_to: Date | null }>(
    model: TemporalModel,
    asOf: Date,
    where: Record<string, unknown>,
  ): Promise<T | null> {
    if (!asOf) {
      throw new Error(
        `TemporalResolver.findActive(${model}): asOf wajib. Query temporal tanpa tanggal acuan adalah cacat blocker (BRD 4.5.1).`,
      );
    }
    const delegate = this.prisma[model as keyof PrismaService] as unknown as {
      findFirst: (args: Record<string, unknown>) => Promise<T | null>;
    };
    const row = await delegate.findFirst({
      where: {
        ...where,
        effective_from: { lte: asOf },
        OR: [{ effective_to: null }, { effective_to: { gte: asOf } }],
      },
      orderBy: { effective_from: 'desc' },
    });
    return (row ?? null) as T | null;
  }

  /**
   * List all rows for an entity, optionally filtered by scope and validity.
   * `asOf` is required — there is no "current value only" read for temporal rows.
   */
  async list<T>(model: TemporalModel, asOf: Date, where: Record<string, unknown> = {}): Promise<T[]> {
    if (!asOf) {
      throw new Error(`TemporalResolver.list(${model}): asOf wajib.`);
    }
    const delegate = this.prisma[model as keyof PrismaService] as unknown as {
      findMany: (args: Record<string, unknown>) => Promise<T[]>;
    };
    const rows = await delegate.findMany({
      where: {
        ...where,
        effective_from: { lte: asOf },
        OR: [{ effective_to: null }, { effective_to: { gte: asOf } }],
      },
      orderBy: { effective_from: 'desc' },
    });
    return rows as T[];
  }
}

// The Prisma delegates that are temporal (Class A/B). Only these may be passed
// to TemporalResolver — the type guard prevents querying non-temporal tables.
type TemporalModel =
  | 'system_parameters'
  | 'overtime_rate_rules'
  | 'bpjs_rates'
  | 'attendance_allowance_rules'
  | 'employee_component_assignments'
  | 'perdiem_rates'
  | 'employee_assignments'
  | 'reporting_lines';