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
  params?: { page?: number; pageSize?: number; search?: string; asOf?: string },
): Promise<ListResponse<T>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.search) q.set('search', params.search);
  if (params?.asOf) q.set('asOf', params.asOf);
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
