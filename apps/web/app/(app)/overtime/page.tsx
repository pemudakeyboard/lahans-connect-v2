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
import { DataTable, type Column } from '@/components/data-table';
import {
  createOvertimeRequest,
  listOvertimeRequests,
  type OvertimeRequestRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  RETURNED: 'outline',
  CANCELED: 'outline',
};

const DAY_TYPE_LABEL: Record<string, string> = {
  WEEKDAY: 'Hari Biasa',
  WEEKEND: 'Akhir Pekan',
  NATIONAL_HOLIDAY: 'Libur Nasional',
  JOINT_HOLIDAY: 'Cuti Bersama',
};

const columns: Column<OvertimeRequestRow>[] = [
  { key: 'doc_number', header: 'No. Dokumen', className: 'font-mono text-xs' },
  {
    key: 'overtime_date',
    header: 'Tanggal',
    render: (r) => r.overtime_date.slice(0, 10),
  },
  {
    key: 'day_type',
    header: 'Jenis Hari',
    render: (r) => DAY_TYPE_LABEL[r.day_type] ?? r.day_type,
  },
  {
    key: 'planned_hours',
    header: 'Jam',
    render: (r) => `${r.planned_hours} jam`,
  },
  {
    key: 'calculated_amount',
    header: 'Perkiraan',
    render: (r) =>
      r.calculated_amount != null ? (
        <span className="font-mono">Rp {Number(r.calculated_amount).toLocaleString('id-ID')}</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>,
  },
];

export default function OvertimePage() {
  const { user, hasPermission } = useAuth();
  const [rows, setRows] = useState<OvertimeRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    overtime_date: '',
    planned_hours: '2',
    reason: '',
  });
  const [preview, setPreview] = useState<string | null>(null);

  const canWrite = hasPermission('overtime.request.write');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reqs = await listOvertimeRequests({ page, pageSize });
      setRows(reqs.rows);
      setTotal(reqs.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data lembur.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setPreview(null);
    try {
      const created = await createOvertimeRequest({
        overtime_date: form.overtime_date,
        planned_hours: Number(form.planned_hours),
        reason: form.reason || undefined,
      });
      setOpen(false);
      setForm({ overtime_date: '', planned_hours: '2', reason: '' });
      if (created.calculated_amount != null) {
        setPreview(
          `Perkiraan lembur: Rp ${Number(created.calculated_amount).toLocaleString('id-ID')}`,
        );
      }
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengajukan lembur.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lembur</h1>
          <p className="text-muted-foreground text-sm">
            S8-M3 — pengajuan lembur dan perhitungan (GAJI POKOK ÷ 173 × multiplier × jam)
          </p>
        </div>
        {canWrite && user?.employeeId && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Ajukan Lembur
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {preview && (
        <p className="rounded border border-emerald-500/40 bg-emerald-50 p-2 text-sm">{preview}</p>
      )}

      <DataTable<OvertimeRequestRow>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        emptyMessage="Belum ada pengajuan lembur."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Ajukan Lembur</DialogTitle>
              <DialogDescription>
                Perhitungan mengikuti golongan dan jenis hari. Karyawan dengan golongan Manager
                tidak eligible lembur.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overtime_date">Tanggal Lembur</Label>
                <Input
                  id="overtime_date"
                  type="date"
                  value={form.overtime_date}
                  onChange={(e) => setForm({ ...form, overtime_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_hours">Jumlah Jam</Label>
                <Input
                  id="planned_hours"
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={form.planned_hours}
                  onChange={(e) => setForm({ ...form, planned_hours: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Alasan</Label>
                <Input
                  id="reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="mis. penyelesaian laporan bulanan"
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
