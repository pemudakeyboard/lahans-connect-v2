import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma } from '../../../generated/prisma';

/**
 * Validation rule payload (FR-M8B-004..006).
 *
 * rule_config shape depends on rule_type:
 *   REQUIRED        -> {}
 *   REGEX           -> { pattern: "...", flags?: "i" }
 *   RANGE           -> { min?: number, max?: number }
 *   LENGTH          -> { min?: number, max?: number }
 *   UNIQUE          -> { entity: "employees", field: "nik" }
 *   CROSS_FIELD     -> { operator: ">", field_b: "resign_date" }
 *   LOOKUP          -> { reference: "EMPLOYMENT_STATUS" }
 */
export class UpsertValidationRuleDto {
  @ApiProperty({ example: 'employees' })
  @IsString()
  entity_name!: string;

  @ApiProperty({ example: 'nik' })
  @IsString()
  field_name!: string;

  @ApiProperty({ enum: ['REQUIRED', 'REGEX', 'RANGE', 'UNIQUE', 'LENGTH', 'CROSS_FIELD', 'LOOKUP'] })
  @IsIn(['REQUIRED', 'REGEX', 'RANGE', 'UNIQUE', 'LENGTH', 'CROSS_FIELD', 'LOOKUP'])
  rule_type!: string;

  @ApiProperty({ description: 'Konfigurasi sesuai rule_type (lihat doc DTO)' })
  @IsObject()
  rule_config!: Prisma.InputJsonValue;

  @ApiPropertyOptional({ enum: ['ERROR', 'WARNING', 'INFO'], default: 'ERROR' })
  @IsOptional()
  @IsIn(['ERROR', 'WARNING', 'INFO'])
  severity?: string = 'ERROR';

  @ApiProperty({ example: 'NIK wajib berisi 8 digit.' })
  @IsString()
  error_message!: string;

  @ApiPropertyOptional({ enum: ['CREATE', 'UPDATE', 'IMPORT', 'ALL'], default: 'ALL' })
  @IsOptional()
  @IsIn(['CREATE', 'UPDATE', 'IMPORT', 'ALL'])
  applies_on?: string = 'ALL';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number = 0;
}