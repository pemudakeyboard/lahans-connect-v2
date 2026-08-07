/**
 * M1B — Master Data generic CRUD registry.
 *
 * Maps a route entity key to its Prisma delegate + behavior flags. Adding a new
 * master table = one entry here (plus its permission codes in seed). No per-entity
 * controller/service boilerplate — the generic MasterService drives all of them.
 *
 * NOTE: `delegate` is a string key of PrismaService to avoid importing generated
 * types at module boundaries; the runtime lookup is type-safe via the delegate
 * union in prisma.service.
 */
export interface MasterEntityConfig {
  /** Prisma delegate name (model name from schema.prisma). */
  delegate: string;
  /** Fields used for the free-text `search` filter. */
  searchable: string[];
  /** Fields that carry Decimal/JSON and must be kept as-is on create/update. */
  jsonFields?: string[];
  /** Entity is effective-dated (Class A/B). List/reads then REQUIRE asOf. */
  temporal?: boolean;
  /** Label shown in API docs / UI. */
  label: string;
}

/**
 * Master entities exposed via the generic CRUD. Deliberately scoped to the
 * tables M1B owns (organization + core master data). Sensitive/audit tables
 * (users, permissions, audit_logs, payslips, ...) are NOT here.
 */
export const MASTER_REGISTRY: Record<string, MasterEntityConfig> = {
  companies: { delegate: 'companies', searchable: ['code', 'legal_name'], label: 'Perusahaan' },
  branches: { delegate: 'branches', searchable: ['code', 'name'], label: 'Cabang' },
  divisions: { delegate: 'divisions', searchable: ['code', 'name'], label: 'Divisi' },
  departments: { delegate: 'departments', searchable: ['code', 'name'], label: 'Departemen' },
  'job-grades': { delegate: 'job_grades', searchable: ['code', 'name'], label: 'Jenjang Jabatan' },
  'job-positions': { delegate: 'job_positions', searchable: ['code', 'name'], label: 'Jabatan' },
  employees: {
    delegate: 'employees',
    searchable: ['nik', 'full_name', 'email'],
    label: 'Karyawan',
  },
  'reference-data': { delegate: 'reference_data', searchable: ['category', 'code', 'label'], label: 'Data Referensi' },
  'leave-types': { delegate: 'leave_types', searchable: ['code', 'name'], label: 'Jenis Cuti' },
  holidays: { delegate: 'holidays', searchable: ['name'], label: 'Hari Libur' },
  'work-schedules': { delegate: 'work_schedules', searchable: ['name'], label: 'Jadwal Kerja' },
  'payroll-components': { delegate: 'payroll_components', searchable: ['code', 'name'], label: 'Komponen Gaji' },
  'bpjs-profiles': { delegate: 'bpjs_rate_profiles', searchable: ['code', 'name'], label: 'Profil BPJS' },
  'tax-ter-categories': { delegate: 'tax_ter_categories', searchable: ['code', 'name'], label: 'Kategori TER' },
  'loan-types': { delegate: 'loan_types', searchable: ['code', 'name'], label: 'Jenis Pinjaman' },
  'report-definitions': { delegate: 'report_definitions', searchable: ['report_code', 'name'], label: 'Definisi Laporan' },
  'upload-policies': { delegate: 'upload_policies', searchable: ['entity_name', 'field_name'], label: 'Kebijakan Upload' },
};

/** Route key -> permission resource prefix (used to build `master.<entity>.read`). */
export function permissionResource(entity: string): string {
  // 'job-grades' -> 'job_grades'
  return entity.replaceAll('-', '_');
}