import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MASTER_REGISTRY, MasterEntityConfig } from './master-registry';

/**
 * M1B — Generic Master Data CRUD (BRD §7.1).
 *
 * One service drives every master entity in MASTER_REGISTRY. Rules:
 *  - list/create/update/delete are permission-gated per entity (`master.<resource>.read|write`)
 *  - temporal entities REQUIRE an `asOf` query param (BRD 4.5.1 — no asOf = blocker)
 *  - delete is SOFT when the table has `is_active`; otherwise hard delete
 *  - all writes go through Prisma (row-level scoping is enforced upstream by
 *    the DataScopeInterceptor / PermissionGuard)
 */
@Injectable()
export class MasterService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(entity: string) {
    const config = this.resolveConfig(entity);
    return this.prisma[config.delegate as keyof PrismaService] as unknown as {
      count: (args: Record<string, unknown>) => Promise<number>;
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
      findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
      findFirst: (args: Record<string, unknown>) => Promise<unknown | null>;
      create: (args: Record<string, unknown>) => Promise<unknown>;
      update: (args: Record<string, unknown>) => Promise<unknown>;
      delete: (args: Record<string, unknown>) => Promise<unknown>;
    };
  }

  private resolveConfig(entity: string): MasterEntityConfig {
    const config = MASTER_REGISTRY[entity];
    if (!config) throw new NotFoundException(`Entitas master tidak dikenal: ${entity}`);
    return config;
  }

  /** Effective permission resource for an entity (e.g. 'job_grades'). */
  resource(entity: string): string {
    return this.resolveConfig(entity).delegate;
  }

  private assertAsOf(entity: string, config: MasterEntityConfig, asOf?: string): Date {
    if (config.temporal && !asOf) {
      throw new BadRequestException({
        code: 'AS_OF_REQUIRED',
        message: `Entitas ${entity} bersifat temporal (Class A/B). Parameter 'asOf' wajib.`,
      });
    }
    if (!asOf) return new Date();
    const d = new Date(asOf);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Parameter asOf tidak valid.');
    return d;
  }

  async list(
    entity: string,
    query: { page?: number; pageSize?: number; search?: string; asOf?: string },
  ) {
    const config = this.resolveConfig(entity);
    const asOf = this.assertAsOf(entity, config, query.asOf);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const d = this.delegate(entity);

    const where: Record<string, unknown> = {};
    // Soft-deleted rows (is_active = false) are hidden from list views.
    if (config.isActive) where.is_active = true;
    if (config.temporal && asOf) {
      where.effective_from = { lte: asOf };
      where.OR = [{ effective_to: null }, { effective_to: { gte: asOf } }];
    }
    if (query.search) {
      where.OR = [
        ...(where.OR && Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
        ...config.searchable.map((f) => ({ [f]: { contains: query.search, mode: 'insensitive' } })),
      ];
    }

    const [total, rows] = await Promise.all([
      d.count({ where }),
      d.findMany({
        where,
        orderBy: config.searchable[0] ? { [config.searchable[0]]: 'asc' } : { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        ...(config.include ? { include: config.include } : {}),
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  async getOne(entity: string, id: string, asOf?: string) {
    const config = this.resolveConfig(entity);
    const date = this.assertAsOf(entity, config, asOf);
    const d = this.delegate(entity);
    const where: Record<string, unknown> = { id };
    if (config.temporal && date) {
      where.effective_from = { lte: date };
      where.OR = [{ effective_to: null }, { effective_to: { gte: date } }];
    }
    const row = await d.findFirst({ where });
    if (!row) throw new NotFoundException(`${config.label} ${id} tidak ditemukan.`);
    return row;
  }

  /**
   * Coerce date-only strings ("2024-01-15") to the ISO-8601 datetime Prisma
   * DateTime requires. HTML `<input type="date">` submits a bare YYYY-MM-DD,
   * which Prisma rejects with a validation error ("Data tidak valid."); this
   * makes master CRUD accept the same payload from every client.
   */
  private normalizeDateInputs(body: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      out[k] = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
    }
    return out;
  }

  async create(entity: string, body: Record<string, unknown>) {
    this.resolveConfig(entity);
    return this.delegate(entity).create({ data: this.normalizeDateInputs(body) as never });
  }

  async update(entity: string, id: string, body: Record<string, unknown>) {
    const config = this.resolveConfig(entity);
    const d = this.delegate(entity);
    const existing = await d.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${config.label} ${id} tidak ditemukan.`);
    return d.update({ where: { id }, data: this.normalizeDateInputs(body) as never });
  }

  async remove(entity: string, id: string) {
    const config = this.resolveConfig(entity);
    const d = this.delegate(entity);
    const existing = await d.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${config.label} ${id} tidak ditemukan.`);

    // Soft delete when the table has is_active (keeps referential integrity).
    if ('is_active' in (existing as Record<string, unknown>)) {
      return d.update({ where: { id }, data: { is_active: false } });
    }
    return d.delete({ where: { id } });
  }
}
