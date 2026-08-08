import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { ConfigModule } from '../config/config.module';
import { RosterModule } from '../roster/roster.module';

/**
 * S7-M3 — Cuti & Izin (BP-04, BP-05).
 *
 * Depends on ConfigModule for number-sequence reservation (DOC_LEAVE/DOC_IZIN).
 * ParameterService and TemporalResolver come from the @Global CoreRulesModule.
 * RosterModule supplies the shared schedule resolver so leave working-day
 * counting honors the same roster as attendance.
 */
@Module({
  imports: [ConfigModule, RosterModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
