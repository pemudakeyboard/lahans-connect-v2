# FR ↔ Implementation Map — LAHANS Connect

Every functional requirement in the PRD is mapped to its implementation (code,
seeded data, or test) or marked **deferred** (blocked by an Open Question /
future module). Status legend:

- ✅ **Implemented** — code + tests where applicable
- 🟡 **Partial** — core path works; edge/UX deferred
- ⏳ **Deferred** — future module, seam only
- 🔒 **Enforced by tooling** — lint rule / CI gate

## M0 — Identity & Access (foundation)

| FR        | Requirement                                                    | Status | Where                                                                                              |
| --------- | -------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| FR-M0-001 | RBAC + ABAC (permission vs data scope)                         | ✅     | `core/auth/access-resolver.service.ts`, `group_permissions.data_scope`                             |
| FR-M0-002 | Permissions in `permissions` table `{mod}.{resource}.{action}` | ✅     | seed `PERMISSIONS`; `identity`/`config`/`master` modules                                           |
| FR-M0-003 | Backend authorization (not just frontend hiding)               | ✅     | `core/auth/guards/permission.guard.ts`                                                             |
| FR-M0-004 | Deny-by-default; no annotation = rejected                      | ✅     | `PermissionGuard`; CI would fail on missing decorator                                              |
| FR-M0-010 | user ↔ employee (max 1)                                        | ✅     | `users.employee_id` unique                                                                         |
| FR-M0-011 | Login NIK+password (mobile) / email+password (web)             | ✅     | `auth.controller.ts` `POST /auth/login`; web login screen                                          |
| FR-M0-012 | Password policy from `system_parameters`                       | 🟡     | `SECURITY.*` seeded; enforcement in `PasswordService`                                              |
| FR-M0-013 | Lock account after N fails for M min (from config)             | 🟡     | `auth.service.ts recordFailedAttempt` — hardcoded 5/15, TODO to read from config                   |
| FR-M0-014 | User status lifecycle                                          | ✅     | `users.status`; `RESIGNED` auto-disable pending M1B                                                |
| FR-M0-015 | Device binding (mobile)                                        | ⏳     | deferred with Flutter                                                                              |
| FR-M0-016 | Reset password via OTP                                         | 🟡     | `forgot-password`/`reset-password`; OTP channel mocked                                             |
| FR-M0-017 | Active sessions + force logout                                 | 🟡     | refresh token rotation; admin force-logout deferred                                                |
| FR-M0-018 | 2FA (TOTP) forced for `requires_2fa` groups                    | ✅     | `otplib`, `auth.service.userRequires2fa`                                                           |
| FR-M0-020 | Group CRUD + clone via UI                                      | ✅     | `identity` module (API); UI deferred                                                               |
| FR-M0-021 | User in multiple groups; effective = union                     | ✅     | `AccessResolver`                                                                                   |
| FR-M0-022 | `user_permission_overrides` GRANT/DENY; DENY wins              | 🟡     | table exists; override resolution TODO                                                             |
| FR-M0-023 | `is_system` groups protected                                   | ✅     | seed `SUPER_ADMIN` `is_system`                                                                     |
| FR-M0-024 | Simulate-as-user screen                                        | ⏳     | deferred                                                                                           |
| FR-M0-025 | Group `requires_2fa`/`max_session_minutes`/`allowed_ip_cidr`   | 🟡     | `requires_2fa` active; rest deferred                                                               |
| FR-M0-030 | `data_scope` as reference data                                 | ✅     | seeded enum via `reference_data`                                                                   |
| FR-M0-031 | Scope effective = widest                                       | 🟡     | TODO in `AccessResolver`                                                                           |
| FR-M0-032 | Scope filter at repository/query layer                         | 🔒     | `DataScopeInterceptor` + Prisma where                                                              |
| FR-M0-033 | `TEAM_TREE` depth cap                                          | ⏳     | deferred                                                                                           |
| FR-M0-034 | Scope guard on employee queries + leak tests                   | 🟡     | guard present; cross-branch unit test TODO                                                         |
| FR-M0-040 | `sensitive_fields` registry + masking                          | ✅     | `core/auth/interceptors/field-mask.interceptor.ts`                                                 |
| FR-M0-041 | Per group×permission field masking, `"***"`                    | 🟡     | mask interceptor; per-scope config TODO                                                            |
| FR-M0-042 | Export honors masking                                          | ⏳     | deferred                                                                                           |
| FR-M0-050 | `menus` table                                                  | ✅     | seed `menus`                                                                                       |
| FR-M0-051 | Nav from `GET /me/navigation`, not static array                | ✅     | `me-navigation.service.ts`; web `app-shell` renders from state                                     |
| FR-M0-052 | Hide parent when all children inaccessible                     | ✅     | `me-navigation.service.ts prunes`                                                                  |
| FR-M0-053 | Admin reorders menu without deploy                             | 🟡     | API supports; UI deferred                                                                          |
| FR-M0-054 | Menu TTL cache + forced invalidation                           | 🟡     | `cache_ttl_seconds: 300`; invalidation deferred                                                    |
| FR-M0-060 | Approval delegation                                            | ✅     | `approval_delegations` + delegation endpoints di modul roster (lihat M2B); `guardActiveDelegation` |
| FR-M0-061 | Delegated approval attribution                                 | ✅     | `DelegationService.resolveStepAssignee` → `approval_tasks.delegated_from_user_id` (lihat M2B)      |
| FR-M0-062 | Audit users/groups/menus changes with before/after             | ✅     | `audit.interceptor.ts`                                                                             |
| FR-M0-063 | `audit_logs` append-only                                       | ✅     | migration `REVOKE UPDATE/DELETE`                                                                   |

## M1B — Master Data (generic CRUD)

| FR         | Requirement                                        | Status | Where                                             |
| ---------- | -------------------------------------------------- | ------ | ------------------------------------------------- |
| FR-M1B-001 | Every registry table has CRUD screen               | ✅     | `master-registry.ts` + `MasterCrud` web component |
| FR-M1B-002 | Financial master data effective-dated              | ✅     | `temporal` flag + `asOf` required                 |
| FR-M1B-003 | No physical delete of referenced data; soft-delete | ✅     | `MasterService.remove` → `is_active: false`       |

## M8B — Format & Validasi

| FR          | Requirement                                                        | Status | Where                                                       |
| ----------- | ------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| FR-M8B-001  | Display formats from `format_settings`                             | ✅     | seed `FORMAT_SETTINGS`; `GET /config/formats`               |
| FR-M8B-002  | Default date format `DDMMYYYY`                                     | ✅     | seeded `date.display`                                       |
| FR-M8B-003  | Storage stays ISO/DATE                                             | ✅     | schema `DateTime`/`Date`; formatting only at presentation   |
| FR-M8B-004  | API accepts/returns ISO 8601                                       | ✅     | `class-validator`; client-side transform                    |
| FR-M8B-005  | Import parser tries formats in order; reject ambiguity             | ⏳     | importer deferred                                           |
| FR-M8B-006  | Mobile/web pickers use same format + direct `DDMMYYYY` entry       | 🟡     | web client TODO; mobile deferred                            |
| FR-M8B-010  | Validation rules in `validation_rules`, backend is source of truth | ✅     | `validation-rules` CRUD; `ValidationService`                |
| FR-M8B-011  | Severity ERROR/WARNING/INFO                                        | ✅     | DTO + seeded rules                                          |
| FR-M8B-020  | NIK manual input (PO decision)                                     | ✅     | `number_sequences.EMPLOYEE_NIK` seeded; generator nonactive |
| FR-M8B-020a | Existing NIK left as-is                                            | ✅     | no retroactive normalization                                |
| FR-M8B-021  | NIK real-time validation                                           | 🟡     | seeded `REGEX ^\d{8}$`; live check TODO                     |
| FR-M8B-022  | Debounced uniqueness check                                         | 🟡     | `check-nik` endpoint TODO                                   |
| FR-M8B-023  | DB `UNIQUE` constraint on NIK                                      | ✅     | schema `@unique`                                            |
| FR-M8B-024  | Next-NIK suggestion (clickable help)                               | ⏳     | deferred                                                    |
| FR-M8B-025a | No NIK reuse after resign                                          | 🟡     | `previous_employee_id` link; enforcement TODO               |
| FR-M8B-030  | Document numbering per ISO + configurable                          | ✅     | `number_sequences` + `reserveNextNumber`                    |
| FR-M8B-031  | FLAG: OT + absence-correction docs lack SOP                        | ⏳     | Doc Control pending                                         |
| FR-M8B-032  | Numbers generated at submit, not draft                             | ✅     | `reserve` on submit                                         |
| FR-M8B-040  | Shared report template                                             | ⏳     | reporting deferred                                          |

## S7 — Cuti & Izin (Leave)

| FR/BR  | Requirement                                                        | Status | Where                                                           |
| ------ | ------------------------------------------------------------------ | ------ | --------------------------------------------------------------- |
| BR-C01 | Cuti Tahunan 12 hari kerja/tahun, diberikan di tanggal anniversary | ✅     | `leave.service.ts runAnnualGrant`; `LEAVE.ANNUAL_DAYS` param    |
| BR-C02 | Year-1 pro-rata months-based (1 hari/bulan s.d. Desember)          | ✅     | `prorateDays`; unit-tested (Mar→10, Dec→1, Jan→12)              |
| BR-C03 | Rekomendasi: cuti tidak boleh melewati sisa saldo                  | ✅     | `balanceFor` check + `LEAVE_MAX_DAYS_EXCEEDED`                  |
| BR-C05 | Cuti di Muka maks 3 hari kerja, dipotong dari entitas masa depan   | ✅     | `LEAVE.ADVANCE_MAX_DAYS` param + `advance_used_days` on balance |
| BR-C07 | Notice cuti H-7 hari kerja                                         | ✅     | `min_notice_days=7` on `CUTI_TAHUNAN`; `addWorkingDays` check   |
| BR-C08 | Notice izin H-1                                                    | ✅     | `min_notice_days=1` on `IZIN`; `addWorkingDays` check           |
| BR-C09 | Izin tanpa keterangan potong gaji pokok (÷25)                      | ✅     | `leave_types.deduct_salary`; `PAYROLL.ABSENCE_DIVISOR` param    |
| BR-C12 | Approval chain CUTI: Atasan → Division Head                        | ✅     | `approval_workflows.code=CUTI`; `resolveStepAssignee`           |
| BR-C13 | Approval chain IZIN: Atasan → Dept. Comben                         | ✅     | `approval_workflows.code=IZIN`; `resolveStepAssignee`           |
| —      | Pengajuan cuti/izin dengan nomor dokumen (DOC_LEAVE/DOC_IZIN)      | ✅     | `ConfigService.reserveNextNumber`; `POST /leave/requests`       |
| —      | Saldo card (Hak \| Terpakai \| Pending \| Sisa)                    | ✅     | `GET /leave/balance`; web `cuti/page.tsx`                       |
| —      | Ledger append-only (GRANT/USE/ADVANCE/EXPIRE/ADJUST/PAYOUT)        | ✅     | `leave_balance_ledger`; `GET /leave/ledger`                     |
| —      | Approval inbox + decide (approve/reject/return)                    | ✅     | `GET /leave/inbox`; `POST /leave/requests/:id/decide`           |
| —      | Post-approval effects: debit saldo + attendance_daily stamp        | ✅     | `applyApprovedEffects` (CUTI/IZIN/SAKIT)                        |
| —      | Jalur darurat (backdate / melewati notice)                         | ✅     | `is_emergency` bypass; `leave_types.allow_backdate`             |
| —      | Cuti Advance clawback on early resignation                         | ⏳     | `advance_used_days` tracked; clawback on resign deferred        |
| —      | Carryover ≤ 7 hari (BR-C07 related)                                | ⏳     | `LEAVE.MAX_CARRYOVER_DAYS` param; expiry job deferred           |

## S6 — Absensi (Attendance)

Sumber: modul M2 (Absensi) — `Tintin Compensation & Benefit - LEMBUR & ABSEN.pdf` + `Contoh Jadwal kerja.pdf`.

| FR/BR     | Requirement                                                                                  | Status | Where                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| FR-M2-001 | Harian absensi turun dari log + jadwal (HADIR/TERLAMBAT/PULANG_CEPAT/ALPHA/INCOMPLETE/LIBUR) | ✅     | `attendance-derivation.ts deriveDailyFields`; `deriveTx` on every clock + finalize                                 |
| FR-M2-002 | Absen masuk & pulang (clock) dengan `log_type` IN/OUT                                        | ✅     | `POST /attendance/clock` (BRD §7.3 semantics)                                                                      |
| FR-M2-003 | Jam kerja & perhitungan menit dari jadwal admin (FIXED/FLEXIBLE/SHIFT)                       | ✅     | `work_schedules`/`work_schedule_days`/`schedule_assignments` (admin-config, **tidak hardcoded**)                   |
| FR-M2-004 | Kalender kerja / hari libur                                                                  | ✅     | `holidays` master (NATIONAL/JOINT_LEAVE/COMPANY) → status LIBUR                                                    |
| FR-M2-005 | Geofence radius per cabang (atau parameter global)                                           | ✅     | `branches.geofence_radius_m` / `ATTENDANCE.GEOFENCE_RADIUS_M` param; STRICT 403 / TRACKED anomaly                  |
| FR-M2-006 | Idempoten retry (jaringan) via `client_request_id`                                           | ✅     | unique + replay → `{idempotent:true}`; P2002 race re-fetch                                                         |
| FR-M2-008 | Rekap harian data-scoped (Comben/HCGA lihat divisi/cabang sendiri)                           | ✅     | `PayrollScopeService.employeeWhere`; `GET /attendance/daily`                                                       |
| FR-M2-009 | Kartu "hari ini" untuk karyawan                                                              | ✅     | `GET /attendance/today` (daily, log terakhir, jadwal, geofence)                                                    |
| FR-M2-010 | Finalisasi harian / bulanan oleh Comben                                                      | ✅     | `POST /attendance/daily/finalize` (re-derive scoped; freeze-guar MANUAL)                                           |
| FR-M2-011 | Anomali (OUT_OF_ZONE / MOCK_LOCATION / NO_GEOFENCE_DATA / NO_SCHEDULE)                       | ✅     | `attendance_daily.is_anomaly` + `anomaly_reasons` (Json)                                                           |
| FR-M2-012 | Koreksi kehadiran self-service dengan approval (Atasan → Comben)                             | ✅     | `attendance_corrections` + flow `ATTENDANCE_CORRECTION`; akhir APPROVE terapkan `proposed_values`, `source=MANUAL` |
| BR-A01    | Absen di luar radius → blokir (STRICT) / flag (TRACKED)                                      | ✅     | `resolveGeofence`; haversine; `GEOFENCE_DENIED` 403                                                                |
| BR-A02    | Radius default bila cabang tidak set                                                         | ✅     | `ATTENDANCE.GEOFENCE_RADIUS_M` (seeded 150 m)                                                                      |
| BR-A03    | Toleransi keterlambatan per jadwal                                                           | ✅     | `work_schedule_days.late_tolerance_minutes` → `late_minutes`                                                       |
| BR-A04    | Sesuatu yang melewati jam → tidak dihitung / anomali                                         | ✅     | `deriveDailyFields` bounds; OUT tanpa IN → `ATTENDANCE_OUT_WITHOUT_IN`                                             |
| —         | Kartu riwayat bulanan + tombol Koreksi per karyawan                                          | ✅     | web `attendance/page.tsx` (tab Absen Saya)                                                                         |
| —         | Inbox koreksi + setujui/tolak                                                                | ✅     | web tab Rekap Harian; `decideCorrection`                                                                           |
| —         | Periode gaji CLOSED → koreksi diblokir                                                       | ✅     | `createCorrection` → `ATTENDANCE_PERIOD_CLOSED`                                                                    |
| —         | Sinkronisasi offline `/sync` (FR-M2-006/007 mobile)                                          | ⏳     | seam `is_offline_sync` + `client_request_id`; endpoint deferred                                                    |
| —         | Proxy attendance (EC-07)                                                                     | ⏳     | deferred                                                                                                           |
| —         | Swap / ganti-hari (`schedule_overrides`)                                                     | ⏳     | seeded; unimplemented                                                                                              |
| —         | Scheduler harian otomatis (bukan manual finalize)                                            | ⏳     | `finalizeDay` endpoint; cron deferred                                                                              |

**Catatan data masa:** `attendance_daily.work_date` disimpan sebagai **UTC midnight** hari Indonesia (Asia/Jakarta) — konvensi sama dengan batas `cutoff_*` payroll dan seed. `startOfDay/endOfDay` di `attendance.service.ts` memakai `Date.UTC`, dan `resolveScheduleDay` memakai `getUTCDay()` supaya lookup hari-jadwal konsisten. Baris yang sudah `source=MANUAL` (hasil koreksi yang disetujui) dibekukan — `finalizeDay`/clock tidak menimpa override manual.

## M2B — Roster Management

Sumber: modul M2B (Roster) — admin mengonfigurasi shift schedule per branch/unit (manufaktur vs branch), tanpa pemblokiran karyawan. Jadwal yang hilang tidak pernah memblokir clock-in — hanya muncul sebagai anomali `NO_SCHEDULE` di rekap kehadiran (keputusan user atas FR-M2B-006). Resolver shift dipakai bersama oleh attendance + leave agar perubahan roster dihormati di mana-mana.

| FR/BR      | Requirement                                                                                     | Status | Where                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M2B-001 | Roster & shift management — admin configures shift schedules per branch/unit, no blocking       | ✅     | `roster` module (`/roster/*`); master CRUD `shift-definitions`/`shift-patterns`/`shift-rotations`/`schedule-assignments`; `schedule_assignments.scope_type` = EMPLOYEE\|POSITION\|GRADE\|BRANCH\|COMPANY |
| FR-M2B-002 | Shift definitions (NORMAL/PAGI/SIANG/MALAM) + rotation patterns (PABRIK_3X 7-slot cycle)        | ✅     | `shift_definitions` (`crosses_midnight`, `cover_end_date`), `shift_patterns.cycle_length` (default 7), `shift_rotations` (day_index → shift; null = libur); seed `PABRIK_3X`                             |
| FR-M2B-003 | Schedule resolution priority — individu(1) > jabatan(2) > golongan(3) > cabang(4) > entitas(5)  | ✅     | `shift-resolver.ts` `SCOPE_PRIORITY` + `rankAssignments`; dipakai attendance (`attendance.service.ts resolveScheduleDay`) + leave (`leave.service.ts computeWorkingDays`)                                |
| FR-M2B-004 | Calendar view per employee × date, branch-filterable; per-date overrides (swap shift / day off) | ✅     | `GET /roster/calendar` (from/to/branchId); `GET/POST /roster/overrides` → `schedule_overrides` (upsert `employee_id_work_date`, unique); override menang atas assignment                                 |
| FR-M2B-005 | Bulk assignment of a work_schedule to many employees                                            | ✅     | `POST /roster/schedules/:id/assign` (`employee_ids[]`) → EMPLOYEE scope priority 1, `effective_from`=now; reassign update bila assignment terbuka sudah ada                                              |
| FR-M2B-006 | Missing schedule → NO_SCHEDULE anomaly, never blocks period close                               | ✅     | `attendance-derivation.ts` push `NO_SCHEDULE`; `RosterService` no-block (`collectBlockers` sengaja kosong); spec `attendance-derivation.spec.ts` "no schedule → working day"                             |
| FR-M0-060  | Approval delegation — roster duties delegable                                                   | ✅     | `approval_delegations` + `POST /roster/delegations` / `DELETE /roster/delegations/:id`; `RosterService.guardActiveDelegation` blokir delegator aktif                                                     |
| FR-M0-061  | Delegated approval attribution                                                                  | ✅     | `DelegationService.resolveStepAssignee` → `approval_tasks.delegated_from_user_id`; `GET /roster/delegations` (mine + delegatingToMe)                                                                     |
| —          | Swap / ganti-hari (pair bidirectional, ADR-0003 `swap_pair_id` + flow auto-approval)            | ⏳     | `schedule_overrides.swap_pair_id`/`approval_instance_id` ada di schema (ADR-0003); endpoint overrides ada, flow auto-approval belum diimplementasikan                                                    |

**BR / perilaku (catatan):**

- **Sumbu prioritas 5-level** — `SCOPE_PRIORITY` di `shift-resolver.ts`: `EMPLOYEE`=1 (individu) > `POSITION`=2 (jabatan) > `GRADE`=3 (golongan) > `BRANCH`=4 (cabang) > `COMPANY`=5 (entitas). `rankAssignments` memilih pemenang dari assignment effective (window `effective_from..effective_to` inklusif); tie-break ke `priority` tersimpan lalu schedule id. `scopeRefsFor` membangun daftar scope per karyawan (ref org null dilewati).
- **Semantik window shift** — value seed: `NORMAL` 08:00–17:00 (break 60), `PAGI` 06:00–14:00, `SIANG` 14:00–22:00, `MALAM` 22:00–06:00 (break 0) — semua WIB wall-time dari `shift_definitions`, bukan hardcode (`RosterService.infersCrossesMidnight` menandai `crosses_midnight` saat start ≥ end). `MALAM` masuk hitungan hari Indonesia saat shift **mulai**; `shiftWindowInstants` me-roll end +24h → label `"06:00 (esok)"` (`advanceWallClock`), dan `cover_end_date` menandai end_time milik hari berikutnya.
- **Konvensi work_date UTC-midnight** — dipakai ulang dari S6: kalender roster memajukan kursor pada jam UTC (`startOfDay`/`Date.UTC`, lihat komentar anti-infinite-loop di `roster.service.ts calendar`), lookup FIXED/FLEXIBLE untuk hari-jadwal via `getUTCDay()`, selaras `attendance_daily.work_date` = UTC midnight hari Indonesia.
- **No-block NO_SCHEDULE** — jadwal yang hilang tidak pernah memblokir clock-in/penutupan periode (keputusan user atas FR-M2B-006): `attendance-derivation.ts` memperlakukan null schedule sebagai hari kerja (ALPHA tetap bisa terbakar) dan push anomali `NO_SCHEDULE` (FR-M2-011); `collectBlockers` sengaja kosong. Di kalender roster sel tanpa jadwal tampil shift `—`.
- **Konfigurasi per branch/unit** — SHIFT schedule `PABRIK_SHIFT_3X` di-assign di scope BRANCH (priority 4) ke cabang PBR = default unit manufaktur untuk karyawan tanpa jadwal individu di branch itu. Shift config per-company (`resolveCompanyId` pilih bind COMPANY scope user, fallback company pertama) — unit baru tidak butuh perubahan kode.

**UAT / demo note:** seed menciptakan `PABRIK_SHIFT_3X` (SHIFT, "Pabrik Shift 3x8") → pattern `PABRIK_3X` (cycle 7: PAGI→SIANG→MALAM→libur→PAGI→SIANG→MALAM) yang di-assign di scope BRANCH ke `PBR` ("Pabrik Rancaekek", priority 4, effective 2026-01-01). Karyawan OPERATOR-TINTIN (`20230612` BYW, `20000173` & `20240682` GRT) mendapat assignment EMPLOYEE-scope yang sama (priority 1) → rotasi 3-shift ter-resolve di kalender roster. Roster group grants: `COMBEN` + `HCGA_MANAGER` manage penuh di scope DIVISION; `EMPLOYEE` baca kalender/override/delegation (SELF). Delegasi (FR-M0-060/061): demo supervisor `88000002` (SUPER_ADMIN, reporting line untuk UAT cuti/koreksi) dapat membuat delegasi roster via UI; selama delegasi aktif `guardActiveDelegation` memblokir `88000002` bertindak sampai delegasi dibatalkan.

## Core cross-cutting (BRD S0/S0b)

| Requirement                                 | Status | Where                                                        |
| ------------------------------------------- | ------ | ------------------------------------------------------------ |
| Parameter reads require `asOf`              | 🔒     | `parameter.service.ts` + `temporal-resolver.ts`; unit-tested |
| Financial calc produces `calculation_trace` | ✅     | `core/rules/calculation-trace.ts`                            |
| No policy-number literals                   | 🔒     | `lahans/no-magic-policy-numbers` ESLint rule                 |
| No group-name checks                        | 🔒     | `lahans/no-group-name-checks` ESLint rule                    |
| Indexing (BRD §6.4)                         | ✅     | Prisma migrations                                            |
| Decimal/BigInt serialized as strings        | ✅     | `bigint-serializer.interceptor.ts` (Prisma.Decimal + bigint) |
