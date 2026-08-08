'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/data-table';
import {
  createLeaveRequest,
  getLeaveBalance,
  listLeaveRequests,
  masterList,
  type LeaveBalanceRow,
  type LeaveRequestRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface LeaveTypeRow {
  id: string;
  code: string;
  name: string;
  deduct_quota: boolean;
  max_days_per_request?: number | null;
  min_notice_days?: number | null;
  requires_attachment: boolean;
  allow_half_day: boolean;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  RETURNED: 'outline',
  CANCELED: 'outline',
};

const columns: Column<LeaveRequestRow>[] = [
  { key: 'doc_number', header: 'No. Dokumen', className: 'font-mono text-xs' },
  {
    key: 'leave_type',
    header: 'Jenis',
    render: (r) => r.leave_type?.name ?? '—',
  },
  { key: 'start_date', header: 'Dari' },
  { key: 'end_date', header: 'Sampai' },
  { key: 'total_days', header: 'Jumlah (hari kerja)' },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>,
  },
  {
    key: 'is_emergency',
    header: 'Jalur',
    render: (r) => (r.is_emergency ? <Badge variant="destructive">Darurat</Badge> : '—'),
  },
];

export default function CutiPage() {
  const { user, hasPermission } = useAuth();
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [rows, setRows] = useState<LeaveRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<LeaveTypeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_emergency: false,
  });
  const [preview, setPreview] = useState<string | null>(null);

  const canWrite = hasPermission('leave.request.write');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bal, reqs] = await Promise.all([
        getLeaveBalance(),
        listLeaveRequests({ page, pageSize }),
      ]);
      setBalances(bal);
      setRows(reqs.rows);
      setTotal(reqs.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data cuti.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load leave types once (master CRUD exposes leave-types).
  useEffect(() => {
    masterList<LeaveTypeRow>('leave-types', { pageSize: 100 })
      .then((res) => setTypes(res.rows))
      .catch(() => setTypes([]));
  }, []);

  function selectType(id: string) {
    setForm((f) => ({ ...f, leave_type_id: id }));
  }

  async function onSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.leave_type_id) {
      setError('Pilih jenis cuti terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError(null);
    setPreview(null);
    try {
      await createLeaveRequest({
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
        is_emergency: form.is_emergency,
      });
      setOpen(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', is_emergency: false });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengajukan cuti.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cuti</h1>
          <p className="text-muted-foreground text-sm">
            S7-M3 — pengajuan cuti, saldo, dan persetujuan (BR-C01..C13)
          </p>
        </div>
        {canWrite && user?.employeeId && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Ajukan Cuti
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Saldo card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-4">
            <CardContent className="text-muted-foreground py-6 text-sm">
              Belum ada saldo cuti untuk tahun berjalan.
            </CardContent>
          </Card>
        )}
        {balances.map((b) => (
          <Card key={b.leave_type_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{b.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hak</span>
                <span>{b.entitlement_days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terpakai</span>
                <span>{b.used_days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span>{b.pending_days}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                <span>Sisa</span>
                <span>{b.balance_days}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request list */}
      <DataTable<LeaveRequestRow>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        emptyMessage="Belum ada pengajuan cuti."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Ajukan Cuti</DialogTitle>
              <DialogDescription>
                Pilih jenis cuti dan rentang tanggal. Hari libur &amp; hari non-kerja tidak
                dihitung.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Jenis Cuti</Label>
                <Select value={form.leave_type_id} onValueChange={selectType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis cuti…" />
                  </SelectTrigger>
                  <SelectContent>
                    {types
                      .filter((t) =>
                        ['CUTI_TAHUNAN', 'CUTI_ADVANCE', 'CUTI_KHUSUS'].includes(t.code),
                      )
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.max_days_per_request ? ` (maks ${t.max_days_per_request} hari)` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Tanggal Mulai</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Tanggal Selesai</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Alasan</Label>
                <Input
                  id="reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="mis. cuti tahunan"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_emergency}
                  onChange={(e) => setForm({ ...form, is_emergency: e.target.checked })}
                />
                Jalur darurat (backdate / melewati masa notice)
              </label>
              {preview && <p className="text-muted-foreground text-xs">{preview}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Mengirim…' : 'Ajukan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
