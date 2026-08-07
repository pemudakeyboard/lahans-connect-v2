import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  userId: string;
  employeeId?: string;
  loginNik?: string;
  email?: string;
  /** Group codes the user belongs to (union) */
  groups: string[];
  /** Effective permission codes (union of groups, minus DENY overrides) */
  permissions: string[];
  /** Effective data scope per permission code, keys = permission.code */
  scopes: Record<string, string>;
  /** Masked fields applied for this user */
  maskedFields: string[];
  sessionId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;
    if (!user) {
      throw new Error('CurrentUser decorator used on a request without an authenticated user.');
    }
    return data ? user[data] : user;
  },
);
