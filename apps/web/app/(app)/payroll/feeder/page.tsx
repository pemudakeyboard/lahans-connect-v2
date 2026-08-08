'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Download, FileSearch } from 'lucide-react';
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
  listPayrollPeriods,
  listFeederLines,
  getFeederTrace,
  overrideFeederLine,
  exportFeederUrl,
  type PayrollPeriodRow,
  type FeederLineRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const fmtRp = (v: string | null | undefined) =>
  v == null ? '—' : `Rp ${Number(v).toLocaleString('id-ID')}`;

export default function PayrollFeederPage() {
  const { hasPermission } = useAuth();
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [rows, setRows] = useState<FeederLineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<FeederLineRow | null>(null);
  const [overrideLine, setOverrideLine] = useState<FeederLineRow | null>(null);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [periodStatus, setPeriodStatus] = useState('');

  const canExport = hasPermission('payroll.feeder.export');
  const canOverride = hasPermission('payroll.feeder.override');

  const loadPeriods = useCallback(async () => {
    try {
      const res = await listPayrollPeriods({ page: 1, pageSize: 100 });
      setPeriods(res.rows);
      if (!periodId && res.rows.length > 0) setPeriodId(res.rows[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat periode.');
    }
  }, [periodId]);

  useEffect(() => {
    void loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeeder = useCallback(async () => {
    if (!periodId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listFeederLines(periodId, { page, pageSize });
      setRows(res.rows);
      setTotal(res.total);
      setPeriodStatus(res.periodStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat baris feeder.');
    } finally {
      setLoading(false);
    }
  }, [periodId, page, pageSize]);

  useEffect(() => {
    void loadFeeder();
  }, [loadFeeder]);

  async function onShowTrace(line: FeederLineRow) {
    setError(null);
    try {
      const t = await getFeederTrace(line.id);
      setTrace(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat trace.');
    }
  }

  async function onOverride(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!overrideLine) return;
    setSaving(true);
    setError(null);
    try {
      await overrideFeederLine(overrideLine.id, {
        amount: Number(overrideAmount),
        reason: overrideReason || undefined,
      });
      setOverrideLine(null);
      setOverrideAmount('');
      setOverrideReason('');
      void loadFeeder();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan koreksi.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<FeederLineRow>[] = [
    {
      key: 'employee',
      header: 'NIK',
      render: (r) => <span className="font-mono text-xs">{r.employee?.nik ?? r.employee_id}</span>,
    },
    {
      key: 'employee_name',
      header: 'Nama',
      render: (r) => r.employee?.full_name ?? '—',
    },
    {
      key: 'component_code',
      header: 'Komponen',
      render: (r) => <span className="font-mono text-xs">{r.component_code}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (r) => r.quantity ?? '—',
    },
    {
      key: 'amount',
      header: 'Jumlah',
      render: (r) => <span className="font-mono">{fmtRp(r.amount)}</span>,
    },
    {
      key: 'is_manual_override',
      header: 'Manual',
      render: (r) =>
        r.is_manual_override ? (
          <Badge variant="destructive">Koreksi</Badge>
        ) : (
          <Badge variant="outline">Auto</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => void onShowTrace(r)}>
            <FileSearch className="h-4 w-4" /> Trace
          </Button>
          {canOverride && periodStatus === 'OPEN' && !r.is_manual_override && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOverrideLine(r);
                setOverrideAmount(r.amount ?? '');
              }}
            >
              Koreksi
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll Feeder</h1>
          <p className="text-muted-foreground text-sm">
            M6 — baris feeder per periode (hanya cakupan divisi Anda). Status periode:{' '}
            <span className="font-medium">{periodStatus}</span>
          </p>
        </div>
        {canExport && periodId && (
          <Button asChild variant="outline">
            <a href={exportFeederUrl(periodId)} download>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="max-w-sm space-y-2">
        <Label htmlFor="period">Periode</Label>
        <select
          id="period"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          value={periodId}
          onChange={(e) => {
            setPeriodId(e.target.value);
            setPage(1);
          }}
        >
          {periods.length === 0 && <option value="">Belum ada periode</option>}
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.status}
            </option>
          ))}
        </select>
      </div>

      <DataTable<FeederLineRow>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        emptyMessage="Belum ada baris feeder (jalankan Kunci pada periode)."
      />

      {/* Trace dialog */}
      <Dialog open={trace != null} onOpenChange={(o) => !o && setTrace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Riwayat Kalkulasi</DialogTitle>
            <DialogDescription>
              {trace ? `${trace.component_code} — ${trace.employee?.full_name ?? ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          {trace?.calculation_trace && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Formula:</span>
                <code className="bg-muted rounded px-2 py-0.5">
                  {(trace.calculation_trace as Record<string, unknown>).formula as string}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Input:</span>
                <pre className="bg-muted/50 mt-1 overflow-x-auto rounded border p-2 text-xs">
                  {JSON.stringify(
                    (trace.calculation_trace as Record<string, unknown>).inputs,
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <span className="text-muted-foreground">Langkah:</span>
                <ol className="mt-1 space-y-1">
                  {(
                    (
                      trace.calculation_trace as {
                        steps?: Array<{ label: string; expression: string; value: string }>;
                      }
                    ).steps ?? []
                  ).map((s, i) => (
                    <li key={i} className="bg-muted/30 rounded border px-2 py-1 font-mono text-xs">
                      {s.label}: {s.expression} = {s.value}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="text-muted-foreground">Hasil:</span>{' '}
                <span className="font-mono">{fmtRp(trace.amount)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrace(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override dialog */}
      <Dialog open={overrideLine != null} onOpenChange={(o) => !o && setOverrideLine(null)}>
        <DialogContent>
          <form onSubmit={onOverride}>
            <DialogHeader>
              <DialogTitle>Koreksi Manual</DialogTitle>
              <DialogDescription>
                {overrideLine
                  ? `${overrideLine.component_code} — ${overrideLine.employee?.full_name ?? ''}`
                  : ''}
                . Baris terkoreksi tidak akan ditimpa oleh agregasi ulang.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Jumlah (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step={1000}
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Alasan</Label>
                <Input
                  id="reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="mis. koreksi tunjangan dari HRD"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOverrideLine(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Koreksi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
