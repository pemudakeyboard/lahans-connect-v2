'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * M2B — Shift definitions (FR-M2B-002). The concrete shift windows admins
 * configure per company: NORMAL/PAGI/SIANG/MALAM + any future shift. The SOP
 * hours are only seed defaults — editing here never touches code.
 */

interface ShiftDefinitionRow {
  id: string;
  code: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  late_tolerance_minutes: number;
  crosses_midnight: boolean;
  cover_end_date: boolean;
  is_active: boolean;
}

const columns: Column<ShiftDefinitionRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'name', header: 'Nama' },
  {
    key: 'start_time',
    header: 'Mulai',
    render: (r) => r.start_time ?? '—',
  },
  {
    key: 'end_time',
    header: 'Selesai',
    render: (r) => r.end_time ?? '—',
  },
  {
    key: 'break_minutes',
    header: 'Istirahat',
    render: (r) => (r.break_minutes > 0 ? `${r.break_minutes} mnt` : '—'),
  },
  {
    key: 'crosses_midnight',
    header: 'Lintas Malam',
    render: (r) => (r.crosses_midnight ? <Badge variant="destructive">Ya</Badge> : '—'),
  },
  {
    key: 'is_active',
    header: 'Aktif',
    render: (r) => (r.is_active ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>),
  },
];

const fields: FieldDef[] = [
  {
    name: 'company_id',
    label: 'Perusahaan',
    required: true,
    select: { entity: 'companies', valueField: 'id', labelField: 'legal_name' },
  },
  { name: 'code', label: 'Kode', required: true, placeholder: 'PAGI' },
  { name: 'name', label: 'Nama', required: true, placeholder: 'Shift Pagi' },
  { name: 'start_time', label: 'Mulai (HH:MM)', type: 'text', placeholder: '06:00' },
  { name: 'end_time', label: 'Selesai (HH:MM)', type: 'text', placeholder: '14:00' },
  { name: 'break_minutes', label: 'Istirahat (mnt)', type: 'number' },
  { name: 'late_tolerance_minutes', label: 'Toleransi Telat (mnt)', type: 'number' },
  { name: 'crosses_midnight', label: 'Lintas Malam', type: 'boolean' },
  { name: 'cover_end_date', label: 'Selesai di Hari Berikutnya', type: 'boolean' },
  { name: 'is_active', label: 'Aktif', type: 'boolean' },
];

export default function ShiftDefinitionsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<ShiftDefinitionRow>
      entity="shift-definitions"
      title="Shift (Konfigurasi)"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.shift_definitions.write')}
    />
  );
}
