import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Day portion for a leave day. FULL = one working day; FIRST_HALF / SECOND_HALF
 * = half-day (only for leave types with allow_half_day, e.g. CUTI_TAHUNAN).
 */
export type DayPortion = 'FULL' | 'FIRST_HALF' | 'SECOND_HALF';

export class CreateLeaveRequestDto {
  @IsUUID()
  leave_type_id!: string;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  /** ISO date strings for each leave day (defaults to all working days in range). */
  @IsOptional()
  @IsArray()
  days?: string[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  is_emergency?: boolean;

  @IsOptional()
  @IsBoolean()
  is_backdated?: boolean;

  @IsOptional()
  @IsString()
  attachment_urls?: string;
}
