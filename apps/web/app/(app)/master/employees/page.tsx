'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

interface EmployeeRow {
  id: string;
  nik: string;
  full_name: string;
  email: string;
  phone?: string | null;
  employment_status?: string | null;
  join_date?: string | null;
}

const columns: Column<EmployeeRow>[] = [
  { key: 'nik', header: 'NIK', className: 'font-mono text-xs' },
  { key: 'full_name', header: 'Nama' },
  { key: 'email', header: 'Email' },
  {
    key: 'employment_status',
    header: 'Status',
    render: (r) =>
      r.employment_status ? <Badge variant="outline">{r.employment_status}</Badge> : <span className="text-muted-foreground">—</span>,
  },
  { key: 'join_date', header: 'Mulai Kerja' },
];

const fields: FieldDef[] = [
  { name: 'nik', label: 'NIK', required: true, placeholder: '8 digit' },
  { name: 'full_name', label: 'Nama Lengkap', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Telepon' },
  { name: 'employment_status', label: 'Status Kepegawaian' },
  { name: 'join_date', label: 'Tanggal Mulai', type: 'date' },
];

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<EmployeeRow>
      entity="employees"
      title="Karyawan"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.employees.write')}
    />
  );
}