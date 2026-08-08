-- M6: Payroll feeder — scope + attendance rule-set binding
--
-- Adds the position-level attendance-allowance rule-set selector that the M6
-- payroll feeder needs to key the TUNJANGAN_KEHADIRAN ladder. "Rule set dipilih
-- oleh posisi" (CONTEXT.md): job_positions.attendance_rule_set carries
-- NON_STAFF_DEFAULT | OPERATOR_TINTIN | NULL (NULL = no attendance allowance).
-- Nullable so existing positions are unaffected.
--
-- The data-scope enforcement hook (user_scope_bindings) already exists in the
-- init migration — no schema change needed there, only seed + service wiring.

ALTER TABLE "job_positions" ADD COLUMN "attendance_rule_set" TEXT;