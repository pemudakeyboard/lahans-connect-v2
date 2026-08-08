'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * Admin-config penugasan jadwal (user directive: jadwal kerja tidak hardcoded).
 * Binds a work_schedule to a scope (EMPLOYEE/POSITION/GRADE/BRANCH/COMPANY) with
 * a priority + effective window; the attendance runtime resolves the highest-
 * priority active assignment per employee.
 */

const SCOPE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Karyawan',
  POSITION: 'Jabatan',
  GRADE: 'Golongan',
  BRANCH: 'Cabang',
  COMPANY: 'Perusahaan',
};

interface ScheduleAssignmentRow {
  id: string;
  work_schedule_id: string;
  scope_type: string;
  scope_ref_id: string;
  priority: number;
  effective_from: string;
  effective_to?: string | null;
  work_schedule?: { name?: string } | null;
}

const columns: Column<ScheduleAssignmentRow>[] = [
  {
    key: 'work_schedule',
    header: 'Jadwal',
    render: (r) => r.work_schedule?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'scope_type',
    header: 'Cakupan',
    render: (r) => <Badge variant="outline">{SCOPE_LABEL[r.scope_type] ?? r.scope_type}</Badge>,
  },
  { key: 'scope_ref_id', header: 'ID Referensi', className: 'font-mono text-xs' },
  { key: 'priority', header: 'Prioritas' },
  {
    key: 'effective_from',
    header: 'Berlaku Dari',
    render: (r) => r.effective_from.slice(0, 10),
  },
  {
    key: 'effective_to',
    header: 'Hingga',
    render: (r) => (r.effective_to ? r.effective_to.slice(0, 10) : <Badge>Aktif</Badge>),
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
    name: 'scope_type',
    label: 'Cakupan',
    required: true,
    options: [
      { value: 'EMPLOYEE', label: 'Karyawan' },
      { value: 'POSITION', label: 'Jabatan' },
      { value: 'GRADE', label: 'Golongan' },
      { value: 'BRANCH', label: 'Cabang' },
      { value: 'COMPANY', label: 'Perusahaan' },
    ],
  },
  { name: 'scope_ref_id', label: 'ID Referensi (UUID)', required: true },
  { name: 'priority', label: 'Prioritas (1=tertinggi)', type: 'number', required: true },
  { name: 'effective_from', label: 'Berlaku Dari', type: 'date', required: true },
  { name: 'effective_to', label: 'Berlaku Hingga (kosongkan = selamanya)', type: 'date' },
];

export default function ScheduleAssignmentsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<ScheduleAssignmentRow>
      entity="schedule-assignments"
      title="Penugasan Jadwal"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.schedule_assignments.write')}
    />
  );
}
