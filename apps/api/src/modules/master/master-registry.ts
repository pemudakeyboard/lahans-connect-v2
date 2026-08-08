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
  /**
   * Relations to include on list reads so the UI can show the referenced
   * entity's name (e.g. employees → branch.name). Mirrors Prisma `include`.
   * Values may carry Prisma include options (where/orderBy/take) beyond a bare
   * `select` (e.g. an employee's current contract assignment).
   */
  include?: Record<string, object>;
  /**
   * Fields the list query may filter on via exact-match query params
   * (e.g. employees → `?branch_id=…&employment_status=…`). Only declared
   * fields are honored — anything else is ignored.
   */
  filterable?: string[];
  /** Entity has an `is_active` soft-delete column; list excludes inactive rows. */
  isActive?: boolean;
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
  companies: {
    delegate: 'companies',
    searchable: ['code', 'legal_name'],
    label: 'Perusahaan',
    isActive: true,
  },
  branches: {
    delegate: 'branches',
    searchable: ['code', 'name'],
    label: 'Cabang',
    isActive: true,
  },
  divisions: {
    delegate: 'divisions',
    searchable: ['code', 'name'],
    label: 'Divisi',
    isActive: true,
  },
  departments: {
    delegate: 'departments',
    searchable: ['code', 'name'],
    label: 'Departemen',
    isActive: true,
  },
  'job-grades': {
    delegate: 'job_grades',
    searchable: ['code', 'name'],
    label: 'Jenjang Jabatan',
    isActive: true,
  },
  'job-positions': {
    delegate: 'job_positions',
    searchable: ['code', 'name'],
    label: 'Jabatan',
    isActive: true,
  },
  employees: {
    delegate: 'employees',
    searchable: ['nik', 'full_name', 'email'],
    label: 'Karyawan',
    isActive: true,
    filterable: ['branch_id', 'employment_status'],
    include: {
      branch: { select: { name: true } },
      job_position: { select: { name: true } },
      job_grade: { select: { name: true } },
      // Current contract assignment (Class B, effective-dated) for the list's
      // kontrak columns. Takes the is_primary assignment still effective today.
      assignments: {
        where: { is_primary: true, contract_type: { not: null } },
        orderBy: { effective_from: 'desc' },
        take: 1,
        select: {
          id: true,
          contract_type: true,
          contract_start: true,
          contract_end: true,
        },
      },
    },
  },
  /**
   * Contract assignment (Class B, effective-dated) — the employee's current
   * contract_type/start/end live here, not on `employees`. Written by the
   * employee detail page's Pekerjaan tab. Not temporal here on purpose: the
   * generic CRUD keeps it simple, satisfies reads via the employees include.
   */
  'employee-assignments': {
    delegate: 'employee_assignments',
    searchable: ['employee_id'],
    label: 'Penugasan Karyawan',
  },
  'reference-data': {
    delegate: 'reference_data',
    searchable: ['category', 'code', 'label'],
    label: 'Data Referensi',
    isActive: true,
    filterable: ['category'],
  },
  'leave-types': {
    delegate: 'leave_types',
    searchable: ['code', 'name'],
    label: 'Jenis Cuti',
    isActive: true,
  },
  holidays: {
    delegate: 'holidays',
    searchable: ['name'],
    label: 'Hari Libur',
    isActive: true,
  },
  'work-schedules': {
    delegate: 'work_schedules',
    searchable: ['name'],
    label: 'Jadwal Kerja',
    isActive: true,
  },
  /**
   * Per-day schedule definition (Mon–Sun). Admin-configurable so future
   * branches/manufacturing units can be configured without code changes (user
   * directive: jadwal kerja tidak hardcoded). Parent reference is a FK dropdown
   * (`work_schedule_id`), `day_of_week` 0=Sun..6=Sat.
   */
  'work-schedule-days': {
    delegate: 'work_schedule_days',
    searchable: ['work_schedule_id'],
    label: 'Hari Kerja',
    include: { work_schedule: { select: { name: true } } },
  },
  /**
   * Who gets which schedule (employee/position/grade/branch/company) and when.
   * Admin-configurable assignment so admins bind schedules per unit without code.
   */
  'schedule-assignments': {
    delegate: 'schedule_assignments',
    searchable: ['scope_type', 'scope_ref_id'],
    label: 'Penugasan Jadwal',
    include: { work_schedule: { select: { name: true } } },
  },
  /**
   * M2B — shift definitions (FR-M2B-002). The concrete shift windows admins
   * configure per company: NORMAL/PAGI/SIANG/MALAM + any future shift. Parent
   * reference is `company_id` (each company/unit edits its own shifts).
   */
  'shift-definitions': {
    delegate: 'shift_definitions',
    searchable: ['code', 'name'],
    label: 'Shift',
    isActive: true,
  },
  /**
   * M2B — rotation patterns (FR-M2B-002). A SHIFT work_schedule points here;
   * `cycle_length` bounds the day_indexes of its slots.
   */
  'shift-patterns': {
    delegate: 'shift_patterns',
    searchable: ['code', 'name'],
    label: 'Pola Rotasi Shift',
    isActive: true,
  },
  /**
   * M2B — rotation slots (FR-M2B-002). One row per cycle day: day_index →
   * shift_definition (null = day off). Parent reference is `shift_pattern_id`.
   */
  'shift-rotations': {
    delegate: 'shift_rotations',
    searchable: ['shift_pattern_id', 'day_index'],
    label: 'Slot Rotasi Shift',
    include: { shift_definition: { select: { code: true, name: true } } },
  },
  'payroll-components': {
    delegate: 'payroll_components',
    searchable: ['code', 'name'],
    label: 'Komponen Gaji',
    isActive: true,
  },
  'bpjs-profiles': {
    delegate: 'bpjs_rate_profiles',
    searchable: ['code', 'name'],
    label: 'Profil BPJS',
    isActive: true,
  },
  'tax-ter-categories': {
    delegate: 'tax_ter_categories',
    searchable: ['code', 'name'],
    label: 'Kategori TER',
  },
  'loan-types': {
    delegate: 'loan_types',
    searchable: ['code', 'name'],
    label: 'Jenis Pinjaman',
    isActive: true,
  },
  // Class A financial rate tables — effective-dated, reads REQUIRE asOf (BRD 4.5.1).
  'overtime-rate-rules': {
    delegate: 'overtime_rate_rules',
    searchable: ['day_type'],
    temporal: true,
    label: 'Aturan Tarif Lembur',
  },
  'perdiem-rates': {
    delegate: 'perdiem_rates',
    searchable: ['city_tier'],
    temporal: true,
    label: 'Tarif Perdiem',
  },
  'attendance-allowance-rules': {
    delegate: 'attendance_allowance_rules',
    searchable: ['rule_set_code'],
    temporal: true,
    label: 'Aturan Tunjangan Kehadiran',
  },
  'bpjs-rates': {
    delegate: 'bpjs_rates',
    searchable: ['contribution_code'],
    temporal: true,
    label: 'Tarif BPJS',
  },
  'report-definitions': {
    delegate: 'report_definitions',
    searchable: ['report_code', 'name'],
    label: 'Definisi Laporan',
    isActive: true,
  },
  'upload-policies': {
    delegate: 'upload_policies',
    searchable: ['entity_name', 'field_name'],
    label: 'Kebijakan Upload',
    isActive: true,
  },
};

/** Route key -> permission resource prefix (used to build `master.<entity>.read`). */
export function permissionResource(entity: string): string {
  // 'job-grades' -> 'job_grades'
  return entity.replaceAll('-', '_');
}
