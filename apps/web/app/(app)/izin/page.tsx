'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  listLeaveRequests,
  masterList,
  type LeaveRequestRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface LeaveTypeRow {
  id: string;
  code: string;
  name: string;
  max_days_per_request?: number | null;
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
];

export default function IzinPage() {
  const { user, hasPermission } = useAuth();
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

  const canWrite = hasPermission('leave.request.write');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reqs = await listLeaveRequests({ page, pageSize });
      setRows(reqs.rows);
      setTotal(reqs.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data izin.');
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

  async function onSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.leave_type_id) {
      setError('Pilih jenis izin terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError(null);
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
      setError(err instanceof ApiError ? err.message : 'Gagal mengajukan izin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Izin</h1>
          <p className="text-muted-foreground text-sm">
            S7-M3 — pengajuan izin tidak masuk kerja (BR-C08, BR-C13)
          </p>
        </div>
        {canWrite && user?.employeeId && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Ajukan Izin
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DataTable<LeaveRequestRow>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        emptyMessage="Belum ada pengajuan izin."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Ajukan Izin</DialogTitle>
              <DialogDescription>
                Izin tanpa keterangan akan mengurangi gaji pokok (slip upah). Hari libur &amp; hari
                non-kerja tidak dihitung.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Jenis Izin</Label>
                <Select
                  value={form.leave_type_id}
                  onValueChange={(v) => setForm({ ...form, leave_type_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis izin…" />
                  </SelectTrigger>
                  <SelectContent>
                    {types
                      .filter((t) => ['IZIN', 'SAKIT'].includes(t.code))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
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
                  placeholder="mis. keperluan keluarga"
                />
              </div>
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
