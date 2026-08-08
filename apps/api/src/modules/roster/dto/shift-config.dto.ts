import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * M2B — Shift definition CRUD (FR-M2B-002).
 *
 * A shift is a re-usable time window (NORMAL/PAGI/SIANG/MALAM) scoped to one
 * company. Admin-configurable per branch/manufacturing unit via the shift
 * configuration screen — the SOP hours are ONLY the seed defaults, never
 * hardcoded in code.
 */
export class CreateShiftDefinitionDto {
  @IsString()
  code!: string; // NORMAL | PAGI | SIANG | MALAM | ...

  @IsString()
  name!: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end_time?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  break_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  late_tolerance_minutes?: number;

  /** Night shift: end_time belongs to the next Indonesian day (start > end). */
  @IsOptional()
  @IsBoolean()
  crosses_midnight?: boolean;

  @IsOptional()
  @IsBoolean()
  cover_end_date?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateShiftDefinitionDto extends CreateShiftDefinitionDto {}

/** Create a full rotation pattern (shared by validators + seed). */
export class CreateShiftPatternDto {
  @IsString()
  code!: string; // ROOKIE_3X, PABRIK_3X, ...

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  cycle_length?: number; // default 7

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  // 30 = cycle_length validation ceiling (schema @Max(31) minus 1), a DTO
  // sanity bound — not a business policy number.
  // eslint-disable-next-line lahans/no-magic-policy-numbers
  @Max(30, { each: true })
  day_indexes!: number[]; // positions bound ONLY by cycle_length

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  shift_codes!: string[]; // may contain OFF for a rest day

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** Assign one work schedule to many employees (bulk, FR-M2B-003). */
export class AssignScheduleDto {
  @IsString()
  work_schedule_id!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  employee_ids!: string[];
}

/** Per-date roster override (FR-M2B-004): shift swap or day off. */
export class CreateOverrideDto {
  @IsString()
  employee_id!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  work_date!: string;

  @IsOptional()
  @IsString()
  work_schedule_id?: string;

  @IsOptional()
  @IsBoolean()
  is_day_off?: boolean;

  @IsString()
  reason!: string;
}

/** Create a delegation (FR-M0-060/061). */
export class CreateDelegationDto {
  @IsString()
  delegate_user_id!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  module_codes?: string[];

  @IsString()
  start_date!: string;

  @IsString()
  end_date!: string;

  @IsString()
  reason!: string;
}
