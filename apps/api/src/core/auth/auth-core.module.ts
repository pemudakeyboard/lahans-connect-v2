import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiConfigService } from '../config/api-config.service';
import { AccessResolver } from './access-resolver.service';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';

/**
 * Global auth primitives shared across modules (PermissionGuard, AccessResolver,
 * PasswordService, TotpService). Avoids re-registering the guard in every module.
 *
 * JwtModule is registered here (not in AuthModule) because PermissionGuard is a
 * global APP_GUARD that injects JwtService — it must be resolvable outside the
 * AuthModule scope.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ApiConfigService],
      useFactory: (config: ApiConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessTtlSeconds },
      }),
    }),
  ],
  providers: [AccessResolver, PasswordService, TotpService],
  exports: [JwtModule, AccessResolver, PasswordService, TotpService],
})
export class AuthCoreModule {}