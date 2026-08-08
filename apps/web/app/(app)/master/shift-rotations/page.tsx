'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * M2B — Rotation slots (FR-M2B-002). One row per cycle day: day_index →
 * shift_definition (null = day off). Parent reference is shift_pattern_id.
 */

interface ShiftRotationRow {
  id: string;
  shift_pattern_id: string;
  day_index: number;
  shift_definition_id: string | null;
  is_working_day: boolean;
  shift_definition?: { code: string; name: string } | null;
}

const columns: Column<ShiftRotationRow>[] = [
  {
    key: 'pattern',
    header: 'Pola',
    render: () => '—',
  },
  {
    key: 'day_index',
    header: 'Hari ke-',
    render: (r) => `${r.day_index + 1}`,
  },
  {
    key: 'shift_definition',
    header: 'Shift',
    render: (r) =>
      r.is_working_day ? (
        <Badge variant="outline">{r.shift_definition?.code ?? '—'}</Badge>
      ) : (
        <Badge>Libur</Badge>
      ),
  },
  {
    key: 'is_working_day',
    header: 'Kerja',
    render: (r) =>
      r.is_working_day ? <Badge>Aktif</Badge> : <Badge variant="outline">Libur</Badge>,
  },
];

const fields: FieldDef[] = [
  {
    name: 'shift_pattern_id',
    label: 'Pola Rotasi',
    required: true,
    select: { entity: 'shift-patterns', valueField: 'id', labelField: 'name' },
  },
  { name: 'day_index', label: 'Hari ke- (0-based)', type: 'number' },
  {
    name: 'shift_definition_id',
    label: 'Shift',
    select: { entity: 'shift-definitions', valueField: 'id', labelField: 'name' },
  },
  { name: 'is_working_day', label: 'Hari Kerja', type: 'boolean' },
];

export default function ShiftRotationsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<ShiftRotationRow>
      entity="shift-rotations"
      title="Slot Rotasi Shift"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.shift_rotations.write')}
    />
  );
}
