import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';

/**
 * M0 — Identity administration (users, groups, memberships).
 */
@Module({
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}