'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { useAuth } from '@/lib/auth-context';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  company_id?: string | null;
  geofence_radius_m?: number | null;
}

const columns: Column<BranchRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'name', header: 'Nama Cabang' },
  { key: 'geofence_radius_m', header: 'Radius Geolokasi (m)' },
];

const fields: FieldDef[] = [
  { name: 'code', label: 'Kode', required: true, placeholder: 'PBR' },
  { name: 'name', label: 'Nama Cabang', required: true },
  { name: 'company_id', label: 'Company ID' },
  { name: 'geofence_radius_m', label: 'Radius Geolokasi (m)', type: 'number' },
];

export default function BranchesPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<BranchRow>
      entity="branches"
      title="Cabang"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.branches.write')}
    />
  );
}
