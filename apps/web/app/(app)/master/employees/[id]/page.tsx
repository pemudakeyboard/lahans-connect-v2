'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getEmployeeSchedule,
  masterCreate,
  masterGet,
  masterList,
  masterUpdate,
  type EmployeeScheduleRow,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PickOption {
  value: string;
  label: string;
}

interface RefOption {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  code?: string | null;
}

interface ContractAssignment {
  id?: string;
  contract_type?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
}

interface Employee {
  id: string;
  nik: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  address?: string | null;
  religion?: string | null;
  id_card_no?: string | null;
  tax_id?: string | null;
  tax_status_ptkp?: string | null;
  marital_status?: string | null;
  dependents_count?: number | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  bpjs_tk_number?: string | null;
  bpjs_kes_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  join_date?: string | null;
  employment_status?: string | null;
  resign_date?: string | null;
  leave_eligible?: boolean | null;
  photo_url?: string | null;
  is_active?: boolean | null;
  branch_id?: string | null;
  job_position_id?: string | null;
  job_grade_id?: string | null;
  branch?: RefOption | null;
  job_position?: RefOption | null;
  job_grade?: RefOption | null;
  assignments?: ContractAssignment[];
}

type FormState = Record<string, string>;

// ---------------------------------------------------------------------------
// Field group definitions (grouped per the grilled design decisions)
// ---------------------------------------------------------------------------

interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email';
  required?: boolean;
  placeholder?: string;
  /** Static picklist options (from reference_data). */
  options?: PickOption[];
  /** FK via master entity dropdown. */
  select?: { entity: string; valueField: string; labelField: string };
  /** Contract fields live on the primary employee_assignments row. */
  contract?: boolean;
  /** Only editable on create (NIK is immutable after creation). */
  readonlyOnEdit?: boolean;
}

const TABS: { value: string; label: string; fields: FieldDef[] }[] = [
  {
    value: 'identitas',
    label: 'Identitas',
    fields: [
      { name: 'nik', label: 'NIK', required: true, readonlyOnEdit: true, placeholder: '8 digit' },
      { name: 'full_name', label: 'Nama Lengkap', required: true },
      { name: 'gender', label: 'Jenis Kelamin', options: [] },
      { name: 'religion', label: 'Agama', options: [] },
      { name: 'birth_place', label: 'Tempat Lahir' },
      { name: 'birth_date', label: 'Tanggal Lahir', type: 'date' },
      { name: 'id_card_no', label: 'No. KTP' },
      { name: 'tax_id', label: 'NPWP' },
    ],
  },
  {
    value: 'keluarga',
    label: 'Keluarga & Kontak',
    fields: [
      { name: 'marital_status', label: 'Status Pernikahan', options: [] },
      { name: 'dependents_count', label: 'Jumlah Tanggungan', type: 'number' },
      { name: 'address', label: 'Alamat' },
      { name: 'phone', label: 'No. HP' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'emergency_contact_name', label: 'Kontak Darurat — Nama' },
      { name: 'emergency_contact_phone', label: 'Kontak Darurat — No. HP' },
      { name: 'emergency_contact_relation', label: 'Kontak Darurat — Hubungan' },
    ],
  },
  {
    value: 'pekerjaan',
    label: 'Pekerjaan',
    fields: [
      {
        name: 'branch_id',
        label: 'Area Kerja',
        select: { entity: 'branches', valueField: 'id', labelField: 'name' },
      },
      {
        name: 'job_position_id',
        label: 'Jabatan',
        select: { entity: 'job-positions', valueField: 'id', labelField: 'name' },
      },
      {
        name: 'job_grade_id',
        label: 'Golongan',
        select: { entity: 'job-grades', valueField: 'id', labelField: 'name' },
      },
      { name: 'employment_status', label: 'Status Kepegawaian', options: [] },
      { name: 'join_date', label: 'Tanggal Masuk', type: 'date' },
      { name: 'resign_date', label: 'Tanggal Resign', type: 'date' },
      { name: 'contract_type', label: 'Status Kontrak', contract: true, options: [] },
      { name: 'contract_start', label: 'Mulai Kontrak', contract: true, type: 'date' },
      { name: 'contract_end', label: 'Akhir Kontrak', contract: true, type: 'date' },
    ],
  },
  {
    value: 'payroll',
    label: 'Payroll & BPJS',
    fields: [
      { name: 'tax_status_ptkp', label: 'Status PTKP', options: [] },
      { name: 'bank_name', label: 'Nama Bank' },
      { name: 'bank_account_no', label: 'No. Rekening' },
      { name: 'bank_account_name', label: 'Atas Nama Rekening' },
      { name: 'bpjs_tk_number', label: 'No. BPJS Ketenagakerjaan' },
      { name: 'bpjs_kes_number', label: 'No. BPJS Kesehatan' },
    ],
  },
];

// Flatten for options fetch + validation.
const ALL_FIELDS = TABS.flatMap((t) => t.fields);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Fetch a reference_data category as {code, label} options. */
function usePicklist(category: string): PickOption[] {
  const [opts, setOpts] = useState<PickOption[]>([]);
  useEffect(() => {
    let alive = true;
    masterList<{ code: string; label: string }>('reference-data', {
      pageSize: 100,
      filters: { category },
    })
      .then((res) => {
        if (alive) setOpts(res.rows.map((r) => ({ value: r.code, label: r.label })));
      })
      .catch(() => alive && setOpts([]));
    return () => {
      alive = false;
    };
  }, [category]);
  return opts;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('master.employees.write');
  const isNew = params.id === 'new';

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState('identitas');
  const dirtyRef = useRef(false);

  // Read-only "Jadwal Kerja" card (Ticket 04). Loaded lazily — only when the
  // Pekerjaan tab is opened, and only for users with roster read access.
  const canReadSchedule = hasPermission('roster.calendar.read');
  const [schedule, setSchedule] = useState<EmployeeScheduleRow | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const scheduleFetchedRef = useRef(false);
  useEffect(() => {
    if (isNew || tab !== 'pekerjaan' || !canReadSchedule || !employee?.id) return;
    if (scheduleFetchedRef.current) return;
    scheduleFetchedRef.current = true;
    setScheduleLoading(true);
    getEmployeeSchedule(employee.id)
      .then(setSchedule)
      .catch(() => setSchedule(null))
      .finally(() => setScheduleLoading(false));
  }, [isNew, tab, canReadSchedule, employee]);

  // Picklist options per category (merging the empty placeholder arrays).
  const genderOpts = usePicklist('GENDER');
  const religionOpts = usePicklist('RELIGION');
  const maritalOpts = usePicklist('MARITAL_STATUS');
  const statusOpts = usePicklist('EMPLOYMENT_STATUS');
  const contractOpts = usePicklist('CONTRACT_TYPE');
  const ptkpOpts = usePicklist('PTKP_STATUS');

  const picklists: Record<string, PickOption[]> = {
    gender: genderOpts,
    religion: religionOpts,
    marital_status: maritalOpts,
    employment_status: statusOpts,
    contract_type: contractOpts,
    tax_status_ptkp: ptkpOpts,
  };

  // FK options (branches, job positions, job grades) — one fetch each.
  const [refOptions, setRefOptions] = useState<Record<string, RefOption[]>>({});
  useEffect(() => {
    const entities = ['branches', 'job-positions', 'job-grades'];
    void Promise.all(
      entities.map(async (entity) => {
        try {
          const res = await masterList<RefOption>(entity, { pageSize: 100 });
          setRefOptions((prev) => ({ ...prev, [entity]: res.rows }));
        } catch {
          setRefOptions((prev) => ({ ...prev, [entity]: [] }));
        }
      }),
    );
  }, []);

  const loadEmployee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const emp = await masterGet<Employee>('employees', params.id);
      setEmployee(emp);
      const init: FormState = {};
      for (const f of ALL_FIELDS) {
        if (f.contract) {
          const a = emp.assignments?.[0];
          init[f.name] = String((a as Record<string, unknown>)?.[f.name] ?? '');
        } else {
          const raw = (emp as unknown as Record<string, unknown>)[f.name];
          init[f.name] =
            raw == null ? '' : f.type === 'date' ? String(raw).slice(0, 10) : String(raw);
        }
      }
      setForm(init);
      dirtyRef.current = false;
      setDirtyTabs(new Set());
      setErrors({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data karyawan.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!isNew) void loadEmployee();
  }, [isNew, loadEmployee]);

  // Initialize an empty form for create mode.
  const initCreate = useCallback(() => {
    const init: FormState = {};
    for (const f of ALL_FIELDS) init[f.name] = '';
    setForm(init);
    setEmployee(null);
    dirtyRef.current = false;
    setDirtyTabs(new Set());
    setErrors({});
  }, []);
  useEffect(() => {
    if (isNew) initCreate();
  }, [isNew, initCreate]);

  function setField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    const field = ALL_FIELDS.find((f) => f.name === name);
    if (field) {
      const tabKey = TABS.find((t) => t.fields.some((f) => f.name === name))?.value;
      if (tabKey) setDirtyTabs((prev) => new Set(prev).add(tabKey));
    }
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    dirtyRef.current = true;
  }

  // Optimistic NIK mutation in the header summary.
  const headerNik = form.nik || employee?.nik || '—';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of ALL_FIELDS) {
      if (f.required && !form[f.name]) {
        errs[f.name] = 'Wajib diisi';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Build the PUT/POST payload. Contract fields are split out for the
  // employee_assignments row; the rest go to the employees row.
  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    const contract: Record<string, unknown> = {};
    for (const f of ALL_FIELDS) {
      const v = form[f.name];
      if (v === '') continue;
      if (f.contract) {
        if (f.name === 'contract_end' && v === '') continue;
        contract[f.name] = v;
      } else if (f.type === 'number') {
        payload[f.name] = Number(v);
      } else {
        payload[f.name] = v;
      }
    }
    return { payload, contract };
  };

  const onSave = async () => {
    if (!validate()) {
      setError('Ada field yang belum lengkap. Periksa field yang ditandai.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { payload, contract } = buildPayload();
    try {
      if (isNew) {
        const created = await masterCreate<Employee>('employees', payload);
        const id = created.id;
        if (Object.keys(contract).length > 0) {
          // Contract fields land on the primary employee_assignments row.
          await masterCreate('employee-assignments', {
            employee_id: id,
            contract_type: contract.contract_type,
            contract_start: contract.contract_start,
            contract_end: contract.contract_end,
            is_primary: true,
          });
        }
        setSuccess('Karyawan berhasil dibuat.');
        router.replace(`/master/employees/${id}`);
      } else {
        await masterUpdate('employees', employee!.id, payload);
        const a = employee!.assignments?.[0];
        if (Object.keys(contract).length > 0 && a?.id) {
          await masterUpdate('employee-assignments', a.id, contract);
        }
        dirtyRef.current = false;
        setDirtyTabs(new Set());
        setSuccess('Perubahan berhasil disimpan.');
        scheduleFetchedRef.current = false;
        setSchedule(null);
        void loadEmployee();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  // Unsaved-changes guard on leave / tab switch.
  const confirmLeaving = () => {
    if (dirtyRef.current) {
      return window.confirm('Ada perubahan yang belum disimpan. Lanjutkan tanpa menyimpan?');
    }
    return true;
  };
  const goBack = () => {
    if (confirmLeaving()) router.push('/master/employees');
  };
  const onTabChange = (v: string) => {
    if (v !== tab && confirmLeaving()) setTab(v);
  };

  const summary = employee ? (
    <span className="text-muted-foreground text-sm">
      {employee.job_position?.name ?? '—'} · {employee.branch?.name ?? '—'}
      {employee.employment_status ? (
        <Badge className="ml-2" variant={STATUS_VARIANT[employee.employment_status] ?? 'outline'}>
          {STATUS_LABEL[employee.employment_status] ?? employee.employment_status}
        </Badge>
      ) : null}
    </span>
  ) : (
    <span className="text-muted-foreground text-sm">Karyawan baru</span>
  );

  const picklistFor = (f: FieldDef): PickOption[] => picklists[f.name] ?? [];

  return (
    <div className="space-y-6">
      {/* Sticky header: back, avatar+summary, global save. */}
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 border-b px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} title="Kembali">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar name={employee?.full_name || form.full_name || 'K'} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold">
                  {employee?.full_name || form.full_name || 'Karyawan Baru'}
                </h1>
                {summary}
              </div>
              <p className="text-muted-foreground font-mono text-xs">NIK {headerNik}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {success && <span className="text-sm text-emerald-600">{success}</span>}
            {canWrite && (
              <Button onClick={() => void onSave()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={onTabChange}>
          <div className="bg-background/95 sticky top-[72px] z-10 -mx-4 border-b px-4 pt-2 backdrop-blur md:-mx-6 md:px-6">
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {dirtyTabs.has(t.value) && <span className="text-primary ml-1">•</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map((t) => {
            const tabErrors = t.fields.filter((f) => errors[f.name]);
            return (
              <TabsContent key={t.value} value={t.value} className="pt-4">
                {t.value === 'pekerjaan' &&
                  scheduleCard(canReadSchedule, scheduleLoading, schedule)}
                <Card>
                  <CardContent className="pt-6">
                    {tabErrors.length > 0 && (
                      <p className="text-destructive mb-4 text-sm">
                        Periksa {tabErrors.length} field yang belum lengkap di tab ini.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {t.fields.map((f) => {
                        const fieldErr = errors[f.name];
                        const isReadonly = !canWrite || (f.readonlyOnEdit && !isNew);
                        const opts = f.options
                          ? picklistFor(f)
                          : (refOptions[f.select?.entity ?? '']?.map((r) => ({
                              value: String(r[f.select!.valueField as keyof RefOption]),
                              label: r[f.select!.labelField as keyof RefOption] ?? String(r.id),
                            })) ?? []);
                        return (
                          <div key={f.name} className={cnFullRow(f)}>
                            <div className="space-y-2">
                              <Label htmlFor={`field-${f.name}`}>
                                {f.label}
                                {f.required && <span className="text-destructive"> *</span>}
                                {f.contract && (
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    (kontrak)
                                  </span>
                                )}
                              </Label>
                              {isReadonly ? (
                                <div className="text-muted-foreground flex h-9 items-center rounded-md border border-transparent px-3 text-sm">
                                  {displayValue(form[f.name] ?? '', f, opts)}
                                </div>
                              ) : opts.length > 0 ? (
                                <Select
                                  value={form[f.name] ?? ''}
                                  onValueChange={(v) => setField(f.name, v)}
                                >
                                  <SelectTrigger id={`field-${f.name}`} className="w-full">
                                    <SelectValue placeholder={f.placeholder ?? 'Pilih…'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {opts.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  id={`field-${f.name}`}
                                  type={f.type ?? 'text'}
                                  value={form[f.name] ?? ''}
                                  onChange={(e) => setField(f.name, e.target.value)}
                                  placeholder={f.placeholder}
                                  className={fieldErr ? 'border-destructive' : undefined}
                                />
                              )}
                              {f.type === 'date' && !isReadonly && (
                                <p className="text-muted-foreground text-xs">Format: YYYY-MM-DD</p>
                              )}
                              {fieldErr && <p className="text-destructive text-xs">{fieldErr}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

/** Full-width wrapper for long text fields (address, rekening atas nama, dll). */
function cnFullRow(f: FieldDef): string {
  return ['address', 'bank_account_name', 'emergency_contact_name'].includes(f.name)
    ? 'sm:col-span-2'
    : '';
}

/** Read-only "Jadwal Kerja" card (Ticket 04), fed by the roster resolver. */
function scheduleCard(
  canRead: boolean,
  loading: boolean,
  sched: EmployeeScheduleRow | null,
): React.ReactNode {
  if (!canRead) return null;
  const w = sched?.window ?? null;
  const s = sched?.schedule ?? null;
  const title = s?.name ?? 'Belum ada jadwal';
  const subtitle = s
    ? s.schedule_type === 'SHIFT'
      ? `rotasi ${s.code}`
      : s.schedule_type === 'FLEXIBLE'
        ? 'fleksibel'
        : 'jam tetap'
    : null;
  const time = w?.start_time && w?.end_time ? `${w.start_time}–${w.end_time}` : null;
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Jadwal Kerja
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat jadwal…
          </div>
        ) : !sched ? (
          <p className="text-muted-foreground text-sm">Tidak dapat memuat jadwal.</p>
        ) : !s ? (
          <p className="text-muted-foreground text-sm">
            Belum ada jadwal kerja untuk karyawan ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Jadwal</p>
              <p className="text-sm font-medium">{title}</p>
              {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Jam Kerja Hari Ini</p>
              <p className="text-sm font-medium">{time ?? '—'}</p>
              {w?.crosses_midnight && (
                <p className="text-muted-foreground text-xs">Melewati tengah malam</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="text-sm font-medium">
                {w?.is_working_day === false
                  ? 'Libur'
                  : w?.shiftCode
                    ? `Shift ${w.shiftCode}`
                    : time
                      ? 'Hari kerja'
                      : '—'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Pretty-print a stored value for read-only display. */
function displayValue(value: string, f: FieldDef, opts: PickOption[]): string {
  if (!value) return '—';
  if (f.type === 'date') return formatDate(value);
  if (opts.length > 0) {
    const hit = opts.find((o) => o.value === value);
    if (hit) return hit.label;
  }
  if (f.name === 'contract_type') return CONTRACT_LABEL[value] ?? value;
  if (f.name === 'employment_status') return STATUS_LABEL[value] ?? value;
  return value;
}
