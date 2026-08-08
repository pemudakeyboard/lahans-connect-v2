import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

/**
 * S7-M3 — Cuti & Izin (BP-04, BP-05).
 *
 * Endpoints:
 *  - GET  /leave/balance          saldo cuti (Hak | Terpakai | Pending | Sisa)
 *  - GET  /leave/ledger           riwayat ledger (append-only)
 *  - POST /leave/requests         ajukan cuti/izin
 *  - GET  /leave/requests         pengajuan saya
 *  - GET  /leave/inbox            approval inbox (tasks assigned to me)
 *  - POST /leave/requests/:id/decide   approve/reject/return
 *  - POST /leave/requests/:id/cancel   batalkan
 *  - POST /leave/grant            jalankan pemberian hak tahunan (admin/job)
 */
@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  // ---------------------------------------------------------------------------
  // SALDO
  // ---------------------------------------------------------------------------

  @Get('balance')
  @RequirePermission('leave.balance.read')
  @ApiOperation({ summary: 'Saldo cuti (Hak | Terpakai | Pending | Sisa)' })
  balance(
    @CurrentUser() user: { employeeId?: string },
    @Query('employeeId') employeeId?: string,
    @Query('asOf') asOf?: string,
  ) {
    const target = employeeId ?? user.employeeId;
    if (!target) throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    return this.leave.getBalance(target, asOf);
  }

  @Get('ledger')
  @RequirePermission('leave.balance.read')
  @ApiOperation({ summary: 'Riwayat ledger saldo cuti (append-only)' })
  ledger(@CurrentUser() user: { employeeId?: string }, @Query('leaveTypeId') leaveTypeId?: string) {
    if (!user.employeeId) throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    return this.leave.getLedger(user.employeeId, leaveTypeId);
  }

  // ---------------------------------------------------------------------------
  // PENGAJUAN
  // ---------------------------------------------------------------------------

  @Get('requests')
  @RequirePermission('leave.request.read')
  @ApiOperation({ summary: 'Daftar pengajuan saya' })
  myRequests(
    @CurrentUser() user: { employeeId?: string },
    @Query() query: { page?: number; pageSize?: number },
  ) {
    if (!user.employeeId) throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    return this.leave.listMyRequests(user.employeeId, query);
  }

  @Post('requests')
  @RequirePermission('leave.request.write')
  @ApiOperation({ summary: 'Ajukan cuti/izin' })
  create(
    @CurrentUser() user: { userId: string; employeeId?: string },
    @Body() dto: CreateLeaveRequestDto,
  ) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.leave.create(user.employeeId, user.userId, dto);
  }

  @Get('inbox')
  @RequirePermission('leave.request.approve')
  @ApiOperation({ summary: 'Approval inbox (tugas approval untuk saya)' })
  inbox(
    @CurrentUser() user: { userId: string },
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.leave.listInbox(user.userId, query);
  }

  @Post('requests/:id/decide')
  @RequirePermission('leave.request.approve')
  @ApiOperation({ summary: 'Putuskan approval (approve/reject/return)' })
  decide(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() body: { action: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string },
  ) {
    return this.leave.decide(id, user.userId, body.action, body.comment);
  }

  @Post('requests/:id/cancel')
  @RequirePermission('leave.request.write')
  @ApiOperation({ summary: 'Batalkan pengajuan (PENDING/RETURNED)' })
  cancel(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.leave.cancel(id, user.userId);
  }

  // ---------------------------------------------------------------------------
  // GRANT (admin / scheduler)
  // ---------------------------------------------------------------------------

  @Post('grant')
  @RequirePermission('leave.balance.write')
  @ApiOperation({ summary: 'Pemberian hak cuti tahunan (anniversary/prorata)' })
  grant(@CurrentUser() user: { userId: string }, @Query('asOf') asOf?: string) {
    return this.leave.runAnnualGrant(asOf ? new Date(asOf) : new Date(), user.userId);
  }
}
