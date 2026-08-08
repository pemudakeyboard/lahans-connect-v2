'use client';

import { MasterCrud, type FieldDef } from '@/components/master-crud';
import type { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

/**
 * Admin-config kalender kerja / hari libur (user directive: kalender kerja
 * tidak hardcoded). Admins add national/company holidays per branch region; the
 * attendance derivation marks those dates LIBUR.
 */

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  NATIONAL: 'Libur Nasional',
  JOINT_LEAVE: 'Cuti Bersama',
  COMPANY: 'Libur Perusahaan',
};

interface HolidayRow {
  id: string;
  company_id: string;
  date: string;
  name: string;
  holiday_type: string;
  deducts_annual_leave: boolean;
  region_scope?: string | null;
  is_active: boolean;
}

const columns: Column<HolidayRow>[] = [
  {
    key: 'date',
    header: 'Tanggal',
    render: (r) => r.date.slice(0, 10),
  },
  { key: 'name', header: 'Nama Libur' },
  {
    key: 'holiday_type',
    header: 'Jenis',
    render: (r) => (
      <Badge variant="outline">{HOLIDAY_TYPE_LABEL[r.holiday_type] ?? r.holiday_type}</Badge>
    ),
  },
  {
    key: 'deducts_annual_leave',
    header: 'Kurangi Cuti?',
    render: (r) => (r.deducts_annual_leave ? 'Ya' : 'Tidak'),
  },
  {
    key: 'region_scope',
    header: 'Wilayah',
    render: (r) => r.region_scope ?? 'Nasional',
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
  { name: 'date', label: 'Tanggal', type: 'date', required: true },
  { name: 'name', label: 'Nama Libur', required: true },
  {
    name: 'holiday_type',
    label: 'Jenis',
    required: true,
    options: [
      { value: 'NATIONAL', label: 'Libur Nasional' },
      { value: 'JOINT_LEAVE', label: 'Cuti Bersama' },
      { value: 'COMPANY', label: 'Libur Perusahaan' },
    ],
  },
  { name: 'deducts_annual_leave', label: 'Kurangi Cuti Tahunan', type: 'boolean' },
  { name: 'region_scope', label: 'Wilayah (kosongkan = nasional)' },
  { name: 'is_active', label: 'Aktif', type: 'boolean' },
];

export default function HolidaysPage() {
  const { hasPermission } = useAuth();
  return (
    <MasterCrud<HolidayRow>
      entity="holidays"
      title="Hari Libur / Kalender Kerja"
      columns={columns}
      fields={fields}
      canWrite={hasPermission('master.holidays.write')}
    />
  );
}
