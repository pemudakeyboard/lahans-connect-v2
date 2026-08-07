import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Payload for number_sequences (FR-M8B-007..010). */
export class UpsertNumberSequenceDto {
  @ApiProperty({ example: 'EMPLOYEE_NIK' })
  @IsString()
  sequence_code!: string;

  @ApiProperty({ example: 'EMP-{YYYY}-{SEQ}', description: 'Support token: {YYYY},{MM},{DD},{SEQ}' })
  @IsString()
  sequence_pattern!: string;

  @ApiPropertyOptional({ enum: ['NEVER', 'YEARLY', 'MONTHLY'], default: 'NEVER' })
  @IsOptional()
  @IsIn(['NEVER', 'YEARLY', 'MONTHLY'])
  reset_period?: string = 'NEVER';

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  padding_length?: number = 4;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allow_manual?: boolean = false;

  @ApiPropertyOptional({ description: 'Scope: NULL=global, BRANCH=id branch, COMPANY=id company' })
  @IsOptional()
  @IsString()
  scope_type?: string;

  @ApiPropertyOptional({ description: 'ID sesuai scope_type (Uuid)' })
  @IsOptional()
  @Type(() => String)
  scope_ref_id?: string;
}

/** Response ketika sebuah nomor di-reserve (FR-M8B-010). */
export class ReserveNumberResultDto {
  @ApiProperty({ example: 'EMP-2026-0001' })
  nextNumber!: string;

  @ApiProperty()
  sequenceCode!: string;
}