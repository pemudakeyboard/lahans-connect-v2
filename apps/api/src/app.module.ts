import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiConfigModule } from './core/config/api-config.module';
import { CoreRulesModule } from './core/rules/rules.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthCoreModule } from './core/auth/auth-core.module';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ConfigModule as M8BConfigModule } from './modules/config/config.module';
import { MasterModule } from './modules/master/master.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PermissionGuard } from './core/auth/guards/permission.guard';
import { AuditInterceptor } from './core/audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ApiConfigModule,
    CoreRulesModule,
    PrismaModule,
    AuthCoreModule,
    AuthModule,
    IdentityModule,
    M8BConfigModule,
    MasterModule,
    LeaveModule,
  ],
  providers: [
    // PermissionGuard is global — deny-by-default (FR-M0-004). Public endpoints
    // are marked with @Public(); every other route requires a permission.
    { provide: APP_GUARD, useClass: PermissionGuard },
    // AuditInterceptor captures actor/IP/user-agent on mutating requests (G5)
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
