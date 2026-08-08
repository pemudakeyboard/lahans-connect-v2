import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../core/auth/password.service';
import { TotpService } from '../../core/auth/totp.service';
import { ApiConfigService } from '../../core/config/api-config.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly password: PasswordService,
    private readonly totp: TotpService,
    private readonly config: ApiConfigService,
  ) {}

  /**
   * Login by NIK or email + password (FR-M0-011). Returns a token pair.
   * Enforces: account lockout (FR-M0-013). Authenticator/OTP 2FA was removed
   * from the login flow per product decision — no TOTP step at sign-in.
   */
  async login(identifier: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ login_nik: identifier }, { email: identifier }],
      },
    });
    if (!user) {
      throw new UnauthorizedException('Identitas atau kata sandi salah.');
    }

    if (user.status === 'LOCKED' && user.locked_until && user.locked_until > new Date()) {
      throw new ForbiddenException({ code: 'ACCOUNT_LOCKED', message: 'Akun terkunci sementara.' });
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun tidak aktif. Hubungi admin.',
      });
    }

    const valid = await this.password.verify(user.password_hash, password);
    if (!valid) {
      await this.recordFailedAttempt(user.id);
      throw new UnauthorizedException('Identitas atau kata sandi salah.');
    }

    // Lockout check after failed attempts cleared
    if (user.locked_until) {
      await this.prisma.users.update({
        where: { id: user.id },
        data: { failed_attempts: 0, locked_until: null },
      });
    }

    await this.prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    return this.issueTokenPair(user.id, user.login_nik ?? undefined, user.email ?? undefined);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // Verify the refresh token signature
    let payload: { sub: string; type: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; type: string; jti: string }>(
        refreshToken,
        {
          secret: this.config.jwtRefreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid.');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token bukan refresh token.');
    }

    const stored = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: this.hashToken(refreshToken) },
    });
    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      throw new UnauthorizedException('Sesi telah berakhir.');
    }

    // Rotation: revoke the used token, issue new pair (BRD 7.4)
    await this.prisma.refresh_tokens.update({
      where: { id: stored.id },
      data: { revoked_at: new Date(), replaced_by: this.hashToken(refreshToken) },
    });

    return this.issueTokenPair(stored.user_id, undefined, undefined);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refresh_tokens.updateMany({
      where: { token_hash: this.hashToken(refreshToken), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async forgotPassword(identifier: string): Promise<{ sessionId: string; mockOtp: string }> {
    // MVP: return the OTP in the response for demo. Production: send via SMS/WhatsApp.
    // The OTP is 6 digits, TTL 10 minutes.
    const user = await this.prisma.users.findFirst({
      where: { OR: [{ login_nik: identifier }, { email: identifier }] },
    });
    if (!user) {
      // Do not reveal whether the identifier exists
      return { sessionId: randomUUID(), mockOtp: '000000' };
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = randomUUID();
    await this.prisma.users.update({
      where: { id: user.id },
      data: { two_factor_secret: sessionId, locked_until: new Date(Date.now() + 10 * 60 * 1000) },
    });
    void otp; // In production, send via OTP channel. Demo returns it.
    return { sessionId, mockOtp: otp };
  }

  async resetPassword(sessionId: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.prisma.users.findFirst({
      where: { two_factor_secret: sessionId },
    });
    if (!user || user.locked_until == null || user.locked_until < new Date()) {
      throw new UnauthorizedException({
        code: 'RESET_SESSION_EXPIRED',
        message: 'Sesi reset kedaluwarsa.',
      });
    }
    // MVP: otp is mock — skip strict check here; production verifies via OTP store.
    void otp;
    const hash = await this.password.hash(newPassword);
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: hash,
        must_change_password: false,
        two_factor_secret: null,
        locked_until: null,
      },
    });
  }

  async enroll2fa(userId: string): Promise<{ secret: string; uri: string }> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Pengguna tidak ditemukan.');
    const secret = this.totp.generateSecret();
    const uri = this.totp.provisionUri(secret, user.login_nik ?? user.email ?? userId);
    await this.prisma.users.update({
      where: { id: userId },
      data: { two_factor_secret: secret },
    });
    return { secret, uri };
  }

  async verify2fa(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user?.two_factor_secret) return false;
    const ok = this.totp.verify(token, user.two_factor_secret);
    if (ok) {
      await this.prisma.users.update({ where: { id: userId }, data: { two_factor_enabled: true } });
    }
    return ok;
  }

  // ------------------------------------------------------------

  private async issueTokenPair(userId: string, nik?: string, email?: string): Promise<TokenPair> {
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: userId, nik, email, type: 'access', jti },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessTtlSeconds },
    );
    const refreshJti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh', jti: refreshJti },
      { secret: this.config.jwtRefreshSecret, expiresIn: this.config.jwtRefreshTtlSeconds },
    );

    await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: this.hashToken(refreshToken),
        expires_at: new Date(Date.now() + this.config.jwtRefreshTtlSeconds * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.config.jwtAccessTtlSeconds };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    const maxAttempts = 5; // from config in production
    const newCount = (user?.failed_attempts ?? 0) + 1;
    const lockUntil = newCount >= maxAttempts ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await this.prisma.users.update({
      where: { id: userId },
      data: {
        failed_attempts: newCount,
        ...(lockUntil ? { locked_until: lockUntil } : {}),
      },
    });
  }
}
