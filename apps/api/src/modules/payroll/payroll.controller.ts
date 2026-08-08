import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { PayrollService } from './payroll.service';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { OverrideFeederLineDto } from './dto/override-feeder-line.dto';

/**
 * M6 — Payroll feeder (BRD §11.4, FR-PY-001..004).
 *
 * Every handler is data-scoped by PayrollService through PayrollScopeService:
 * a Comben user bound to the SALES division aggregates/sees only the sales
 * employees; the PABRIK-bound user only the operators. Enforcement, not UI.
 *
 * Endpoints:
 *  - GET  /payroll/periods                  daftar periode (scoped info)
 *  - POST /payroll/periods                  buka periode (company scope only)
 *  - POST /payroll/periods/:id/validate     blokir => daftar blocker (UAT-M6-03)
 *  - POST /payroll/periods/:id/lock         validate + agregasi cakupan saya
 *  - POST /payroll/periods/:id/close        tutup periode
 *  - GET  /payroll/periods/:id/feeder       baris feeder (scoped)
 *  - GET  /payroll/periods/:id/feeder/export   CSV (BRD export)
 *  - GET  /payroll/feeder-lines/:id/trace   riwayat kalkulasi
 *  - POST /payroll/feeder-lines/:id/override   koreksi manual
 */
@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('periods')
  @RequirePermission('payroll.period.read')
  @ApiOperation({ summary: 'Daftar periode penggajian' })
  listPeriods(
    @CurrentUser() user: ICurrentUser,
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.payroll.listPeriods(user, query);
  }

  @Post('periods')
  @RequirePermission('payroll.period.write')
  @ApiOperation({ summary: 'Buka periode penggajian baru (cakupan perusahaan)' })
  openPeriod(@CurrentUser() user: ICurrentUser, @Body() dto: CreatePayrollPeriodDto) {
    return this.payroll.openPeriod(user, dto);
  }

  @Post('periods/:id/validate')
  @RequirePermission('payroll.period.close')
  @ApiOperation({ summary: 'Validasi periode — daftar blocker (UAT-M6-03)' })
  validate(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.payroll.validatePeriod(user, id);
  }

  @Post('periods/:id/lock')
  @RequirePermission('payroll.period.close')
  @ApiOperation({ summary: 'Kunci periode — agregasi cakupan saya' })
  lock(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.payroll.lockPeriod(user, id);
  }

  @Post('periods/:id/close')
  @RequirePermission('payroll.period.close')
  @ApiOperation({ summary: 'Tutup periode' })
  close(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.payroll.closePeriod(user, id);
  }

  @Get('periods/:id/feeder')
  @RequirePermission('payroll.feeder.read')
  @ApiOperation({ summary: 'Baris feeder periode (cakupan saya)' })
  listFeeder(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.payroll.listFeeder(user, id, query);
  }

  @Get('periods/:id/feeder/export')
  @RequirePermission('payroll.feeder.export')
  @ApiOperation({ summary: 'Export feeder CSV (UTF-8 BOM)' })
  async exportFeeder(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
    @Res() res: Response,
  ) {
    const csv = await this.payroll.exportFeeder(user, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-feeder-${id}.csv"`);
    res.send(csv);
  }

  @Get('feeder-lines/:id/trace')
  @RequirePermission('payroll.feeder.read')
  @ApiOperation({ summary: 'Riwayat kalkulasi satu baris feeder' })
  getTrace(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.payroll.getFeederTrace(user, id);
  }

  @Post('feeder-lines/:id/override')
  @RequirePermission('payroll.feeder.override')
  @ApiOperation({ summary: 'Koreksi manual satu baris feeder' })
  override(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
    @Body() dto: OverrideFeederLineDto,
  ) {
    return this.payroll.overrideFeederLine(user, id, dto);
  }
}
