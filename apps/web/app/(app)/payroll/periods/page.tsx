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
  createPayrollPeriod,
  listPayrollPeriods,
  validatePayrollPeriod,
  lockPayrollPeriod,
  closePayrollPeriod,
  type PayrollPeriodRow,
  type PeriodBlockers,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  OPEN: 'default',
  LOCKED: 'secondary',
  CLOSED: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Terbuka',
  LOCKED: 'Terkunci',
  CLOSED: 'Ditutup',
};

const fmtDate = (s: string | null | undefined) => (s ? s.slice(0, 10) : '—');

const columns: Column<PayrollPeriodRow>[] = [
  { key: 'code', header: 'Periode', className: 'font-mono text-xs' },
  {
    key: 'cutoff_start',
    header: 'Cutoff',
    render: (r) => `${fmtDate(r.cutoff_start)} → ${fmtDate(r.cutoff_end)}`,
  },
  {
    key: 'payment_date',
    header: 'Bayar',
    render: (r) => fmtDate(r.payment_date),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>
        {STATUS_LABEL[r.status] ?? r.status}
      </Badge>
    ),
  },
];

export default function PayrollPeriodsPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<PayrollPeriodRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    cutoff_start: '',
    cutoff_end: '',
    payment_date: '',
  });

  const canWrite = hasPermission('payroll.period.write');
  const canClose = hasPermission('payroll.period.close');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPayrollPeriods({ page, pageSize });
      setRows(res.rows);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat periode penggajian.');
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
    try {
      await createPayrollPeriod({
        code: form.code,
        cutoff_start: form.cutoff_start,
        cutoff_end: form.cutoff_end,
        payment_date: form.payment_date || undefined,
      });
      setOpen(false);
      setForm({ code: '', cutoff_start: '', cutoff_end: '', payment_date: '' });
      setInfo(`Periode ${form.code} dibuka.`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuka periode.');
    } finally {
      setSaving(false);
    }
  }

  async function onValidate(period: PayrollPeriodRow) {
    setError(null);
    setInfo(null);
    try {
      const res: PeriodBlockers = await validatePayrollPeriod(period.id);
      if (res.ok) setInfo(`Periode ${period.code} valid — tidak ada blocker.`);
      else setInfo(`Blocker: ${res.blockers.map((b) => b.code).join(', ')}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal validasi periode.');
    }
  }

  async function onLock(period: PayrollPeriodRow) {
    setActingId(period.id);
    setError(null);
    setInfo(null);
    try {
      const res = await lockPayrollPeriod(period.id);
      setInfo(
        `Periode ${period.code} dikunci: ${res.aggregatedEmployees} karyawan, ${res.aggregatedLines} baris feeder.`,
      );
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunci periode.');
    } finally {
      setActingId(null);
    }
  }

  async function onClose(period: PayrollPeriodRow) {
    setActingId(period.id);
    setError(null);
    setInfo(null);
    try {
      await closePayrollPeriod(period.id);
      setInfo(`Periode ${period.code} ditutup.`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menutup periode.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Periode Penggajian</h1>
          <p className="text-muted-foreground text-sm">
            M6 — siklus periode (buka → validasi → kunci → tutup). Feeder mengikuti cakupan data
            Anda (divisi sales / pabrik).
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Buat Periode
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {info && (
        <p className="rounded border border-emerald-500/40 bg-emerald-50 p-2 text-sm">{info}</p>
      )}

      <DataTable<PayrollPeriodRow>
        columns={[
          ...columns,
          ...(canClose
            ? [
                {
                  key: 'actions' as const,
                  header: 'Aksi',
                  render: (r: PayrollPeriodRow) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void onValidate(r)}>
                        Validasi
                      </Button>
                      {r.status === 'OPEN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === r.id}
                          onClick={() => void onLock(r)}
                        >
                          {actingId === r.id ? 'Memproses…' : 'Kunci'}
                        </Button>
                      )}
                      {(r.status === 'OPEN' || r.status === 'LOCKED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === r.id}
                          onClick={() => void onClose(r)}
                        >
                          Tutup
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        emptyMessage="Belum ada periode penggajian."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Buat Periode Penggajian</DialogTitle>
              <DialogDescription>
                Periode memakai cutoff 22 → 21 (parameter PAYROLL.CUTOFF_START_DAY / END_DAY). Kode
                unik, mis. 2026-08.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode Periode</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="2026-08"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cutoff_start">Cutoff Awal</Label>
                  <Input
                    id="cutoff_start"
                    type="date"
                    value={form.cutoff_start}
                    onChange={(e) => setForm({ ...form, cutoff_start: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cutoff_end">Cutoff Akhir</Label>
                  <Input
                    id="cutoff_end"
                    type="date"
                    value={form.cutoff_end}
                    onChange={(e) => setForm({ ...form, cutoff_end: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Tanggal Bayar</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Membuka…' : 'Buka Periode'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
