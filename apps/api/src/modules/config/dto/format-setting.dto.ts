import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/** Create/update payload for format_settings (FR-M8B-001..003). */
export class UpsertFormatSettingDto {
  @ApiProperty({ example: 'date.display' })
  @IsString()
  format_key!: string;

  @ApiProperty({ example: 'DD/MM/YYYY' })
  @IsString()
  format_value!: string;

  @ApiPropertyOptional({ enum: ['STRING', 'NUMBER', 'JSON'], default: 'STRING' })
  @IsOptional()
  @IsIn(['STRING', 'NUMBER', 'JSON'])
  data_type?: string = 'STRING';

  @ApiPropertyOptional({ enum: ['WEB', 'MOBILE', 'BOTH', 'EXPORT'], default: 'BOTH' })
  @IsOptional()
  @IsIn(['WEB', 'MOBILE', 'BOTH', 'EXPORT'])
  applies_to?: string = 'BOTH';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_editable?: boolean = true;
}
