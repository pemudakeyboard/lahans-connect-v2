'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * Admin-config hari kerja per jadwal (user directive: jadwal kerja tidak
 * hardcoded). `day_of_week` 0=Minggu .. 6=Sabtu; jam didefinisikan per hari.
 */

const DAY_LABEL: Record<string, string> = {
  '0': 'Minggu',
  '1': 'Senin',
  '2': 'Selasa',
  '3': 'Rabu',
  '4': 'Kamis',
  '5': 'Jumat',
  '6': 'Sabtu',
};

interface WorkScheduleDayRow {
  id: string;
  work_schedule_id: string;
  day_of_week: number;
  is_working_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  break_minutes: number;
  late_tolerance_minutes: number;
  work_schedule?: { name?: string } | null;
}

const columns: Column<WorkScheduleDayRow>[] = [
  {
    key: 'work_schedule',
    header: 'Jadwal',
    render: (r) => r.work_schedule?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'day_of_week',
    header: 'Hari',
    render: (r) => DAY_LABEL[String(r.day_of_week)] ?? String(r.day_of_week),
  },
  {
    key: 'is_working_day',
    header: 'Kerja',
    render: (r) =>
      r.is_working_day ? <Badge>Aktif</Badge> : <Badge variant="outline">Libur</Badge>,
  },
  {
    key: 'start_time',
    header: 'Mulai',
    render: (r) => (r.is_working_day ? (r.start_time ?? '—') : '—'),
  },
  {
    key: 'end_time',
    header: 'Selesai',
    render: (r) => (r.is_working_day ? (r.end_time ?? '—') : '—'),
  },
  {
    key: 'break_minutes',
    header: 'Istirahat (mnt)',
    render: (r) => (r.is_working_day ? r.break_minutes : '—'),
  },
  {
    key: 'late_tolerance_minutes',
    header: 'Toleransi (mnt)',
    render: (r) => (r.is_working_day ? r.late_tolerance_minutes : '—'),
  },
];

const fields: FieldDef[] = [
  {
    name: 'work_schedule_id',
    label: 'Jadwal',
    required: true,
    select: { entity: 'work-schedules', valueField: 'id', labelField: 'name' },
  },
  {
    name: 'day_of_week',
    label: 'Hari',
    required: true,
    options: [
      { value: '0', label: 'Minggu' },
      { value: '1', label: 'Senin' },
      { value: '2', label: 'Selasa' },
      { value: '3', label: 'Rabu' },
      { value: '4', label: 'Kamis' },
      { value: '5', label: 'Jumat' },
      { value: '6', label: 'Sabtu' },
    ],
  },
  { name: 'is_working_day', label: 'Hari Kerja', type: 'boolean' },
  { name: 'start_time', label: 'Jam Mulai (HH:MM)', placeholder: '09:00' },
  { name: 'end_time', label: 'Jam Selesai (HH:MM)', placeholder: '17:00' },
  { name: 'break_minutes', label: 'Istirahat (menit)', type: 'number' },
  { name: 'late_tolerance_minutes', label: 'Toleransi Terlambat (menit)', type: 'number' },
];

export default function WorkScheduleDaysPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<WorkScheduleDayRow>
      entity="work-schedule-days"
      title="Hari Kerja"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.work_schedule_days.write')}
    />
  );
}
