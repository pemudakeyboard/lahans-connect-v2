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

export async function loginRequest(
  identifier: string,
  password: string,
  otp?: string,
): Promise<LoginResponse> {
  return api<LoginResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ identifier, password, ...(otp ? { otp } : {}) }),
  });
}

export interface MeResponse {
  userId: string;
  employeeId: string;
  loginNik: string;
  email: string;
  groups: string[];
  permissions: string[];
}

export async function meRequest(): Promise<MeResponse> {
  return api<MeResponse>('/api/auth/me');
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
  current_value: number;
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
