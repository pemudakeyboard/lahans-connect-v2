'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Selamat datang, {user?.loginNik ?? 'pengguna'} — {user?.email ?? ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Grup</CardTitle>
            <CardDescription>RBAC</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{user?.groups.length ? user.groups.join(', ') : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Permission</CardTitle>
            <CardDescription>Hak akses efektif</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{user?.permissions.length ?? 0} permission aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Modul</CardTitle>
            <CardDescription>Foundation S0 + M8B + M1B</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Format &amp; Validasi • Master Data</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
