import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

/**
 * S6 — Clock-in/out payload (BRD §7.3, FR-M2-002/006).
 *
 * lat/lng travel as strings to preserve exactly 6 decimals into the
 * Decimal(9,6) column; `gps_accuracy_m` as a string for Decimal(8,2).
 * `client_request_id` is the FR-M2-006 idempotency key (unique in schema).
 */
export class ClockInDto {
  @IsIn(['IN', 'OUT'])
  log_type!: 'IN' | 'OUT';

  @IsOptional()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  latitude?: string;

  @IsOptional()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  longitude?: string;

  @IsOptional()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/)
  gps_accuracy_m?: string;

  @IsOptional()
  @IsISO8601()
  device_time?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsBoolean()
  is_mock_location?: boolean;

  @IsOptional()
  @IsBoolean()
  is_offline_sync?: boolean;

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  app_version?: string;

  @IsOptional()
  @IsUUID()
  client_request_id?: string;

  @IsOptional()
  @IsObject()
  raw_payload?: Record<string, unknown>;
}
