'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { useAuth } from '@/lib/auth-context';

interface CompanyRow {
  id: string;
  code: string;
  legal_name: string;
  tax_id?: string | null;
  timezone?: string | null;
}

const columns: Column<CompanyRow>[] = [
  { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
  { key: 'legal_name', header: 'Nama Legal' },
  { key: 'tax_id', header: 'NPWP' },
  { key: 'timezone', header: 'Zona Waktu' },
];

const fields: FieldDef[] = [
  { name: 'code', label: 'Kode', required: true, placeholder: 'LMN' },
  { name: 'legal_name', label: 'Nama Legal', required: true },
  { name: 'tax_id', label: 'NPWP' },
  { name: 'timezone', label: 'Zona Waktu', placeholder: 'Asia/Jakarta' },
];

export default function CompaniesPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<CompanyRow>
      entity="companies"
      title="Perusahaan"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.companies.write')}
    />
  );
}