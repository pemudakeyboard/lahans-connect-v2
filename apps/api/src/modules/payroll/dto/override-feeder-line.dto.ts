import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * M6 — Koreksi manual satu baris feeder sebelum periode dikunci (Comben).
 *
 * Write-protects the line: sets is_manual_override=true so a re-run of the
 * aggregation never deletes/recomputes it. `amount` is required (in Rupiah);
 * `reason` documents the override for the audit trail.
 */
export class OverrideFeederLineDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
