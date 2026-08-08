import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { ConfigModule } from '../config/config.module';

/**
 * S7-M3 — Cuti & Izin (BP-04, BP-05).
 *
 * Depends on ConfigModule for number-sequence reservation (DOC_LEAVE/DOC_IZIN).
 * ParameterService and TemporalResolver come from the @Global CoreRulesModule.
 */
@Module({
  imports: [ConfigModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
