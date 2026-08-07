import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthCoreModule } from '../../core/auth/auth-core.module';
import { JwtStrategy } from '../../core/auth/strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MeNavigationService } from './me-navigation.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuthCoreModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MeNavigationService],
  exports: [AuthService],
})
export class AuthModule {}