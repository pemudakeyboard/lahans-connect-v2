-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "bpjs_rate_profile" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "geofence_radius_m" INTEGER NOT NULL DEFAULT 150,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "attendance_policy" TEXT NOT NULL DEFAULT 'GEOFENCE_TRACKED',
    "city_tier" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divisions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_grades" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level_order" INTEGER NOT NULL DEFAULT 0,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" UUID NOT NULL,
    "department_id" UUID,
    "job_grade_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "nik" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "birth_date" TIMESTAMP(3),
    "birth_place" TEXT,
    "id_card_no" TEXT,
    "tax_id" TEXT,
    "marital_status" TEXT,
    "dependents_count" INTEGER NOT NULL DEFAULT 0,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "join_date" TIMESTAMP(3),
    "employment_status" TEXT NOT NULL DEFAULT 'AKTIF',
    "resign_date" TIMESTAMP(3),
    "leave_eligible" BOOLEAN NOT NULL DEFAULT true,
    "photo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "branch_id" UUID,
    "job_position_id" UUID,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "department_id" UUID,
    "job_position_id" UUID,
    "job_grade_id" UUID,
    "contract_type" TEXT,
    "contract_start" TIMESTAMP(3),
    "contract_end" TIMESTAMP(3),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_lines" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "supervisor_id" UUID NOT NULL,
    "line_type" TEXT NOT NULL DEFAULT 'DIRECT',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT,
    "issued_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_url" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "login_nik" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "requires_2fa" BOOLEAN NOT NULL DEFAULT false,
    "max_session_minutes" INTEGER,
    "allowed_ip_cidr" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "is_dangerous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_permissions" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "data_scope" TEXT NOT NULL DEFAULT 'SELF',
    "scope_config" JSONB,
    "masked_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" TEXT NOT NULL,
    "data_scope" TEXT,
    "reason" TEXT NOT NULL,
    "granted_by" UUID NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scope_bindings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_ref_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_scope_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "route" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'BOTH',
    "permission_code" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_fields" (
    "id" UUID NOT NULL,
    "entity_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "default_masked" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL,
    "delegator_user_id" UUID NOT NULL,
    "delegate_user_id" UUID NOT NULL,
    "module_codes" JSONB NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "fcm_token" TEXT,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "weekly_target_minutes" INTEGER,
    "daily_standard_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_days" (
    "id" UUID NOT NULL,
    "work_schedule_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TEXT,
    "end_time" TEXT,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" UUID NOT NULL,
    "work_schedule_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_ref_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_overrides" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "work_schedule_id" UUID,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "holiday_type" TEXT NOT NULL,
    "deducts_annual_leave" BOOLEAN NOT NULL DEFAULT false,
    "region_scope" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "log_type" TEXT NOT NULL,
    "server_time" TIMESTAMP(3) NOT NULL,
    "device_time" TIMESTAMP(3),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "gps_accuracy_m" DECIMAL(8,2),
    "photo_url" TEXT,
    "branch_id" UUID,
    "distance_from_geofence_m" DECIMAL(10,2),
    "is_out_of_zone" BOOLEAN NOT NULL DEFAULT false,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false,
    "is_offline_sync" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT,
    "app_version" TEXT,
    "raw_payload" JSONB,
    "client_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_daily" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "schedule_id" UUID,
    "first_in_at" TIMESTAMP(3),
    "last_out_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "work_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MOBILE',
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomaly_reasons" JSONB,
    "payroll_period_id" UUID,
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "attendance_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "attendance_daily_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "notes" TEXT,
    "proposed_values" JSONB,
    "approval_instance_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deduct_quota" BOOLEAN NOT NULL DEFAULT false,
    "deduct_salary" BOOLEAN NOT NULL DEFAULT false,
    "salary_deduction_formula_code" TEXT,
    "max_days_per_request" INTEGER,
    "min_notice_days" INTEGER,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "allow_backdate" BOOLEAN NOT NULL DEFAULT false,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT false,
    "gender_restriction" TEXT,
    "min_service_months" INTEGER,
    "workflow_code" TEXT,
    "affects_attendance_allowance" BOOLEAN NOT NULL DEFAULT true,
    "affects_meal_transport_allowance" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "entitlement_days" DECIMAL(6,2) NOT NULL,
    "prorate_days" DECIMAL(6,2) NOT NULL,
    "carried_over_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "advance_used_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "expired_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "balance_days" DECIMAL(6,2) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "doc_number" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DECIMAL(6,2) NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "attachment_urls" JSONB,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "is_backdated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_instance_id" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_days" (
    "id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "leave_date" TIMESTAMP(3) NOT NULL,
    "day_portion" TEXT NOT NULL DEFAULT 'FULL',
    "is_counted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "leave_request_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_ledger" (
    "id" UUID NOT NULL,
    "leave_balance_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_rate_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "job_grade_id" UUID NOT NULL,
    "day_type" TEXT NOT NULL,
    "calc_method" TEXT NOT NULL,
    "divisor" INTEGER,
    "multiplier" DECIMAL(6,3),
    "flat_amount" DECIMAL(18,2),
    "max_hours_per_day" INTEGER,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" UUID NOT NULL,
    "doc_number" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "overtime_date" TIMESTAMP(3) NOT NULL,
    "day_type" TEXT NOT NULL,
    "planned_start" TEXT,
    "planned_end" TEXT,
    "planned_hours" DECIMAL(6,2),
    "actual_hours" DECIMAL(6,2),
    "rate_rule_id" UUID,
    "calculated_amount" DECIMAL(18,2),
    "calculation_trace" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_instance_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_components" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL,
    "is_fixed_allowance" BOOLEAN NOT NULL DEFAULT false,
    "calc_method" TEXT NOT NULL DEFAULT 'FIXED',
    "formula_expression" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "bpjs_base" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_component_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payroll_component_id" UUID NOT NULL,
    "amount" DECIMAL(18,2),
    "qty" DECIMAL(10,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_component_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_allowance_rules" (
    "id" UUID NOT NULL,
    "rule_set_code" TEXT NOT NULL,
    "absence_days_min" INTEGER NOT NULL,
    "absence_days_max" INTEGER,
    "percentage" DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_allowance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpjs_rate_profiles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpjs_rate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpjs_rates" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "contribution_code" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "base_component_codes" JSONB,
    "salary_cap" DECIMAL(18,2),
    "rounding_rule" TEXT NOT NULL DEFAULT 'ROUND',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpjs_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "cutoff_start" TIMESTAMP(3) NOT NULL,
    "cutoff_end" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closed_by" UUID,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_feeder_lines" (
    "id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "component_code" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "amount" DECIMAL(18,2),
    "calculation_trace" JSONB,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "overridden_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_feeder_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "gross_amount" DECIMAL(18,2),
    "deduction_amount" DECIMAL(18,2),
    "net_amount" DECIMAL(18,2),
    "pdf_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "first_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_lines" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "component_code" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "amount" DECIMAL(18,2),
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_steps" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_ref" TEXT,
    "condition_expression" TEXT,
    "sla_working_days" INTEGER NOT NULL DEFAULT 2,
    "escalation_action" TEXT NOT NULL DEFAULT 'NOTIFY_THEN_ESCALATE',
    "allow_delegate" BOOLEAN NOT NULL DEFAULT true,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" UUID NOT NULL,
    "current_step_order" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tasks" (
    "id" UUID NOT NULL,
    "approval_instance_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "assignee_user_id" UUID NOT NULL,
    "delegated_from_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3),
    "acted_at" TIMESTAMP(3),
    "action" TEXT,
    "comments" TEXT,

    CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameters" (
    "id" UUID NOT NULL,
    "param_key" TEXT NOT NULL,
    "param_value" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_ref_id" UUID,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "description" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "format_settings" (
    "id" UUID NOT NULL,
    "format_key" TEXT NOT NULL,
    "format_value" TEXT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'STRING',
    "applies_to" TEXT NOT NULL DEFAULT 'BOTH',
    "description" TEXT,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "format_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "id" UUID NOT NULL,
    "entity_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_config" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "applies_on" TEXT NOT NULL DEFAULT 'ALL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" UUID NOT NULL,
    "sequence_code" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "reset_period" TEXT NOT NULL DEFAULT 'NEVER',
    "padding_length" INTEGER NOT NULL DEFAULT 4,
    "current_number" BIGINT NOT NULL DEFAULT 0,
    "last_reset_key" TEXT,
    "allow_manual" BOOLEAN NOT NULL DEFAULT false,
    "scope_type" TEXT,
    "scope_ref_id" UUID,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" UUID NOT NULL,
    "report_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "data_source" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "default_filters" JSONB,
    "group_by" JSONB,
    "output_formats" JSONB NOT NULL,
    "permission_code" TEXT,
    "header_template" TEXT,
    "footer_template" TEXT,
    "filename_pattern" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_data" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_policies" (
    "id" UUID NOT NULL,
    "policy_code" TEXT NOT NULL,
    "allowed_mime_types" JSONB NOT NULL,
    "max_size_kb" INTEGER NOT NULL,
    "max_width_px" INTEGER,
    "max_height_px" INTEGER,
    "compress_quality" INTEGER NOT NULL DEFAULT 70,
    "max_files" INTEGER NOT NULL DEFAULT 1,
    "retention_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "policy_code" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "storage_driver" TEXT NOT NULL DEFAULT 'local-disk',
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_orphan" BOOLEAN NOT NULL DEFAULT true,
    "purge_after" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_ter_categories" (
    "id" UUID NOT NULL,
    "category_code" TEXT NOT NULL,
    "ptkp_status" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_ter_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_ter_brackets" (
    "id" UUID NOT NULL,
    "category_code" TEXT NOT NULL,
    "income_from" DECIMAL(18,2) NOT NULL,
    "income_to" DECIMAL(18,2),
    "rate_percent" DECIMAL(6,3) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_ter_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_amount" DECIMAL(18,2),
    "max_tenor_months" INTEGER,
    "min_service_months" INTEGER,
    "max_per_year" INTEGER,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "workflow_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "doc_number" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "loan_type_id" UUID NOT NULL,
    "requested_amount" DECIMAL(18,2) NOT NULL,
    "tenor_months" INTEGER NOT NULL,
    "purpose" TEXT,
    "attachment_urls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_instance_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "principal_amount" DECIMAL(18,2) NOT NULL,
    "tenor_months" INTEGER NOT NULL,
    "monthly_installment" DECIMAL(18,2) NOT NULL,
    "outstanding_amount" DECIMAL(18,2) NOT NULL,
    "start_period_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_installments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perdiem_rates" (
    "id" UUID NOT NULL,
    "job_grade_id" UUID NOT NULL,
    "city_tier" TEXT NOT NULL,
    "expense_type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PER_DAY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perdiem_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_requests" (
    "id" UUID NOT NULL,
    "doc_number" TEXT NOT NULL,
    "requester_employee_id" UUID NOT NULL,
    "trip_type" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'PLANNED',
    "destination" TEXT NOT NULL,
    "depart_date" TIMESTAMP(3) NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_instance_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_participants" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TRAVELER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_budget_lines" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "expense_type" TEXT NOT NULL,
    "estimated_amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advances" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_no" TEXT,
    "disbursed_by" UUID,
    "disbursed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_reports" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "total_actual" DECIMAL(18,2),
    "variance_amount" DECIMAL(18,2),
    "settlement_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_expense_lines" (
    "id" UUID NOT NULL,
    "trip_report_id" UUID NOT NULL,
    "expense_type" TEXT NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receipt_url" TEXT,
    "has_valid_receipt" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_expense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_financings" (
    "id" UUID NOT NULL,
    "doc_number" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "license_type" TEXT NOT NULL,
    "old_license_no" TEXT,
    "old_expiry_date" TIMESTAMP(3),
    "total_cost" DECIMAL(18,2) NOT NULL,
    "company_share_pct" DECIMAL(5,2) NOT NULL,
    "company_amount" DECIMAL(18,2) NOT NULL,
    "employee_amount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approval_instance_id" TEXT,
    "new_license_no" TEXT,
    "new_license_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope_type" TEXT,
    "scope_ref_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "subject_template" TEXT,
    "body_template" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_code" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_holidaysTowork_schedules" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_holidaysTowork_schedules_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_is_active_idx" ON "companies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "branches_is_active_idx" ON "branches"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_code_key" ON "divisions"("code");

-- CreateIndex
CREATE INDEX "divisions_company_id_idx" ON "divisions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_division_id_idx" ON "departments"("division_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_code_key" ON "job_grades"("code");

-- CreateIndex
CREATE INDEX "job_grades_is_active_idx" ON "job_grades"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "job_positions_code_key" ON "job_positions"("code");

-- CreateIndex
CREATE INDEX "job_positions_job_grade_id_idx" ON "job_positions"("job_grade_id");

-- CreateIndex
CREATE INDEX "job_positions_is_active_idx" ON "job_positions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_nik_key" ON "employees"("nik");

-- CreateIndex
CREATE INDEX "employees_branch_id_idx" ON "employees"("branch_id");

-- CreateIndex
CREATE INDEX "employees_job_position_id_idx" ON "employees"("job_position_id");

-- CreateIndex
CREATE INDEX "employees_is_active_idx" ON "employees"("is_active");

-- CreateIndex
CREATE INDEX "employees_join_date_idx" ON "employees"("join_date");

-- CreateIndex
CREATE INDEX "employees_employment_status_idx" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "employee_assignments_employee_id_effective_from_idx" ON "employee_assignments"("employee_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "employee_assignments_employee_id_effective_to_idx" ON "employee_assignments"("employee_id", "effective_to");

-- CreateIndex
CREATE INDEX "reporting_lines_supervisor_id_effective_from_idx" ON "reporting_lines"("supervisor_id", "effective_from");

-- CreateIndex
CREATE INDEX "reporting_lines_employee_id_effective_from_idx" ON "reporting_lines"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_expiry_date_idx" ON "employee_documents"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_nik_key" ON "users"("login_nik");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_code_key" ON "user_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_members_user_id_group_id_key" ON "user_group_members"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "group_permissions_group_id_permission_id_key" ON "group_permissions"("group_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_user_id_permission_id_key" ON "user_permission_overrides"("user_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scope_bindings_user_id_scope_type_scope_ref_id_key" ON "user_scope_bindings"("user_id", "scope_type", "scope_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "menus_code_key" ON "menus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_fields_entity_name_field_name_key" ON "sensitive_fields"("entity_name", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_device_id_key" ON "user_devices"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_name_entity_id_idx" ON "audit_logs"("entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_code_key" ON "work_schedules"("code");

-- CreateIndex
CREATE INDEX "work_schedules_company_id_idx" ON "work_schedules"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_days_work_schedule_id_day_of_week_key" ON "work_schedule_days"("work_schedule_id", "day_of_week");

-- CreateIndex
CREATE INDEX "schedule_assignments_scope_type_scope_ref_id_idx" ON "schedule_assignments"("scope_type", "scope_ref_id");

-- CreateIndex
CREATE INDEX "schedule_assignments_work_schedule_id_idx" ON "schedule_assignments"("work_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_overrides_employee_id_work_date_key" ON "schedule_overrides"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_company_id_date_holiday_type_key" ON "holidays"("company_id", "date", "holiday_type");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_client_request_id_key" ON "attendance_logs"("client_request_id");

-- CreateIndex
CREATE INDEX "attendance_logs_employee_id_server_time_idx" ON "attendance_logs"("employee_id", "server_time" DESC);

-- CreateIndex
CREATE INDEX "attendance_logs_branch_id_idx" ON "attendance_logs"("branch_id");

-- CreateIndex
CREATE INDEX "attendance_daily_payroll_period_id_status_idx" ON "attendance_daily"("payroll_period_id", "status");

-- CreateIndex
CREATE INDEX "attendance_daily_is_anomaly_idx" ON "attendance_daily"("is_anomaly");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_daily_employee_id_work_date_key" ON "attendance_daily"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

-- CreateIndex
CREATE INDEX "leave_balances_expires_at_idx" ON "leave_balances"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_period_year_key" ON "leave_balances"("employee_id", "leave_type_id", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_doc_number_key" ON "leave_requests"("doc_number");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_submitted_at_idx" ON "leave_requests"("employee_id", "submitted_at");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_request_days_leave_request_id_idx" ON "leave_request_days"("leave_request_id");

-- CreateIndex
CREATE INDEX "leave_balance_ledger_leave_balance_id_created_at_idx" ON "leave_balance_ledger"("leave_balance_id", "created_at");

-- CreateIndex
CREATE INDEX "overtime_rate_rules_job_grade_id_day_type_effective_from_idx" ON "overtime_rate_rules"("job_grade_id", "day_type", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "overtime_requests_doc_number_key" ON "overtime_requests"("doc_number");

-- CreateIndex
CREATE INDEX "overtime_requests_employee_id_overtime_date_idx" ON "overtime_requests"("employee_id", "overtime_date");

-- CreateIndex
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_components_code_key" ON "payroll_components"("code");

-- CreateIndex
CREATE INDEX "payroll_components_is_active_idx" ON "payroll_components"("is_active");

-- CreateIndex
CREATE INDEX "employee_component_assignments_employee_id_effective_from_idx" ON "employee_component_assignments"("employee_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "attendance_allowance_rules_rule_set_code_effective_from_idx" ON "attendance_allowance_rules"("rule_set_code", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bpjs_rate_profiles_code_key" ON "bpjs_rate_profiles"("code");

-- CreateIndex
CREATE INDEX "bpjs_rates_profile_id_contribution_code_effective_from_idx" ON "bpjs_rates"("profile_id", "contribution_code", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_code_key" ON "payroll_periods"("code");

-- CreateIndex
CREATE INDEX "payroll_periods_company_id_status_idx" ON "payroll_periods"("company_id", "status");

-- CreateIndex
CREATE INDEX "payroll_feeder_lines_payroll_period_id_employee_id_idx" ON "payroll_feeder_lines"("payroll_period_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_period_id_employee_id_version_key" ON "payslips"("payroll_period_id", "employee_id", "version");

-- CreateIndex
CREATE INDEX "payslip_lines_payslip_id_idx" ON "payslip_lines"("payslip_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_code_key" ON "approval_workflows"("code");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_steps_workflow_id_step_order_key" ON "approval_workflow_steps"("workflow_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_instances_document_type_document_id_idx" ON "approval_instances"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "approval_tasks_assignee_user_id_status_due_at_idx" ON "approval_tasks"("assignee_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "system_parameters_param_key_effective_from_idx" ON "system_parameters"("param_key", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "format_settings_format_key_key" ON "format_settings"("format_key");

-- CreateIndex
CREATE INDEX "validation_rules_entity_name_field_name_idx" ON "validation_rules"("entity_name", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_sequence_code_key" ON "number_sequences"("sequence_code");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_sequence_code_scope_type_scope_ref_id_key" ON "number_sequences"("sequence_code", "scope_type", "scope_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_report_code_key" ON "report_definitions"("report_code");

-- CreateIndex
CREATE INDEX "reference_data_category_idx" ON "reference_data"("category");

-- CreateIndex
CREATE UNIQUE INDEX "reference_data_category_code_key" ON "reference_data"("category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "upload_policies_policy_code_key" ON "upload_policies"("policy_code");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_object_key_key" ON "attachments"("object_key");

-- CreateIndex
CREATE INDEX "attachments_entity_name_entity_id_idx" ON "attachments"("entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_at_idx" ON "attachments"("uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_ter_categories_ptkp_status_effective_from_key" ON "tax_ter_categories"("ptkp_status", "effective_from");

-- CreateIndex
CREATE INDEX "tax_ter_brackets_category_code_effective_from_income_from_idx" ON "tax_ter_brackets"("category_code", "effective_from", "income_from");

-- CreateIndex
CREATE UNIQUE INDEX "loan_types_code_key" ON "loan_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_doc_number_key" ON "loan_applications"("doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loan_application_id_key" ON "loans"("loan_application_id");

-- CreateIndex
CREATE INDEX "perdiem_rates_job_grade_id_city_tier_expense_type_idx" ON "perdiem_rates"("job_grade_id", "city_tier", "expense_type");

-- CreateIndex
CREATE UNIQUE INDEX "trip_requests_doc_number_key" ON "trip_requests"("doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "trip_reports_trip_request_id_key" ON "trip_reports"("trip_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "license_financings_doc_number_key" ON "license_financings"("doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_code_key" ON "feature_flags"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "_holidaysTowork_schedules_B_index" ON "_holidaysTowork_schedules"("B");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_position_id_fkey" FOREIGN KEY ("job_position_id") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_lines" ADD CONSTRAINT "reporting_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_lines" ADD CONSTRAINT "reporting_lines_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope_bindings" ADD CONSTRAINT "user_scope_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_daily" ADD CONSTRAINT "attendance_daily_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_days" ADD CONSTRAINT "leave_request_days_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_ledger" ADD CONSTRAINT "leave_balance_ledger_leave_balance_id_fkey" FOREIGN KEY ("leave_balance_id") REFERENCES "leave_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_rate_rules" ADD CONSTRAINT "overtime_rate_rules_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_component_assignments" ADD CONSTRAINT "employee_component_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_component_assignments" ADD CONSTRAINT "employee_component_assignments_payroll_component_id_fkey" FOREIGN KEY ("payroll_component_id") REFERENCES "payroll_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpjs_rates" ADD CONSTRAINT "bpjs_rates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "bpjs_rate_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_feeder_lines" ADD CONSTRAINT "payroll_feeder_lines_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_feeder_lines" ADD CONSTRAINT "payroll_feeder_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "approval_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_holidaysTowork_schedules" ADD CONSTRAINT "_holidaysTowork_schedules_A_fkey" FOREIGN KEY ("A") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_holidaysTowork_schedules" ADD CONSTRAINT "_holidaysTowork_schedules_B_fkey" FOREIGN KEY ("B") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- LAHANS hardening (BRD §6.4 + BRD §13): beyond Prisma DDL.
--   1. btree_gist extension (EXCLUDE gist support)
--   2. Period anti-overlap EXCLUDE for Class A/B tables
--   3. APPEND-ONLY on audit_logs (REVOKE UPDATE/DELETE)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Class A/B period anti-overlap. NULL effective_to = open-ended,
-- handled via COALESCE(..., 'infinity'). Uses '[)' half-open ranges.
ALTER TABLE "employee_assignments"
  ADD CONSTRAINT "employee_assignments_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "reporting_lines"
  ADD CONSTRAINT "reporting_lines_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    "line_type" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "overtime_rate_rules"
  ADD CONSTRAINT "overtime_rate_rules_no_overlap"
  EXCLUDE USING gist (
    "job_grade_id" WITH =,
    "day_type" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "employee_component_assignments"
  ADD CONSTRAINT "employee_component_assignments_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    "payroll_component_id" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "attendance_allowance_rules"
  ADD CONSTRAINT "attendance_allowance_rules_no_overlap"
  EXCLUDE USING gist (
    "rule_set_code" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "bpjs_rates"
  ADD CONSTRAINT "bpjs_rates_no_overlap"
  EXCLUDE USING gist (
    "profile_id" WITH =,
    "contribution_code" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "system_parameters"
  ADD CONSTRAINT "system_parameters_no_overlap"
  EXCLUDE USING gist (
    "param_key" WITH =,
    COALESCE("scope_type", '') WITH =,
    COALESCE("scope_ref_id"::text, '') WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "tax_ter_categories"
  ADD CONSTRAINT "tax_ter_categories_no_overlap"
  EXCLUDE USING gist (
    "category_code" WITH =,
    "ptkp_status" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "tax_ter_brackets"
  ADD CONSTRAINT "tax_ter_brackets_no_overlap"
  EXCLUDE USING gist (
    "category_code" WITH =,
    "income_from" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );
ALTER TABLE "perdiem_rates"
  ADD CONSTRAINT "perdiem_rates_no_overlap"
  EXCLUDE USING gist (
    "job_grade_id" WITH =,
    "city_tier" WITH =,
    "expense_type" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );

-- APPEND-ONLY audit trail (BRD §6.4). Rows immutable once written.
REVOKE UPDATE, DELETE ON "audit_logs" FROM "lahans_app";
