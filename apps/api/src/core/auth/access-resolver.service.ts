import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * Computes the EFFECTIVE access for a user:
 *   permissions = union of all groups' permissions  (FR-M0-021)
 *   minus DENY overrides  (FR-M0-022 — DENY always wins)
 *   data_scope = the widest scope across groups  (FR-M0-031)
 *   masked_fields = union of masked fields across grants
 *
 * This is the singleton source of truth for the PermissionGuard and the
 * /me/effective-access simulation screen (FR-M0-024).
 */
@Injectable()
export class AccessResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        group_memberships: {
          include: {
            group: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        overrides: { include: { permission: true } },
      },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Union of group permissions
    const granted = new Map<string, { dataScope: string; maskedFields: string[] }>();
    for (const membership of user.group_memberships) {
      if (!membership.group.is_active) continue;
      for (const gp of membership.group.permissions) {
        const code = gp.permission.code;
        const existing = granted.get(code);
        const scope = gp.data_scope;
        const masked = (gp.masked_fields as string[]) ?? [];
        if (!existing) {
          granted.set(code, { dataScope: scope, maskedFields: masked });
        } else {
          // FR-M0-031: widest scope wins. Ordering: ALL > ENTITY > DIVISION >
          // BRANCH > TEAM_TREE > DIRECT_REPORT > SELF > CUSTOM (CUSTOM kept as-is).
          existing.dataScope = widerScope(existing.dataScope, scope, masked.length > 0);
          existing.maskedFields = [...new Set([...existing.maskedFields, ...masked])];
        }
      }
    }

    // Apply overrides (FR-M0-022): DENY removes permission entirely.
    for (const override of user.overrides) {
      const code = override.permission.code;
      if (override.effect === 'DENY') {
        granted.delete(code);
      } else {
        granted.set(code, {
          dataScope: override.data_scope ?? granted.get(code)?.dataScope ?? 'SELF',
          maskedFields: granted.get(code)?.maskedFields ?? [],
        });
      }
    }

    const permissions = [...granted.keys()];
    const scopes: Record<string, string> = {};
    const maskedFields: string[] = [];
    for (const [code, { dataScope, maskedFields: mf }] of granted) {
      scopes[code] = dataScope;
      maskedFields.push(...mf);
    }

    return {
      userId: user.id,
      employeeId: user.employee_id ?? undefined,
      loginNik: user.login_nik ?? undefined,
      email: user.email ?? undefined,
      groups: user.group_memberships.map((m) => m.group.code),
      permissions,
      scopes,
      maskedFields: [...new Set(maskedFields)],
    };
  }

  /** Whether a resolved user holds a permission (used by guards). */
  hasPermission(user: CurrentUser, required: string): boolean {
    return user.permissions.includes(required);
  }
}

const WIDTH_ORDER: Record<string, number> = {
  ALL: 8,
  ENTITY: 7,
  DIVISION: 6,
  BRANCH: 5,
  TEAM_TREE: 4,
  CUSTOM: 3,
  DIRECT_REPORT: 2,
  SELF: 1,
};

function widerScope(a: string, b: string, _bHasMask = false): string {
  const wa = WIDTH_ORDER[a] ?? 0;
  const wb = WIDTH_ORDER[b] ?? 0;
  if (wb === wa) return a;
  return wb > wa ? b : a;
}
