import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

/**
 * TOTP 2FA (FR-M0-018). Enforced for groups with requires_2fa = true
 * (default seed: SUPER_ADMIN, FINANCE, HCGA_MANAGER).
 */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  provisionUri(secret: string, account: string, issuer = 'LAHANS Connect'): string {
    return authenticator.keyuri(account, issuer, secret);
  }

  verify(token: string, secret: string): boolean {
    if (!token || !secret) return false;
    return authenticator.check(token, secret);
  }
}
