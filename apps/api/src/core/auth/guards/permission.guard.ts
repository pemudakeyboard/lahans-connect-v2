import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccessResolver } from '../access-resolver.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApiConfigService } from '../../config/api-config.service';

/**
 * Global guard — deny-by-default (FR-M0-004).
 *
 * 1. Public routes (@Public) pass straight through.
 * 2. Otherwise the request must carry a valid JWT (authenticated user).
 * 3. The handler's @RequirePermission codes are checked against the user's
 *    effective permissions (union of groups minus DENY overrides).
 * 4. A handler with NO permission annotation is DENIED (403) — the CI gate
 *    enforces every controller declares one.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessResolver: AccessResolver,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Autentikasi diperlukan.');
    }

    // Verify JWT signature + expiry via JwtService (never trust an unverified decode)
    const token = authHeader.slice(7);
    let payload: { sub: string; type: string; jti?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; type: string; jti?: string }>(
        token,
        { secret: this.config.jwtAccessSecret },
      );
    } catch {
      throw new UnauthorizedException('Token tidak valid atau kedaluwarsa.');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token bukan access token.');
    }

    // Resolve effective access from DB (fresh every request — permission changes
    // take effect immediately, FR-M0-054).
    const user = await this.accessResolver.resolveForUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }

    request.user = { ...user, sessionId: payload.jti };

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      // deny-by-default: no annotation = forbidden
      throw new ForbiddenException({
        code: 'PERMISSION_REQUIRED',
        message: 'Endpoint ini memerlukan deklarasi permission.',
      });
    }

    const hasAny = required.some((p) => user.permissions.includes(p));
    if (!hasAny) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki hak akses.',
      });
    }

    return true;
  }
}
