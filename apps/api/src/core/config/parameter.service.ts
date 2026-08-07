import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

export interface ParamScope {
  scopeType?: string;
  scopeRefId?: string;
}

export type ParamDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE';

/**
 * ZERO HARDCODE — Temporal Parameter Resolver (BRD 5.3.1).
 *
 * Every policy number (divisor 173, absence divisor 25, annual leave days 12,
 * SLA 2 days, 150m geofence, ...) is read through this resolver WITH an asOf
 * date. The BRD's rule is absolute:
 *
 *   "setiap pemanggilan resolve() tanpa argumen asOf adalah cacat blocker."
 *
 * Queries without asOf must be rejected at compile time — see the
 * `no-temporal-query-without-asof` lint rule / the typed TemporalResolver.
 */
@Injectable()
export class ParameterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a system parameter effective on `asOf`.
   * Scope precedence: most-specific scope wins (scope_type NOT NULL first),
   * then latest effective_from.
   */
  async resolve(
    key: string,
    asOf: Date,
    scope?: ParamScope,
  ): Promise<{
    value: string;
    dataType: ParamDataType;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  } | null> {
    if (!asOf) {
      throw new Error(
        `ParameterService.resolve('${key}'): asOf wajib. Pembacaan parameter tanpa tanggal acuan adalah cacat blocker (BRD 5.3).`,
      );
    }

    // Temporal validity: effective_from <= asOf AND (effective_to IS NULL OR effective_to >= asOf)
    const validity: Prisma.system_parametersWhereInput = {
      effective_from: { lte: asOf },
      OR: [{ effective_to: null }, { effective_to: { gte: asOf } }],
    };
    // Scope: most-specific wins. When a scope is requested, match either the
    // exact scope or the global (scope_type NULL) fallback.
    let scopeMatch: Prisma.system_parametersWhereInput;
    if (scope?.scopeType) {
      scopeMatch = {
        OR: [
          { scope_type: scope.scopeType, scope_ref_id: scope.scopeRefId ?? null },
          { scope_type: null, scope_ref_id: null },
        ],
      };
    } else {
      scopeMatch = { scope_type: null, scope_ref_id: null };
    }

    // Combine validity + scope. Both carry an OR (validity on effective_to,
    // scope on scope_type/scope_ref_id) — spread order would overwrite. Use AND
    // so both constraints hold.
    const rows = await this.prisma.system_parameters.findMany({
      where: {
        param_key: key,
        AND: [validity, scopeMatch],
      },
      orderBy: [{ scope_type: 'desc' }, { effective_from: 'desc' }],
    });

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      value: row.param_value,
      dataType: row.data_type as ParamDataType,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
    };
  }

  /** Resolve and coerce to a number. Returns null when absent or unparseable. */
  async resolveNumber(key: string, asOf: Date, scope?: ParamScope): Promise<number | null> {
    const p = await this.resolve(key, asOf, scope);
    if (!p) return null;
    const n = Number(p.value);
    return Number.isNaN(n) ? null : n;
  }

  /** Resolve and coerce to a boolean. */
  async resolveBoolean(key: string, asOf: Date, scope?: ParamScope): Promise<boolean | null> {
    const p = await this.resolve(key, asOf, scope);
    if (!p) return null;
    return ['true', '1', 'yes', 'on'].includes(p.value.toLowerCase());
  }

  /** Resolve and coerce to JSON. */
  async resolveJson<T>(key: string, asOf: Date, scope?: ParamScope): Promise<T | null> {
    const p = await this.resolve(key, asOf, scope);
    if (!p) return null;
    try {
      return JSON.parse(p.value) as T;
    } catch {
      return null;
    }
  }
}
