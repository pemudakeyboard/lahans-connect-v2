import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * S8 — Pengajuan lembur.
 *
 * `planned_hours` is what the employee asks for at submission; `actual_hours`
 * is filled by the supervisor after review (or by time-logs where available).
 * Only `actual_hours` drives the calculation.
 */
export class CreateOvertimeRequestDto {
  @IsDateString()
  overtime_date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  planned_hours!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
