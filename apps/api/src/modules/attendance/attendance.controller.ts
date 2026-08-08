import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from './dto/clock-in.dto';
import { CreateCorrectionDto } from './dto/create-correction.dto';

/**
 * S6 — Absensi (FR-M2-001..012).
 *
 * Endpoints:
 *  - POST /attendance/clock                 absen masuk/pulang (idempotent via client_request_id)
 *  - GET  /attendance/today                 kartu hari ini (demo web)
 *  - GET  /attendance/daily                 rekap harian (data-scoped)
 *  - POST /attendance/daily/finalize        COMBEN end-of-day derivation
 *  - POST /attendance/corrections           ajukan koreksi kehadiran
 *  - GET  /attendance/corrections           koreksi saya
 *  - GET  /attendance/corrections/inbox     approval inbox (Atasan/Comben)
 *  - POST /attendance/corrections/:id/decide approve/reject/return
 *  - POST /attendance/corrections/:id/cancel batalkan
 */
@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('clock')
  @RequirePermission('attendance.log.write')
  @ApiOperation({ summary: 'Absen masuk/pulang (geofence + idempotent)' })
  clock(@CurrentUser() user: CurrentUser, @Body() dto: ClockInDto) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.attendance.clock(user.employeeId, dto);
  }

  @Get('today')
  @RequirePermission('attendance.daily.read')
  @ApiOperation({ summary: 'Kartu kehadiran hari ini' })
  today(@CurrentUser() user: CurrentUser) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.attendance.today(user);
  }

  @Get('daily')
  @RequirePermission('attendance.daily.read')
  @ApiOperation({ summary: 'Rekap harian (data-scoped)' })
  listDaily(
    @CurrentUser() user: CurrentUser,
    @Query()
    query: { page?: number; pageSize?: number; from?: string; to?: string; employeeId?: string },
  ) {
    return this.attendance.listDaily(user, query);
  }

  @Post('daily/finalize')
  @RequirePermission('attendance.daily.write')
  @ApiOperation({ summary: 'Finalisasi rekap harian (COMBEN)' })
  finalizeDay(
    @CurrentUser() user: CurrentUser,
    @Body() body: { date: string; employee_id?: string },
  ) {
    return this.attendance.finalizeDay(user, body.date, body.employee_id);
  }

  @Post('corrections')
  @RequirePermission('attendance.correction.write')
  @ApiOperation({ summary: 'Ajukan koreksi kehadiran (Atasan → Comben)' })
  createCorrection(@CurrentUser() user: CurrentUser, @Body() dto: CreateCorrectionDto) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.attendance.createCorrection(user.employeeId, user.userId, dto);
  }

  @Get('corrections')
  @RequirePermission('attendance.correction.read')
  @ApiOperation({ summary: 'Koreksi kehadiran saya' })
  myCorrections(
    @CurrentUser() user: CurrentUser,
    @Query() query: { page?: number; pageSize?: number },
  ) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.attendance.listMyCorrections(user.employeeId, query);
  }

  @Get('corrections/inbox')
  @RequirePermission('attendance.correction.approve')
  @ApiOperation({ summary: 'Approval inbox koreksi (Atasan/Comben)' })
  correctionInbox(
    @CurrentUser() user: CurrentUser,
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.attendance.listCorrectionInbox(user.userId, query);
  }

  @Post('corrections/:id/decide')
  @RequirePermission('attendance.correction.approve')
  @ApiOperation({ summary: 'Putuskan koreksi (approve/reject/return)' })
  decideCorrection(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUser,
    @Body() body: { action: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string },
  ) {
    return this.attendance.decideCorrection(id, user.userId, body.action, body.comment);
  }

  @Post('corrections/:id/cancel')
  @RequirePermission('attendance.correction.write')
  @ApiOperation({ summary: 'Batalkan koreksi (PENDING/RETURNED)' })
  cancelCorrection(@Param('id') id: string, @CurrentUser() user: CurrentUser) {
    return this.attendance.cancelCorrection(id, user.userId);
  }
}
