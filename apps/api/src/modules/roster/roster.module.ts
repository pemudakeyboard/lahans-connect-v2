import { Module } from '@nestjs/common';
import { RosterService } from './roster.service';
import { RosterController } from './roster.controller';
import { PayrollModule } from '../payroll/payroll.module';

/**
 * M2B — Roster Management (FR-M2B-001..004, FR-M0-060/061).
 *
 * Reuses PayrollScopeService (exported by PayrollModule) for data-scoped
 * calendar/override reads. DelegationService comes from the @Global
 * DelegationModule. Shift schedule resolution is shared with attendance and
 * leave via the pure `shift-resolver` helpers.
 */
@Module({
  imports: [PayrollModule],
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
