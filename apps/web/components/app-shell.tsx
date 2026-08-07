'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

const NAV = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
  {
    title: 'Master Data',
    href: '/master/employees',
    icon: Database,
    permission: 'master.read',
    children: [
      { title: 'Karyawan', href: '/master/employees', permission: 'master.employees.read' },
      { title: 'Perusahaan', href: '/master/companies', permission: 'master.companies.read' },
      { title: 'Cabang', href: '/master/branches', permission: 'master.branches.read' },
      { title: 'Divisi', href: '/master/divisions', permission: 'master.divisions.read' },
    ],
  },
  {
    title: 'Pengaturan',
    href: '/config/formats',
    icon: Settings,
    permission: 'config.format.read',
    children: [
      { title: 'Format', href: '/config/formats', permission: 'config.format.read' },
      { title: 'Validasi', href: '/config/validation', permission: 'config.validation.read' },
      { title: 'Nomor Urut', href: '/config/sequences', permission: 'config.sequence.read' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();

  const visible = NAV.filter((item) => {
    if (!item.permission) return true;
    if (item.permission === 'master.read') return user?.permissions.some((p) => p.startsWith('master.'));
    return user?.permissions.includes(item.permission);
  });

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            LAHANS Connect
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visible.map((item) => {
            const isActive = pathname === item.href || (item.children?.some((c) => pathname.startsWith(c.href)) ?? false);
            return (
              <div key={item.title}>
                <Link
                  href={item.children ? item.children[0].href : item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
                {item.children && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-2">
                    {item.children
                      .filter((c) => !c.permission || hasPermission(c.permission))
                      .map((c) => {
                        const active = pathname === c.href;
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            className={cn(
                              'block rounded-md px-3 py-1.5 text-sm transition-colors',
                              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-accent-foreground',
                            )}
                          >
                            {c.title}
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
              <p className="truncate text-xs text-muted-foreground">
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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <span className="font-semibold">LAHANS</span>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}