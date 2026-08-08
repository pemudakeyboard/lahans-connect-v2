# Trip classification is derived, not typed

The perjalanan dinas form asks for a binary "Dalam Kota / Luar Kota" label, but the SK Perdin defines the real taxonomy (PDDK/PDLK/PDLN) by **distance and overnight** (>100 km or overnight = PDLK; <100 km and no overnight = PDDK; international = PDLN). We decided the system **derives** the classification from stored `distance_km` + `is_overnight` on the trip request, keeps the form's binary only as a human _draft guess_, and reads the 100 km threshold from `system_parameters` rather than a literal.

Why: allowances differ by trip type, and a hand-typed label is not a computable foundation — the SK's rule is. The threshold is a policy number, and this repo bans hardcoded policy numbers.
