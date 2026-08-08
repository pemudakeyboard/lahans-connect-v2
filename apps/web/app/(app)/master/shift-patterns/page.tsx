'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * M2B — Rotation patterns (FR-M2B-002). A named cycle (e.g. 3-shift × N days)
 * whose ordered slots reference shift definitions. A SHIFT work_schedule points
 * here; per-date resolution = day_index mod cycle_length.
 */

interface ShiftPatternRow {
  id: string;
  code: string;
  name: string;
  cycle_length: number;
  is_active: boolean;
}

const columns: Column<ShiftPatternRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'name', header: 'Nama' },
  {
    key: 'cycle_length',
    header: 'Panjang Siklus',
    render: (r) => `${r.cycle_length} hari`,
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
  { name: 'code', label: 'Kode', required: true, placeholder: 'PABRIK_3X' },
  { name: 'name', label: 'Nama', required: true, placeholder: 'Pola 3 Shift Pabrik' },
  { name: 'cycle_length', label: 'Panjang Siklus (hari)', type: 'number' },
  { name: 'is_active', label: 'Aktif', type: 'boolean' },
];

export default function ShiftPatternsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<ShiftPatternRow>
      entity="shift-patterns"
      title="Pola Rotasi Shift"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.shift_patterns.write')}
    />
  );
}
