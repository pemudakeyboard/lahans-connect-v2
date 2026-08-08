import { Global, Module } from '@nestjs/common';
import { DelegationService } from './delegation.service';

/**
 * M0 — Approval delegation (FR-M0-060/061) internal wiring.
 *
 * @Global so any domain module (leave, overtime, attendance, roster) can inject
 * DelegationService without cross-importing. PrismaService comes from the
 * @Global PrismaModule.
 */
@Global()
@Module({
  providers: [DelegationService],
  exports: [DelegationService],
})
export class DelegationModule {}
