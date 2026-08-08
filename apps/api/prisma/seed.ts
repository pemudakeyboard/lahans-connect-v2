/**
 * LAHANS CONNECT — idempotent seed (BRD §6.1, §6.4).
 *
 * Everything here is safe to run repeatedly. Upsert-based, no hardcoded UUIDs
 * other than the generated demo user's reference (created once, matched by NIK).
 *
 * ZERO HARDCODE: policy numbers seeded here live in system_parameters and are
 * read at runtime via ParameterService.resolve(key, asOf) — never imported into
 * application code.
 */
import { Prisma, PrismaClient } from '../src/generated/prisma';
import * as argon2 from '@node-rs/argon2';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Constants exposed only to the seed (the seed is the config source of truth).
// ---------------------------------------------------------------------------
const ASOF = new Date('2026-01-01');
const DEMO_ADMIN_NIK = '88000001';

// Permission codes: {module}.{resource}.{action}
const PERMISSIONS = [
  // M0 identity
  'identity.user.read',
  'identity.user.write',
  'identity.group.read',
  'identity.group.write',
  // M8B config
  'config.format.read',
  'config.format.write',
  'config.validation.read',
  'config.validation.write',
  'config.sequence.read',
  'config.sequence.write',
  // M1B master (generic route gate + per-resource)
  'master.read',
  'master.write',
  'master.companies.read',
  'master.companies.write',
  'master.branches.read',
  'master.branches.write',
  'master.divisions.read',
  'master.divisions.write',
  'master.job_grades.read',
  'master.job_grades.write',
  'master.employees.read',
  'master.employees.write',
  'master.reference_data.read',
  'master.reference_data.write',
  // master — schedule/calendar admin config (jadwal kerja & kalender kerja,
  // admin-editable per user directive — not hardcoded)
  'master.work_schedules.read',
  'master.work_schedules.write',
  'master.work_schedule_days.read',
  'master.work_schedule_days.write',
  'master.schedule_assignments.read',
  'master.schedule_assignments.write',
  'master.holidays.read',
  'master.holidays.write',
  // master — M2B shift config (shift definitions / rotation patterns, admin-editable)
  'master.shift_definitions.read',
  'master.shift_definitions.write',
  'master.shift_patterns.read',
  'master.shift_patterns.write',
  'master.shift_rotations.read',
  'master.shift_rotations.write',
  // attendance
  'attendance.log.read',
  'attendance.log.write',
  'attendance.daily.read',
  'attendance.daily.write',
  'attendance.correction.read',
  'attendance.correction.write',
  'attendance.correction.approve',
  // roster (M2B — shift config, calendar, assignment, delegation)
  'roster.calendar.read',
  'roster.shift.read',
  'roster.shift.write',
  'roster.override.read',
  'roster.override.write',
  'roster.assign.write',
  'roster.delegation.read',
  'roster.delegation.write',
  // leave
  'leave.request.read',
  'leave.request.write',
  'leave.request.approve',
  'leave.balance.read',
  'leave.balance.write',
  // overtime
  'overtime.request.read',
  'overtime.request.write',
  'overtime.request.approve',
  // perjalanan dinas
  'perdin.request.read',
  'perdin.request.write',
  'perdin.request.approve',
  'perdin.advance.read',
  'perdin.advance.write',
  'perdin.report.read',
  'perdin.report.write',
  // pinjaman
  'loan.request.read',
  'loan.request.write',
  'loan.request.approve',
  'loan.disburse',
  // SIM financing
  'license.request.read',
  'license.request.write',
  'license.request.approve',
  // M6 payroll (BRD §11.4)
  'payroll.period.read',
  'payroll.period.write',
  'payroll.period.close',
  'payroll.feeder.read',
  'payroll.feeder.export',
  'payroll.feeder.override',
  'payroll.payslip.read_self',
  'payroll.payslip.read_all',
  'payroll.payslip.publish',
];

const REFERENCE_DATA_SEED: { category: string; code: string; label: string; sort_order: number }[] =
  [
    { category: 'EMPLOYMENT_STATUS', code: 'AKTIF', label: 'Aktif', sort_order: 1 },
    { category: 'EMPLOYMENT_STATUS', code: 'CUTI', label: 'Cuti', sort_order: 2 },
    { category: 'EMPLOYMENT_STATUS', code: 'RESIGN', label: 'Resign', sort_order: 3 },
    { category: 'CONTRACT_TYPE', code: 'PERMANENT', label: 'Karyawan Tetap', sort_order: 1 },
    { category: 'CONTRACT_TYPE', code: 'CONTRACT', label: 'Kontrak', sort_order: 2 },
    { category: 'CONTRACT_TYPE', code: 'PROBATION', label: 'Percobaan', sort_order: 3 },
    { category: 'DOCUMENT_TYPE', code: 'KTP', label: 'Kartu Tanda Penduduk', sort_order: 1 },
    { category: 'DOCUMENT_TYPE', code: 'NPWP', label: 'NPWP', sort_order: 2 },
    { category: 'DOCUMENT_TYPE', code: 'KK', label: 'Kartu Keluarga', sort_order: 3 },
    // Source-of-truth employee template (data_pegawai_master.pdf) pick-lists.
    { category: 'GENDER', code: 'Pria', label: 'Pria', sort_order: 1 },
    { category: 'GENDER', code: 'Wanita', label: 'Wanita', sort_order: 2 },
    { category: 'RELIGION', code: 'Islam', label: 'Islam', sort_order: 1 },
    { category: 'RELIGION', code: 'Kristen', label: 'Kristen', sort_order: 2 },
    { category: 'MARITAL_STATUS', code: 'Belum Menikah', label: 'Belum Menikah', sort_order: 1 },
    { category: 'MARITAL_STATUS', code: 'Menikah', label: 'Menikah', sort_order: 2 },
    { category: 'MARITAL_STATUS', code: 'Janda/duda', label: 'Janda/duda', sort_order: 3 },
    // STATUS PTKP (source template: TK/0..TK/1, K/0..K/4)
    { category: 'PTKP_STATUS', code: 'TK/0', label: 'TK/0', sort_order: 1 },
    { category: 'PTKP_STATUS', code: 'TK/1', label: 'TK/1', sort_order: 2 },
    { category: 'PTKP_STATUS', code: 'K/0', label: 'K/0', sort_order: 3 },
    { category: 'PTKP_STATUS', code: 'K/1', label: 'K/1', sort_order: 4 },
    { category: 'PTKP_STATUS', code: 'K/2', label: 'K/2', sort_order: 5 },
    { category: 'PTKP_STATUS', code: 'K/3', label: 'K/3', sort_order: 6 },
    { category: 'PTKP_STATUS', code: 'K/4', label: 'K/4', sort_order: 7 },
    // Pinjaman purpose whitelist (CONTEXT.md) — enforced at submission
    {
      category: 'LOAN_PURPOSE',
      code: 'MARRIED_MEDICAL',
      label: 'Pengobatan (menikah: diri, pasangan, anak kandung ≤3)',
      sort_order: 1,
    },
    {
      category: 'LOAN_PURPOSE',
      code: 'UNMARRIED_MEDICAL',
      label: 'Pengobatan (lajang: diri, orang tua kandung)',
      sort_order: 2,
    },
    {
      category: 'LOAN_PURPOSE',
      code: 'FUNERAL',
      label: 'Duka (pasangan, anak kandung, orang tua kandung)',
      sort_order: 3,
    },
    {
      category: 'LOAN_PURPOSE',
      code: 'OWN_WEDDING',
      label: 'Pernikahan diri sendiri',
      sort_order: 4,
    },
    // S6 — attendance correction reasons (FR-M2-012, PRD 6.4.1 — no frontend arrays)
    {
      category: 'ATTENDANCE_CORRECTION_REASON',
      code: 'LUPA_ABSEN',
      label: 'Lupa absen masuk/pulang',
      sort_order: 1,
    },
    {
      category: 'ATTENDANCE_CORRECTION_REASON',
      code: 'HP_RUSAK',
      label: 'Ganti HP / HP rusak',
      sort_order: 2,
    },
    {
      category: 'ATTENDANCE_CORRECTION_REASON',
      code: 'SINYAL_HILANG',
      label: 'Sinyal/kuota hilang saat absen',
      sort_order: 3,
    },
    {
      category: 'ATTENDANCE_CORRECTION_REASON',
      code: 'BATERAI_HABIS',
      label: 'Baterai HP habis',
      sort_order: 4,
    },
    {
      category: 'ATTENDANCE_CORRECTION_REASON',
      code: 'DINAS_LUAR',
      label: 'Dinas luar / bekerja di luar lokasi',
      sort_order: 5,
    },
  ];

// system_parameters — every policy number the BRD names, effective-dated.
const SYSTEM_PARAMETERS = [
  // Payroll divisors (BRD §5.3.1)
  {
    param_key: 'PAYROLL.ABSENCE_DIVISOR',
    param_value: '173',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'PAYROLL.ABSENCE_MINUTES_DIVISOR',
    param_value: '25',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Payroll cutoff (BRD §11.4 source of truth: 22 → 21 of following month)
  {
    param_key: 'PAYROLL.CUTOFF_START_DAY',
    param_value: '22',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'PAYROLL.CUTOFF_END_DAY',
    param_value: '21',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Leave (BRD §5.3.1)
  { param_key: 'LEAVE.ANNUAL_DAYS', param_value: '12', data_type: 'NUMBER', effective_from: ASOF },
  // CONTEXT.md: Cuti Tahunan earned after 12 continuous months of service.
  {
    param_key: 'LEAVE.FULL_ENTITLEMENT_SERVICE_MONTHS',
    param_value: '12',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Overtime (BRD §5.3.1)
  { param_key: 'OVERTIME.SLA_DAYS', param_value: '2', data_type: 'NUMBER', effective_from: ASOF },
  // Attendance / geofence (BRD §6.4)
  {
    param_key: 'ATTENDANCE.GEOFENCE_RADIUS_M',
    param_value: '150',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Loan (v2 shell, referenced by M8B)
  {
    param_key: 'LOAN.MAX_AMOUNT',
    param_value: '150000',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'LOAN.MAX_TENOR_MONTHS',
    param_value: '12',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Leave max carryover
  {
    param_key: 'LEAVE.MAX_CARRYOVER_DAYS',
    param_value: '7',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Security (BRD 7.4)
  {
    param_key: 'SECURITY.LOCKOUT_MAX_ATTEMPTS',
    param_value: '5',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'SECURITY.LOCKOUT_DURATION_MIN',
    param_value: '15',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Format defaults (M8B)
  {
    param_key: 'FORMAT.DATE',
    param_value: 'DD/MM/YYYY',
    data_type: 'STRING',
    effective_from: ASOF,
  },
  // Perjalanan dinas (ADR-0001: classification threshold, CONTEXT.md)
  {
    param_key: 'TRIP.LONG_DISTANCE_THRESHOLD_KM',
    param_value: '100',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'PERDIN.REPORT_DEADLINE_DAYS',
    param_value: '7',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Leave advance (CONTEXT.md: max 3 working days)
  {
    param_key: 'LEAVE.ADVANCE_MAX_DAYS',
    param_value: '3',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // Pinjaman (CONTEXT.md: min 2 years continuous tenure)
  {
    param_key: 'PINJAMAN.MIN_SERVICE_MONTHS',
    param_value: '24',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  // SIM financing (CONTEXT.md: Driver, min 1 year, 50:50 split)
  {
    param_key: 'SIM.MIN_SERVICE_MONTHS',
    param_value: '12',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
  {
    param_key: 'SIM.SHARE_PERCENT',
    param_value: '50',
    data_type: 'NUMBER',
    effective_from: ASOF,
  },
];

const FORMAT_SETTINGS = [
  {
    format_key: 'date.display',
    format_value: 'DD/MM/YYYY',
    data_type: 'STRING',
    applies_to: 'BOTH',
  },
  {
    format_key: 'date.display_separated',
    format_value: 'DD MM YYYY',
    data_type: 'STRING',
    applies_to: 'EXPORT',
  },
  { format_key: 'currency.symbol', format_value: 'Rp', data_type: 'STRING', applies_to: 'BOTH' },
  {
    format_key: 'currency.decimal_separator',
    format_value: ',',
    data_type: 'STRING',
    applies_to: 'BOTH',
  },
  {
    format_key: 'number.thousand_separator',
    format_value: '.',
    data_type: 'STRING',
    applies_to: 'BOTH',
  },
];

const NUMBER_SEQUENCES = [
  {
    sequence_code: 'EMPLOYEE_NIK',
    pattern: 'EMP-{YYYY}-{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_LEAVE',
    pattern: 'C/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_IZIN',
    pattern: 'I/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_OVERTIME',
    pattern: 'L/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_PERDIN',
    pattern: 'PD/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_ADVANCE',
    pattern: 'UM/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_LOAN',
    pattern: 'PJ/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  {
    sequence_code: 'DOC_SIM',
    pattern: 'SIM/{YYYY}/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
];

const VALIDATION_RULES = [
  {
    entity_name: 'employees',
    field_name: 'nik',
    rule_type: 'REGEX',
    rule_config: { pattern: '^\\d{8}$' },
    severity: 'ERROR',
    error_message: 'NIK wajib 8 digit angka.',
    applies_on: 'ALL',
  },
  {
    entity_name: 'users',
    field_name: 'email',
    rule_type: 'REGEX',
    rule_config: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    severity: 'ERROR',
    error_message: 'Format email tidak valid.',
    applies_on: 'ALL',
  },
];

async function main() {
  console.log('🌱 LAHANS Connect seed dimulai...');

  // ---------- Permissions ----------
  const permissionIds = new Map<string, string>();
  for (const code of PERMISSIONS) {
    // Registry format is {modul}.{resource}.{action}; two-segment codes like
    // `master.read` are generic CI-gate permissions where the action lives in
    // the second segment (module-level gate, not per-entity).
    const parts = code.split('.');
    const [mod, res] = parts;
    const act = parts.length === 3 ? parts[2] : res;
    const p = await prisma.permissions.upsert({
      where: { code },
      create: { code, module: mod, resource: res, action: act },
      update: {},
    });
    permissionIds.set(code, p.id);
  }
  console.log(`✔ ${PERMISSIONS.length} permissions`);

  // ---------- Groups ----------
  const groups = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', is_system: true, requires_2fa: true },
    { code: 'HCGA_MANAGER', name: 'HC & GA Manager', requires_2fa: true },
    { code: 'COMBEN', name: 'Compensation & Benefits', requires_2fa: true },
    { code: 'FINANCE', name: 'Finance', requires_2fa: true },
    { code: 'EMPLOYEE', name: 'Karyawan', requires_2fa: false },
  ];
  const groupIds = new Map<string, string>();
  for (const g of groups) {
    const row = await prisma.user_groups.upsert({
      where: { code: g.code },
      create: g,
      update: g,
    });
    groupIds.set(g.code, row.id);
  }
  console.log(`✔ ${groups.length} grup`);

  // ---------- Group permissions (SUPER_ADMIN gets everything; others get shells) ----------
  for (const [code, id] of permissionIds) {
    await prisma.group_permissions.upsert({
      where: {
        group_id_permission_id: { group_id: groupIds.get('SUPER_ADMIN')!, permission_id: id },
      },
      create: { group_id: groupIds.get('SUPER_ADMIN')!, permission_id: id, data_scope: 'ALL' },
      update: {},
    });
  }
  // HCGA_MANAGER: identity + master + config
  for (const code of PERMISSIONS.filter(
    (c) => c.startsWith('identity.') || c.startsWith('master.') || c.startsWith('config.'),
  )) {
    await prisma.group_permissions.upsert({
      where: {
        group_id_permission_id: {
          group_id: groupIds.get('HCGA_MANAGER')!,
          permission_id: permissionIds.get(code)!,
        },
      },
      create: {
        group_id: groupIds.get('HCGA_MANAGER')!,
        permission_id: permissionIds.get(code)!,
        data_scope: 'DIVISION',
      },
      update: {},
    });
  }

  // ---------- Reference data ----------
  for (const ref of REFERENCE_DATA_SEED) {
    await prisma.reference_data.upsert({
      where: { category_code: { category: ref.category, code: ref.code } },
      create: ref,
      update: ref,
    });
  }
  console.log(`✔ ${REFERENCE_DATA_SEED.length} reference data`);

  // ---------- Master data: company, branches, divisions, job grades ----------
  const company = await prisma.companies.upsert({
    where: { code: 'LMN' },
    create: {
      code: 'LMN',
      legal_name: 'PT Lahan Mekar Niaga',
      tax_id: '00.000.000.0-000.000',
      timezone: 'Asia/Jakarta',
    },
    update: {},
  });
  const branch = await prisma.branches.upsert({
    where: { code: 'PBR' },
    create: {
      company_id: company.id,
      code: 'PBR',
      name: 'Pabrik Rancaekek',
      geofence_radius_m: 150,
    },
    update: {},
  });
  const division = await prisma.divisions.upsert({
    where: { code: 'HCGA' },
    create: { company_id: company.id, code: 'HCGA', name: 'Human Capital & General Affairs' },
    update: {},
  });
  const department = await prisma.departments.upsert({
    where: { code: 'HCGA-PAYROLL' },
    create: { division_id: division.id, code: 'HCGA-PAYROLL', name: 'Payroll' },
    update: {},
  });
  const gradeStaff = await prisma.job_grades.upsert({
    where: { code: 'STAFF' },
    create: { code: 'STAFF', name: 'Staff', level_order: 2, is_staff: true },
    update: {},
  });
  const gradeManager = await prisma.job_grades.upsert({
    where: { code: 'MANAGER' },
    create: { code: 'MANAGER', name: 'Manager', level_order: 4, is_staff: false },
    update: {},
  });
  const position = await prisma.job_positions.upsert({
    where: { code: 'HCGA-MGR' },
    create: {
      department_id: department.id,
      job_grade_id: gradeManager.id,
      code: 'HCGA-MGR',
      name: 'HC & GA Manager',
    },
    update: {},
  });

  // ---------- M6 org: SALES vs PABRIK (data-scope axis) ----------
  // Decision 1: the sales-non-staff vs operator feeder split is materialized as
  // two divisions. A Comben user bound to DIVISION SALES processes only the
  // non-staff sales employees; the PABRIK-bound user only the operators.
  const nonStaffGrade = await prisma.job_grades.upsert({
    where: { code: 'NON_STAFF' },
    create: { code: 'NON_STAFF', name: 'Non-Staff', level_order: 1, is_staff: false },
    update: {},
  });
  const divisionSales = await prisma.divisions.upsert({
    where: { code: 'SALES' },
    create: { company_id: company.id, code: 'SALES', name: 'Sales & Distribusi' },
    update: {},
  });
  const divisionPabrik = await prisma.divisions.upsert({
    where: { code: 'PABRIK' },
    create: { company_id: company.id, code: 'PABRIK', name: 'Pabrik / Manufaktur' },
    update: {},
  });
  const deptSales = await prisma.departments.upsert({
    where: { code: 'SALES-DIST' },
    create: { division_id: divisionSales.id, code: 'SALES-DIST', name: 'Sales Distribution' },
    update: {},
  });
  const deptPabrik = await prisma.departments.upsert({
    where: { code: 'PABRIK-PROD' },
    create: { division_id: divisionPabrik.id, code: 'PABRIK-PROD', name: 'Produksi' },
    update: {},
  });
  // Positions carry the feeder ladder key (schema: job_positions.attendance_rule_set).
  const positions = [
    { code: 'SALESMAN', name: 'Salesman', ruleSet: 'NON_STAFF_DEFAULT', dept: deptSales },
    { code: 'DRIVER', name: 'Driver', ruleSet: 'NON_STAFF_DEFAULT', dept: deptSales },
    { code: 'SPG', name: 'Sales Promotion Girl', ruleSet: 'NON_STAFF_DEFAULT', dept: deptSales },
    {
      code: 'OPERATOR-TINTIN',
      name: 'Operator Tintin',
      ruleSet: 'OPERATOR_TINTIN',
      dept: deptPabrik,
    },
  ];
  const positionIdByCode = new Map<string, string>();
  for (const p of positions) {
    const row = await prisma.job_positions.upsert({
      where: { code: p.code },
      create: {
        department_id: p.dept.id,
        job_grade_id: nonStaffGrade.id,
        code: p.code,
        name: p.name,
        attendance_rule_set: p.ruleSet,
      },
      update: { attendance_rule_set: p.ruleSet, job_grade_id: nonStaffGrade.id },
    });
    positionIdByCode.set(p.code, row.id);
  }
  // Branch fixtures from the source-of-truth employee master (PDF locations).
  const branchSeeds = [
    { code: 'WNG', name: 'PT LMN - Wangon' },
    { code: 'PBG', name: 'PT LMN - Probolinggo' },
    { code: 'PWR', name: 'PT LMN - Purwakarta' },
    { code: 'BYW', name: 'PT LMN - Banyuwangi' },
    { code: 'GRT', name: 'PT LMN - Garut' },
  ];
  const branchIdByCode = new Map<string, string>();
  for (const b of branchSeeds) {
    const row = await prisma.branches.upsert({
      where: { code: b.code },
      create: { company_id: company.id, code: b.code, name: b.name, geofence_radius_m: 150 },
      update: {},
    });
    branchIdByCode.set(b.code, row.id);
  }
  console.log('✔ master data org (+ M6 SALES/PABRIK scope axis)');

  // ---------- Approval workflows (per document type — never one normalized chain) ----------
  // CONTEXT.md "Approval Chains": each document has its own chain.
  const workflows = [
    {
      code: 'CUTI',
      module_code: 'LEAVE',
      name: 'Cuti — Atasan Langsung → Division Head',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        { step_order: 2, approver_type: 'DIVISION_HEAD', sla_working_days: 2 },
      ],
    },
    {
      code: 'IZIN',
      module_code: 'LEAVE',
      name: 'Izin — Atasan Langsung → Dept. Comben',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        {
          step_order: 2,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
      ],
    },
    {
      code: 'OVERTIME',
      module_code: 'OVERTIME',
      name: 'Lembur — Atasan Langsung → Division Head',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        { step_order: 2, approver_type: 'DIVISION_HEAD', sla_working_days: 2 },
      ],
    },
    {
      code: 'PERDIN',
      module_code: 'PERDIN',
      name: 'Perdin — Atasan Langsung → Comben → Finance',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        {
          step_order: 2,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
        {
          step_order: 3,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'FINANCE',
          sla_working_days: 2,
        },
      ],
    },
    {
      code: 'PINJAMAN',
      module_code: 'LOAN',
      name: 'Pinjaman — Atasan → Div Head → HCGA/Comben → FAT',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        { step_order: 2, approver_type: 'DIVISION_HEAD', sla_working_days: 2 },
        {
          step_order: 3,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
        {
          step_order: 4,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'FINANCE',
          sla_working_days: 2,
        },
      ],
    },
    {
      code: 'SIM',
      module_code: 'LICENSE',
      name: 'SIM — Atasan Langsung → Comben',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        {
          step_order: 2,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
      ],
    },
    {
      code: 'SWAP',
      module_code: 'ATTENDANCE',
      name: 'Ganti hari — Atasan Langsung → Comben',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        {
          step_order: 2,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
      ],
    },
    {
      code: 'ATTENDANCE_CORRECTION',
      module_code: 'ATTENDANCE',
      name: 'Koreksi absensi — Atasan Langsung → Comben',
      steps: [
        { step_order: 1, approver_type: 'DIRECT_SUPERVISOR', sla_working_days: 2 },
        {
          step_order: 2,
          approver_type: 'SPECIFIC_GROUP',
          approver_ref: 'COMBEN',
          sla_working_days: 2,
        },
      ],
    },
  ];
  const workflowIds = new Map<string, string>();
  for (const wf of workflows) {
    const row = await prisma.approval_workflows.upsert({
      where: { code: wf.code },
      create: { code: wf.code, module_code: wf.module_code, name: wf.name },
      update: { name: wf.name, module_code: wf.module_code },
    });
    workflowIds.set(wf.code, row.id);
    for (const step of wf.steps) {
      await prisma.approval_workflow_steps.upsert({
        where: { workflow_id_step_order: { workflow_id: row.id, step_order: step.step_order } },
        create: { workflow_id: row.id, ...step },
        update: {
          approver_type: step.approver_type,
          approver_ref: step.approver_ref ?? null,
          sla_working_days: step.sla_working_days,
        },
      });
    }
  }
  console.log(`✔ ${workflows.length} approval workflows`);

  // ---------- Leave types (CONTEXT.md: Cuti Tahunan / Cuti Advance / Cuti Khusus / Izin / Sakit) ----------
  await prisma.leave_types.upsert({
    where: { code: 'CUTI_TAHUNAN' },
    create: {
      code: 'CUTI_TAHUNAN',
      name: 'Cuti Tahunan',
      deduct_quota: true,
      deduct_salary: false,
      max_days_per_request: 12,
      min_notice_days: 7, // BR-C07: notice period cuti tahunan = 7 hari kerja
      allow_backdate: false,
      allow_half_day: true,
      workflow_code: 'CUTI',
      affects_attendance_allowance: true,
      affects_meal_transport_allowance: true,
    },
    update: {
      deduct_quota: true,
      deduct_salary: false,
      min_notice_days: 7,
      workflow_code: 'CUTI',
    },
  });
  await prisma.leave_types.upsert({
    where: { code: 'CUTI_ADVANCE' },
    create: {
      code: 'CUTI_ADVANCE',
      name: 'Cuti di Muka',
      deduct_quota: true, // drawn down from future entitlement
      deduct_salary: false,
      max_days_per_request: 3,
      allow_backdate: false,
      allow_half_day: false,
      workflow_code: 'CUTI',
      affects_attendance_allowance: true,
      affects_meal_transport_allowance: true,
    },
    update: { deduct_quota: true, deduct_salary: false, workflow_code: 'CUTI' },
  });
  await prisma.leave_types.upsert({
    where: { code: 'CUTI_KHUSUS' },
    create: {
      code: 'CUTI_KHUSUS',
      name: 'Cuti Khusus',
      deduct_quota: false,
      deduct_salary: false, // does not reduce gaji pokok (CONTEXT.md)
      allow_backdate: true,
      allow_half_day: false,
      workflow_code: 'CUTI',
      affects_attendance_allowance: true,
      affects_meal_transport_allowance: true,
    },
    update: { deduct_quota: false, deduct_salary: false, workflow_code: 'CUTI' },
  });
  await prisma.leave_types.upsert({
    where: { code: 'IZIN' },
    create: {
      code: 'IZIN',
      name: 'Izin',
      deduct_quota: false,
      deduct_salary: true, // only Izin/Alpha deduct gaji pokok (CONTEXT.md)
      min_notice_days: 1, // BR-C08: notice period izin = H-1
      allow_backdate: true,
      allow_half_day: true,
      workflow_code: 'IZIN',
      affects_attendance_allowance: true,
      affects_meal_transport_allowance: true,
    },
    update: { deduct_quota: false, deduct_salary: true, min_notice_days: 1, workflow_code: 'IZIN' },
  });
  await prisma.leave_types.upsert({
    where: { code: 'SAKIT' },
    create: {
      code: 'SAKIT',
      name: 'Sakit',
      deduct_quota: false,
      deduct_salary: false, // Sakit does not reduce gaji pokok (CONTEXT.md)
      requires_attachment: true,
      allow_backdate: true,
      allow_half_day: false,
      workflow_code: 'IZIN',
      affects_attendance_allowance: true,
      affects_meal_transport_allowance: true,
    },
    update: { deduct_quota: false, deduct_salary: false, workflow_code: 'IZIN' },
  });
  console.log('✔ 5 leave types');

  // ---------- Overtime rate rules (Class A) — CONTEXT.md: ×2 holiday is Non-Staff only ----------
  // Grade-scoped: Non-Staff ×2 on holidays, Staff/SPV/Manager ×1.
  // (`nonStaffGrade` is declared in the M6 org block above.)
  const supervisorGrade = await prisma.job_grades.upsert({
    where: { code: 'SUPERVISOR' },
    create: { code: 'SUPERVISOR', name: 'Supervisor', level_order: 3, is_staff: true },
    update: {},
  });
  const gradeRateRules = [
    // Non-Staff: ordinary day ×1 via PAYROLL.OVERTIME_DIVISOR, holiday ×2
    {
      job_grade_id: nonStaffGrade.id,
      day_type: 'WEEKDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: nonStaffGrade.id,
      day_type: 'WEEKEND',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: nonStaffGrade.id,
      day_type: 'NATIONAL_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 2,
    },
    {
      job_grade_id: nonStaffGrade.id,
      day_type: 'JOINT_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 2,
    },
    // Staff/SPV/Manager: ×1 on all day types
    {
      job_grade_id: gradeStaff.id,
      day_type: 'WEEKDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: gradeStaff.id,
      day_type: 'WEEKEND',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: gradeStaff.id,
      day_type: 'NATIONAL_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: gradeStaff.id,
      day_type: 'JOINT_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: supervisorGrade.id,
      day_type: 'WEEKDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: supervisorGrade.id,
      day_type: 'WEEKEND',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: supervisorGrade.id,
      day_type: 'NATIONAL_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    {
      job_grade_id: supervisorGrade.id,
      day_type: 'JOINT_HOLIDAY',
      calc_method: 'HOURLY_DIVISOR',
      multiplier: 1,
    },
    { job_grade_id: gradeManager.id, day_type: 'WEEKDAY', calc_method: 'NONE' },
    { job_grade_id: gradeManager.id, day_type: 'WEEKEND', calc_method: 'NONE' },
    { job_grade_id: gradeManager.id, day_type: 'NATIONAL_HOLIDAY', calc_method: 'NONE' },
    { job_grade_id: gradeManager.id, day_type: 'JOINT_HOLIDAY', calc_method: 'NONE' },
  ];
  for (const r of gradeRateRules) {
    const existing = await prisma.overtime_rate_rules.findFirst({
      where: { job_grade_id: r.job_grade_id, day_type: r.day_type, effective_from: ASOF },
    });
    const data = { ...r, effective_from: ASOF, effective_to: null };
    if (existing) {
      await prisma.overtime_rate_rules.update({ where: { id: existing.id }, data });
    } else {
      await prisma.overtime_rate_rules.create({ data });
    }
  }
  console.log(`✔ ${gradeRateRules.length} overtime rate rules`);

  // ---------- Attendance allowance ladder (CONTEXT.md) ----------
  // NON_STAFF_DEFAULT: 1 absence → 50%, >1 → 0
  // OPERATOR_TINTIN: 1 → 80%, 2 → 50%, >2 → 0
  const allowanceRules = [
    {
      rule_set_code: 'NON_STAFF_DEFAULT',
      absence_days_min: 1,
      absence_days_max: 1,
      percentage: 50,
    },
    {
      rule_set_code: 'NON_STAFF_DEFAULT',
      absence_days_min: 2,
      absence_days_max: null,
      percentage: 0,
    },
    { rule_set_code: 'OPERATOR_TINTIN', absence_days_min: 1, absence_days_max: 1, percentage: 80 },
    { rule_set_code: 'OPERATOR_TINTIN', absence_days_min: 2, absence_days_max: 2, percentage: 50 },
    {
      rule_set_code: 'OPERATOR_TINTIN',
      absence_days_min: 3,
      absence_days_max: null,
      percentage: 0,
    },
  ];
  for (const r of allowanceRules) {
    const existing = await prisma.attendance_allowance_rules.findFirst({
      where: {
        rule_set_code: r.rule_set_code,
        absence_days_min: r.absence_days_min,
        effective_from: ASOF,
      },
    });
    const data = { ...r, effective_from: ASOF, effective_to: null };
    if (existing) {
      await prisma.attendance_allowance_rules.update({ where: { id: existing.id }, data });
    } else {
      await prisma.attendance_allowance_rules.create({ data });
    }
  }
  console.log(`✔ ${allowanceRules.length} attendance allowance rules`);

  // ---------- Payroll components (feeder-ready) ----------
  const payrollComponents = [
    {
      code: 'BASIC_SALARY',
      name: 'Gaji Pokok',
      component_type: 'INCOME',
      calc_method: 'FIXED',
      taxable: true,
      bpjs_base: true,
      display_order: 1,
    },
    {
      code: 'TUNJANGAN_MAKAN',
      name: 'Uang Makan',
      component_type: 'INCOME',
      calc_method: 'PER_DAY',
      taxable: false,
      display_order: 2,
    },
    {
      code: 'TUNJANGAN_TRANSPORT',
      name: 'Uang Transport',
      component_type: 'INCOME',
      calc_method: 'PER_DAY',
      taxable: false,
      display_order: 3,
    },
    {
      code: 'TUNJANGAN_KEHADIRAN',
      name: 'Tunjangan Kehadiran',
      component_type: 'INCOME',
      calc_method: 'PERCENTAGE',
      taxable: false,
      display_order: 4,
    },
    {
      code: 'LEMBUR',
      name: 'Lembur',
      component_type: 'INCOME',
      calc_method: 'FORMULA',
      formula_expression: 'HOURLY_DIVISOR * MULTIPLIER * HOURS',
      taxable: true,
      display_order: 5,
    },
    {
      code: 'POTONGAN_IZIN',
      name: 'Potongan Izin',
      component_type: 'DEDUCTION',
      calc_method: 'FORMULA',
      formula_expression: '-(GP / ABSENCE_MINUTES_DIVISOR) * IZIN_DAYS',
      taxable: false,
      display_order: 6,
    },
  ];
  const payrollComponentId = new Map<string, string>();
  for (const c of payrollComponents) {
    const comp = await prisma.payroll_components.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
    payrollComponentId.set(c.code, comp.id);
  }
  console.log(`✔ ${payrollComponents.length} payroll components`);

  // ---------- Loan types (pinjaman purpose whitelist enforced) ----------
  await prisma.loan_types.upsert({
    where: { code: 'WELFARE' },
    create: {
      code: 'WELFARE',
      name: 'Pinjaman Kesejahteraan',
      max_amount: 150000,
      max_tenor_months: 12,
      min_service_months: 24,
      max_per_year: 2,
      requires_attachment: true,
      workflow_code: 'PINJAMAN',
      allowed_purposes: ['MARRIED_MEDICAL', 'UNMARRIED_MEDICAL', 'FUNERAL', 'OWN_WEDDING'],
    },
    update: {
      max_amount: 150000,
      max_tenor_months: 12,
      min_service_months: 24,
      workflow_code: 'PINJAMAN',
    },
  });
  console.log('✔ 1 loan type');

  // ---------- Demo employee + user ----------
  // Demo login is shared by the whole ops team, so it carries a STAFF grade
  // (not Manager) plus a BASIC_SALARY assignment — this makes transaction
  // modules (lembur, perdin, pinjaman) exercisable end-to-end with a real
  // calculated amount. Manager grade has calc_method NONE and would block demo.
  const demoEmployee = await prisma.employees.upsert({
    where: { nik: DEMO_ADMIN_NIK },
    create: {
      nik: DEMO_ADMIN_NIK,
      full_name: 'Admin Demo',
      email: 'admin@lahans.dev',
      phone: '081234567890',
      branch_id: branch.id,
      job_position_id: position.id,
      job_grade_id: gradeStaff.id,
      join_date: new Date('2024-01-01'),
      employment_status: 'AKTIF',
    },
    update: { job_grade_id: gradeStaff.id },
  });
  const basicSalaryComponentId = payrollComponentId.get('BASIC_SALARY') ?? null;
  if (basicSalaryComponentId) {
    // No unique key on employee_component_assignments — idempotency via the
    // (employee, component, effective_from) pair, same as system_parameters.
    const existingAssignment = await prisma.employee_component_assignments.findFirst({
      where: {
        employee_id: demoEmployee.id,
        payroll_component_id: basicSalaryComponentId,
        effective_from: ASOF,
      },
    });
    const assignmentData = {
      employee_id: demoEmployee.id,
      payroll_component_id: basicSalaryComponentId,
      amount: new Prisma.Decimal(5_000_000),
      effective_from: ASOF,
      effective_to: null,
    };
    if (existingAssignment) {
      await prisma.employee_component_assignments.update({
        where: { id: existingAssignment.id },
        data: { amount: assignmentData.amount },
      });
    } else {
      await prisma.employee_component_assignments.create({ data: assignmentData });
    }
  }
  const passwordHash = await argon2.hash('Lahans@2026', {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 2,
    outputLen: 32,
  });
  // Authenticator/OTP 2FA was removed from login — demo user signs in with
  // password only (no TOTP secret, two_factor_enabled stays false).
  const demoUser = await prisma.users.upsert({
    where: { login_nik: DEMO_ADMIN_NIK },
    create: {
      employee_id: demoEmployee.id,
      login_nik: DEMO_ADMIN_NIK,
      email: 'admin@lahans.dev',
      password_hash: passwordHash,
      status: 'ACTIVE',
      must_change_password: false,
      two_factor_enabled: false,
    },
    update: { employee_id: demoEmployee.id, email: 'admin@lahans.dev' },
  });
  console.log(`✔ demo user ${DEMO_ADMIN_NIK} (password: Lahans@2026)`);
  // Assign to SUPER_ADMIN
  await prisma.user_group_members.upsert({
    where: { user_id_group_id: { user_id: demoUser.id, group_id: groupIds.get('SUPER_ADMIN')! } },
    create: { user_id: demoUser.id, group_id: groupIds.get('SUPER_ADMIN')! },
    update: {},
  });

  // ---------- Demo supervisor + reporting line ----------
  // Approval chains (CUTI/OVERTIME/PERDIN/PINJAMAN) start at the direct
  // supervisor. Without a reporting line the demo request would sit at step 1
  // with no assignee, so we seed one supervisor the demo employee reports to.
  const supervisorEmployee = await prisma.employees.upsert({
    where: { nik: '88000002' },
    create: {
      nik: '88000002',
      full_name: 'Demo Supervisor',
      email: 'supervisor@lahans.dev',
      phone: '081234567891',
      branch_id: branch.id,
      job_position_id: position.id,
      job_grade_id: gradeStaff.id,
      join_date: new Date('2023-01-01'),
      employment_status: 'AKTIF',
    },
    update: {},
  });
  const supervisorPasswordHash = await argon2.hash('Lahans@2026', {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 2,
    outputLen: 32,
  });
  const supervisorUser = await prisma.users.upsert({
    where: { login_nik: '88000002' },
    create: {
      employee_id: supervisorEmployee.id,
      login_nik: '88000002',
      email: 'supervisor@lahans.dev',
      password_hash: supervisorPasswordHash,
      status: 'ACTIVE',
      must_change_password: false,
      two_factor_enabled: false,
    },
    update: { employee_id: supervisorEmployee.id, email: 'supervisor@lahans.dev' },
  });
  await prisma.user_group_members.upsert({
    where: {
      user_id_group_id: { user_id: supervisorUser.id, group_id: groupIds.get('SUPER_ADMIN')! },
    },
    create: { user_id: supervisorUser.id, group_id: groupIds.get('SUPER_ADMIN')! },
    update: {},
  });
  const existingReportingLine = await prisma.reporting_lines.findFirst({
    where: { employee_id: demoEmployee.id, line_type: 'DIRECT', effective_to: null },
  });
  if (!existingReportingLine) {
    await prisma.reporting_lines.create({
      data: {
        employee_id: demoEmployee.id,
        supervisor_id: supervisorEmployee.id,
        line_type: 'DIRECT',
        effective_from: ASOF,
        effective_to: null,
      },
    });
  }
  console.log('✔ demo supervisor 88000002 + reporting line');

  // ---------------------------------------------------------------------------
  // M6 — Payroll demo data (UAT-M6-01..05, decision 6)
  // ---------------------------------------------------------------------------
  // Proves the sales-vs-pabrik data split: 3 non-staff sales employees (SALES
  // division, NON_STAFF_DEFAULT ladder) + 3 operator employees (PABRIK division,
  // OPERATOR_TINTIN ladder). Two Comben users are bound to DIVISION SALES / PABRIK
  // via user_scope_bindings — each sees and processes only its own slice.
  const M6_PERIOD_CODE = '2026-08';
  const M6_CUTOFF_START = new Date('2026-07-22');
  const M6_CUTOFF_END = new Date('2026-08-21');
  const M6_ASOF = ASOF; // assignments effective 2026-01-01 (before period)

  // -- Payload: per-employee component assignments (amounts from source of truth).
  const m6Employees = [
    // SALES division — non-staff, NON_STAFF_DEFAULT ladder.
    {
      nik: '20250055',
      full_name: 'Aan Agustian',
      email: 'aan.agustian@lahans.dev',
      branchCode: 'WNG',
      positionCode: 'SALESMAN',
      // 0 absence days -> kehadiran 100%, full 200k.
      attendance: { present: 31, absence: 0 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3250000 },
        { code: 'TUNJANGAN_MAKAN', amount: 20000 }, // per-day
        { code: 'TUNJANGAN_KEHADIRAN', amount: 200000 }, // base (monthly)
      ],
      overtime: [
        {
          date: '2026-08-03',
          dayType: 'WEEKDAY',
          plannedHours: 2,
          actualHours: 2,
          amount: 37572.25,
        },
        {
          date: '2026-08-04',
          dayType: 'WEEKDAY',
          plannedHours: 2,
          actualHours: 2,
          amount: 37572.25,
        },
      ],
    },
    {
      nik: '20230567',
      full_name: 'Abdullah Hasan',
      email: 'abdullah.hasan@lahans.dev',
      branchCode: 'PBG',
      positionCode: 'DRIVER',
      // 1 absence day -> kehadiran 50% (200k -> 100k) (NON_STAFF_DEFAULT 1->50%).
      attendance: { present: 30, absence: 1 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3250000 },
        { code: 'TUNJANGAN_MAKAN', amount: 20000 },
        { code: 'TUNJANGAN_KEHADIRAN', amount: 200000 },
      ],
      overtime: [],
    },
    {
      nik: '20260007',
      full_name: 'Acep Hendra',
      email: 'acep.hendra@lahans.dev',
      branchCode: 'PWR',
      positionCode: 'SPG',
      // 2 absence days -> kehadiran 0% (NON_STAFF_DEFAULT 2+->0).
      attendance: { present: 29, absence: 2 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3250000 },
        { code: 'TUNJANGAN_MAKAN', amount: 10000 }, // SPG makan 10k/day
        { code: 'TUNJANGAN_KEHADIRAN', amount: 100000 }, // SPG kehadiran base 100k
      ],
      overtime: [],
    },
    // PABRIK division — operators, OPERATOR_TINTIN ladder.
    {
      nik: '20230612',
      full_name: 'Ach. Firdaus',
      email: 'firdaus@lahans.dev',
      branchCode: 'BYW',
      positionCode: 'OPERATOR-TINTIN',
      // 0 absence days -> kehadiran 100% (130k).
      attendance: { present: 31, absence: 0 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3000000 },
        { code: 'TUNJANGAN_MAKAN', amount: 13000 }, // operator makan 13k/day
        { code: 'TUNJANGAN_KEHADIRAN', amount: 130000 }, // all operators 130k
      ],
      overtime: [
        {
          date: '2026-08-08',
          dayType: 'WEEKEND',
          plannedHours: 3,
          actualHours: 3,
          amount: 56358.38,
        },
      ],
    },
    {
      nik: '20000173',
      full_name: 'Ade Nurjaman',
      email: 'ade.nurjaman@lahans.dev',
      branchCode: 'GRT',
      positionCode: 'OPERATOR-TINTIN',
      // 1 absence day -> kehadiran 80% (130k -> 104k) (OPERATOR_TINTIN 1->80%).
      attendance: { present: 30, absence: 1 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3000000 },
        { code: 'TUNJANGAN_MAKAN', amount: 13000 },
        { code: 'TUNJANGAN_KEHADIRAN', amount: 130000 },
      ],
      overtime: [],
    },
    {
      nik: '20240682',
      full_name: 'Adie Wirahadie',
      email: 'adie.wirahadie@lahans.dev',
      branchCode: 'GRT',
      positionCode: 'OPERATOR-TINTIN',
      // 2 absence days -> kehadiran 50% (130k -> 65k) (OPERATOR_TINTIN 2->50%).
      attendance: { present: 29, absence: 2 },
      assignments: [
        { code: 'BASIC_SALARY', amount: 3000000 },
        { code: 'TUNJANGAN_MAKAN', amount: 13000 },
        { code: 'TUNJANGAN_KEHADIRAN', amount: 130000 },
      ],
      overtime: [],
    },
  ];

  const m6EmployeeIdByNik = new Map<string, string>();
  for (const e of m6Employees) {
    const branchId = branchIdByCode.get(e.branchCode)!;
    const positionId = positionIdByCode.get(e.positionCode)!;
    const emp = await prisma.employees.upsert({
      where: { nik: e.nik },
      create: {
        nik: e.nik,
        full_name: e.full_name,
        email: e.email,
        branch_id: branchId,
        job_position_id: positionId,
        job_grade_id: nonStaffGrade.id,
        join_date: new Date('2024-01-01'),
        employment_status: 'AKTIF',
      },
      update: { branch_id: branchId, job_position_id: positionId, job_grade_id: nonStaffGrade.id },
    });
    m6EmployeeIdByNik.set(e.nik, emp.id);

    // Component assignments (idempotent by employee+component+effective_from).
    for (const a of e.assignments) {
      const compId = payrollComponentId.get(a.code);
      if (!compId) continue;
      const existingAssignment = await prisma.employee_component_assignments.findFirst({
        where: {
          employee_id: emp.id,
          payroll_component_id: compId,
          effective_from: M6_ASOF,
        },
      });
      const data = {
        employee_id: emp.id,
        payroll_component_id: compId,
        amount: new Prisma.Decimal(a.amount),
        effective_from: M6_ASOF,
        effective_to: null,
      };
      if (existingAssignment) {
        await prisma.employee_component_assignments.update({
          where: { id: existingAssignment.id },
          data: { amount: data.amount },
        });
      } else {
        await prisma.employee_component_assignments.create({ data });
      }
    }

    // Attendance days for the period (22 Jul – 21 Aug 2026 = 31 days).
    // Absence days are marked IZIN (deducts salary pro-rata + meal/transport);
    // the rest are HADIR.
    const dayMs = 86400000;
    for (let i = 0; i < 31; i++) {
      const d = new Date(M6_CUTOFF_START.getTime() + i * dayMs);
      const status = i < e.attendance.absence ? 'IZIN' : 'HADIR';
      const existingDay = await prisma.attendance_daily.findUnique({
        where: { employee_id_work_date: { employee_id: emp.id, work_date: d } },
      });
      if (existingDay) {
        await prisma.attendance_daily.update({
          where: { id: existingDay.id },
          data: { status, source: 'MANUAL' },
        });
      } else {
        await prisma.attendance_daily.create({
          data: { employee_id: emp.id, work_date: d, status, source: 'MANUAL' },
        });
      }
    }

    // Approved overtime (in-period).
    const ot = e.overtime ?? [];
    for (const o of ot) {
      const doc = `L/M6/${e.nik}/${o.date}`;
      const overtimeDate = new Date(o.date + 'T00:00:00Z');
      const existingOt = await prisma.overtime_requests.findUnique({ where: { doc_number: doc } });
      if (existingOt) {
        await prisma.overtime_requests.update({
          where: { id: existingOt.id },
          data: {
            day_type: o.dayType,
            planned_hours: new Prisma.Decimal(o.plannedHours),
            actual_hours: new Prisma.Decimal(o.actualHours),
            calculated_amount: new Prisma.Decimal(o.amount),
            status: 'APPROVED',
          },
        });
      } else {
        await prisma.overtime_requests.create({
          data: {
            doc_number: doc,
            employee_id: emp.id,
            overtime_date: overtimeDate,
            day_type: o.dayType,
            planned_hours: new Prisma.Decimal(o.plannedHours),
            actual_hours: new Prisma.Decimal(o.actualHours),
            calculated_amount: new Prisma.Decimal(o.amount),
            status: 'APPROVED',
            reason: 'Demo M6 lembur',
          },
        });
      }
    }
  }
  console.log(`✔ ${m6Employees.length} M6 employees + attendance + overtime`);

  // -- Payroll period 2026-08 (OPEN, 22 Jul – 21 Aug 2026).
  await prisma.payroll_periods.upsert({
    where: { code: M6_PERIOD_CODE },
    create: {
      company_id: company.id,
      code: M6_PERIOD_CODE,
      cutoff_start: M6_CUTOFF_START,
      cutoff_end: M6_CUTOFF_END,
      status: 'OPEN',
    },
    update: { cutoff_start: M6_CUTOFF_START, cutoff_end: M6_CUTOFF_END, status: 'OPEN' },
  });
  console.log(`✔ payroll period ${M6_PERIOD_CODE} (OPEN)`);

  // -- COMBEN group gets payroll permissions at DIVISION data scope, plus the
  //    two Comben users bound to the SALES / PABRIK divisions.
  const combenPayrollPerms = [
    'payroll.period.read',
    'payroll.period.close',
    'payroll.feeder.read',
    'payroll.feeder.export',
    'payroll.feeder.override',
  ];
  for (const code of combenPayrollPerms) {
    await prisma.group_permissions.upsert({
      where: {
        group_id_permission_id: {
          group_id: groupIds.get('COMBEN')!,
          permission_id: permissionIds.get(code)!,
        },
      },
      create: {
        group_id: groupIds.get('COMBEN')!,
        permission_id: permissionIds.get(code)!,
        data_scope: 'DIVISION',
      },
      update: { data_scope: 'DIVISION' },
    });
  }

  const combenUsers = [
    { nik: '88000011', email: 'comben.sales@lahans.dev', divisionId: divisionSales.id },
    { nik: '88000012', email: 'comben.pabrik@lahans.dev', divisionId: divisionPabrik.id },
  ];
  for (const cu of combenUsers) {
    const emp = await prisma.employees.upsert({
      where: { nik: cu.nik },
      create: {
        nik: cu.nik,
        full_name: cu.nik === '88000011' ? 'Comben Sales' : 'Comben Pabrik',
        email: cu.email,
        branch_id: branch.id,
        job_position_id: position.id,
        job_grade_id: gradeStaff.id,
        join_date: new Date('2023-01-01'),
        employment_status: 'AKTIF',
      },
      update: {},
    });
    const hash = await argon2.hash('Lahans@2026', {
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 2,
      outputLen: 32,
    });
    const usr = await prisma.users.upsert({
      where: { login_nik: cu.nik },
      create: {
        employee_id: emp.id,
        login_nik: cu.nik,
        email: cu.email,
        password_hash: hash,
        status: 'ACTIVE',
        must_change_password: false,
        two_factor_enabled: false,
      },
      update: { employee_id: emp.id, email: cu.email },
    });
    await prisma.user_group_members.upsert({
      where: { user_id_group_id: { user_id: usr.id, group_id: groupIds.get('COMBEN')! } },
      create: { user_id: usr.id, group_id: groupIds.get('COMBEN')! },
      update: {},
    });
    // DATA-SCOPE BINDING: each Comben user is bound to exactly one division.
    await prisma.user_scope_bindings.upsert({
      where: {
        user_id_scope_type_scope_ref_id: {
          user_id: usr.id,
          scope_type: 'DIVISION',
          scope_ref_id: cu.divisionId,
        },
      },
      create: {
        user_id: usr.id,
        scope_type: 'DIVISION',
        scope_ref_id: cu.divisionId,
      },
      update: {},
    });
  }
  console.log('✔ M6 Comben users 88000011 (Sales) + 88000012 (Pabrik) + DIVISION bindings');

  // ---------------------------------------------------------------------------
  // S6 — Attendance group grants (FR-M2-001..012)
  // ---------------------------------------------------------------------------
  // COMBEN + HCGA_MANAGER review/process attendance at DIVISION scope; every
  // EMPLOYEE clocks and reads their own + self-service corrections at SELF scope.
  const combenAttendancePerms = [
    'attendance.log.read',
    'attendance.daily.read',
    'attendance.daily.write',
    'attendance.correction.read',
    'attendance.correction.write',
    'attendance.correction.approve',
  ];
  for (const code of combenAttendancePerms) {
    for (const g of ['COMBEN', 'HCGA_MANAGER']) {
      await prisma.group_permissions.upsert({
        where: {
          group_id_permission_id: {
            group_id: groupIds.get(g)!,
            permission_id: permissionIds.get(code)!,
          },
        },
        create: {
          group_id: groupIds.get(g)!,
          permission_id: permissionIds.get(code)!,
          data_scope: 'DIVISION',
        },
        update: { data_scope: 'DIVISION' },
      });
    }
  }
  const employeeAttendancePerms = [
    'attendance.log.read',
    'attendance.log.write',
    'attendance.daily.read',
    'attendance.correction.write',
    'attendance.correction.read',
  ];
  for (const code of employeeAttendancePerms) {
    await prisma.group_permissions.upsert({
      where: {
        group_id_permission_id: {
          group_id: groupIds.get('EMPLOYEE')!,
          permission_id: permissionIds.get(code)!,
        },
      },
      create: {
        group_id: groupIds.get('EMPLOYEE')!,
        permission_id: permissionIds.get(code)!,
        data_scope: 'SELF',
      },
      update: { data_scope: 'SELF' },
    });
  }
  // Admin-config schedules/calendars: HCGA (master role) can edit work-schedule
  // days + assignments so future branches/manufacturing units are configured in
  // the admin UI, not hardcoded (user directive).
  for (const g of ['COMBEN', 'HCGA_MANAGER']) {
    for (const code of [
      'master.work_schedule_days.read',
      'master.work_schedule_days.write',
      'master.schedule_assignments.read',
      'master.schedule_assignments.write',
      'master.work_schedules.read',
      'master.work_schedules.write',
      'master.holidays.read',
      'master.holidays.write',
    ]) {
      await prisma.group_permissions.upsert({
        where: {
          group_id_permission_id: {
            group_id: groupIds.get(g)!,
            permission_id: permissionIds.get(code)!,
          },
        },
        create: {
          group_id: groupIds.get(g)!,
          permission_id: permissionIds.get(code)!,
          data_scope: 'DIVISION',
        },
        update: {},
      });
    }
  }
  console.log('✔ attendance group grants (COMBEN/HCGA DIVISION, EMPLOYEE SELF)');

  // ---------------------------------------------------------------------------
  // M2B — Roster group grants (FR-M2B-001..004, FR-M0-060/061)
  // ---------------------------------------------------------------------------
  // COMBEN + HCGA_MANAGER manage the roster (shifts, calendar, overrides,
  // assignment, delegation) at DIVISION scope; EMPLOYEE reads the calendar.
  for (const g of ['COMBEN', 'HCGA_MANAGER']) {
    for (const code of [
      'roster.calendar.read',
      'roster.shift.read',
      'roster.shift.write',
      'roster.override.read',
      'roster.override.write',
      'roster.assign.write',
      'roster.delegation.read',
      'roster.delegation.write',
      'master.shift_definitions.read',
      'master.shift_definitions.write',
      'master.shift_patterns.read',
      'master.shift_patterns.write',
      'master.shift_rotations.read',
      'master.shift_rotations.write',
    ]) {
      await prisma.group_permissions.upsert({
        where: {
          group_id_permission_id: {
            group_id: groupIds.get(g)!,
            permission_id: permissionIds.get(code)!,
          },
        },
        create: {
          group_id: groupIds.get(g)!,
          permission_id: permissionIds.get(code)!,
          data_scope: 'DIVISION',
        },
        update: { data_scope: 'DIVISION' },
      });
    }
  }
  for (const code of ['roster.calendar.read', 'roster.override.read', 'roster.delegation.read']) {
    await prisma.group_permissions.upsert({
      where: {
        group_id_permission_id: {
          group_id: groupIds.get('EMPLOYEE')!,
          permission_id: permissionIds.get(code)!,
        },
      },
      create: {
        group_id: groupIds.get('EMPLOYEE')!,
        permission_id: permissionIds.get(code)!,
        data_scope: 'SELF',
      },
      update: { data_scope: 'SELF' },
    });
  }
  console.log('✔ roster group grants (COMBEN/HCGA DIVISION, EMPLOYEE SELF)');

  // ---------------------------------------------------------------------------
  // M2B — Shift management (FR-M2B-002): definitions + rotation + SHIFT schedule
  // ---------------------------------------------------------------------------
  // The SOP hours are fixed-day schedules (office 09–17, pabrik 07:30–15:30/15:00,
  // field flexible). On top of those, admins configure named shift windows
  // (NORMAL/PAGI/SIANG/MALAM) that a rotation pattern composes into a SHIFT
  // work_schedule — the "3 shift" set-up for the manufaktur unit. These are
  // seed defaults, fully admin-editable via the master web UI; the roster
  // resolver reads them from the DB (no code change when a unit is added).
  const shiftDefSeeds = [
    {
      code: 'NORMAL',
      name: 'Shift Normal',
      start: '08:00',
      end: '17:00',
      break: 60,
      tol: 0,
      crosses: false,
    },
    {
      code: 'PAGI',
      name: 'Shift Pagi',
      start: '06:00',
      end: '14:00',
      break: 0,
      tol: 0,
      crosses: false,
    },
    {
      code: 'SIANG',
      name: 'Shift Siang',
      start: '14:00',
      end: '22:00',
      break: 0,
      tol: 0,
      crosses: false,
    },
    {
      code: 'MALAM',
      name: 'Shift Malam',
      start: '22:00',
      end: '06:00',
      break: 0,
      tol: 0,
      crosses: true,
    },
  ];
  const shiftDefIdByCode = new Map<string, string>();
  for (const s of shiftDefSeeds) {
    const row = await prisma.shift_definitions.upsert({
      where: { company_id_code: { company_id: company.id, code: s.code } },
      create: {
        company_id: company.id,
        code: s.code,
        name: s.name,
        start_time: s.start,
        end_time: s.end,
        break_minutes: s.break,
        late_tolerance_minutes: s.tol,
        crosses_midnight: s.crosses,
        is_active: true,
      },
      update: {
        name: s.name,
        start_time: s.start,
        end_time: s.end,
        break_minutes: s.break,
        late_tolerance_minutes: s.tol,
        crosses_midnight: s.crosses,
        is_active: true,
      },
    });
    shiftDefIdByCode.set(s.code, row.id);
  }
  console.log(`✔ ${shiftDefSeeds.length} shift definitions (NORMAL/PAGI/SIANG/MALAM)`);

  // 3-shift rotation pattern: 7-day cycle, PAGI→SIANG→MALAM→LIBUR→PAGI→SIANG→MALAM.
  const PABRIK_PATTERN_CODE = 'PABRIK_3X';
  const pattern = await prisma.shift_patterns.upsert({
    where: { company_id_code: { company_id: company.id, code: PABRIK_PATTERN_CODE } },
    create: {
      company_id: company.id,
      code: PABRIK_PATTERN_CODE,
      name: 'Pola 3 Shift Pabrik',
      cycle_length: 7,
      is_active: true,
    },
    update: { name: 'Pola 3 Shift Pabrik', cycle_length: 7, is_active: true },
  });
  const rotationSeeds: { idx: number; shift: string | null; working: boolean }[] = [
    { idx: 0, shift: 'PAGI', working: true },
    { idx: 1, shift: 'SIANG', working: true },
    { idx: 2, shift: 'MALAM', working: true },
    { idx: 3, shift: null, working: false }, // libur
    { idx: 4, shift: 'PAGI', working: true },
    { idx: 5, shift: 'SIANG', working: true },
    { idx: 6, shift: 'MALAM', working: true },
  ];
  for (const r of rotationSeeds) {
    await prisma.shift_rotations.upsert({
      where: { shift_pattern_id_day_index: { shift_pattern_id: pattern.id, day_index: r.idx } },
      create: {
        shift_pattern_id: pattern.id,
        day_index: r.idx,
        shift_definition_id: r.shift ? (shiftDefIdByCode.get(r.shift) ?? null) : null,
        is_working_day: r.working,
      },
      update: {
        shift_definition_id: r.shift ? (shiftDefIdByCode.get(r.shift) ?? null) : null,
        is_working_day: r.working,
      },
    });
  }
  console.log(`✔ ${PABRIK_PATTERN_CODE} rotation pattern (${rotationSeeds.length} slots)`);

  // SHIFT work_schedule pointing at the 3-shift pattern, assigned to the
  // manufaktur unit (PBR branch) at BRANCH scope (priority 4) — the operator
  // demo employees resolving it get their day-off/shift from the rotation.
  const shiftSchedule = await prisma.work_schedules.upsert({
    where: { code: 'PABRIK_SHIFT_3X' },
    create: {
      company_id: company.id,
      code: 'PABRIK_SHIFT_3X',
      name: 'Pabrik Shift 3x8',
      schedule_type: 'SHIFT',
      shift_pattern_id: pattern.id,
      is_active: true,
    },
    update: {
      name: 'Pabrik Shift 3x8',
      schedule_type: 'SHIFT',
      shift_pattern_id: pattern.id,
      is_active: true,
    },
  });
  const existingShiftAssign = await prisma.schedule_assignments.findFirst({
    where: { scope_type: 'BRANCH', scope_ref_id: branch.id, work_schedule_id: shiftSchedule.id },
  });
  const shiftAssignData = {
    work_schedule_id: shiftSchedule.id,
    scope_type: 'BRANCH' as const,
    scope_ref_id: branch.id,
    priority: 4,
    effective_from: ASOF,
    effective_to: null,
  };
  if (existingShiftAssign) {
    await prisma.schedule_assignments.update({
      where: { id: existingShiftAssign.id },
      data: shiftAssignData,
    });
  } else {
    await prisma.schedule_assignments.create({ data: shiftAssignData });
  }
  // Shared schedule-id registry populated here (M2B) and by the S6 block below.
  const scheduleIdByCode = new Map<string, string>();
  scheduleIdByCode.set('PABRIK_SHIFT_3X', shiftSchedule.id);
  console.log('✔ PABRIK_SHIFT_3X work schedule + BRANCH assignment (PBR)');

  // ---------------------------------------------------------------------------
  // S6 — Work schedules + calendar (admin-configurable baseline, NOT hardcoded)
  // ---------------------------------------------------------------------------
  // Seeded as demo defaults only; admins reconfigure them (and add new ones per
  // branch/manufacturing unit) via the master web UI. The runtime resolves
  // schedules from the DB, so no code change is needed when a unit is added.
  //
  // Day tuples: [day_of_week, is_working_day, start_time, end_time, break_min, tolerance]
  type ScheduleDaySeed = [number, boolean, string | null, string | null, number, number];
  type WorkScheduleSeed = {
    code: string;
    name: string;
    schedule_type: string;
    weekly_target_minutes: number | null;
    daily_standard_minutes: number | null;
    days: ScheduleDaySeed[];
  };
  const workScheduleSeeds: WorkScheduleSeed[] = [
    {
      code: 'HO_STANDARD',
      name: 'HO Standard',
      schedule_type: 'FIXED',
      weekly_target_minutes: null,
      daily_standard_minutes: null,
      days: [
        [1, true, '09:00', '17:00', 60, 0],
        [2, true, '09:00', '17:00', 60, 0],
        [3, true, '09:00', '17:00', 60, 0],
        [4, true, '09:00', '17:00', 60, 0],
        [5, true, '09:00', '17:00', 60, 0],
        [6, false, null, null, 0, 0],
        [0, false, null, null, 0, 0],
      ],
    },
    {
      code: 'PABRIK_STAFFUP',
      name: 'Pabrik Staff/Up',
      schedule_type: 'FIXED',
      weekly_target_minutes: null,
      daily_standard_minutes: null,
      days: [
        [1, true, '07:30', '15:30', 60, 0],
        [2, true, '07:30', '15:30', 60, 0],
        [3, true, '07:30', '15:30', 60, 0],
        [4, true, '07:30', '15:30', 60, 0],
        [5, true, '07:30', '15:30', 60, 0],
        [6, true, '07:30', '12:00', 0, 0],
        [0, false, null, null, 0, 0],
      ],
    },
    {
      code: 'PABRIK_OPERATOR',
      name: 'Pabrik Operator',
      schedule_type: 'FIXED',
      weekly_target_minutes: null,
      daily_standard_minutes: null,
      days: [
        [1, true, '07:30', '15:00', 60, 0],
        [2, true, '07:30', '15:00', 60, 0],
        [3, true, '07:30', '15:00', 60, 0],
        [4, true, '07:30', '15:00', 60, 0],
        [5, true, '07:30', '15:00', 60, 0],
        [6, false, null, null, 0, 0],
        [0, false, null, null, 0, 0],
      ],
    },
    {
      code: 'FIELD_MARKET',
      name: 'Field Market',
      schedule_type: 'FLEXIBLE',
      weekly_target_minutes: 1800,
      daily_standard_minutes: 480,
      days: [
        [1, true, '09:00', '15:00', 60, 0],
        [2, true, '09:00', '15:00', 60, 0],
        [3, true, '09:00', '15:00', 60, 0],
        [4, true, '09:00', '15:00', 60, 0],
        [5, true, '09:00', '15:00', 60, 0],
        [6, false, null, null, 0, 0],
        [0, false, null, null, 0, 0],
      ],
    },
  ];
  for (const s of workScheduleSeeds) {
    const row = await prisma.work_schedules.upsert({
      where: { code: s.code },
      create: {
        company_id: company.id,
        code: s.code,
        name: s.name,
        schedule_type: s.schedule_type,
        weekly_target_minutes: s.weekly_target_minutes,
        daily_standard_minutes: s.daily_standard_minutes,
        is_active: true,
      },
      update: {
        name: s.name,
        schedule_type: s.schedule_type,
        weekly_target_minutes: s.weekly_target_minutes,
        daily_standard_minutes: s.daily_standard_minutes,
        is_active: true,
      },
    });
    scheduleIdByCode.set(s.code, row.id);
    for (const [dow, working, start, end, breakMin, tol] of s.days) {
      await prisma.work_schedule_days.upsert({
        where: { work_schedule_id_day_of_week: { work_schedule_id: row.id, day_of_week: dow } },
        create: {
          work_schedule_id: row.id,
          day_of_week: dow,
          is_working_day: working,
          start_time: start,
          end_time: end,
          break_minutes: breakMin,
          late_tolerance_minutes: tol,
        },
        update: {
          is_working_day: working,
          start_time: start,
          end_time: end,
          break_minutes: breakMin,
          late_tolerance_minutes: tol,
        },
      });
    }
  }
  console.log(`✔ ${workScheduleSeeds.length} work schedules (admin-configurable)`);

  // Assign schedules to employees (EMPLOYEE scope, priority 1, effective 2026-01-01).
  // Operators get the 3-shift ROTATION (PAGI/SIANG/MALAM) so the demo shows the
  // M2B shift machinery; office staff get fixed SOP schedules. The PBR BRANCH
  // assignment (priority 4) is the manufaktur-unit default for any employee with
  // no individual schedule — admins configure per unit via master, not code.
  const scheduleForEmployee = (nik: string): string | null => {
    const pos = m6Employees.find((e) => e.nik === nik)?.positionCode;
    if (pos === 'OPERATOR-TINTIN') return 'PABRIK_SHIFT_3X';
    if (pos) return 'FIELD_MARKET'; // SALESMAN/DRIVER/SPG
    if (nik === '88000002' || nik === '88000011' || nik === '88000012') return 'HO_STANDARD';
    return null;
  };
  const attendanceEmployees = [
    ...m6Employees.map((e) => e.nik),
    '88000002',
    '88000011',
    '88000012',
  ];
  for (const nik of attendanceEmployees) {
    const scheduleCode = scheduleForEmployee(nik);
    if (!scheduleCode) continue;
    const scheduleId = scheduleIdByCode.get(scheduleCode)!;
    const empRow = await prisma.employees.findUnique({ where: { nik }, select: { id: true } });
    if (!empRow) continue;
    const existingAssign = await prisma.schedule_assignments.findFirst({
      where: { scope_type: 'EMPLOYEE', scope_ref_id: empRow.id, effective_from: ASOF },
    });
    const assignData = {
      work_schedule_id: scheduleId,
      scope_type: 'EMPLOYEE',
      scope_ref_id: empRow.id,
      priority: 1,
      effective_from: ASOF,
      effective_to: null,
    };
    if (existingAssign) {
      await prisma.schedule_assignments.update({
        where: { id: existingAssign.id },
        data: assignData,
      });
    } else {
      await prisma.schedule_assignments.create({ data: assignData });
    }
  }
  console.log(`✔ ${attendanceEmployees.length} schedule assignments (EMPLOYEE scope)`);

  // Demo clock logs for NIK 20250055 (Aan) on 2026-08-06 so the web demo shows
  // a derived daily row (IN 08:58 / OUT 17:02 Asia/Jakarta → UTC 01:58/10:02).
  const demoClockEmployee = await prisma.employees.findUnique({
    where: { nik: '20250055' },
    select: { id: true, branch_id: true },
  });
  if (demoClockEmployee) {
    const demoDay = new Date('2026-08-06');
    const inTime = new Date('2026-08-06T01:58:00.000Z');
    const outTime = new Date('2026-08-06T10:02:00.000Z');
    const inLog = await prisma.attendance_logs.findUnique({
      where: { client_request_id: 'demo-s6-in-20250055-20260806' },
    });
    if (!inLog) {
      await prisma.attendance_logs.create({
        data: {
          employee_id: demoClockEmployee.id,
          log_type: 'IN',
          server_time: inTime,
          device_time: inTime,
          latitude: new Prisma.Decimal('-6.200000'),
          longitude: new Prisma.Decimal('106.800000'),
          branch_id: demoClockEmployee.branch_id,
          distance_from_geofence_m: new Prisma.Decimal('15.00'),
          is_out_of_zone: false,
          is_mock_location: false,
          is_offline_sync: false,
          client_request_id: 'demo-s6-in-20250055-20260806',
        },
      });
    }
    const outLog = await prisma.attendance_logs.findUnique({
      where: { client_request_id: 'demo-s6-out-20250055-20260806' },
    });
    if (!outLog) {
      await prisma.attendance_logs.create({
        data: {
          employee_id: demoClockEmployee.id,
          log_type: 'OUT',
          server_time: outTime,
          device_time: outTime,
          latitude: new Prisma.Decimal('-6.200000'),
          longitude: new Prisma.Decimal('106.800000'),
          branch_id: demoClockEmployee.branch_id,
          distance_from_geofence_m: new Prisma.Decimal('15.00'),
          is_out_of_zone: false,
          is_mock_location: false,
          is_offline_sync: false,
          client_request_id: 'demo-s6-out-20250055-20260806',
        },
      });
    }
    // Derive the daily row for the demo day (idempotent upsert).
    const demoDaily = await prisma.attendance_daily.findUnique({
      where: { employee_id_work_date: { employee_id: demoClockEmployee.id, work_date: demoDay } },
    });
    if (demoDaily) {
      await prisma.attendance_daily.update({
        where: { id: demoDaily.id },
        data: {
          first_in_at: inTime,
          last_out_at: outTime,
          status: 'HADIR',
          late_minutes: 0,
          early_leave_minutes: 0,
        },
      });
    } else {
      await prisma.attendance_daily.create({
        data: {
          employee_id: demoClockEmployee.id,
          work_date: demoDay,
          first_in_at: inTime,
          last_out_at: outTime,
          status: 'HADIR',
          late_minutes: 0,
          early_leave_minutes: 0,
          work_minutes: 420,
          source: 'MANUAL',
        },
      });
    }
    console.log('✔ demo attendance_logs + daily for 20250055 (2026-08-06)');

    // Demo user login for Aan (20250055) so the "Absen Saya" web tab is usable
    // (self-scope EMPLOYEE group grants already cover attendance.*).
    const demoAanHash = await argon2.hash('Lahans@2026', {
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 2,
      outputLen: 32,
    });
    const demoAanUser = await prisma.users.upsert({
      where: { login_nik: '20250055' },
      create: {
        employee_id: demoClockEmployee.id,
        login_nik: '20250055',
        email: 'aan.agustian@lahans.dev',
        password_hash: demoAanHash,
        status: 'ACTIVE',
        must_change_password: false,
        two_factor_enabled: false,
      },
      update: { employee_id: demoClockEmployee.id, email: 'aan.agustian@lahans.dev' },
    });
    await prisma.user_group_members.upsert({
      where: { user_id_group_id: { user_id: demoAanUser.id, group_id: groupIds.get('EMPLOYEE')! } },
      create: { user_id: demoAanUser.id, group_id: groupIds.get('EMPLOYEE')! },
      update: {},
    });
    console.log('✔ demo login 20250055 (Aan, EMPLOYEE) — Lahans@2026');

    // Direct reporting line for Aan → 88000002 so the attendance-correction
    // workflow (step 1 = DIRECT_SUPERVISOR) resolves an assignee. Without it a
    // correction would sit at PENDING with no task (orphaned).
    const aanReportingLine = await prisma.reporting_lines.findFirst({
      where: { employee_id: demoClockEmployee.id, line_type: 'DIRECT', effective_to: null },
    });
    if (!aanReportingLine) {
      await prisma.reporting_lines.create({
        data: {
          employee_id: demoClockEmployee.id,
          supervisor_id: supervisorEmployee.id,
          line_type: 'DIRECT',
          effective_from: ASOF,
          effective_to: null,
        },
      });
    }
    console.log('✔ reporting line 20250055 → 88000002 (attendance correction chain)');
  }

  // ---------- system_parameters (effective-dated) ----------
  // No unique key on system_parameters (only a composite index), so idempotency
  // is achieved by matching the (param_key, effective_from) pair via findFirst.
  for (const p of SYSTEM_PARAMETERS) {
    const existingParam = await prisma.system_parameters.findFirst({
      where: { param_key: p.param_key, effective_from: p.effective_from },
    });
    const data = { ...p, effective_to: null };
    if (existingParam) {
      await prisma.system_parameters.update({ where: { id: existingParam.id }, data });
    } else {
      await prisma.system_parameters.create({ data });
    }
  }
  console.log(`✔ ${SYSTEM_PARAMETERS.length} system parameters`);

  // ---------- format settings ----------
  for (const f of FORMAT_SETTINGS) {
    await prisma.format_settings.upsert({
      where: { format_key: f.format_key },
      create: f,
      update: f,
    });
  }
  console.log(`✔ ${FORMAT_SETTINGS.length} format settings`);

  // ---------- number sequences ----------
  for (const s of NUMBER_SEQUENCES) {
    await prisma.number_sequences.upsert({
      where: { sequence_code: s.sequence_code },
      create: s,
      update: s,
    });
  }
  console.log(`✔ ${NUMBER_SEQUENCES.length} number sequences`);

  // ---------- validation rules ----------
  // Idempotent by matching (entity_name, field_name, rule_type).
  for (const r of VALIDATION_RULES) {
    const existingRule = await prisma.validation_rules.findFirst({
      where: { entity_name: r.entity_name, field_name: r.field_name, rule_type: r.rule_type },
    });
    if (existingRule) {
      await prisma.validation_rules.update({ where: { id: existingRule.id }, data: r });
    } else {
      await prisma.validation_rules.create({ data: r });
    }
  }
  console.log(`✔ ${VALIDATION_RULES.length} validation rules`);

  // ---------- menus (M0 navigation) ----------
  const menusSeed = [
    {
      code: 'DASHBOARD',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      route: '/dashboard',
      platform: 'BOTH',
      sort_order: 1,
      permission_code: null,
    },
    {
      code: 'MASTER',
      label: 'Master Data',
      icon: 'Database',
      platform: 'BOTH',
      sort_order: 10,
      permission_code: 'master.read',
    },
    {
      code: 'MASTER.EMPLOYEES',
      label: 'Karyawan',
      route: '/master/employees',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 11,
      permission_code: 'master.employees.read',
    },
    {
      code: 'MASTER.COMPANIES',
      label: 'Perusahaan',
      route: '/master/companies',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 12,
      permission_code: 'master.companies.read',
    },
    {
      code: 'MASTER.BRANCHES',
      label: 'Cabang',
      route: '/master/branches',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 13,
      permission_code: 'master.branches.read',
    },
    {
      code: 'MASTER.DIVISIONS',
      label: 'Divisi',
      route: '/master/divisions',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 14,
      permission_code: 'master.divisions.read',
    },
    {
      code: 'MASTER.WORK_SCHEDULES',
      label: 'Jadwal Kerja',
      route: '/master/work-schedules',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 15,
      permission_code: 'master.work_schedules.read',
    },
    {
      code: 'MASTER.WORK_SCHEDULE_DAYS',
      label: 'Hari Kerja',
      route: '/master/work-schedule-days',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 16,
      permission_code: 'master.work_schedule_days.read',
    },
    {
      code: 'MASTER.SCHEDULE_ASSIGNMENTS',
      label: 'Penugasan Jadwal',
      route: '/master/schedule-assignments',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 17,
      permission_code: 'master.schedule_assignments.read',
    },
    {
      code: 'MASTER.HOLIDAYS',
      label: 'Hari Libur',
      route: '/master/holidays',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 18,
      permission_code: 'master.holidays.read',
    },
    {
      code: 'MASTER.SHIFT_DEFINITIONS',
      label: 'Shift',
      route: '/master/shift-definitions',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 19,
      permission_code: 'master.shift_definitions.read',
    },
    {
      code: 'MASTER.SHIFT_PATTERNS',
      label: 'Pola Rotasi Shift',
      route: '/master/shift-patterns',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 20,
      permission_code: 'master.shift_patterns.read',
    },
    {
      code: 'MASTER.SHIFT_ROTATIONS',
      label: 'Slot Rotasi Shift',
      route: '/master/shift-rotations',
      parent_code: 'MASTER',
      platform: 'BOTH',
      sort_order: 21,
      permission_code: 'master.shift_rotations.read',
    },
    {
      code: 'CONFIG',
      label: 'Pengaturan',
      icon: 'Settings',
      platform: 'BOTH',
      sort_order: 20,
      permission_code: 'config.format.read',
    },
    {
      code: 'CONFIG.FORMATS',
      label: 'Format',
      route: '/config/formats',
      parent_code: 'CONFIG',
      platform: 'BOTH',
      sort_order: 21,
      permission_code: 'config.format.read',
    },
    {
      code: 'CONFIG.VALIDATION',
      label: 'Validasi',
      route: '/config/validation',
      parent_code: 'CONFIG',
      platform: 'BOTH',
      sort_order: 22,
      permission_code: 'config.validation.read',
    },
    {
      code: 'CONFIG.SEQUENCES',
      label: 'Nomor Urut',
      route: '/config/sequences',
      parent_code: 'CONFIG',
      platform: 'BOTH',
      sort_order: 23,
      permission_code: 'config.sequence.read',
    },
    // HR operational modules (S7 → v2)
    {
      code: 'LEAVE',
      label: 'Cuti & Izin',
      icon: 'CalendarDays',
      platform: 'BOTH',
      sort_order: 30,
      permission_code: 'leave.request.read',
    },
    {
      code: 'LEAVE.REQUESTS',
      label: 'Pengajuan Cuti',
      route: '/cuti',
      parent_code: 'LEAVE',
      platform: 'BOTH',
      sort_order: 31,
      permission_code: 'leave.request.read',
    },
    {
      code: 'LEAVE.PERMITS',
      label: 'Pengajuan Izin',
      route: '/izin',
      parent_code: 'LEAVE',
      platform: 'BOTH',
      sort_order: 32,
      permission_code: 'leave.request.read',
    },
    {
      code: 'OVERTIME',
      label: 'Lembur',
      icon: 'Clock',
      platform: 'BOTH',
      sort_order: 40,
      permission_code: 'overtime.request.read',
    },
    {
      code: 'OVERTIME.REQUESTS',
      label: 'Pengajuan',
      route: '/overtime',
      parent_code: 'OVERTIME',
      platform: 'BOTH',
      sort_order: 41,
      permission_code: 'overtime.request.read',
    },
    {
      code: 'PERDIN',
      label: 'Perjalanan Dinas',
      icon: 'Plane',
      platform: 'BOTH',
      sort_order: 50,
      permission_code: 'perdin.request.read',
    },
    {
      code: 'PERDIN.REQUESTS',
      label: 'Pengajuan',
      route: '/perdin',
      parent_code: 'PERDIN',
      platform: 'BOTH',
      sort_order: 51,
      permission_code: 'perdin.request.read',
    },
    {
      code: 'PINJAMAN',
      label: 'Pinjaman',
      icon: 'Wallet',
      platform: 'BOTH',
      sort_order: 60,
      permission_code: 'loan.request.read',
    },
    {
      code: 'PINJAMAN.REQUESTS',
      label: 'Pengajuan',
      route: '/pinjaman',
      parent_code: 'PINJAMAN',
      platform: 'BOTH',
      sort_order: 61,
      permission_code: 'loan.request.read',
    },
    {
      code: 'LICENSE',
      label: 'Pembiayaan SIM',
      icon: 'IdCard',
      platform: 'BOTH',
      sort_order: 70,
      permission_code: 'license.request.read',
    },
    {
      code: 'LICENSE.REQUESTS',
      label: 'Pengajuan',
      route: '/sim',
      parent_code: 'LICENSE',
      platform: 'BOTH',
      sort_order: 71,
      permission_code: 'license.request.read',
    },
    {
      code: 'ATTENDANCE',
      label: 'Kehadiran',
      icon: 'Fingerprint',
      platform: 'BOTH',
      sort_order: 80,
      permission_code: 'attendance.daily.read',
    },
    {
      code: 'ATTENDANCE.DAILY',
      label: 'Rekap Harian',
      route: '/attendance',
      parent_code: 'ATTENDANCE',
      platform: 'BOTH',
      sort_order: 81,
      permission_code: 'attendance.daily.read',
    },
    // M2B — roster (shift config + calendar)
    {
      code: 'ROSTER',
      label: 'Roster',
      icon: 'CalendarDays',
      platform: 'BOTH',
      sort_order: 85,
      permission_code: 'roster.calendar.read',
    },
    {
      code: 'ROSTER.CALENDAR',
      label: 'Kalender Roster',
      route: '/roster',
      parent_code: 'ROSTER',
      platform: 'BOTH',
      sort_order: 86,
      permission_code: 'roster.calendar.read',
    },
    {
      code: 'ROSTER.SHIFTS',
      label: 'Konfigurasi Shift',
      route: '/roster?tab=shifts',
      parent_code: 'ROSTER',
      platform: 'BOTH',
      sort_order: 87,
      permission_code: 'roster.shift.read',
    },
    {
      code: 'ROSTER.DELEGATIONS',
      label: 'Delegasi Roster',
      route: '/roster?tab=delegations',
      parent_code: 'ROSTER',
      platform: 'BOTH',
      sort_order: 88,
      permission_code: 'roster.delegation.read',
    },
    // M6 — payroll (BRD §11.4)
    {
      code: 'PAYROLL',
      label: 'Payroll',
      icon: 'Calculator',
      platform: 'BOTH',
      sort_order: 90,
      permission_code: 'payroll.period.read',
    },
    {
      code: 'PAYROLL.PERIODS',
      label: 'Periode Penggajian',
      route: '/payroll/periods',
      parent_code: 'PAYROLL',
      platform: 'BOTH',
      sort_order: 91,
      permission_code: 'payroll.period.read',
    },
    {
      code: 'PAYROLL.FEEDER',
      label: 'Payroll Feeder',
      route: '/payroll/feeder',
      parent_code: 'PAYROLL',
      platform: 'BOTH',
      sort_order: 92,
      permission_code: 'payroll.feeder.read',
    },
  ];
  const menuIdByCode = new Map<string, string>();
  for (const m of menusSeed) {
    const permission = m.permission_code ? (permissionIds.get(m.permission_code) ?? null) : null;
    const parent = m.parent_code ? (menuIdByCode.get(m.parent_code) ?? null) : null;
    const row = await prisma.menus.upsert({
      where: { code: m.code },
      create: {
        code: m.code,
        label: m.label,
        icon: m.icon ?? null,
        route: m.route ?? null,
        platform: m.platform,
        sort_order: m.sort_order,
        parent_id: parent,
        permission_code: permission,
      },
      update: {
        label: m.label,
        icon: m.icon ?? null,
        route: m.route ?? null,
        platform: m.platform,
        sort_order: m.sort_order,
        parent_id: parent,
        permission_code: permission,
      },
    });
    menuIdByCode.set(m.code, row.id);
  }
  console.log(`✔ ${menusSeed.length} menu`);

  console.log('✅ Seed selesai. Demo login: admin@lahans.dev / Lahans@2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
