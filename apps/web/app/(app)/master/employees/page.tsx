'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { DataTable, type Column } from '@/components/data-table';
import { masterList } from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';

interface EmployeeRow {
  id: string;
  nik: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  employment_status?: string | null;
  join_date?: string | null;
  branch_id?: string | null;
  branch?: { name?: string | null } | null;
  job_position_id?: string | null;
  job_position?: { name?: string | null } | null;
  job_grade_id?: string | null;
  job_grade?: { name?: string | null } | null;
  assignments?: {
    contract_type?: string | null;
    contract_start?: string | null;
    contract_end?: string | null;
  }[];
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  AKTIF: 'default',
  CUTI: 'secondary',
  RESIGN: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  CUTI: 'Cuti',
  RESIGN: 'Resign',
};

const CONTRACT_LABEL: Record<string, string> = {
  PERMANENT: 'Tetap',
  CONTRACT: 'PKWT',
  PROBATION: 'Percobaan',
};

/** Days until contract_end; null when no end date or in the past. */
function contractDaysLeft(end?: string | null): number | null {
  if (!end) return null;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000);
  return diff >= 0 ? diff : null;
}

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const canWrite = hasPermission('master.employees.write');

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Branch options for the filter dropdown.
  useEffect(() => {
    void masterList<{ id: string; name: string }>('branches', { pageSize: 100 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(
    async (p: number, s: string, b: string, st: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await masterList<EmployeeRow>('employees', {
          page: p,
          pageSize,
          ...(s ? { search: s } : {}),
          filters: {
            ...(b ? { branch_id: b } : {}),
            ...(st ? { employment_status: st } : {}),
          },
        });
        setRows(res.rows);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data karyawan.');
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    void load(page, search, branchFilter, statusFilter);
  }, [load, page, search, branchFilter, statusFilter]);

  const columns = useMemo<Column<EmployeeRow>[]>(
    () => [
      {
        key: 'avatar',
        header: '',
        className: 'w-12',
        render: (r) => <Avatar name={r.full_name} size="sm" />,
      },
      {
        key: 'nik',
        header: 'NIK',
        className: 'font-mono text-xs',
      },
      { key: 'full_name', header: 'Nama' },
      {
        key: 'branch',
        header: 'Area Kerja',
        render: (r) => r.branch?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'job_position',
        header: 'Jabatan',
        render: (r) => r.job_position?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'job_grade',
        header: 'Golongan',
        render: (r) => r.job_grade?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'contract_type',
        header: 'Status Kontrak',
        render: (r) => {
          const t = r.assignments?.[0]?.contract_type;
          return t ? (
            <Badge variant="outline">{CONTRACT_LABEL[t] ?? t}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: 'contract_end',
        header: 'Akhir Kontrak',
        render: (r) => {
          const end = r.assignments?.[0]?.contract_end;
          if (!end) return <span className="text-muted-foreground">—</span>;
          const days = contractDaysLeft(end);
          return (
            <span className="flex items-center gap-2">
              {formatDate(end)}
              {days != null && days <= 30 && <Badge variant="outline">⚠ {days} hari</Badge>}
            </span>
          );
        },
      },
      {
        key: 'employment_status',
        header: 'Status',
        render: (r) => (
          <Badge variant={STATUS_VARIANT[r.employment_status ?? ''] ?? 'outline'}>
            {STATUS_LABEL[r.employment_status ?? ''] ?? r.employment_status}
          </Badge>
        ),
      },
      { key: 'join_date', header: 'Mulai Kerja', render: (r) => formatDate(r.join_date) },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Karyawan</h1>
          <p className="text-muted-foreground text-sm">M1B — master data</p>
        </div>
        {canWrite && (
          <Button onClick={() => router.push('/master/employees/new')}>
            <Plus className="h-4 w-4" /> Tambah Karyawan
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            placeholder="Cari nama / NIK…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                void load(1, search, branchFilter, statusFilter);
              }
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={branchFilter}
          onValueChange={(v) => {
            setBranchFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Area Kerja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Semua Area Kerja</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Semua Status</SelectItem>
            <SelectItem value="AKTIF">Aktif</SelectItem>
            <SelectItem value="CUTI">Cuti</SelectItem>
            <SelectItem value="RESIGN">Resign</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable<EmployeeRow>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={(p) => setPage(p)}
        onRowClick={(r) => router.push(`/master/employees/${r.id}`)}
        emptyMessage="Tidak ada karyawan."
      />
    </div>
  );
}
