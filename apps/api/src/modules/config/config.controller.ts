import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { ConfigService } from './config.service';
import { ListQueryDto } from './dto/common.dto';
import { UpsertFormatSettingDto } from './dto/format-setting.dto';
import { UpsertValidationRuleDto } from './dto/validation-rule.dto';
import { UpsertNumberSequenceDto } from './dto/number-sequence.dto';

@ApiTags('config')
@ApiBearerAuth()
@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  // ---------- format settings ----------

  @Get('formats')
  @RequirePermission('config.format.read')
  @ApiOperation({ summary: 'Daftar format (FR-M8B-001..003)' })
  listFormats() {
    return this.config.listFormats();
  }

  @Put('formats/:formatKey')
  @RequirePermission('config.format.write')
  @ApiOperation({ summary: 'Upsert format' })
  upsertFormat(@Param('formatKey') formatKey: string, @Body() dto: UpsertFormatSettingDto) {
    return this.config.upsertFormat({ ...dto, format_key: formatKey });
  }

  @Delete('formats/:formatKey')
  @RequirePermission('config.format.write')
  @ApiOperation({ summary: 'Hapus format (kecuali read-only)' })
  deleteFormat(@Param('formatKey') formatKey: string) {
    return this.config.deleteFormat(formatKey);
  }

  // ---------- validation rules ----------

  @Get('validation-rules')
  @RequirePermission('config.validation.read')
  @ApiOperation({ summary: 'Daftar rule validasi (FR-M8B-004)' })
  listValidationRules(@Query() query: ListQueryDto) {
    return this.config.listValidationRules(query);
  }

  @Post('validation-rules')
  @RequirePermission('config.validation.write')
  @ApiOperation({ summary: 'Buat rule validasi' })
  createValidationRule(@Body() dto: UpsertValidationRuleDto) {
    return this.config.upsertValidationRule(dto);
  }

  @Put('validation-rules/:id')
  @RequirePermission('config.validation.write')
  @ApiOperation({ summary: 'Perbarui rule validasi' })
  updateValidationRule(@Param('id') id: string, @Body() dto: Partial<UpsertValidationRuleDto>) {
    return this.config.updateValidationRule(id, dto);
  }

  @Delete('validation-rules/:id')
  @RequirePermission('config.validation.write')
  @ApiOperation({ summary: 'Hapus rule validasi' })
  deleteValidationRule(@Param('id') id: string) {
    return this.config.deleteValidationRule(id);
  }

  // ---------- number sequences ----------

  @Get('number-sequences')
  @RequirePermission('config.sequence.read')
  @ApiOperation({ summary: 'Daftar sequence (FR-M8B-007)' })
  listNumberSequences() {
    return this.config.listNumberSequences();
  }

  @Put('number-sequences/:sequenceCode')
  @RequirePermission('config.sequence.write')
  @ApiOperation({ summary: 'Upsert sequence' })
  upsertNumberSequence(
    @Param('sequenceCode') sequenceCode: string,
    @Body() dto: UpsertNumberSequenceDto,
  ) {
    return this.config.upsertNumberSequence({ ...dto, sequence_code: sequenceCode });
  }

  @Post('number-sequences/:sequenceCode/reserve')
  @RequirePermission('config.sequence.write')
  @ApiOperation({ summary: 'Reserve nomor berikutnya (FR-M8B-010)' })
  reserveNextNumber(
    @Param('sequenceCode') sequenceCode: string,
    @Query('scopeType') scopeType?: string,
    @Query('scopeRefId') scopeRefId?: string,
  ) {
    return this.config.reserveNextNumber(sequenceCode, { scopeType, scopeRefId });
  }
}
