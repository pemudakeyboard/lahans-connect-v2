import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessResolver } from '../../core/auth/access-resolver.service';
import { Prisma } from '../../generated/prisma';

type MenuWithPermission = Prisma.menusGetPayload<{ include: { permission: true } }>;

/**
 * Renders the authenticated user's navigation tree from the `menus` registry
 * (FR-M0-050/051). Menus whose permission the user does not hold are pruned;
 * a parent with no visible children is hidden (FR-M0-052).
 *
 * The frontend consumes this at GET /me/navigation — never a static array
 * in frontend code (BRD §13 rule 8).
 */
@Injectable()
export class MeNavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessResolver,
  ) {}

  async forUser(
    userId: string,
    platform: string,
  ): Promise<{
    platform: string;
    menus: NavMenu[];
    cache_ttl_seconds: number;
  }> {
    const user = await this.access.resolveForUser(userId);
    const permissionSet = new Set(user.permissions);

    const allMenus = await this.prisma.menus.findMany({
      where: { is_active: true },
      orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }],
      include: { permission: true },
    });

    const visible = allMenus.filter((m: MenuWithPermission) => {
      if (platform !== 'BOTH' && m.platform !== 'BOTH' && m.platform !== platform) return false;
      if (m.permission_code == null) return true; // parent without permission: visible, pruned by children
      return permissionSet.has(m.permission!.code);
    });

    // Group children under the parent's *code* — the recursion in build() keys
    // on code, so the two must agree (a parent's UUID is meaningless to build()).
    const codeById = new Map(allMenus.map((m) => [m.id, m.code] as const));
    const byParent = new Map<string | null, NavMenu[]>();
    for (const m of visible) {
      const key = m.parent_id == null ? null : (codeById.get(m.parent_id) ?? m.parent_id);
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push({
        code: m.code,
        label: m.label,
        icon: m.icon ?? undefined,
        route: m.route ?? undefined,
        children: [],
      });
    }

    // Build tree, dropping parents with no visible children (FR-M0-052)
    const build = (parentId: string | null): NavMenu[] => {
      const kids = byParent.get(parentId) ?? [];
      const result: NavMenu[] = [];
      for (const kid of kids) {
        const children = build(kid.code);
        if (children.length === 0 && kid.route == null) continue; // empty non-leaf parent
        result.push({ ...kid, children });
      }
      return result;
    };

    return {
      platform,
      menus: build(null),
      cache_ttl_seconds: 300, // from config (FR-M0-054)
    };
  }
}

export interface NavMenu {
  code: string;
  label: string;
  icon?: string;
  route?: string;
  children: NavMenu[];
}
