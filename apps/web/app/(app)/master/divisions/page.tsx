'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { useAuth } from '@/lib/auth-context';

interface DivisionRow {
  id: string;
  code: string;
  name: string;
  company_id?: string | null;
}

const columns: Column<DivisionRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'name', header: 'Nama Divisi' },
];

const fields: FieldDef[] = [
  { name: 'code', label: 'Kode', required: true },
  { name: 'name', label: 'Nama Divisi', required: true },
  { name: 'company_id', label: 'Company ID' },
];

export default function DivisionsPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<DivisionRow>
      entity="divisions"
      title="Divisi"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.divisions.write')}
    />
  );
}
