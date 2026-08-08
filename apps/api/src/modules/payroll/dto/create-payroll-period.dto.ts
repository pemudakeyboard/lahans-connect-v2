import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * M6 — Buka periode penggajian.
 *
 * `code` is the unique period label (e.g. "2026-08"); `cutoff_start`/`cutoff_end`
 * bound the work-date window aggregated into the feeder (BRD source-of-truth
 * cutoff: 22 → 21 of the following month).
 */
export class CreatePayrollPeriodDto {
  @IsString()
  code!: string;

  @IsDateString()
  cutoff_start!: string;

  @IsDateString()
  cutoff_end!: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;
}
