import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * S6 — Request an attendance correction (FR-M2-012, PRD 6.4.1).
 *
 * `proposed_values` carries the corrected fields the employee wants; the
 * approval chain (Atasan → Comben) decides, and on final APPROVE the values are
 * applied to attendance_daily with source=MANUAL. `reason_code` must exist in
 * reference_data category ATTENDANCE_CORRECTION_REASON (no frontend arrays).
 */
export class CreateCorrectionDto {
  @IsUUID()
  attendance_daily_id!: string;

  @IsString()
  reason_code!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  proposed_values?: {
    first_in_at?: string;
    last_out_at?: string;
    status?: string;
    late_minutes?: number;
    early_leave_minutes?: number;
    work_minutes?: number;
  };
}
