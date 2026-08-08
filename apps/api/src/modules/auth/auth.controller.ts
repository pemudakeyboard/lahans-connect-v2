import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { AuthService, TokenPair } from './auth.service';
import { AccessResolver } from '../../core/auth/access-resolver.service';
import { MeNavigationService } from './me-navigation.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accessResolver: AccessResolver,
    private readonly navigation: MeNavigationService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login NIK/email + password' })
  async login(@Body() body: { identifier: string; password: string }): Promise<TokenPair> {
    return this.auth.login(body.identifier, body.password);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotasi refresh token (BRD 7.4)' })
  async refresh(@Body() body: { refreshToken: string }): Promise<TokenPair> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Cabut refresh token' })
  async logout(@Body() body: { refreshToken: string }): Promise<{ ok: true }> {
    await this.auth.logout(body.refreshToken);
    return { ok: true };
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Kirim OTP reset ke HP/email terdaftar' })
  async forgotPassword(@Body() body: { identifier: string }): Promise<{ sessionId: string }> {
    const res = await this.auth.forgotPassword(body.identifier);
    return { sessionId: res.sessionId };
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Setel ulang kata sandi dengan OTP' })
  async resetPassword(
    @Body() body: { sessionId: string; otp: string; newPassword: string },
  ): Promise<{ ok: true }> {
    await this.auth.resetPassword(body.sessionId, body.otp, body.newPassword);
    return { ok: true };
  }

  @Post('2fa/enroll')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mulai pendaftaran 2FA (TOTP)' })
  async enroll2fa(@CurrentUser() user: { userId: string }) {
    return this.auth.enroll2fa(user.userId);
  }

  @Post('2fa/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifikasi token 2FA' })
  async verify2fa(@CurrentUser() user: { userId: string }, @Body() body: { token: string }) {
    const ok = await this.auth.verify2fa(user.userId, body.token);
    if (!ok) throw new UnauthorizedException('Kode verifikasi salah.');
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @RequirePermission('identity.user.read')
  @ApiOperation({ summary: 'Profil + grup + permission efektif' })
  async me(@CurrentUser() user: { userId: string }) {
    const resolved = await this.accessResolver.resolveForUser(user.userId);
    return {
      userId: resolved.userId,
      employeeId: resolved.employeeId,
      loginNik: resolved.loginNik,
      email: resolved.email,
      groups: resolved.groups,
      permissions: resolved.permissions,
      scopes: resolved.scopes,
    };
  }

  @Get('me/navigation')
  @ApiBearerAuth()
  @RequirePermission('identity.user.read')
  @ApiOperation({ summary: 'Struktur menu dinamis (FR-M0-051) — web & mobile' })
  async navigationMenu(@Req() req: Request) {
    const platform = (req.query.platform as string) ?? 'BOTH';
    const user = req.user as { userId: string };
    return this.navigation.forUser(user.userId, platform);
  }
}
