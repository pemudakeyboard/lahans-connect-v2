'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search, Tag, Trash2, UserMinus, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { DataTable, type Column } from '@/components/data-table';
import {
  assignSchedules,
  bulkDeactivateEmployees,
  bulkDeleteEmployees,
  masterList,
} from '@/lib/lahans-api';
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

/** Headers for the client-side CSV export. */
const CSV_HEADERS = [
  'NIK',
  'Nama',
  'Email',
  'Telepon',
  'Jenis Kelamin',
  'Area Kerja',
  'Jabatan',
  'Golongan',
  'Status Kontrak',
  'Akhir Kontrak',
  'Status',
  'Mulai Kerja',
];

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const canWrite = hasPermission('master.employees.write');
  const canAssignRoster = hasPermission('roster.assign.write');

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

  // Bulk selection (Ticket 03).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'delete' | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [schedules, setSchedules] = useState<{ id: string; name: string }[]>([]);
  const [assignScheduleId, setAssignScheduleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  // Work-schedule options for the Assign Jadwal dialog (roster bulk endpoint
  // validates the schedule belongs to the user's company).
  useEffect(() => {
    if (!assignOpen) return;
    void masterList<{ id: string; name: string }>('work-schedules', { pageSize: 100 })
      .then((res) => setSchedules(res.rows))
      .catch(() => setSchedules([]));
  }, [assignOpen]);

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

  // -- bulk actions (Ticket 03) ----------------------------------------------

  const clearSelection = () => setSelectedIds(new Set());

  const runBulk = useCallback(
    async (fn: (ids: string[]) => Promise<unknown>, okMsg: string) => {
      if (selectedIds.size === 0) return;
      setBusy(true);
      setBulkMsg(null);
      try {
        await fn([...selectedIds]);
        setBulkMsg(`${okMsg} untuk ${selectedIds.size} karyawan.`);
        clearSelection();
      } catch (err) {
        setBulkMsg(err instanceof ApiError ? err.message : `Aksi massal gagal.`);
      } finally {
        setBusy(false);
        setConfirmAction(null);
        void load(page, search, branchFilter, statusFilter);
      }
    },
    [selectedIds, load, page, search, branchFilter, statusFilter],
  );

  const handleDeactivate = () =>
    runBulk(bulkDeactivateEmployees, 'Status diubah ke Nonaktif (RESIGN)');

  const handleDelete = () => runBulk(bulkDeleteEmployees, 'Karyawan dihapus');

  /** Client-side CSV export of the selected rows (no server round-trip). */
  const downloadCsv = () => {
    const rowsToCsv = selectedRows.length > 0 ? selectedRows : rows;
    if (rowsToCsv.length === 0) return;
    const CONTRACT_LABEL_CSV: Record<string, string> = {
      PERMANENT: 'Tetap',
      CONTRACT: 'PKWT',
      PROBATION: 'Percobaan',
    };
    const lines = [
      CSV_HEADERS.join(';'),
      ...rowsToCsv.map((r) =>
        [
          r.nik,
          r.full_name,
          r.email ?? '',
          r.phone ?? '',
          r.gender ?? '',
          r.branch?.name ?? '',
          r.job_position?.name ?? '',
          r.job_grade?.name ?? '',
          r.assignments?.[0]?.contract_type
            ? (CONTRACT_LABEL_CSV[r.assignments[0].contract_type] ?? r.assignments[0].contract_type)
            : '',
          r.assignments?.[0]?.contract_end ? formatDate(r.assignments[0].contract_end) : '',
          STATUS_LABEL[r.employment_status ?? ''] ?? r.employment_status ?? '',
          r.join_date ? formatDate(r.join_date) : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(';'),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karyawan_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAssign = async () => {
    if (!assignScheduleId || selectedIds.size === 0) return;
    setBusy(true);
    setBulkMsg(null);
    try {
      const res = await assignSchedules(assignScheduleId, [...selectedIds]);
      setBulkMsg(`Jadwal diberikan untuk ${res.assigned} karyawan.`);
      clearSelection();
      setAssignOpen(false);
      setAssignScheduleId('');
    } catch (err) {
      setBulkMsg(err instanceof ApiError ? err.message : 'Penugasan jadwal gagal.');
    } finally {
      setBusy(false);
    }
  };

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

      {/* Bulk toolbar (Ticket 03) — visible once ≥1 row is selected. */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} dipilih</span>
          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('deactivate')}
                disabled={busy}
              >
                <UserMinus className="h-4 w-4" /> Nonaktifkan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('delete')}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={busy}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {canAssignRoster && (
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} disabled={busy}>
              <Tag className="h-4 w-4" /> Assign Jadwal
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={clearSelection}
            disabled={busy}
          >
            <X className="h-4 w-4" /> Batal
          </Button>
        </div>
      )}

      {bulkMsg && <p className="text-sm">{bulkMsg}</p>}

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
        selectable={canWrite || canAssignRoster}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        isRowSelectable={(r) => r.employment_status !== 'RESIGN'}
      />

      {/* Confirm dialog: Nonaktifkan */}
      <Dialog
        open={confirmAction === 'deactivate'}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan {selectedIds.size} karyawan?</DialogTitle>
            <DialogDescription>
              Status akan diubah menjadi Nonaktif (RESIGN) dan akun tidak dapat login. Data historis
              (absensi, payroll, jadwal) tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={handleDeactivate} disabled={busy}>
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog: Hapus */}
      <Dialog open={confirmAction === 'delete'} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {selectedIds.size} karyawan?</DialogTitle>
            <DialogDescription>
              Tindakan ini menyembunyikan karyawan dari daftar tanpa menghapus riwayatnya
              (soft-delete), agar data absensi/payroll tetap utuh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Jadwal dialog */}
      <Dialog open={assignOpen} onOpenChange={(o) => !o && setAssignOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Jadwal ke {selectedIds.size} karyawan</DialogTitle>
            <DialogDescription>
              Memakai endpoint bulk-assignment roster yang sudah ada. Jadwal lama yang masih berlaku
              akan diganti.
            </DialogDescription>
          </DialogHeader>
          <Select value={assignScheduleId} onValueChange={setAssignScheduleId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih jadwal kerja…" />
            </SelectTrigger>
            <SelectContent>
              {schedules.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              {schedules.length === 0 && (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">Tidak ada jadwal.</div>
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={handleAssign} disabled={!assignScheduleId || busy}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
