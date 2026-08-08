import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { OvertimeService } from './overtime.service';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';

/**
 * S8-M3 — Lembur.
 *
 * Endpoints:
 *  - POST /overtime/requests         ajukan lembur
 *  - GET  /overtime/requests         pengajuan saya
 *  - GET  /overtime/inbox            approval inbox (tasks assigned to me)
 *  - POST /overtime/requests/:id/decide   approve/reject/return (+ actual_hours)
 *  - POST /overtime/requests/:id/cancel   batalkan
 */
@ApiTags('overtime')
@ApiBearerAuth()
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtime: OvertimeService) {}

  @Get('requests')
  @RequirePermission('overtime.request.read')
  @ApiOperation({ summary: 'Daftar pengajuan lembur saya' })
  myRequests(
    @CurrentUser() user: { employeeId?: string },
    @Query() query: { page?: number; pageSize?: number },
  ) {
    if (!user.employeeId) throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    return this.overtime.listMyRequests(user.employeeId, query);
  }

  @Post('requests')
  @RequirePermission('overtime.request.write')
  @ApiOperation({ summary: 'Ajukan lembur' })
  create(
    @CurrentUser() user: { userId: string; employeeId?: string },
    @Body() dto: CreateOvertimeRequestDto,
  ) {
    if (!user.employeeId) {
      throw new UnauthorizedException('Pengguna tidak terhubung ke karyawan.');
    }
    return this.overtime.create(user.employeeId, user.userId, dto);
  }

  @Get('inbox')
  @RequirePermission('overtime.request.approve')
  @ApiOperation({ summary: 'Approval inbox (tugas approval untuk saya)' })
  inbox(
    @CurrentUser() user: { userId: string },
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.overtime.listInbox(user.userId, query);
  }

  @Post('requests/:id/decide')
  @RequirePermission('overtime.request.approve')
  @ApiOperation({ summary: 'Putuskan approval (approve/reject/return + actual_hours)' })
  decide(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body()
    body: {
      action: 'APPROVE' | 'REJECT' | 'RETURN';
      comment?: string;
      actual_hours?: number;
    },
  ) {
    return this.overtime.decide(id, user.userId, body.action, body.comment, body.actual_hours);
  }

  @Post('requests/:id/cancel')
  @RequirePermission('overtime.request.write')
  @ApiOperation({ summary: 'Batalkan pengajuan (PENDING/RETURNED)' })
  cancel(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.overtime.cancel(id, user.userId);
  }
}
