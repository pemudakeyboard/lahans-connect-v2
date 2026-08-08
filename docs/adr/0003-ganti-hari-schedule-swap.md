# "Izin ganti hari kerja" is a schedule swap, not a leave type

The Izin SOP lists "izin ganti hari kerja / libur pengganti" as a first-class variant. We decided it is **not** a leave type: it is a **bidirectional schedule swap** — the employee takes day X off and works substitute day Y instead. Modeled as a paired `schedule_overrides` operation (X off, Y on), resolved before any absence classification.

Why: as a leave type it would wrongly trigger the attendance-allowance ladder, meal/transport forfeiture, and gaji deductions. As a swap, day X is a compensated rest day and day Y a working day — no payroll effect at all. This is the one a future engineer would most likely "fix" into a leave type, so it earned an ADR.
