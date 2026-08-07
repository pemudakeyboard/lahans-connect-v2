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
import { PrismaClient } from '../src/generated/prisma';
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
  // attendance (shell)
  'attendance.log.read',
  'attendance.log.write',
  // leave (shell)
  'leave.request.read',
  'leave.request.write',
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
    { category: 'MARITAL_STATUS', code: 'LAJANG', label: 'Lajang', sort_order: 1 },
    { category: 'MARITAL_STATUS', code: 'MENIKAH', label: 'Menikah', sort_order: 2 },
    { category: 'MARITAL_STATUS', code: 'CERAI', label: 'Cerai', sort_order: 3 },
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
  // Leave (BRD §5.3.1)
  { param_key: 'LEAVE.ANNUAL_DAYS', param_value: '12', data_type: 'NUMBER', effective_from: ASOF },
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
    pattern: 'C/YYYY/{SEQ}',
    reset_period: 'YEARLY',
    padding_length: 4,
  },
  { sequence_code: 'DOC_IZIN', pattern: 'I/YYYY/{SEQ}', reset_period: 'YEARLY', padding_length: 4 },
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
    const [mod, res, act] = code.split('.');
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
  console.log('✔ master data org');

  // ---------- Demo employee + user ----------
  const demoEmployee = await prisma.employees.upsert({
    where: { nik: DEMO_ADMIN_NIK },
    create: {
      nik: DEMO_ADMIN_NIK,
      full_name: 'Admin Demo',
      email: 'admin@lahans.dev',
      phone: '081234567890',
      branch_id: branch.id,
      job_position_id: position.id,
      join_date: new Date('2024-01-01'),
      employment_status: 'AKTIF',
    },
    update: {},
  });
  const passwordHash = await argon2.hash('Lahans@2026', {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 2,
    outputLen: 32,
  });
  const demoUser = await prisma.users.upsert({
    where: { login_nik: DEMO_ADMIN_NIK },
    create: {
      employee_id: demoEmployee.id,
      login_nik: DEMO_ADMIN_NIK,
      email: 'admin@lahans.dev',
      password_hash: passwordHash,
      status: 'ACTIVE',
      must_change_password: false,
    },
    update: { employee_id: demoEmployee.id, email: 'admin@lahans.dev' },
  });
  // Assign to SUPER_ADMIN
  await prisma.user_group_members.upsert({
    where: { user_id_group_id: { user_id: demoUser.id, group_id: groupIds.get('SUPER_ADMIN')! } },
    create: { user_id: demoUser.id, group_id: groupIds.get('SUPER_ADMIN')! },
    update: {},
  });
  console.log(`✔ demo user ${DEMO_ADMIN_NIK} (password: Lahans@2026)`);

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
