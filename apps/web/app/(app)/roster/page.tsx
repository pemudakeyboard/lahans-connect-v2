'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  listShifts,
  createShift,
  updateShift,
  listRosterCalendar,
  listScheduleOverrides,
  createScheduleOverride,
  listRosterDelegations,
  createRosterDelegation,
  cancelRosterDelegation,
  masterList,
  type ShiftDefinitionRow,
  type RosterCalendarRow,
  type ScheduleOverrideRow,
  type RosterDelegationRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * M2B — Roster Management (FR-M2B-001..004, FR-M0-060/061).
 *
 * Tabs:
 *  - Kalender Roster: one row per employee × date (branch-filterable), sourced
 *    from the shared 5-level resolver (individu > jabatan > golongan > cabang >
 *    entitas) + per-date overrides — no hard blocker on period close.
 *  - Konfigurasi Shift: shift definitions (NORMAL/PAGI/SIANG/MALAM) EDITED here
 *    (not hardcoded) via the roster API; rotation patterns live in master.
 *  - Delegasi: hand roster duties to a delegate (FR-M0-060/061).
 */

const SHIFT_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NORMAL: 'default',
  PAGI: 'secondary',
  SIANG: 'outline',
  MALAM: 'destructive',
};

interface EmployeeOption {
  id: string;
  nik: string;
  full_name: string;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

function calendarKey(row: RosterCalendarRow): string {
  return `${row.employee_id}|${row.work_date}`;
}

export default function RosterPage() {
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(() => searchParams.get('tab') ?? 'calendar');

  // -- calendar state --------------------------------------------------------
  const [calRows, setCalRows] = useState<RosterCalendarRow[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calFrom, setCalFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [calTo, setCalTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [calBranchId, setCalBranchId] = useState('');

  // -- shift config state ----------------------------------------------------
  const [shifts, setShifts] = useState<ShiftDefinitionRow[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState<{
    id?: string;
    code: string;
    name: string;
    start_time: string;
    end_time: string;
    break_minutes: string;
    late_tolerance_minutes: string;
    crosses_midnight: boolean;
  }>({
    code: '',
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: '60',
    late_tolerance_minutes: '0',
    crosses_midnight: false,
  });
  const [shiftSaving, setShiftSaving] = useState(false);

  // -- branches ---------------------------------------------------------------
  const [branches, setBranches] = useState<BranchOption[]>([]);

  // -- override state --------------------------------------------------------
  const [overrides, setOverrides] = useState<ScheduleOverrideRow[]>([]);
  const [ovOpen, setOvOpen] = useState(false);
  const [ovEmployees, setOvEmployees] = useState<EmployeeOption[]>([]);
  const [ovForm, setOvForm] = useState({
    employee_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    work_schedule_id: '',
    is_day_off: false,
    reason: '',
  });
  const [ovSaving, setOvSaving] = useState(false);

  // -- delegation state ------------------------------------------------------
  const [delegations, setDelegations] = useState<{
    mine: RosterDelegationRow[];
    delegatingToMe: string[];
  }>({ mine: [], delegatingToMe: [] });
  const [delOpen, setDelOpen] = useState(false);
  const [delForm, setDelForm] = useState({
    delegate_user_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    reason: '',
  });
  const [delSaving, setDelSaving] = useState(false);

  const canCalendar = hasPermission('roster.calendar.read');
  const canShiftWrite = hasPermission('roster.shift.write');
  const canOverrideWrite = hasPermission('roster.override.write');
  const canDelegationWrite = hasPermission('roster.delegation.write');

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    setError(null);
    try {
      const res = await listRosterCalendar({
        from: calFrom,
        to: calTo,
        branchId: calBranchId || undefined,
      });
      setCalRows(res.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat kalender roster.');
    } finally {
      setCalLoading(false);
    }
  }, [calFrom, calTo, calBranchId]);

  const loadShifts = useCallback(async () => {
    setShiftLoading(true);
    setError(null);
    try {
      setShifts(await listShifts());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat konfigurasi shift.');
    } finally {
      setShiftLoading(false);
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    try {
      setOverrides(await listScheduleOverrides());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat override jadwal.');
    }
  }, []);

  const loadDelegations = useCallback(async () => {
    try {
      setDelegations(await listRosterDelegations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat delegasi roster.');
    }
  }, []);

  useEffect(() => {
    if (canCalendar) void loadCalendar();
    void loadShifts();
    void loadOverrides();
    void loadDelegations();
  }, [canCalendar, loadCalendar, loadShifts, loadOverrides, loadDelegations]);

  // Employee options for the override dialog (from master employees).
  useEffect(() => {
    masterList<EmployeeOption>('employees', { pageSize: 1000 })
      .then((res) => setOvEmployees(res.rows))
      .catch(() => setOvEmployees([]));
  }, []);

  // Branch filter options (from master branches).
  useEffect(() => {
    masterList<BranchOption>('branches', { pageSize: 1000 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
  }, []);

  function openShift(row?: ShiftDefinitionRow) {
    setShiftForm(
      row
        ? {
            id: row.id,
            code: row.code,
            name: row.name,
            start_time: row.start_time ?? '',
            end_time: row.end_time ?? '',
            break_minutes: String(row.break_minutes),
            late_tolerance_minutes: String(row.late_tolerance_minutes),
            crosses_midnight: row.crosses_midnight,
          }
        : {
            code: '',
            name: '',
            start_time: '09:00',
            end_time: '17:00',
            break_minutes: '60',
            late_tolerance_minutes: '0',
            crosses_midnight: false,
          },
    );
    setShiftOpen(true);
  }

  async function onSaveShift(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setShiftSaving(true);
    setError(null);
    try {
      const body = {
        code: shiftForm.code,
        name: shiftForm.name,
        start_time: shiftForm.start_time || undefined,
        end_time: shiftForm.end_time || undefined,
        break_minutes: Number(shiftForm.break_minutes) || undefined,
        late_tolerance_minutes: Number(shiftForm.late_tolerance_minutes) || undefined,
        crosses_midnight: shiftForm.crosses_midnight,
      };
      if (shiftForm.id) {
        await updateShift(shiftForm.id, body);
        setInfo('Shift diperbarui.');
      } else {
        await createShift(body);
        setInfo('Shift baru dibuat.');
      }
      setShiftOpen(false);
      await loadShifts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan shift.');
    } finally {
      setShiftSaving(false);
    }
  }

  async function onSaveOverride(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ovForm.employee_id) return;
    setOvSaving(true);
    setError(null);
    try {
      await createScheduleOverride({
        employee_id: ovForm.employee_id,
        work_date: ovForm.work_date,
        work_schedule_id: ovForm.work_schedule_id || undefined,
        is_day_off: ovForm.is_day_off,
        reason: ovForm.reason,
      });
      setOvOpen(false);
      setInfo('Override jadwal disimpan.');
      setOvForm((f) => ({ ...f, employee_id: '', work_schedule_id: '', reason: '' }));
      await Promise.all([loadOverrides(), loadCalendar()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan override.');
    } finally {
      setOvSaving(false);
    }
  }

  async function onSaveDelegation(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!delForm.delegate_user_id) return;
    setDelSaving(true);
    setError(null);
    try {
      await createRosterDelegation({
        delegate_user_id: delForm.delegate_user_id,
        module_codes: ['ROSTER'],
        start_date: delForm.start_date,
        end_date: delForm.end_date,
        reason: delForm.reason,
      });
      setDelOpen(false);
      setInfo('Delegasi roster dibuat.');
      setDelForm((f) => ({ ...f, delegate_user_id: '', end_date: '', reason: '' }));
      await loadDelegations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat delegasi.');
    } finally {
      setDelSaving(false);
    }
  }

  async function onCancelDelegation(id: string) {
    setError(null);
    try {
      await cancelRosterDelegation(id);
      setInfo('Delegasi dibatalkan.');
      await loadDelegations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membatalkan delegasi.');
    }
  }

  const shiftColumns: Column<ShiftDefinitionRow>[] = [
    {
      key: 'code',
      header: 'Kode',
      render: (r) => <Badge variant={SHIFT_VARIANT[r.code] ?? 'outline'}>{r.code}</Badge>,
    },
    { key: 'name', header: 'Nama' },
    {
      key: 'window',
      header: 'Jam Kerja',
      render: (r) => (r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : '—'),
    },
    {
      key: 'crosses_midnight',
      header: 'Lintas Malam',
      render: (r) => (r.crosses_midnight ? <Badge>Ya</Badge> : '—'),
    },
    {
      key: 'break_minutes',
      header: 'Istirahat',
      render: (r) => (r.break_minutes > 0 ? `${r.break_minutes} mnt` : '—'),
    },
    {
      key: 'is_active',
      header: 'Aktif',
      render: (r) =>
        r.is_active ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (r) =>
        canShiftWrite ? (
          <Button size="sm" variant="outline" onClick={() => openShift(r)}>
            Edit
          </Button>
        ) : null,
    },
  ];

  const overrideColumns: Column<ScheduleOverrideRow>[] = [
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
      key: 'is_day_off',
      header: 'Libur',
      render: (r) => (r.is_day_off ? <Badge variant="outline">Libur</Badge> : <Badge>Aktif</Badge>),
    },
    { key: 'reason', header: 'Alasan' },
  ];

  const delegationColumns: Column<RosterDelegationRow>[] = [
    {
      key: 'delegate',
      header: 'Delegasi Ke',
      render: (r) =>
        r.delegate?.login_nik ? (
          <span>
            {r.delegate.employee?.full_name ?? r.delegate.login_nik}{' '}
            <span className="text-muted-foreground font-mono text-xs">{r.delegate.login_nik}</span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'window',
      header: 'Periode',
      render: (r) => `${r.start_date.slice(0, 10)} → ${r.end_date.slice(0, 10)}`,
    },
    { key: 'reason', header: 'Alasan' },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) =>
        r.is_active ? <Badge>Aktif</Badge> : <Badge variant="outline">Selesai</Badge>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (r) =>
        r.is_active && canDelegationWrite ? (
          <Button size="sm" variant="outline" onClick={() => void onCancelDelegation(r.id)}>
            Batalkan
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roster</h1>
          <p className="text-muted-foreground text-sm">
            M2B — konfigurasi shift (normal/pagi/siang/malam), kalender roster per branch, dan
            delegasi tugas (FR-M2B-001..004, FR-M0-060/061)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadCalendar();
            void loadShifts();
            void loadOverrides();
            void loadDelegations();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Muat Ulang
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {info && (
        <p className="rounded border border-emerald-500/40 bg-emerald-50 p-2 text-sm">{info}</p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar">Kalender Roster</TabsTrigger>
          <TabsTrigger value="overrides">Override</TabsTrigger>
          <TabsTrigger value="shifts">Konfigurasi Shift</TabsTrigger>
          <TabsTrigger value="delegations">Delegasi</TabsTrigger>
        </TabsList>

        {/* ------------------------- KALENDER ROSTER ------------------------- */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Kalender Roster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Dari</Label>
                  <Input
                    type="date"
                    value={calFrom}
                    onChange={(e) => setCalFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sampai</Label>
                  <Input
                    type="date"
                    value={calTo}
                    onChange={(e) => setCalTo(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cabang</Label>
                  <Select value={calBranchId} onValueChange={setCalBranchId}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Semua cabang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua cabang</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={() => void loadCalendar()}>
                  Tampilkan
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Sumber: resolver 5-level (individu &gt; jabatan &gt; golongan &gt; cabang &gt;
                entitas) + override per tanggal. Jadwal yang hilang tidak memblokir penutupan
                periode — ditandai NO_SCHEDULE di rekap kehadiran.
              </p>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            {calLoading ? (
              <div className="text-muted-foreground p-8 text-center text-sm">Memuat…</div>
            ) : calRows.length === 0 ? (
              <div className="text-muted-foreground p-8 text-center text-sm">
                Tidak ada data untuk rentang ini.
              </div>
            ) : (
              <CalTable rows={calRows} />
            )}
          </div>
        </TabsContent>

        {/* ------------------------- OVERRIDE ------------------------- */}
        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Override Jadwal (FR-M2B-004)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                Tukar shift / libur per tanggal tanpa mengubah jadwal utama. Resolver mengutamakan
                override di atas penugasan.
              </p>
              {canOverrideWrite && (
                <Button size="sm" onClick={() => setOvOpen(true)}>
                  + Override Baru
                </Button>
              )}
              <DataTable
                columns={overrideColumns}
                rows={overrides.map((o) => ({ ...o, id: o.id }))}
                total={overrides.length}
                page={1}
                pageSize={overrides.length || 1}
                emptyMessage="Belum ada override."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------- KONFIGURASI SHIFT ------------------------- */}
        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Konfigurasi Shift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                Shift NORMAL/PAGI/SIANG/MALAM dikonfigurasi di sini (bukan hardcoded) — jam SOP
                hanyalah default seed. Shift lintas malam (MALAM) otomatis menandai{' '}
                <code>crosses_midnight</code> saat waktu mulai ≥ waktu selesai.
              </p>
              {canShiftWrite && (
                <Button size="sm" onClick={() => openShift()}>
                  + Shift Baru
                </Button>
              )}
              <DataTable
                columns={shiftColumns}
                rows={shifts.map((s) => ({ ...s, id: s.id }))}
                total={shifts.length}
                page={1}
                pageSize={shifts.length || 1}
                loading={shiftLoading}
                emptyMessage="Belum ada shift. Seed dari SOP akan muncul saat migrasi."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------- DELEGASI ------------------------- */}
        <TabsContent value="delegations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Delegasi Roster (FR-M0-060/061)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                Serahkan tugas roster ke rekan saat berhalangan. Selama delegasi aktif, tugas yang
                masuk ke Anda diteruskan ke delegasi.
              </p>
              {canDelegationWrite && (
                <Button size="sm" onClick={() => setDelOpen(true)}>
                  + Delegasi Baru
                </Button>
              )}
              <DataTable
                columns={delegationColumns}
                rows={delegations.mine.map((d) => ({ ...d, id: d.id }))}
                total={delegations.mine.length}
                page={1}
                pageSize={delegations.mine.length || 1}
                emptyMessage="Belum ada delegasi."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------- SHIFT DIALOG ------------------------- */}
      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shiftForm.id ? 'Edit Shift' : 'Shift Baru'}</DialogTitle>
            <DialogDescription>Konfigurasi jam shift (WIB).</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onSaveShift(e)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kode</Label>
                <Input
                  value={shiftForm.code}
                  onChange={(e) => setShiftForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="PAGI"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nama</Label>
                <Input
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Shift Pagi"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mulai</Label>
                <Input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(e) => setShiftForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Selesai</Label>
                <Input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(e) => setShiftForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Istirahat (mnt)</Label>
                <Input
                  type="number"
                  min={0}
                  value={shiftForm.break_minutes}
                  onChange={(e) => setShiftForm((f) => ({ ...f, break_minutes: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Toleransi Telat (mnt)</Label>
                <Input
                  type="number"
                  min={0}
                  value={shiftForm.late_tolerance_minutes}
                  onChange={(e) =>
                    setShiftForm((f) => ({ ...f, late_tolerance_minutes: e.target.value }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shiftForm.crosses_midnight}
                onChange={(e) =>
                  setShiftForm((f) => ({ ...f, crosses_midnight: e.target.checked }))
                }
              />
              Shift lintas malam (selesai di hari berikutnya)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShiftOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={shiftSaving}>
                {shiftSaving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------- OVERRIDE DIALOG ------------------------- */}
      <Dialog open={ovOpen} onOpenChange={setOvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Jadwal</DialogTitle>
            <DialogDescription>Libur atau tukar shift untuk satu tanggal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onSaveOverride(e)} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Karyawan</Label>
              <Select
                value={ovForm.employee_id}
                onValueChange={(v) => setOvForm((f) => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {ovEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.nik})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal</Label>
              <Input
                type="date"
                value={ovForm.work_date}
                onChange={(e) => setOvForm((f) => ({ ...f, work_date: e.target.value }))}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ovForm.is_day_off}
                onChange={(e) => setOvForm((f) => ({ ...f, is_day_off: e.target.checked }))}
              />
              Jadikan libur
            </label>
            <div className="space-y-1">
              <Label className="text-xs">Alasan</Label>
              <Input
                value={ovForm.reason}
                onChange={(e) => setOvForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Alasan override"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOvOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={ovSaving}>
                {ovSaving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------- DELEGATION DIALOG ------------------------- */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegasi Roster</DialogTitle>
            <DialogDescription>
              Serahkan tugas roster ke rekan selama periode ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onSaveDelegation(e)} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Delegasi Ke (ID pengguna)</Label>
              <Input
                value={delForm.delegate_user_id}
                onChange={(e) => setDelForm((f) => ({ ...f, delegate_user_id: e.target.value }))}
                placeholder="UUID user rekan"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mulai</Label>
                <Input
                  type="date"
                  value={delForm.start_date}
                  onChange={(e) => setDelForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Selesai</Label>
                <Input
                  type="date"
                  value={delForm.end_date}
                  onChange={(e) => setDelForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alasan</Label>
              <Input
                value={delForm.reason}
                onChange={(e) => setDelForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Alasan delegasi"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDelOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={delSaving}>
                {delSaving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Lightweight calendar table (rows are keyed employee_id|date, no id column). */
function CalTable({ rows }: { rows: RosterCalendarRow[] }) {
  const columns: Column<{ key: string; row: RosterCalendarRow }>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (c) => (
        <span>
          {c.row.full_name}{' '}
          <span className="text-muted-foreground font-mono text-xs">{c.row.nik}</span>
        </span>
      ),
    },
    { key: 'date', header: 'Tanggal', render: (c) => c.row.work_date },
    {
      key: 'shift',
      header: 'Shift',
      render: (c) =>
        c.row.shift_code ? (
          <Badge variant={SHIFT_VARIANT[c.row.shift_code] ?? 'outline'}>{c.row.shift_code}</Badge>
        ) : (
          '—'
        ),
    },
    {
      key: 'window',
      header: 'Jam',
      render: (c) =>
        c.row.start_time && c.row.end_time ? `${c.row.start_time}–${c.row.end_time}` : '—',
    },
    {
      key: 'working',
      header: 'Kerja',
      render: (c) =>
        c.row.is_working_day ? <Badge>Aktif</Badge> : <Badge variant="outline">Libur</Badge>,
    },
    {
      key: 'source',
      header: 'Sumber',
      render: (c) =>
        c.row.source === 'OVERRIDE' ? (
          <Badge variant="secondary">Override</Badge>
        ) : (
          <Badge variant="outline">Jadwal</Badge>
        ),
    },
  ];

  const data = rows.map((row) => ({ key: calendarKey(row), row }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            {columns.map((c) => (
              <th key={c.key} className="p-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key} className="border-b last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="p-2">
                  {c.render ? c.render(d) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
