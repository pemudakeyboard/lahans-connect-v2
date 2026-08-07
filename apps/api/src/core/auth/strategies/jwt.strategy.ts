import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiConfigService } from '../../config/api-config.service';

export interface JwtPayload {
  sub: string; // user id
  nik?: string;
  email?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Validates the JWT access token claims. The heavy lifting (loading the user's
 * effective permissions) is deferred to AccessResolver inside PermissionGuard —
 * this strategy only authenticates the token itself.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ApiConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  validate(payload: JwtPayload): { userId: string; type: string } {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token bukan access token.');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Token tidak valid.');
    }
    return { userId: payload.sub, type: payload.type };
  }
}
