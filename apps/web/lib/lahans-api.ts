'use client';

import { api } from './api';

// ---------------------------------------------------------------------------
// Auth (M0)
// ---------------------------------------------------------------------------

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function loginRequest(identifier: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ identifier, password }),
  });
}

export interface MeResponse {
  userId: string;
  employeeId: string;
  loginNik: string;
  email: string;
  groups: string[];
  permissions: string[];
  scopes: Record<string, string>;
}

export async function meRequest(): Promise<MeResponse> {
  return api<MeResponse>('/api/auth/me');
}

// ---------------------------------------------------------------------------
// M0 — dynamic navigation (BRD §13 rule 8: never a static array in frontend)
// ---------------------------------------------------------------------------

export interface NavMenu {
  code: string;
  label: string;
  icon?: string;
  route?: string;
  children: NavMenu[];
}

export interface NavigationResponse {
  platform: string;
  menus: NavMenu[];
  cache_ttl_seconds: number;
}

export async function navigationRequest(
  platform: 'WEB' | 'MOBILE' | 'BOTH' = 'BOTH',
): Promise<NavigationResponse> {
  return api<NavigationResponse>(`/api/auth/me/navigation?platform=${platform}`);
}

// ---------------------------------------------------------------------------
// M8B — config
// ---------------------------------------------------------------------------

export interface FormatSetting {
  format_key: string;
  format_value: string;
  data_type: 'STRING' | 'NUMBER' | 'JSON';
  applies_to: 'WEB' | 'MOBILE' | 'BOTH' | 'EXPORT';
  description?: string | null;
  is_editable: boolean;
  updated_at: string;
}

export async function listFormats(): Promise<FormatSetting[]> {
  return api<FormatSetting[]>('/api/config/formats');
}

export async function upsertFormat(
  formatKey: string,
  body: Partial<FormatSetting>,
): Promise<FormatSetting> {
  return api<FormatSetting>(`/api/config/formats/${encodeURIComponent(formatKey)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteFormat(formatKey: string): Promise<void> {
  await api(`/api/config/formats/${encodeURIComponent(formatKey)}`, { method: 'DELETE' });
}

export interface ValidationRule {
  id: string;
  entity_name: string;
  field_name: string;
  rule_type: string;
  rule_config: Record<string, unknown>;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  error_message: string;
  applies_on: string;
  is_active: boolean;
  sort_order: number;
}

export interface ListResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  rows: T[];
}

export async function listValidationRules(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<ListResponse<ValidationRule>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.search) q.set('search', params.search);
  const qs = q.toString();
  return api<ListResponse<ValidationRule>>(`/api/config/validation-rules${qs ? `?${qs}` : ''}`);
}

export async function createValidationRule(
  body: Omit<ValidationRule, 'id' | 'is_active' | 'sort_order'> & {
    is_active?: boolean;
    sort_order?: number;
  },
): Promise<ValidationRule> {
  return api<ValidationRule>('/api/config/validation-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateValidationRule(
  id: string,
  body: Partial<ValidationRule>,
): Promise<ValidationRule> {
  return api<ValidationRule>(`/api/config/validation-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteValidationRule(id: string): Promise<void> {
  await api(`/api/config/validation-rules/${id}`, { method: 'DELETE' });
}

export interface NumberSequence {
  sequence_code: string;
  sequence_pattern: string;
  reset_period: 'NEVER' | 'YEARLY' | 'MONTHLY';
  padding_length: number;
  allow_manual: boolean;
  scope_type?: string | null;
  scope_ref_id?: string | null;
  current_number: string;
  updated_at: string;
}

export async function listNumberSequences(): Promise<NumberSequence[]> {
  return api<NumberSequence[]>('/api/config/number-sequences');
}

export async function upsertNumberSequence(
  sequenceCode: string,
  body: Partial<NumberSequence>,
): Promise<NumberSequence> {
  return api<NumberSequence>(`/api/config/number-sequences/${encodeURIComponent(sequenceCode)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function reserveNextNumber(
  sequenceCode: string,
): Promise<{ nextNumber: string; sequenceCode: string }> {
  return api<{ nextNumber: string; sequenceCode: string }>(
    `/api/config/number-sequences/${encodeURIComponent(sequenceCode)}/reserve`,
    { method: 'POST' },
  );
}

// ---------------------------------------------------------------------------
// M1B — master data
// ---------------------------------------------------------------------------

export async function masterList<T = Record<string, unknown>>(
  entity: string,
  params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    asOf?: string;
    /** Exact-match filters (per-entity allow-list enforced server-side). */
    filters?: Record<string, string>;
  },
): Promise<ListResponse<T>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.search) q.set('search', params.search);
  if (params?.asOf) q.set('asOf', params.asOf);
  for (const [k, v] of Object.entries(params?.filters ?? {})) {
    if (v && v !== '') q.set(k, v);
  }
  const qs = q.toString();
  return api<ListResponse<T>>(`/api/master/${entity}${qs ? `?${qs}` : ''}`);
}

export async function masterGet<T = Record<string, unknown>>(
  entity: string,
  id: string,
): Promise<T> {
  return api<T>(`/api/master/${entity}/${id}`);
}

export async function masterCreate<T = Record<string, unknown>>(
  entity: string,
  body: Record<string, unknown>,
): Promise<T> {
  return api<T>(`/api/master/${entity}`, { method: 'POST', body: JSON.stringify(body) });
}

export async function masterUpdate<T = Record<string, unknown>>(
  entity: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  return api<T>(`/api/master/${entity}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function masterDelete(entity: string, id: string): Promise<void> {
  await api(`/api/master/${entity}/${id}`, { method: 'DELETE' });
}

// -- bulk actions (Ticket 03 — employee list toolbar) -------------------------

export async function bulkDeactivateEmployees(ids: string[]): Promise<{ deactivated: number }> {
  return api<{ deactivated: number }>('/api/master/employees/bulk-deactivate', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function bulkDeleteEmployees(ids: string[]): Promise<{ deleted: number }> {
  return api<{ deleted: number }>('/api/master/employees/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// ---------------------------------------------------------------------------
// S7 — leave (cuti & izin)
// ---------------------------------------------------------------------------

export interface LeaveBalanceRow {
  leave_type_id: string;
  code: string;
  name: string;
  entitlement_days: string;
  prorate_days: string;
  carried_over_days: string;
  used_days: string;
  advance_used_days: string;
  pending_days: string;
  balance_days: string;
}

export interface LeaveRequestRow {
  id: string;
  doc_number: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: string;
  is_emergency: boolean;
  is_backdated: boolean;
  status: string;
  reason?: string | null;
  submitted_at: string;
  decided_at?: string | null;
  leave_type?: { code: string; name: string } | null;
  days?: { leave_date: string; day_portion: string }[];
}

export async function getLeaveBalance(opts?: {
  employeeId?: string;
  asOf?: string;
}): Promise<LeaveBalanceRow[]> {
  const q = new URLSearchParams();
  if (opts?.employeeId) q.set('employeeId', opts.employeeId);
  if (opts?.asOf) q.set('asOf', opts.asOf);
  const qs = q.toString();
  return api<LeaveBalanceRow[]>(`/api/leave/balance${qs ? `?${qs}` : ''}`);
}

export async function getLeaveLedger(leaveTypeId?: string): Promise<unknown[]> {
  const q = leaveTypeId ? `?leaveTypeId=${encodeURIComponent(leaveTypeId)}` : '';
  return api<unknown[]>(`/api/leave/ledger${q}`);
}

export async function listLeaveRequests(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<LeaveRequestRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<LeaveRequestRow>>(`/api/leave/requests${qs ? `?${qs}` : ''}`);
}

export async function createLeaveRequest(body: {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  is_emergency?: boolean;
  is_backdated?: boolean;
  attachment_urls?: string;
}): Promise<LeaveRequestRow> {
  return api<LeaveRequestRow>('/api/leave/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function decideLeaveRequest(
  id: string,
  action: 'APPROVE' | 'REJECT' | 'RETURN',
  comment?: string,
): Promise<{ id: string; status: string }> {
  return api<{ id: string; status: string }>(`/api/leave/requests/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ action, comment }),
  });
}

export async function cancelLeaveRequest(id: string): Promise<{ id: string; status: string }> {
  return api<{ id: string; status: string }>(`/api/leave/requests/${id}/cancel`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// S8 — overtime (lebur)
// ---------------------------------------------------------------------------

export interface OvertimeRequestRow {
  id: string;
  doc_number: string;
  employee_id: string;
  overtime_date: string;
  day_type: string;
  planned_hours: string;
  actual_hours?: string | null;
  rate_rule_id?: string | null;
  calculated_amount?: string | null;
  calculation_trace?: Record<string, unknown> | null;
  reason?: string | null;
  status: string;
  approval_instance_id?: string | null;
  created_at: string;
}

export async function listOvertimeRequests(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<OvertimeRequestRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<OvertimeRequestRow>>(`/api/overtime/requests${qs ? `?${qs}` : ''}`);
}

export async function createOvertimeRequest(body: {
  overtime_date: string;
  planned_hours: number;
  reason?: string;
}): Promise<OvertimeRequestRow> {
  return api<OvertimeRequestRow>('/api/overtime/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function decideOvertimeRequest(
  id: string,
  action: 'APPROVE' | 'REJECT' | 'RETURN',
  opts?: { comment?: string; actual_hours?: number },
): Promise<{ id: string; status: string; amount?: string | null }> {
  return api<{ id: string; status: string; amount?: string | null }>(
    `/api/overtime/requests/${id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({ action, ...opts }),
    },
  );
}

export async function cancelOvertimeRequest(id: string): Promise<{ id: string; status: string }> {
  return api<{ id: string; status: string }>(`/api/overtime/requests/${id}/cancel`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// M6 — payroll feeder (periods + feeder, data-scoped)
// ---------------------------------------------------------------------------

export interface PayrollPeriodRow {
  id: string;
  code: string;
  cutoff_start: string;
  cutoff_end: string;
  payment_date: string | null;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
  closed_by: string | null;
  closed_at: string | null;
  company?: { code: string; legal_name: string } | null;
}

export interface FeederLineRow {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  component_code: string;
  quantity: string | null;
  amount: string | null;
  is_manual_override: boolean;
  override_reason?: string | null;
  calculation_trace?: Record<string, unknown> | null;
  employee?: { nik: string; full_name: string } | null;
}

export interface PeriodBlockers {
  ok: boolean;
  blockers: Array<{
    code: string;
    type: string;
    detail: string;
    docNumber?: string;
    employee?: string;
  }>;
}

export async function listPayrollPeriods(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<PayrollPeriodRow> & { scope: boolean }> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<PayrollPeriodRow> & { scope: boolean }>(
    `/api/payroll/periods${qs ? `?${qs}` : ''}`,
  );
}

export async function createPayrollPeriod(body: {
  code: string;
  cutoff_start: string;
  cutoff_end: string;
  payment_date?: string;
}): Promise<PayrollPeriodRow> {
  return api<PayrollPeriodRow>('/api/payroll/periods', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function validatePayrollPeriod(id: string): Promise<PeriodBlockers> {
  return api<PeriodBlockers>(`/api/payroll/periods/${id}/validate`, { method: 'POST' });
}

export async function lockPayrollPeriod(
  id: string,
): Promise<{ id: string; status: string; aggregatedEmployees: number; aggregatedLines: number }> {
  return api(`/api/payroll/periods/${id}/lock`, { method: 'POST' });
}

export async function closePayrollPeriod(id: string): Promise<PayrollPeriodRow> {
  return api<PayrollPeriodRow>(`/api/payroll/periods/${id}/close`, { method: 'POST' });
}

export async function listFeederLines(
  periodId: string,
  params?: { page?: number; pageSize?: number },
): Promise<ListResponse<FeederLineRow> & { periodStatus: string }> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<FeederLineRow> & { periodStatus: string }>(
    `/api/payroll/periods/${periodId}/feeder${qs ? `?${qs}` : ''}`,
  );
}

export async function getFeederTrace(lineId: string): Promise<FeederLineRow> {
  return api<FeederLineRow>(`/api/payroll/feeder-lines/${lineId}/trace`);
}

export async function overrideFeederLine(
  lineId: string,
  body: { amount: number; reason?: string },
): Promise<FeederLineRow> {
  return api<FeederLineRow>(`/api/payroll/feeder-lines/${lineId}/override`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function exportFeederUrl(periodId: string): string {
  return `/api/payroll/periods/${periodId}/feeder/export`;
}

// ---------------------------------------------------------------------------
// S6 — attendance (absensi)
// ---------------------------------------------------------------------------

export interface AttendanceDailyRow {
  id: string;
  employee_id: string;
  work_date: string;
  schedule_id?: string | null;
  first_in_at?: string | null;
  last_out_at?: string | null;
  status: string;
  late_minutes: number;
  early_leave_minutes: number;
  work_minutes: number;
  overtime_minutes: number;
  source: string;
  is_anomaly: boolean;
  anomaly_reasons?: unknown[] | null;
  employee?: { nik: string; full_name: string } | null;
}

export interface AttendanceToday {
  date: string;
  daily: AttendanceDailyRow | null;
  lastLog: {
    id: string;
    log_type: 'IN' | 'OUT';
    server_time: string;
    is_out_of_zone: boolean;
  } | null;
  logs: Array<{
    id: string;
    log_type: 'IN' | 'OUT';
    server_time: string;
    is_out_of_zone: boolean;
  }>;
  schedule: {
    scheduleId: string | null;
    start_time: string | null;
    end_time: string | null;
    break_minutes: number;
    late_tolerance_minutes: number;
    is_working_day: boolean;
  } | null;
  geofence: {
    radius: number;
    policy: string;
    branchLatitude: string | null;
    branchLongitude: string | null;
  };
}

export interface ClockResult {
  log: { id: string; log_type: string; server_time: string };
  idempotent: boolean;
  geofence?: {
    distance: number | null;
    out_of_zone: boolean;
    radius: number;
    policy: string;
    noData: boolean;
  };
}

export async function clockIn(body: {
  log_type: 'IN' | 'OUT';
  latitude?: string;
  longitude?: string;
  gps_accuracy_m?: number;
  is_mock_location?: boolean;
  is_offline_sync?: boolean;
  device_time?: string;
  client_request_id: string;
}): Promise<ClockResult> {
  return api<ClockResult>('/api/attendance/clock', { method: 'POST', body: JSON.stringify(body) });
}

export async function getAttendanceToday(): Promise<AttendanceToday> {
  return api<AttendanceToday>('/api/attendance/today');
}

export async function listAttendanceDaily(params?: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  employeeId?: string;
}): Promise<ListResponse<AttendanceDailyRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  const qs = q.toString();
  return api<ListResponse<AttendanceDailyRow>>(`/api/attendance/daily${qs ? `?${qs}` : ''}`);
}

export async function finalizeAttendanceDaily(body: {
  date: string;
  employee_id?: string;
}): Promise<{ date: string; finalized: number }> {
  return api('/api/attendance/daily/finalize', { method: 'POST', body: JSON.stringify(body) });
}

export interface AttendanceCorrectionRow {
  id: string;
  attendance_daily_id: string;
  requested_by: string;
  reason_code: string;
  notes?: string | null;
  proposed_values?: Record<string, unknown> | null;
  approval_instance_id?: string | null;
  status: string;
  created_at: string;
  attendance_daily?:
    (AttendanceDailyRow & { employee?: { nik: string; full_name: string } | null }) | null;
}

export async function listCorrections(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<AttendanceCorrectionRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<AttendanceCorrectionRow>>(
    `/api/attendance/corrections${qs ? `?${qs}` : ''}`,
  );
}

export interface CorrectionInboxRow {
  id: string;
  document_type: string;
  document_id: string;
  workflow_id: string;
  current_step_order: number;
  status: string;
  started_at: string;
  correction?:
    | (AttendanceCorrectionRow & {
        attendance_daily?:
          | (AttendanceDailyRow & {
              employee?: { nik: string; full_name: string } | null;
            })
          | null;
      })
    | null;
}

export async function listCorrectionInbox(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<CorrectionInboxRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api<ListResponse<CorrectionInboxRow>>(
    `/api/attendance/corrections/inbox${qs ? `?${qs}` : ''}`,
  );
}

export async function createCorrection(body: {
  attendance_daily_id: string;
  reason_code: string;
  notes?: string;
  proposed_values?: Record<string, unknown>;
}): Promise<AttendanceCorrectionRow> {
  return api<AttendanceCorrectionRow>('/api/attendance/corrections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function decideCorrection(
  id: string,
  action: 'APPROVE' | 'REJECT' | 'RETURN',
  comment?: string,
): Promise<{ id: string; status: string }> {
  return api<{ id: string; status: string }>(`/api/attendance/corrections/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ action, comment }),
  });
}

export async function cancelCorrection(id: string): Promise<{ id: string; status: string }> {
  return api<{ id: string; status: string }>(`/api/attendance/corrections/${id}/cancel`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// M2B — roster (shift config + calendar + delegation)
// ---------------------------------------------------------------------------

export interface ShiftDefinitionRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  late_tolerance_minutes: number;
  crosses_midnight: boolean;
  cover_end_date: boolean;
  is_active: boolean;
}

export interface ShiftRotationRow {
  id: string;
  day_index: number;
  shift_definition_id: string | null;
  is_working_day: boolean;
  shift_definition?: { code: string; name: string } | null;
}

export interface ShiftPatternRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  cycle_length: number;
  is_active: boolean;
  rotations?: ShiftRotationRow[];
}

export interface RosterCalendarRow {
  employee_id: string;
  nik: string;
  full_name: string;
  work_date: string;
  shift_code: string | null;
  start_time: string | null;
  end_time: string | null;
  is_working_day: boolean;
  crosses_midnight: boolean;
  source: 'SCHEDULE' | 'OVERRIDE';
  override: { work_schedule_id: string | null; is_day_off: boolean; reason: string } | null;
}

export interface RosterCalendarResponse {
  branchId: string | null;
  from: string;
  to: string;
  rows: RosterCalendarRow[];
}

/** Active-schedule snapshot for the employee detail "Jadwal Kerja" card (Ticket 04). */
export interface EmployeeScheduleRow {
  schedule: {
    id: string;
    code: string;
    name: string;
    schedule_type: string;
  } | null;
  scope: { type: string; refId: string; priority: number } | null;
  window: {
    scheduleId: string | null;
    shiftCode: string | null;
    start_time: string | null;
    end_time: string | null;
    break_minutes: number;
    late_tolerance_minutes: number;
    is_working_day: boolean;
    crosses_midnight: boolean;
  } | null;
}

export async function getEmployeeSchedule(
  employeeId: string,
  params?: { date?: string },
): Promise<EmployeeScheduleRow> {
  const qs = params?.date ? `?date=${encodeURIComponent(params.date)}` : '';
  return api<EmployeeScheduleRow>(`/api/roster/employees/${employeeId}/schedule${qs}`);
}

export interface ScheduleOverrideRow {
  id: string;
  employee_id: string;
  work_date: string;
  work_schedule_id: string | null;
  is_day_off: boolean;
  reason: string;
  employee?: { nik: string; full_name: string } | null;
}

export interface RosterDelegationRow {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  module_codes?: unknown;
  start_date: string;
  end_date: string;
  reason: string;
  is_active: boolean;
  delegator?: { login_nik: string; employee?: { full_name: string } | null } | null;
  delegate?: { login_nik: string; employee?: { full_name: string } | null } | null;
}

export async function listShifts(): Promise<ShiftDefinitionRow[]> {
  return api<ShiftDefinitionRow[]>('/api/roster/shifts');
}

export async function createShift(body: {
  code: string;
  name: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  late_tolerance_minutes?: number;
  crosses_midnight?: boolean;
}): Promise<ShiftDefinitionRow> {
  return api<ShiftDefinitionRow>('/api/roster/shifts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateShift(
  id: string,
  body: Partial<ShiftDefinitionRow>,
): Promise<ShiftDefinitionRow> {
  return api<ShiftDefinitionRow>(`/api/roster/shifts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteShift(id: string): Promise<void> {
  await api(`/api/roster/shifts/${id}`, { method: 'DELETE' });
}

export async function listShiftPatterns(): Promise<ShiftPatternRow[]> {
  return api<ShiftPatternRow[]>('/api/roster/patterns');
}

export async function listRosterCalendar(params: {
  from: string;
  to: string;
  branchId?: string;
}): Promise<RosterCalendarResponse> {
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  if (params.branchId) q.set('branchId', params.branchId);
  return api<RosterCalendarResponse>(`/api/roster/calendar?${q.toString()}`);
}

export async function listScheduleOverrides(params?: {
  from?: string;
  to?: string;
  employeeId?: string;
}): Promise<ScheduleOverrideRow[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  const qs = q.toString();
  return api<ScheduleOverrideRow[]>(`/api/roster/overrides${qs ? `?${qs}` : ''}`);
}

export async function createScheduleOverride(body: {
  employee_id: string;
  work_date: string;
  work_schedule_id?: string;
  is_day_off?: boolean;
  reason: string;
}): Promise<ScheduleOverrideRow> {
  return api<ScheduleOverrideRow>('/api/roster/overrides', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function assignSchedules(
  scheduleId: string,
  employee_ids: string[],
): Promise<{ assigned: number }> {
  return api<{ assigned: number }>(`/api/roster/schedules/${scheduleId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ employee_ids }),
  });
}

export async function listRosterDelegations(): Promise<{
  mine: RosterDelegationRow[];
  delegatingToMe: string[];
}> {
  return api<{ mine: RosterDelegationRow[]; delegatingToMe: string[] }>('/api/roster/delegations');
}

export async function createRosterDelegation(body: {
  delegate_user_id: string;
  module_codes?: string[];
  start_date: string;
  end_date: string;
  reason: string;
}): Promise<RosterDelegationRow> {
  return api<RosterDelegationRow>('/api/roster/delegations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cancelRosterDelegation(id: string): Promise<RosterDelegationRow> {
  return api<RosterDelegationRow>(`/api/roster/delegations/${id}`, { method: 'DELETE' });
}
