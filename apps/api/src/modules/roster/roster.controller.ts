import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { RosterService } from './roster.service';
import {
  AssignScheduleDto,
  CreateDelegationDto,
  CreateOverrideDto,
  CreateShiftDefinitionDto,
  CreateShiftPatternDto,
} from './dto/shift-config.dto';

/**
 * M2B — Roster Management (FR-M2B-001..004, FR-M0-060/061).
 *
 * Endpoints:
 *  - GET  /roster/calendar                 one row per employee × date (branch-filterable)
 *  - GET  /roster/overrides / POST /roster/overrides    per-date roster rows
 *  - POST /roster/schedules/:id/assign      bulk employee → work_schedule
 *  - GET/POST/PUT/DELETE /roster/shifts     shift definitions (NORMAL/PAGI/SIANG/MALAM)
 *  - GET/POST /roster/patterns              rotation patterns (SHIFT work_schedules)
 *  - GET  /roster/delegations / POST /roster/delegations / DELETE /roster/delegations/:id
 *    delegation (FR-M0-060/061) — roster duties are delegable
 */
@ApiTags('roster')
@ApiBearerAuth()
@Controller('roster')
export class RosterController {
  constructor(private readonly roster: RosterService) {}

  // -- calendar --------------------------------------------------------------

  @Get('calendar')
  @RequirePermission('roster.calendar.read')
  @ApiOperation({ summary: 'Kalender roster (per karyawan × tanggal)' })
  calendar(
    @CurrentUser() user: CurrentUser,
    @Query() query: { from: string; to: string; branchId?: string },
  ) {
    return this.roster.calendar(user, query);
  }

  // -- overrides -------------------------------------------------------------

  @Get('overrides')
  @RequirePermission('roster.override.read')
  @ApiOperation({ summary: 'Daftar override jadwal (per tanggal)' })
  overrides(
    @CurrentUser() user: CurrentUser,
    @Query() query: { from?: string; to?: string; employeeId?: string },
  ) {
    return this.roster.listOverrides(user, query);
  }

  @Post('overrides')
  @RequirePermission('roster.override.write')
  @ApiOperation({ summary: 'Buat override jadwal (tukar shift / libur)' })
  createOverride(@CurrentUser() user: CurrentUser, @Body() dto: CreateOverrideDto) {
    return this.roster.createOverride(user, dto);
  }

  // -- bulk assignment -------------------------------------------------------

  @Post('schedules/:id/assign')
  @RequirePermission('roster.assign.write')
  @ApiOperation({ summary: 'Tetapkan jadwal ke banyak karyawan (bulk)' })
  assignSchedules(
    @CurrentUser() user: CurrentUser,
    @Param('id') scheduleId: string,
    @Body() dto: { employee_ids: string[] },
  ) {
    if (!user.userId) throw new UnauthorizedException('Pengguna tidak dikenal.');
    return this.roster.assignSchedules(user, {
      work_schedule_id: scheduleId,
      employee_ids: dto.employee_ids,
    } as AssignScheduleDto);
  }

  // -- shift definitions -----------------------------------------------------

  @Get('shifts')
  @RequirePermission('roster.shift.read')
  @ApiOperation({ summary: 'Daftar shift (NORMAL/PAGI/SIANG/MALAM)' })
  shifts(@CurrentUser() user: CurrentUser) {
    return this.roster.listShifts(user);
  }

  @Post('shifts')
  @RequirePermission('roster.shift.write')
  @ApiOperation({ summary: 'Buat shift baru' })
  createShift(@CurrentUser() user: CurrentUser, @Body() dto: CreateShiftDefinitionDto) {
    return this.roster.createShift(user, dto);
  }

  @Put('shifts/:id')
  @RequirePermission('roster.shift.write')
  @ApiOperation({ summary: 'Perbarui shift' })
  updateShift(
    @CurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateShiftDefinitionDto,
  ) {
    return this.roster.updateShift(user, id, dto);
  }

  @Delete('shifts/:id')
  @RequirePermission('roster.shift.write')
  @ApiOperation({ summary: 'Hapus shift (nahkodai jika dipakai rotasi)' })
  deleteShift(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.roster.deleteShift(user, id);
  }

  // -- rotation patterns -----------------------------------------------------

  @Get('patterns')
  @RequirePermission('roster.shift.read')
  @ApiOperation({ summary: 'Daftar pola rotasi shift' })
  patterns(@CurrentUser() user: CurrentUser) {
    return this.roster.listPatterns(user);
  }

  @Post('patterns')
  @RequirePermission('roster.shift.write')
  @ApiOperation({ summary: 'Buat pola rotasi shift' })
  createPattern(@CurrentUser() user: CurrentUser, @Body() dto: CreateShiftPatternDto) {
    return this.roster.createPattern(user, dto);
  }

  // -- delegation (FR-M0-060/061) --------------------------------------------

  @Get('delegations')
  @RequirePermission('roster.delegation.read')
  @ApiOperation({ summary: 'Daftar delegasi saya (keluar + masuk)' })
  delegations(@CurrentUser() user: CurrentUser) {
    return this.roster.listDelegations(user);
  }

  @Post('delegations')
  @RequirePermission('roster.delegation.write')
  @ApiOperation({ summary: 'Buat delegasi tugas roster' })
  createDelegation(@CurrentUser() user: CurrentUser, @Body() dto: CreateDelegationDto) {
    return this.roster.createDelegation(user, dto);
  }

  @Delete('delegations/:id')
  @RequirePermission('roster.delegation.write')
  @ApiOperation({ summary: 'Batalkan delegasi' })
  cancelDelegation(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.roster.cancelDelegation(user, id);
  }
}
