'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/data-table';
import {
  clockIn,
  getAttendanceToday,
  listAttendanceDaily,
  finalizeAttendanceDaily,
  listCorrections,
  createCorrection,
  listCorrectionInbox,
  decideCorrection,
  masterList,
  type AttendanceToday,
  type AttendanceDailyRow,
  type AttendanceCorrectionRow,
  type CorrectionInboxRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatTime, formatMinutes } from '@/lib/format';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  HADIR: 'default',
  TERLAMBAT: 'destructive',
  PULANG_CEPAT: 'secondary',
  ALPHA: 'destructive',
  IZIN: 'outline',
  SAKIT: 'outline',
  CUTI: 'outline',
  LIBUR: 'outline',
  DINAS: 'outline',
  INCOMPLETE: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  PULANG_CEPAT: 'Pulang Cepat',
  ALPHA: 'Alpha',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  CUTI: 'Cuti',
  LIBUR: 'Libur',
  DINAS: 'Dinas',
  INCOMPLETE: 'Belum Lengkap',
};

const CORR_STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  RETURNED: 'outline',
  CANCELED: 'outline',
};

interface CorrectionReasonRow {
  id: string;
  code: string;
  label: string;
}

/** A PRNG UUID for client_request_id (no crypto dependency needed for a demo). */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const monthlyColumns: Column<AttendanceDailyRow>[] = [
  { key: 'work_date', header: 'Tanggal' },
  {
    key: 'first_in_at',
    header: 'Masuk',
    render: (r) => formatTime(r.first_in_at),
  },
  {
    key: 'last_out_at',
    header: 'Pulang',
    render: (r) => formatTime(r.last_out_at),
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
  {
    key: 'late_minutes',
    header: 'Terlambat',
    render: (r) => (r.late_minutes > 0 ? formatMinutes(r.late_minutes) : '—'),
  },
  {
    key: 'early_leave_minutes',
    header: 'Pulang Cepat',
    render: (r) => (r.early_leave_minutes > 0 ? formatMinutes(r.early_leave_minutes) : '—'),
  },
  {
    key: 'work_minutes',
    header: 'Jam Kerja',
    render: (r) => formatMinutes(r.work_minutes),
  },
  {
    key: 'is_anomaly',
    header: 'Anomali',
    render: (r) =>
      r.is_anomaly ? (
        <Badge variant="destructive">{(r.anomaly_reasons ?? []).join(' · ') || 'ANOMALI'}</Badge>
      ) : (
        '—'
      ),
  },
];

export default function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [rows, setRows] = useState<AttendanceDailyRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [clocking, setClocking] = useState<'IN' | 'OUT' | null>(null);

  // Correction dialog state.
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrDaily, setCorrDaily] = useState<AttendanceDailyRow | null>(null);
  const [corrReasons, setCorrReasons] = useState<CorrectionReasonRow[]>([]);
  const [corrForm, setCorrForm] = useState({
    reason_code: '',
    notes: '',
    first_in_at: '',
    last_out_at: '',
    status: '',
  });
  const [corrSaving, setCorrSaving] = useState(false);

  // Rekap Harian (COMBEN) state.
  const [rekapRows, setRekapRows] = useState<AttendanceDailyRow[]>([]);
  const [rekapTotal, setRekapTotal] = useState(0);
  const [rekapPage, setRekapPage] = useState(1);
  const [rekapLoading, setRekapLoading] = useState(false);
  const [rekapFrom, setRekapFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [rekapTo, setRekapTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [finalizing, setFinalizing] = useState(false);

  // Corrections — mine + inbox.
  const [myCorr, setMyCorr] = useState<AttendanceCorrectionRow[]>([]);
  const [myCorrTotal, setMyCorrTotal] = useState(0);
  const [myCorrPage, setMyCorrPage] = useState(1);
  const [inbox, setInbox] = useState<CorrectionInboxRow[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxPage, setInboxPage] = useState(1);
  const [actingId, setActingId] = useState<string | null>(null);

  const canReadDaily = hasPermission('attendance.daily.read');
  const canWriteDaily = hasPermission('attendance.daily.write');
  const canCorrWrite = hasPermission('attendance.correction.write');
  const canCorrRead = hasPermission('attendance.correction.read');
  const canCorrApprove = hasPermission('attendance.correction.approve');

  const loadToday = useCallback(async () => {
    try {
      setToday(await getAttendanceToday());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat kartu kehadiran.');
    }
  }, []);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAttendanceDaily({ page, pageSize });
      setRows(res.rows);
      setRowsTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat rekap harian.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadCorrections = useCallback(async () => {
    try {
      const [mine, inc] = await Promise.all([
        listCorrections({ page: myCorrPage, pageSize }),
        canCorrApprove ? listCorrectionInbox({ page: inboxPage, pageSize }) : Promise.resolve(null),
      ]);
      setMyCorr(mine.rows);
      setMyCorrTotal(mine.total);
      if (inc) {
        setInbox(inc.rows);
        setInboxTotal(inc.total);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat koreksi kehadiran.');
    }
  }, [pageSize, myCorrPage, inboxPage, canCorrApprove]);

  useEffect(() => {
    void loadToday();
    void loadMonthly();
    void loadCorrections();
  }, [loadToday, loadMonthly, loadCorrections]);

  // Correction reasons from master reference-data (no frontend arrays).
  useEffect(() => {
    masterList<CorrectionReasonRow>('reference-data', {
      pageSize: 100,
      search: 'ATTENDANCE_CORRECTION_REASON',
    })
      .then((res) => setCorrReasons(res.rows))
      .catch(() => setCorrReasons([]));
  }, []);

  async function onClock(kind: 'IN' | 'OUT') {
    if (!user?.employeeId) return;
    setClocking(kind);
    setError(null);
    setInfo(null);
    try {
      const res = await clockIn({
        log_type: kind,
        // Demo: mock GPS inside the HQ geofence (branch -6.2, 106.8).
        latitude: '-6.200000',
        longitude: '106.800000',
        is_mock_location: true,
        client_request_id: uuid(),
      });
      if (res.geofence?.out_of_zone) {
        setInfo(`Absen ${kind === 'IN' ? 'masuk' : 'pulang'} tercatat di luar zona geofence.`);
      } else if (res.geofence?.noData) {
        setInfo(`Absen ${kind === 'IN' ? 'masuk' : 'pulang'} tercatat (tanpa data GPS).`);
      } else {
        setInfo(`Absen ${kind === 'IN' ? 'masuk' : 'pulang'} tercatat.`);
      }
      await loadToday();
      await loadMonthly();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal absen.');
    } finally {
      setClocking(null);
    }
  }

  function openCorrection(row: AttendanceDailyRow) {
    setCorrDaily(row);
    setCorrForm({
      reason_code: '',
      notes: '',
      first_in_at: row.first_in_at ? row.first_in_at.slice(0, 16) : '',
      last_out_at: row.last_out_at ? row.last_out_at.slice(0, 16) : '',
      status: row.status,
    });
    setCorrOpen(true);
  }

  async function onSaveCorrection(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!corrDaily) return;
    setCorrSaving(true);
    setError(null);
    try {
      const proposed_values: Record<string, unknown> = {};
      if (corrForm.first_in_at)
        proposed_values.first_in_at = new Date(corrForm.first_in_at).toISOString();
      if (corrForm.last_out_at)
        proposed_values.last_out_at = new Date(corrForm.last_out_at).toISOString();
      if (corrForm.status) proposed_values.status = corrForm.status;
      await createCorrection({
        attendance_daily_id: corrDaily.id,
        reason_code: corrForm.reason_code,
        notes: corrForm.notes || undefined,
        proposed_values: Object.keys(proposed_values).length ? proposed_values : undefined,
      });
      setCorrOpen(false);
      setInfo('Koreksi kehadiran diajukan — menunggu persetujuan atasan → Combena.');
      await loadCorrections();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengajukan koreksi.');
    } finally {
      setCorrSaving(false);
    }
  }

  async function onFinalize() {
    setFinalizing(true);
    setError(null);
    setInfo(null);
    try {
      const res = await finalizeAttendanceDaily({ date: rekapTo });
      setInfo(`Finalisasi ${res.date}: ${res.finalized} karyawan diproses.`);
      await loadRekap();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal finalisasi rekap harian.');
    } finally {
      setFinalizing(false);
    }
  }

  const loadRekap = useCallback(async () => {
    setRekapLoading(true);
    setError(null);
    try {
      const res = await listAttendanceDaily({
        page: rekapPage,
        pageSize,
        from: rekapFrom,
        to: rekapTo,
      });
      setRekapRows(res.rows);
      setRekapTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat rekap harian divisi.');
    } finally {
      setRekapLoading(false);
    }
  }, [rekapPage, pageSize, rekapFrom, rekapTo]);

  useEffect(() => {
    if (canReadDaily) void loadRekap();
  }, [loadRekap, canReadDaily]);

  async function onDecide(id: string, action: 'APPROVE' | 'REJECT' | 'RETURN') {
    setActingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await decideCorrection(id, action);
      setInfo(`Koreksi ${res.status}.`);
      await loadCorrections();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memutuskan koreksi.');
    } finally {
      setActingId(null);
    }
  }

  const hasIn = today?.logs.some((l) => l.log_type === 'IN') ?? false;
  const hasOut = today?.logs.some((l) => l.log_type === 'OUT') ?? false;
  const schedule = today?.schedule;

  const rekapColumns: Column<AttendanceDailyRow>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (r) => (
        <span>
          {r.employee?.full_name ?? '—'}{' '}
          <span className="text-muted-foreground font-mono text-xs">{r.employee?.nik ?? ''}</span>
        </span>
      ),
    },
    { key: 'work_date', header: 'Tanggal' },
    {
      key: 'first_in_at',
      header: 'Masuk',
      render: (r) => formatTime(r.first_in_at),
    },
    {
      key: 'last_out_at',
      header: 'Pulang',
      render: (r) => formatTime(r.last_out_at),
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
    {
      key: 'work_minutes',
      header: 'Jam Kerja',
      render: (r) => formatMinutes(r.work_minutes),
    },
  ];

  const inboxColumns: Column<CorrectionInboxRow>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (r) => {
        const em = r.correction?.attendance_daily?.employee;
        return em ? (
          <span>
            {em.full_name} <span className="text-muted-foreground font-mono text-xs">{em.nik}</span>
          </span>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'reason_code',
      header: 'Alasan',
      render: (r) => r.correction?.reason_code ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={CORR_STATE_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (r) =>
        r.status === 'PENDING' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === r.id}
              onClick={() => void onDecide(r.id, 'APPROVE')}
            >
              Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === r.id}
              onClick={() => void onDecide(r.id, 'REJECT')}
            >
              Tolak
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kehadiran</h1>
          <p className="text-muted-foreground text-sm">
            S6-M2 — absen masuk/pulang dengan geofence, rekap harian, dan koreksi kehadiran
            (FR-M2-001..012)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadToday()}>
          <RefreshCw className="h-4 w-4" /> Muat Ulang
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {info && (
        <p className="rounded border border-emerald-500/40 bg-emerald-50 p-2 text-sm">{info}</p>
      )}

      <Tabs defaultValue="me">
        <TabsList>
          <TabsTrigger value="me">Absen Saya</TabsTrigger>
          {canReadDaily && <TabsTrigger value="rekap">Rekap Harian</TabsTrigger>}
        </TabsList>

        {/* ------------------------- ABSEN SAYA ------------------------- */}
        <TabsContent value="me" className="space-y-6">
          {/* Today card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Kartu kehadiran — {today?.date ?? '…'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!today ? (
                <p className="text-muted-foreground text-sm">Memuat kartu kehadiran…</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <p className="text-lg font-semibold">
                      {today.daily ? (
                        <Badge variant={STATUS_VARIANT[today.daily.status] ?? 'outline'}>
                          {STATUS_LABEL[today.daily.status] ?? today.daily.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Belum tercatat</Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Masuk / Pulang</p>
                    <p className="text-lg font-semibold">
                      {formatTime(today.daily?.first_in_at)} →{' '}
                      {formatTime(today.daily?.last_out_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Jam Kerja</p>
                    <p className="text-lg font-semibold">
                      {today.daily ? formatMinutes(today.daily.work_minutes) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Jadwal ({schedule ? 'aktif' : '—'})
                    </p>
                    <p className="text-lg font-semibold">
                      {schedule?.start_time && schedule?.end_time
                        ? `${schedule.start_time}–${schedule.end_time}`
                        : schedule?.is_working_day
                          ? 'Fleksibel'
                          : 'Non-kerja'}
                    </p>
                  </div>
                </div>
              )}

              {today && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button
                    disabled={!user?.employeeId || hasIn || clocking !== null}
                    onClick={() => void onClock('IN')}
                  >
                    {clocking === 'IN' ? 'Mencatat…' : hasIn ? 'Masuk ✓' : 'Absen Masuk'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!user?.employeeId || hasOut || !hasIn || clocking !== null}
                    onClick={() => void onClock('OUT')}
                  >
                    {clocking === 'OUT' ? 'Mencatat…' : hasOut ? 'Pulang ✓' : 'Absen Pulang'}
                  </Button>
                  {today.geofence && (
                    <span className="text-muted-foreground text-xs">
                      Geofence {Math.round(today.geofence.radius)} m ·{' '}
                      {today.geofence.policy === 'GEOFENCE_STRICT' ? 'ketat' : 'terlacak'}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly table */}
          <DataTable<AttendanceDailyRow>
            columns={[
              ...monthlyColumns,
              ...(canCorrWrite
                ? [
                    {
                      key: 'actions' as const,
                      header: '',
                      render: (r: AttendanceDailyRow) => (
                        <Button size="sm" variant="ghost" onClick={() => openCorrection(r)}>
                          Koreksi
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={rows}
            total={rowsTotal}
            page={page}
            pageSize={pageSize}
            loading={loading}
            onPageChange={setPage}
            emptyMessage="Belum ada rekap kehadiran."
          />

          {/* My corrections */}
          {canCorrRead && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Koreksi Saya</h2>
              <DataTable<AttendanceCorrectionRow>
                columns={[
                  {
                    key: 'created_at',
                    header: 'Diajukan',
                    render: (r) => r.created_at.slice(0, 10),
                  },
                  { key: 'reason_code', header: 'Alasan' },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (r) => (
                      <Badge variant={CORR_STATE_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>
                    ),
                  },
                ]}
                rows={myCorr}
                total={myCorrTotal}
                page={myCorrPage}
                pageSize={pageSize}
                onPageChange={setMyCorrPage}
                emptyMessage="Belum ada koreksi."
              />
            </div>
          )}
        </TabsContent>

        {/* ------------------------- REKAP HARIAN ------------------------- */}
        {canReadDaily && (
          <TabsContent value="rekap" className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="rekap_from">Dari</Label>
                <Input
                  id="rekap_from"
                  type="date"
                  value={rekapFrom}
                  onChange={(e) => {
                    setRekapFrom(e.target.value);
                    setRekapPage(1);
                  }}
                  className="w-44"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rekap_to">Sampai</Label>
                <Input
                  id="rekap_to"
                  type="date"
                  value={rekapTo}
                  onChange={(e) => {
                    setRekapTo(e.target.value);
                    setRekapPage(1);
                  }}
                  className="w-44"
                />
              </div>
              {canWriteDaily && (
                <Button variant="outline" disabled={finalizing} onClick={() => void onFinalize()}>
                  {finalizing ? 'Memproses…' : 'Finalisasi Hari Ini'}
                </Button>
              )}
            </div>

            <DataTable<AttendanceDailyRow>
              columns={rekapColumns}
              rows={rekapRows}
              total={rekapTotal}
              page={rekapPage}
              pageSize={pageSize}
              loading={rekapLoading}
              onPageChange={setRekapPage}
              emptyMessage="Tidak ada rekap pada rentang ini."
            />

            {canCorrApprove && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Approval Koreksi (Atasan → Comben)</h2>
                <DataTable<CorrectionInboxRow>
                  columns={inboxColumns}
                  rows={inbox}
                  total={inboxTotal}
                  page={inboxPage}
                  pageSize={pageSize}
                  onPageChange={setInboxPage}
                  emptyMessage="Tidak ada koreksi menunggu persetujuan Anda."
                />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* --- Correction dialog --- */}
      <Dialog open={corrOpen} onOpenChange={setCorrOpen}>
        <DialogContent>
          <form onSubmit={onSaveCorrection}>
            <DialogHeader>
              <DialogTitle>Ajukan Koreksi Kehadiran</DialogTitle>
              <DialogDescription>
                Untuk {corrDaily ? formatDateForDialog(corrDaily.work_date) : '…'} — disetujui
                Atasan, lalu dikonfirmasi Comben.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Alasan Koreksi</Label>
                <Select
                  value={corrForm.reason_code}
                  onValueChange={(v) => setCorrForm({ ...corrForm, reason_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih alasan…" />
                  </SelectTrigger>
                  <SelectContent>
                    {corrReasons.map((r) => (
                      <SelectItem key={r.id} value={r.code}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="corr_in">Jam Masuk</Label>
                  <Input
                    id="corr_in"
                    type="datetime-local"
                    value={corrForm.first_in_at}
                    onChange={(e) => setCorrForm({ ...corrForm, first_in_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corr_out">Jam Pulang</Label>
                  <Input
                    id="corr_out"
                    type="datetime-local"
                    value={corrForm.last_out_at}
                    onChange={(e) => setCorrForm({ ...corrForm, last_out_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status Pengganti</Label>
                <Select
                  value={corrForm.status}
                  onValueChange={(v) => setCorrForm({ ...corrForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Biarkan otomatis…" />
                  </SelectTrigger>
                  <SelectContent>
                    {['HADIR', 'TERLAMBAT', 'PULANG_CEPAT', 'IZIN', 'SAKIT', 'DINAS'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="corr_notes">Catatan</Label>
                <Input
                  id="corr_notes"
                  value={corrForm.notes}
                  onChange={(e) => setCorrForm({ ...corrForm, notes: e.target.value })}
                  placeholder="mis. HP tertinggal di rumah"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCorrOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={corrSaving || !corrForm.reason_code}>
                {corrSaving ? 'Mengirim…' : 'Ajukan Koreksi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateForDialog(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
