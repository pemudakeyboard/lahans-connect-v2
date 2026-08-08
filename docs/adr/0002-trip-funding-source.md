# Trip expenses carry a funding source (ADVANCE vs REIMBURSE)

The SK and Perdin SOP fund trips through three mechanisms: uang muka (advanced before the trip, disbursed by Finance), top-up (a _second_ advance when the first runs out mid-trip), and reimbursement (employee pays out of pocket, claimed back). We decided each `trip_expense_line` carries a `funding_source` of `ADVANCE` or `REIMBURSE`, and each `cash_advances` row is a **sequenced child of its trip** (so top-ups are visibly the same trip's money).

Why: the settlement (refund vs reimburse) is only _computable_ if we know which pool each expense drew from — otherwise "refund/reimburse" is hand-typed. The SK explicitly reimburses only certain vehicle expenses (BBM/tol/parkir) while advancing the rest, so a single expense pool would force that distinction to be guessed.
