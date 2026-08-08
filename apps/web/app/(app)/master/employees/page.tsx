'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

interface EmployeeRow {
  id: string;
  nik: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  religion?: string | null;
  employment_status?: string | null;
  join_date?: string | null;
  branch_id?: string | null;
  branch?: { name?: string | null } | null;
  job_position_id?: string | null;
  job_position?: { name?: string | null } | null;
  job_grade_id?: string | null;
  job_grade?: { name?: string | null } | null;
}

const columns: Column<EmployeeRow>[] = [
  { key: 'nik', header: 'NIK', className: 'font-mono text-xs' },
  { key: 'full_name', header: 'Nama' },
  {
    key: 'branch',
    header: 'Area Kerja',
    render: (r) => r.branch?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'job_position',
    header: 'Jabatan',
    render: (r) => r.job_position?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'job_grade',
    header: 'Golongan',
    render: (r) => r.job_grade?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'employment_status',
    header: 'Status',
    render: (r) =>
      r.employment_status ? (
        <Badge variant="outline">{r.employment_status}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  { key: 'join_date', header: 'Mulai Kerja' },
];

const fields: FieldDef[] = [
  { name: 'nik', label: 'NIK', required: true, placeholder: '8 digit' },
  { name: 'full_name', label: 'Nama Lengkap', required: true },
  {
    name: 'gender',
    label: 'Jenis Kelamin',
    options: [
      { value: 'Pria', label: 'Pria' },
      { value: 'Wanita', label: 'Wanita' },
    ],
  },
  {
    name: 'religion',
    label: 'Agama',
    options: [
      { value: 'Islam', label: 'Islam' },
      { value: 'Kristen', label: 'Kristen' },
    ],
  },
  { name: 'birth_date', label: 'Tanggal Lahir', type: 'date' },
  { name: 'birth_place', label: 'Tempat Lahir' },
  { name: 'id_card_no', label: 'No. Identitas (KTP)' },
  { name: 'tax_id', label: 'NPWP' },
  {
    name: 'tax_status_ptkp',
    label: 'Status PTKP',
    options: [
      { value: 'TK/0', label: 'TK/0' },
      { value: 'TK/1', label: 'TK/1' },
      { value: 'K/0', label: 'K/0' },
      { value: 'K/1', label: 'K/1' },
      { value: 'K/2', label: 'K/2' },
      { value: 'K/3', label: 'K/3' },
      { value: 'K/4', label: 'K/4' },
    ],
  },
  {
    name: 'marital_status',
    label: 'Status Pernikahan',
    options: [
      { value: 'Belum Menikah', label: 'Belum Menikah' },
      { value: 'Menikah', label: 'Menikah' },
      { value: 'Janda/duda', label: 'Janda/duda' },
    ],
  },
  { name: 'address', label: 'Alamat' },
  { name: 'phone', label: 'No. HP' },
  { name: 'emergency_contact_name', label: 'Rekan/Keluarga — Nama' },
  { name: 'emergency_contact_phone', label: 'Rekan/Keluarga — No. HP' },
  { name: 'emergency_contact_relation', label: 'Rekan/Keluarga — Hubungan' },
  { name: 'bpjs_tk_number', label: 'No. BPJS Ketenagakerjaan' },
  { name: 'bpjs_kes_number', label: 'No. BPJS Kesehatan' },
  { name: 'bank_name', label: 'Nama Bank' },
  { name: 'bank_account_no', label: 'No. Rekening' },
  { name: 'bank_account_name', label: 'Atas Nama Rekening' },
  { name: 'join_date', label: 'Tanggal Masuk', type: 'date' },
  {
    name: 'employment_status',
    label: 'Status Kepegawaian',
    options: [
      { value: 'AKTIF', label: 'Aktif' },
      { value: 'CUTI', label: 'Cuti' },
      { value: 'RESIGN', label: 'Resign' },
    ],
  },
  {
    name: 'branch_id',
    label: 'Area Kerja',
    select: { entity: 'branches', valueField: 'id', labelField: 'name' },
  },
  {
    name: 'job_position_id',
    label: 'Jabatan',
    select: { entity: 'job-positions', valueField: 'id', labelField: 'name' },
  },
  {
    name: 'job_grade_id',
    label: 'Golongan',
    select: { entity: 'job-grades', valueField: 'id', labelField: 'name' },
  },
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
