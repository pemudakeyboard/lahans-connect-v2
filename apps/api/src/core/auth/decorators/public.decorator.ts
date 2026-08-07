import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public (no auth / no permission required).
 * Use SPARINGLY — only for /auth/login, /auth/refresh, health, and the
 * public payslip verification page. Everything else is deny-by-default.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
