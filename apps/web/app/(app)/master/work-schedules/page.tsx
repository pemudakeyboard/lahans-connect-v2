'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * Admin-config jadwal kerja (user directive: NOT hardcoded). Admins configure
 * schedules per branch/manufacturing unit from the web UI; the attendance
 * runtime resolves them from the DB (schedule_assignments → work_schedule).
 */

interface WorkScheduleRow {
  id: string;
  code: string;
  name: string;
  schedule_type: string;
  weekly_target_minutes?: number | null;
  daily_standard_minutes?: number | null;
  is_active: boolean;
}

const columns: Column<WorkScheduleRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'name', header: 'Nama Jadwal' },
  {
    key: 'schedule_type',
    header: 'Tipe',
    render: (r) => <Badge variant="outline">{r.schedule_type}</Badge>,
  },
  {
    key: 'weekly_target_minutes',
    header: 'Target Mingguan',
    render: (r) => (r.weekly_target_minutes != null ? `${r.weekly_target_minutes} mnt` : '—'),
  },
  {
    key: 'daily_standard_minutes',
    header: 'Standar Harian',
    render: (r) => (r.daily_standard_minutes != null ? `${r.daily_standard_minutes} mnt` : '—'),
  },
  {
    key: 'is_active',
    header: 'Aktif',
    render: (r) => (r.is_active ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>),
  },
];

const fields: FieldDef[] = [
  { name: 'code', label: 'Kode', required: true, placeholder: 'HO_STANDARD' },
  { name: 'name', label: 'Nama Jadwal', required: true },
  {
    name: 'schedule_type',
    label: 'Tipe',
    required: true,
    options: [
      { value: 'FIXED', label: 'FIXED (jam tetap)' },
      { value: 'FLEXIBLE', label: 'FLEXIBLE (jam bebas)' },
      { value: 'SHIFT', label: 'SHIFT (bergilir)' },
    ],
  },
  {
    name: 'company_id',
    label: 'Perusahaan',
    required: true,
    select: { entity: 'companies', valueField: 'id', labelField: 'legal_name' },
  },
  { name: 'weekly_target_minutes', label: 'Target Mingguan (mnt)', type: 'number' },
  { name: 'daily_standard_minutes', label: 'Standar Harian (mnt)', type: 'number' },
  { name: 'is_active', label: 'Aktif', type: 'boolean' },
];

export default function WorkSchedulesPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<WorkScheduleRow>
      entity="work-schedules"
      title="Jadwal Kerja"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.work_schedules.write')}
    />
  );
}
