import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Pagination + search query shared by M8B/M1B list endpoints (BRD 7.4). */
export class ListQueryDto {
  @ApiPropertyOptional({ description: 'Halaman (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Ukuran halaman', default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Kata kunci pencarian bebas' })
  @IsOptional()
  @IsString()
  search?: string;
}
