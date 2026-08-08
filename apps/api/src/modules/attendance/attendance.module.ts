import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PayrollModule } from '../payroll/payroll.module';
import { RosterModule } from '../roster/roster.module';

/**
 * S6 — Absensi (BRD §6.4, FR-M2-001..012).
 *
 * Reuses PayrollScopeService (exported by PayrollModule) for data-scoped daily
 * recap — the sanctioned resolver for ALL/COMPANY/DIVISION/BRANCH/SELF scopes.
 * ParameterService comes from the @Global CoreRulesModule. RosterModule supplies
 * the shared schedule resolver (5-level priority, SHIFT rotation, night shift).
 */
@Module({
  imports: [PayrollModule, RosterModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
