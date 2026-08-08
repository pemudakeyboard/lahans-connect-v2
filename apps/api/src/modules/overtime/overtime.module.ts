import { Module } from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { ConfigModule } from '../config/config.module';

/**
 * S8-M3 — Lembur.
 *
 * Depends on ConfigModule for number-sequence reservation (DOC_OVERTIME).
 * ParameterService and TemporalResolver come from the @Global CoreRulesModule.
 */
@Module({
  imports: [ConfigModule],
  controllers: [OvertimeController],
  providers: [OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
