import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed access to INFRA-ONLY environment values.
 *
 * ZERO HARDCODE: business rules (divisor 173, 12 leave days, 150m geofence,
 * SLA 2 days, ...) must NEVER appear here or anywhere in code — they live in
 * system_parameters / config tables and are read via ParameterService.resolve(key, asOf).
 * See BRD §13 rule 1.
 */
@Injectable()
export class ApiConfigService {
  constructor(private readonly config: ConfigService) {}

  get(key: string, defaultValue?: string): string {
    return this.config.get<string>(key) ?? defaultValue ?? '';
  }

  getNumber(key: string, defaultValue?: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue ?? 0;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? (defaultValue ?? 0) : parsed;
  }

  getBoolean(key: string, defaultValue = false): boolean {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }
    return ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get jwtAccessSecret(): string {
    return this.get('JWT_ACCESS_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.get('JWT_REFRESH_SECRET');
  }

  get jwtAccessTtlSeconds(): number {
    return this.getNumber('JWT_ACCESS_TTL', 15 * 60);
  }

  get jwtRefreshTtlSeconds(): number {
    return this.getNumber('JWT_REFRESH_TTL', 7 * 24 * 60 * 60);
  }

  get storageDriver(): 'local-disk' | 's3' {
    const driver = this.get('STORAGE_DRIVER', 'local-disk');
    return driver === 's3' ? 's3' : 'local-disk';
  }

  get storageLocalPath(): string {
    return this.get('STORAGE_LOCAL_PATH', './storage-local');
  }

  get port(): number {
    return this.getNumber('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.get('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
