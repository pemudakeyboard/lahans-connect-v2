# LAHANS Connect

HRIS for PT Lahan Mekar Niaga (LMN) group — HR operations: identity & access, master data, attendance, leave, overtime, payroll, perjalanan dinas, pinjaman, and SIM financing. Domain rules come from the source-of-truth docs in `docs/Source of truth`.

## Language

### Organization & People

**Golongan**:
The canonical job-grade taxonomy: `NON_STAFF`, `STAFF`, `SUPERVISOR`, `MANAGER`. Exactly four grades. Grade drives overtime rules and salary-component eligibility. "Operator" is not a grade.
_Avoid_: Operator (as a grade)

**Operator**:
Not a grade. A Non-Staff role whose _attendance allowance scheme_ differs, selected by the employee's position (TINTIN factory operator positions → `OPERATOR_TINTIN` rule-set; sales/driver/helper positions → `NON_STAFF_DEFAULT`). Overtime rules remain shared with Non-Staff.
_Avoid_: "Operator grade", "golongan operator"

**Rule set**:
A named scheme of attendance-allowance brackets applied to a class of employees (e.g. `NON_STAFF_DEFAULT`, `OPERATOR_TINTIN`). Assigned via position. Distinct from grade.
_Avoid_: "Fifth grade", "allowance tier"

### Perjalanan Dinas

**Perjalanan Dinas**:
A trip ordered by the company to a location outside the employee's homebase to carry out a work task. Has two documents: the _pengajuan_ (plan) and the _laporan pertanggungjawaban_ (realization).
_Avoid_: Trip, business trip form

**PDDK (Perjalanan Dinas Dalam Kota)**:
A trip inside the homebase city, <100 km, no overnight. _Derived_ from distance + overnight, not typed in.
_Avoid_: "Dalam Kota" (form label)

**PDLK (Perjalanan Dinas Luar Kota)**:
A trip outside the homebase city, **>100 km or overnight**. _Derived_.
_Avoid_: "Luar Kota" (form label)

**PDLN (Perjalanan Dinas Luar Negeri)**:
A trip outside Indonesian territory, always overnight. _Derived_. **No "Perjalanan Dinas Kemitraan (Partnership)" type** — that appears only in a copy-paste-defective SOP and is dropped; the SK Perdin (Direksi, higher authority) governs.
_Avoid_: "partnership trip"

**Trip type classification**:
Derived domain rule: the >100 km threshold and overnight determine PDDK/PDLK/PDLN. The form's "Dalam Kota / Luar Kota" binary is a human _draft guess_, not the source of truth. Threshold is a system parameter, not a literal.
_Avoid_: "Jenis Perjalanan" as authoritative

**Pengajuan Perjalanan Dinas**:
The plan document: destination, purpose, itinerary, estimated budget lines (transportasi, akomodasi, konsumsi), and the cash advance (uang muka) request.
_Avoid_: Form Petty Cash (that's the printed form name)

**Uang Muka Perjalanan Dinas**:
The cash advanced before the trip — cash or bank transfer, disbursed by Finance after budget verification. A trip may have _multiple_ advances (top-up when the advance runs out mid-trip); each advance is a sequenced child of the trip.
_Avoid_: Petty cash, advance payment

**Reimbursement (Perjalanan Dinas)**:
Company repayment of employee out-of-pocket trip expenses (e.g. BBM/tol/parkir for company or personal vehicle, per SK §A.4–5). Distinct from uang muka: the employee's own money was spent first, then claimed.
_Avoid_: "Expense claim", "refund"

**Laporan Pertanggungjawaban (Perjalanan Dinas)**:
The realization document submitted after return: actual expense lines with receipts, compared to the advance, settled as refund / reimburse / none.

**Funding source**:
Every trip expense line carries its funding dimension — `ADVANCE` (drawn from the uang muka) or `REIMBURSE` (employee paid out of pocket). Settlement is _computed_ from this: ADVANCE-funded expenses vs advance totals → refund; REIMBURSE-funded → reimbursement. Never hand-typed settlement type.
_Avoid_: "Single expense pool", hand-picked "refund/reimburse" label

**Pertanggungjawaban deadline**:
The report is due `return_date + 7 calendar days` (per SOP, "7 hari" = calendar). Overdue does **not** auto-deduct: it flags the trip as overdue and surfaces a _suggested_ payroll deduction for the un-settled advance, which Comben approves/rejects and can **edit during the payroll cut-off** before it becomes a feeder line. Never auto-punched.
_Avoid_: "auto-deduction", "penalty"

### Absence & Allowance

**Deduct salary**:
Whether an absence type reduces gaji pokok. Only Izin/Alpha deduct gaji pokok (pro-rata ÷25). Sakit, Cuti Tahunan, Cuti Khusus do not.
_Avoid_: "potong gaji" as a blanket term

**Attendance allowance ladder**:
Tunjangan kehadiran is scaled by _any_ absence — Sakit, Izin, Cuti, or Alpha all count. Non-Staff: 1 absence → 50%, >1 → 0. Operator TINTIN: 1 → 80%, 2 → 50%, >2 → 0. "Tidak memotong apapun" in the docs means _gaji pokok_ only — it never shields the allowances.
_Avoid_: "tidak memotong apapun" as absolute

**Meal/transport allowance**:
Uang makan + uang transport are per-working-day and are forfeited on any absence day (Sakit, Izin, Cuti, Alpha). Governed by `affects_meal_transport_allowance` on the leave type.
_Avoid_: "daily allowance" as one thing

### Payroll Calculation

**Absence divisor**:
The fixed divisor for gaji pokok pro-rata absence deduction. Per the docs it stays **25** even in months with more or fewer working days ("pembaginya tetap 25 bukan 27"). Value lives in `system_parameters` (`PAYROLL.ABSENCE_DIVISOR`), referenced by name in the formula expression — never a literal.
_Avoid_: "working days in month"

**Overtime divisor**:
`Gaji Pokok / 173 / jam` — the standard monthly-hour divisor. Lives in `system_parameters` (`PAYROLL.OVERTIME_DIVISOR`). Referenced by name in the rate rule.
_Avoid_: hardcoded `173`

**Overtime rate rule**:
Grade-scoped: the ×2 holiday premium is a **Non-Staff** property; Staff/SPV/Manager get ×1 on both ordinary and holiday days. Encoded in `overtime_rate_rules` per `job_grade_id`, not a global formula.
_Avoid_: "everyone gets ×2 on holidays"

### Leave

**Cuti Tahunan**:
12 working days per year, earned after 12 continuous months of service. Year 1 is granted **pro-rata** on the anniversary; year 2+ is a flat 12 per calendar year.
_Avoid_: "annual leave" (too generic), "12 days flat always"

**Cuti Advance**:
Leave taken before the entitlement is earned (employee < 1 year), max 3 working days. Deducts from the future cuti tahunan entitlement; if the employee resigns before the entitlement is born, the advances are clawed back from final payroll.
_Avoid_: "negative leave", "unpaid leave"

**Cuti Khusus**:
Leave outside cuti tahunan for statutory/company-designated reasons (wedding, bereavement, etc.). Does not deduct gaji pokok.
_Avoid_: "special leave"

**Leave grant event**:
The entitlement is granted on the **anniversary date** (12-month mark), not batched on Jan 1. `leave_balances.period_year` = the calendar year _containing the anniversary_.
_Avoid_: "January 1 grant", "calendar-year batch"

**Leave proration**:
Year-1 grant is **months-based**: `12 × (months from anniversary month to December) / 12` = 1 day per month remaining. Join 3 Mar 2024 → granted 3 Mar 2025 → 10 days (Mar–Dec). Not days-based.
_Avoid_: "prorate by 365 days"

### Attendance & Swap Day

**Ganti hari kerja / libur pengganti**:
Not a leave type. A **bidirectional schedule swap**: the employee takes day X off and works substitute day Y instead, so X is their (compensated) rest day and Y is their working day — no payroll effect, no attendance-ladder hit, no meal/transport loss. Modeled as a paired `schedule_overrides` operation (X off, Y on), resolved before any absence classification.
_Avoid_: "izin ganti hari" as a leave type, "free day"

### Work Time

**Weekly target**:
The nominal working-hours figure (40h/week) used for **reconciliation only**. It is a _counting convention_, not an enforcement target — a field employee working market hours gets a full HADIR day even if the arithmetic falls short of 40h. **Shortfall never deducts; only absence does.**
_Avoid_: "overtime trigger", "target that deducts"

**Field hours convention**:
For market-based roles (DRIVER, SALESMAN, HELPER, TASK FORCE, SALES MERCHANDISER, SALES HOREKA), actual hours follow market hours (~6h/day) but are **counted as the notional 8h/day** for schedule reconciliation. The counted hours exist only to keep overtime-eligibility and reports consistent, never to compute a shortfall penalty.
_Avoid_: "6-hour day", "actual hours vs target"

### Known Gaps

**Late / early-leave deduction formula**:
The LEMBUR & ABSEN doc names "Izin pulang cepat atau Terlambat" as its own deduction category, but the formula is cut off in the source. `attendance_daily.late_minutes` / `early_leave_minutes` capture the minutes; the deduction formula is **unpinned pending an HR policy decision** — not derived from any source doc.
_Avoid_: assuming late = 1/2 day absence

### SIM Financing

**Pembiayaan SIM**:
Company financing of a licensed Driver's SIM, new or renewal. Eligibility: Driver position, **min 1 year** tenure. Split **50:50** company/employee. The company pays the full cost upfront; the employee's 50% is clawed back via payroll.
_Avoid_: "SIM loan", "reimbursement"

**SIM financing flow**:
Driver applies → Atasan reviews (confirms Driver + tenure) → Comben verifies, administers, archives → employee submits the new-SIM evidence (photo) after completion. The employee half is a payroll clawback, not an upfront payment.
_Avoid_: "employee pays at counter"

### Pinjaman

**Pinjaman Karyawan**:
Company loan to an employee, repaid by monthly payroll deduction. Eligibility: **min 2 years** continuous tenure, **and** a whitelisted purpose. Purpose is _enforced_ (a welfare-program constraint, not a suggestion).
_Avoid_: "salary advance", "loan" (unqualified)

**Pinjaman purpose whitelist**:
The only permitted purposes: (1) medical for a **married** employee (self, spouse, biological children ≤ 3rd); (2) medical for an **unmarried** employee (self, biological parents); (3) funeral of family (spouse, biological children, biological parents); (4) the employee's own wedding. Enforced at submission against `employee.marital_status` and the covered-person relation.
_Avoid_: "any need", "loan for consumption"

**Pinjaman approval chain**:
Karyawan → Atasan Langsung (review) → Division Head (evaluate) → **HCGA Manager / Comben** (approve) → **FAT Manager** (final disbursement authorization). Four steps, last is FAT.
_Avoid_: "approval by manager" (ambiguous)

### Approval Chains

Each document type has its **own chain** — never normalized into one:

- **Cuti:** Atasan Langsung (≤2 working days) → Division Head (final)
- **Izin:** Atasan Langsung → Dept. Comben (final)
- **Perdin:** Atasan Langsung → Comben (record + explain SK terms) → Finance (budget verify + disburse)
- **Pinjaman:** Atasan → Division Head → HCGA Manager/Comben → FAT Manager (disbursement)

_Avoid_: "one approval flow for attendance docs"
_Avoid_: Settlement report, expense claim
