'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calculator, Database, Fingerprint, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { navigationRequest, type NavMenu } from '@/lib/lahans-api';
import { Button } from '@/components/ui/button';

// Menu icon comes from the DB as a string code (seeded in `menus`). Map the
// known codes to lucide components — add a code here when a new menu needs one.
// Never a static menu *array* in frontend code (BRD §13 rule 8): the tree
// itself is fetched from GET /auth/me/navigation.
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Database,
  Settings,
  Calculator,
  Fingerprint,
};

type LucideIcon = (props: React.ComponentProps<'svg'>) => React.ReactNode;

function NavIcon({ icon }: { icon?: string }) {
  if (!icon) return null;
  const Cmp = ICONS[icon];
  if (!Cmp) return null;
  return <Cmp className="h-4 w-4" />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menus, setMenus] = useState<NavMenu[]>([]);

  useEffect(() => {
    // The backend prunes the tree by the user's effective permissions (FR-M0-051)
    // and drops parents with no visible children (FR-M0-052) — we render as-is.
    navigationRequest('WEB')
      .then((res) => setMenus(res.menus))
      .catch(() => setMenus([]));
  }, [user?.userId]);

  const isActive = (menu: NavMenu): boolean => {
    if (menu.route && pathname === menu.route) return true;
    return menu.children?.some((c) => c.route && pathname.startsWith(c.route)) ?? false;
  };

  return (
    <div className="flex min-h-screen">
      <aside className="bg-card fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            LAHANS Connect
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menus.map((item) => {
            const hasChildren = item.children.length > 0;
            const href =
              hasChildren && item.children[0].route
                ? item.children[0].route
                : (item.route ?? '/dashboard');
            return (
              <div key={item.code}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                  )}
                >
                  <NavIcon icon={item.icon} />
                  {item.label}
                </Link>
                {hasChildren && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-2">
                    {item.children.map((c) => {
                      const active = c.route != null && pathname === c.route;
                      return (
                        <Link
                          key={c.code}
                          href={c.route ?? '/dashboard'}
                          className={cn(
                            'block rounded-md px-3 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-accent-foreground',
                          )}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.loginNik ?? '—'}</p>
              <p className="text-muted-foreground truncate text-xs">
                {user?.groups.length ? user.groups.join(', ') : 'Pengguna'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Keluar">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex-1 md:pl-64">
        <header className="bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:hidden">
          <span className="font-semibold">LAHANS</span>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
