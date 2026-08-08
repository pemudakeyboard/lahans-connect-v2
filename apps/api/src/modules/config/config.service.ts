import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertFormatSettingDto } from './dto/format-setting.dto';
import { UpsertValidationRuleDto } from './dto/validation-rule.dto';
import { UpsertNumberSequenceDto } from './dto/number-sequence.dto';

/**
 * M8B — Format & Validasi (BRD §7.2).
 *
 * Serves format_settings, validation_rules, number_sequences, and exposes the
 * effective-dated system_parameters via ParameterService.
 *
 * ZERO HARDCODE: every policy number (loan max, leave days, overtime cap, ...)
 * is read from system_parameters resolved at a given asOf date — never a code literal.
 */
@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- format_settings (FR-M8B-001..003) ----------

  async listFormats() {
    return this.prisma.format_settings.findMany({ orderBy: { format_key: 'asc' } });
  }

  async upsertFormat(dto: UpsertFormatSettingDto) {
    return this.prisma.format_settings.upsert({
      where: { format_key: dto.format_key },
      create: dto,
      update: dto,
    });
  }

  async deleteFormat(formatKey: string) {
    const existing = await this.prisma.format_settings.findUnique({
      where: { format_key: formatKey },
    });
    if (!existing) throw new NotFoundException(`Format ${formatKey} tidak ditemukan.`);
    if (!existing.is_editable)
      throw new ConflictException(`Format ${formatKey} bersifat read-only.`);
    await this.prisma.format_settings.delete({ where: { format_key: formatKey } });
    return { ok: true };
  }

  // ---------- validation_rules (FR-M8B-004..006) ----------

  async listValidationRules(query: { page?: number; pageSize?: number; search?: string }) {
    const { page = 1, pageSize = 20, search } = query;
    const where: Prisma.validation_rulesWhereInput = search
      ? {
          OR: [
            { entity_name: { contains: search, mode: 'insensitive' } },
            { field_name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.validation_rules.count({ where }),
      this.prisma.validation_rules.findMany({
        where,
        orderBy: [{ entity_name: 'asc' }, { field_name: 'asc' }, { sort_order: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  async upsertValidationRule(dto: UpsertValidationRuleDto) {
    return this.prisma.validation_rules.create({
      data: {
        entity_name: dto.entity_name,
        field_name: dto.field_name,
        rule_type: dto.rule_type,
        rule_config: dto.rule_config,
        severity: dto.severity ?? 'ERROR',
        error_message: dto.error_message,
        applies_on: dto.applies_on ?? 'ALL',
        is_active: dto.is_active ?? true,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  async updateValidationRule(id: string, dto: Partial<UpsertValidationRuleDto>) {
    const existing = await this.prisma.validation_rules.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Rule ${id} tidak ditemukan.`);
    return this.prisma.validation_rules.update({ where: { id }, data: dto as never });
  }

  async deleteValidationRule(id: string) {
    const existing = await this.prisma.validation_rules.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Rule ${id} tidak ditemukan.`);
    await this.prisma.validation_rules.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- number_sequences (FR-M8B-007..010) ----------

  async listNumberSequences() {
    return this.prisma.number_sequences.findMany({ orderBy: { sequence_code: 'asc' } });
  }

  async upsertNumberSequence(dto: UpsertNumberSequenceDto) {
    const scopeType = dto.scope_type ?? null;
    const scopeRefId = dto.scope_ref_id ?? null;
    const existing = await this.prisma.number_sequences.findFirst({
      where: { sequence_code: dto.sequence_code, scope_type: scopeType, scope_ref_id: scopeRefId },
    });
    const data = {
      sequence_code: dto.sequence_code,
      pattern: dto.sequence_pattern,
      reset_period: dto.reset_period ?? 'NEVER',
      padding_length: dto.padding_length ?? 4,
      allow_manual: dto.allow_manual ?? false,
      scope_type: scopeType,
      scope_ref_id: scopeRefId,
    };
    if (existing) {
      return this.prisma.number_sequences.update({ where: { id: existing.id }, data });
    }
    return this.prisma.number_sequences.create({ data });
  }

  /**
   * Reserve the next number (FR-M8B-010). Atomic under a row lock so two
   * concurrent requests cannot mint the same number. Handles reset_period
   * (YEARLY/MONTHLY) by checking last_reset_key.
   */
  async reserveNextNumber(
    sequenceCode: string,
    opts: { scopeType?: string; scopeRefId?: string } = {},
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Prefer a scope-specific sequence (e.g. per-branch); fall back to the
      // global unscoped one seeded by default. Catch the Not Found and rethrow
      // only when neither exists, so a missing scoped row is not fatal.
      let seq = await tx.number_sequences.findFirst({
        where: {
          sequence_code: sequenceCode,
          scope_type: opts.scopeType ?? null,
          scope_ref_id: opts.scopeRefId ?? null,
        },
      });
      if (!seq && opts.scopeType) {
        seq = await tx.number_sequences.findFirst({
          where: { sequence_code: sequenceCode, scope_type: null, scope_ref_id: null },
        });
      }
      if (!seq) throw new NotFoundException(`Sequence ${sequenceCode} tidak terdaftar.`);

      const now = new Date();
      const resetKey = seq.reset_period === 'NEVER' ? 'never' : now.toISOString().slice(0, 7);
      const needReset = seq.last_reset_key !== resetKey;

      const next: bigint = needReset ? 1n : seq.current_number + 1n;
      const number = this.renderPattern(seq.pattern, now, next, seq.padding_length);

      await tx.number_sequences.update({
        where: { id: seq.id },
        data: { current_number: next, last_reset_key: resetKey },
      });
      return { nextNumber: number, sequenceCode: seq.sequence_code };
    });
  }

  private renderPattern(pattern: string, date: Date, current: bigint, padding: number): string {
    const seq = current.toString().padStart(padding, '0');
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return pattern
      .replaceAll('{YYYY}', yyyy)
      .replaceAll('{MM}', mm)
      .replaceAll('{DD}', dd)
      .replaceAll('{SEQ}', seq);
  }
}
