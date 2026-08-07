# BRD — LAHANS Connect
### Business Requirements Document & Technical Blueprint
### HRIS PT Lahan Mekar Niaga (LMN Group)

| Field | Value |
|---|---|
| Dokumen | Business Requirements Document (BRD) + Technical Blueprint |
| Versi | 1.0 |
| Tanggal | 07 Agustus 2026 |
| Dokumen Induk | PRD LAHANS Connect v1.0 |
| Audiens | Tim Developer, Tech Lead, QA, DBA, DevOps |
| Prinsip Utama | **ZERO HARDCODE.** Setiap angka kebijakan, alur approval, item menu, dan hak akses adalah **baris data**, bukan baris kode. |

---

## 1. Ruang Lingkup Bisnis

### 1.1 Proses Bisnis dalam Ruang Lingkup

| Kode | Proses | Dokumen Acuan | Rilis |
|---|---|---|---|
| BP-01 | Pengelolaan Data Karyawan & Organisasi | `data_pegawai_master` | MVP |
| BP-02 | Pengelolaan Akses Pengguna & Otorisasi | *(baru — tidak ada SOP)* | MVP |
| BP-03 | Pencatatan Kehadiran & Jadwal Kerja | `Contoh Jadwal Kerja`, `Matriks Payroll` | MVP |
| BP-04 | Pengajuan & Persetujuan Cuti | SOP.LMN.CBN.04 rev.01 (15 Apr 2026) | MVP |
| BP-05 | Pengajuan & Persetujuan Izin | SOP.LMN.CBN.03 rev.01 (09 Apr 2026) | MVP |
| BP-06 | Perintah & Realisasi Lembur | `Matriks Perhitungan Payroll`, `Tintin — LEMBUR & ABSEN` | MVP |
| BP-07 | Penyusunan Input Payroll (Feeder) | `Matriks Perhitungan Payroll`, `Matriks Gaji & Tunjangan` | MVP |
| BP-08 | Distribusi Slip Gaji Elektronik | *(baru)* | MVP |
| BP-09 | Pinjaman Uang Karyawan | SOP.LMN.CBN.09 rev.00 (17 Apr 2026) | v2 |
| BP-10 | Perjalanan Dinas & Petty Cash | SOP.LMN.CMBN.06, SK Perdin, FRM.LMN.CMBN.09.001 | v2 |
| BP-11 | Pembiayaan Perpanjangan SIM | SOP.LMN.CBN.02 rev.01 (10 Apr 2026) | v2 |
| BP-12 | Perhitungan Payroll Penuh (Engine) | `Matriks Payroll`, `Tintin — Matriks` | v2 |

### 1.2 Di Luar Ruang Lingkup

Recruitment, Onboarding, Performance/KPI, Training, PPh 21, integrasi API BPJS, disbursement bank otomatis, Sales Force Automation.

---

## 2. Aktor Bisnis & Tanggung Jawab Sistem

| Aktor | Peran Bisnis (per SOP) | Grup Sistem Default |
|---|---|---|
| Karyawan | Mengajukan, melengkapi dokumen, mempertanggungjawabkan | `EMPLOYEE` |
| Atasan Langsung | Review awal, approve/reject ≤ 2 hari kerja, jaga kontinuitas operasional | `SUPERVISOR` |
| Division Head | Review lanjutan, keputusan akhir approval | `DIVISION_HEAD` |
| Manager | Otorisasi tingkat departemen, persetujuan biaya perdin di atas ambang | `MANAGER` |
| Dept. Comben | Verifikasi hak, administrasi, validasi data HRIS, perhitungan | `COMBEN` |
| HCGA Manager | Pengendalian kebijakan, otorisasi berjenjang, pengelolaan pengguna | `HCGA_MANAGER` |
| Dept. Finance / FAT Manager | Verifikasi anggaran, otorisasi pencairan | `FINANCE` |
| Admin Cabang | Administrasi lokal, proxy attendance, jadwal cabang | `BRANCH_ADMIN` |
| IT Admin | Konfigurasi sistem, pengelolaan akses | `SUPER_ADMIN` |
| Auditor Internal / ISO | Penelusuran rekaman, read-only | `AUDITOR` |

---

## 3. Alur Proses Bisnis (To-Be)

### 3.1 BP-04 — Pengajuan Cuti (SOP.LMN.CBN.04)

```
┌─ KARYAWAN ─────────────────────────────────────────────────────────┐
│ 1. Buka Mobile App → Menu Cuti → Ajukan                            │
│ 2. Sistem menampilkan saldo: Hak | Terpakai | Pending | Sisa       │
│ 3. Pilih jenis cuti → pilih tanggal → sistem hitung hari kerja     │
│    (mengecualikan hari libur & hari non-kerja sesuai jadwal)       │
│ 4. VALIDASI OTOMATIS:                                              │
│    ├─ Saldo cukup?           → tidak: blokir / tawarkan Advance    │
│    ├─ H-7 hari kerja?        → tidak: blokir / tawarkan jalur      │
│    │                                     Darurat (backdate)        │
│    ├─ Tumpang tindih?        → ya: blokir + tampilkan dokumen      │
│    ├─ Lampiran wajib ada?    → tidak: blokir                       │
│    └─ Atasan sudah di-set?   → tidak: blokir + notif HCGA          │
│ 5. Submit → doc_number di-generate dari number_sequences           │
└────────────────────────────────────────────────────────────────────┘
                                 ↓ approval_instance dibuat
┌─ TAHAP 1: ATASAN LANGSUNG (SLA 2 hari kerja) ──────────────────────┐
│ • Push notification + Approval Inbox                               │
│ • Layar approval menampilkan: saldo pemohon, kalender ketersediaan │
│   tim, riwayat cuti 6 bulan, alasan                                │
│ • APPROVE → tahap 2 │ REJECT → selesai │ RETURN → kembali ke       │
│   pemohon untuk revisi                                             │
│ • H+1 tanpa aksi → pengingat; H+2 → eskalasi sesuai config         │
└────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─ TAHAP 2: DIVISION HEAD (SLA 2 hari kerja) ────────────────────────┐
│ • Keputusan akhir. Aksi & aturan sama dengan tahap 1               │
└────────────────────────────────────────────────────────────────────┘
                                 ↓ APPROVED
┌─ SISTEM (otomatis, transaksional) ─────────────────────────────────┐
│ • Debit leave_balances; catat leave_balance_ledger (entry: USE)    │
│ • Buat attendance_daily bertanda CUTI untuk setiap hari            │
│ • Terapkan flag affects_meal_transport_allowance &                 │
│   affects_attendance_allowance ke feeder payroll                   │
│ • Notifikasi ke pemohon, atasan, dan Comben                        │
└────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─ COMBEN (verifikasi, tidak memblokir) ─────────────────────────────┐
│ • Monitoring & rekonsiliasi. Dapat melakukan adjustment ber-audit  │
└────────────────────────────────────────────────────────────────────┘
```

**Jalur Darurat (Cuti Darurat):**
```
Karyawan memberitahu Atasan + Div. Head + Comben via kanal luar sistem
   → Karyawan kembali bekerja
   → Input backdate di sistem (allow_backdate = true) + lampiran wajib
   → Approval retrospektif berjalan normal
   → Jika periode payroll sudah CLOSED → tolak; alihkan ke adjustment
```

### 3.2 BP-05 — Pengajuan Izin (SOP.LMN.CBN.03)

```
Karyawan (maks. H-1) → Atasan Langsung (1 tahap) → APPROVED
   → attendance_daily = IZIN
   → Potongan gaji pokok: (Gaji Pokok ÷ 25) × jumlah hari
   → Uang makan & transport tidak diberikan hari tsb
   → Tunjangan kehadiran terdampak sesuai rule set golongan
   → Masuk feeder payroll periode berjalan
```

### 3.3 BP-06 — Lembur

```
SUPERVISOR membuat Perintah Lembur (dapat multi-karyawan)
   → sistem menentukan day_type dari kalender × jadwal karyawan
   → sistem memilih overtime_rate_rule (job_grade × day_type,
      berlaku pada tanggal lembur)
   → estimasi nilai ditampilkan
        ↓
APPROVAL sesuai workflow (default: Atasan → Div. Head untuk
   jam melebihi ambang; Atasan saja di bawah ambang)
        ↓
PELAKSANAAN → jam aktual diusulkan sistem dari attendance_logs
   (selisih jam pulang aktual vs jadwal)
        ↓
VERIFIKASI SUPERVISOR (rencana vs aktual berdampingan)
        ↓
Nilai dihitung + calculation_trace disimpan → masuk feeder payroll
```

### 3.4 BP-07 — Penyusunan Input Payroll

```
Tanggal 21 (cut-off) →  Comben menjalankan PRE-CLOSE VALIDATION
   ├─ Ada pengajuan PENDING?              → daftar, blokir
   ├─ Ada absensi anomali belum verifikasi? → daftar, blokir
   ├─ Ada karyawan aktif tanpa absensi?     → daftar, blokir
   ├─ Ada gaji pokok kosong/nol?            → daftar, blokir
   └─ Ada attendance_daily INCOMPLETE?      → daftar, blokir
        ↓ semua bersih (atau di-override Super Admin dengan alasan)
PERIOD → LOCKED
        ↓
AGREGASI FEEDER per karyawan:
   • Hari hadir / libur / sakit / cuti (per jenis) / izin / alpha
   • Jam lembur hari biasa & hari libur + nilai terhitung
   • Potongan absen = (Gaji Pokok ÷ 25) × hari tidak masuk
   • Tunjangan kehadiran % dari attendance_allowance_rules
   • Angsuran pinjaman berjalan (v2)
   • Kompensasi/potongan sisa cuti untuk karyawan resign
   → setiap baris menyimpan calculation_trace (JSONB)
        ↓
REVIEW COMBEN (drill-down per angka; override manual wajib beralasan)
        ↓
EXPORT Excel/CSV sesuai template terkonfigurasi
        ↓
[MVP] Perhitungan final di luar sistem → hasil diunggah kembali
        ↓
PUBLISH e-Payslip → PERIOD → CLOSED
```

### 3.5 BP-09 — Pinjaman Karyawan (v2, SOP.LMN.CBN.09)

```
Pra-syarat otomatis (blokir bila gagal):
   • Masa kerja ≥ 2 tahun berturut-turut
   • Tidak ada pinjaman outstanding
   • Belum mengajukan dalam 12 bulan terakhir
   • Jika pinjaman lalu baru lunas → jeda ≥ 1 bulan dari cicilan terakhir
        ↓
Karyawan isi form + lampiran (sesuai jenis keperluan)
        ↓
Atasan Langsung (rekomendasi) → Division Head (otorisasi) →
HCGA Mgr / Comben (verifikasi masa kerja, outstanding, dokumen,
   kesesuaian SK Direksi) → FAT Manager (otorisasi pencairan)
        ↓
Pencairan → buat jadwal angsuran → angsuran otomatis masuk
   potongan payroll tiap periode
        ↓
Resign / PHK → trigger pelunasan dipercepat; sisa dipotong
   dari pembayaran terakhir
```

### 3.6 BP-10 — Perjalanan Dinas (v2, SOP.LMN.CMBN.06 + SK Perdin)

```
Pra-syarat: tidak ada LPJ perdin sebelumnya yang outstanding
        ↓
Pengajuan H-7 hari kerja (atau H-1 bila darurat)
   → sistem menghitung estimasi dari perdiem_rates
     (job_grade × city_tier × expense_type)
        ↓
Atasan Langsung → Comben (pencatatan & penjelasan ketentuan)
   → Finance (verifikasi anggaran, tetapkan batas biaya)
        ↓
Pencairan uang muka (tunai / transfer)
        ↓
PELAKSANAAN — pencatatan pengeluaran + unggah bukti
   • Kekurangan dana → reimbursement (persetujuan atasan) atau
     top-up (form baru ke Finance)
        ↓
LPJ maks. 7 hari setelah kembali
   • Lebih → kembalikan ke perusahaan
   • Kurang → reimbursement dengan bukti sah
   • LEWAT 7 HARI → sistem otomatis membuat potongan payroll
     periode berjalan sebesar uang muka yang belum
     dipertanggungjawabkan  (SK Perdin Pasal 3 poin 5)
        ↓
Verifikasi Comben → Finance → selesai
```

### 3.7 BP-11 — Pembiayaan SIM (v2, SOP.LMN.CBN.02)

```
Pra-syarat otomatis: jabatan = Driver, masa kerja ≥ 1 tahun,
   pengajuan ≥ 30 hari sebelum SIM habis
   (sistem mengirim pengingat otomatis dari employee_documents.expiry_date)
        ↓
Karyawan isi form + fotokopi SIM lama + KTP
        ↓
Dept. Head → Comben/HCGA → Finance
        ↓
Skema 50:50 (persentase dari config, plafon dari SK Direksi)
        ↓
Transfer ke rekening karyawan
        ↓
Karyawan unggah SIM baru → Comben verifikasi → tutup dokumen
   → employee_documents diperbarui (expiry_date baru)
```

---

## 4. Business Rule Registry

> **Ini adalah tabel paling penting di seluruh dokumen.** Setiap baris WAJIB berupa data di database, bukan kode. Kolom "Sumber Konfigurasi" menunjuk lokasi penyimpanannya.

### 4.1 Aturan Payroll

| ID | Aturan | Nilai Default | Sumber Konfigurasi | Status |
|---|---|---|---|---|
| BR-P01 | Periode cut-off payroll | Tgl 22 s.d. 21 bulan berjalan | `system_parameters.payroll_cutoff_start_day` / `_end_day` | Terkonfirmasi |
| BR-P02 | Divisor jam lembur | 173 | `overtime_rate_rules.divisor` | Terkonfirmasi |
| BR-P03 | Divisor potongan absen | **25 (tetap, bukan hari kerja aktual)** | `system_parameters.absence_deduction_divisor` | Terkonfirmasi |
| BR-P04 | Formula potongan absen | `(Gaji Pokok ÷ 25) × hari_tidak_masuk` | `payroll_components.formula_expression` | Terkonfirmasi |
| BR-P05 | Formula potongan izin | `(Gaji Pokok ÷ 25) × hari_izin` | `leave_types.salary_deduction_formula_code` | Terkonfirmasi |
| BR-P06 | Lembur Non-Staff, hari libur | `(GP ÷ 173) × 2 × jam` | `overtime_rate_rules` | Terkonfirmasi |
| BR-P07 | Lembur Non-Staff, hari biasa | `(GP ÷ 173) × 1 × jam` | `overtime_rate_rules` | Terkonfirmasi |
| BR-P08 | Lembur Staff, semua hari | `(GP ÷ 173) × 1 × jam` | `overtime_rate_rules` | Terkonfirmasi |
| BR-P09 | Lembur Supervisor, hari libur | `Rp 150.000 / hari (8 jam)` | `overtime_rate_rules.flat_amount` | Terkonfirmasi |
| BR-P10 | Lembur Supervisor, hari biasa | **KONFLIK — default seed `NONE`** | `overtime_rate_rules` | ⚠️ **OQ-01** |
| BR-P11 | Lembur Manager | Tidak ada | `overtime_rate_rules.calc_method = NONE` | Terkonfirmasi |
| BR-P12 | Tunjangan kehadiran Non-Staff | 0 absen→100%; 1→50%; >1→0% | `attendance_allowance_rules` (`NON_STAFF_DEFAULT`) | Terkonfirmasi |
| BR-P13 | Tunjangan kehadiran Operator | 0→100%; 1→80%; 2→50%; >2→0% | `attendance_allowance_rules` (`OPERATOR_TINTIN`) | Terkonfirmasi |
| BR-P14 | Sakit | Tidak potong gaji pokok; uang makan & transport tidak diberikan | `leave_types` flags | Terkonfirmasi |
| BR-P15 | Cuti (tahunan & khusus) | Tidak potong gaji pokok; uang makan & transport tidak diberikan | `leave_types` flags | Terkonfirmasi |
| BR-P16 | BPJS karyawan — LMN/LMI | JHT 2%, Kesehatan 1% | `bpjs_rates` | Terkonfirmasi |
| BR-P17 | BPJS perusahaan — LMN/LMI | JHT 3,7%; JKK 0,24%; JKM 0,3%; Kes 4% | `bpjs_rates` | Terkonfirmasi |
| BR-P18 | BPJS perusahaan — Pabrik | JHT 3,7%; **JKK 0,89%**; JKM 0,3%; Kes 4% | `bpjs_rates` | Terkonfirmasi |
| BR-P19 | Jaminan Pensiun (JP) | **BELUM ADA DATA** | `bpjs_rates` | ⚠️ **OQ-07** |
| BR-P20 | Potongan keterlambatan / pulang cepat | **BELUM ADA FORMULA** | `payroll_components` | ⚠️ **OQ-12** |

### 4.2 Aturan Cuti & Izin

| ID | Aturan | Nilai Default | Sumber Konfigurasi | Status |
|---|---|---|---|---|
| BR-C01 | Hak cuti tahunan | 12 hari kerja/tahun | `system_parameters.annual_leave_days` | Terkonfirmasi |
| BR-C02 | Masa kerja untuk hak penuh | 12 bulan berturut-turut | `system_parameters.annual_leave_eligibility_months` | Terkonfirmasi |
| BR-C03 | Formula prorata tahun pertama | `(bulan_kerja_efektif ÷ 12) × 12` | `system_parameters.leave_prorate_formula` | Terkonfirmasi |
| BR-C04 | Basis siklus cuti | **KONFLIK — `CALENDAR_YEAR` vs `ANNIVERSARY`** | `system_parameters.leave_cycle_basis` | ⚠️ **OQ-02** |
| BR-C05 | Cuti Advance maksimum | 3 hari kerja | `leave_types.max_days_per_request` (`CUTI_ADVANCE`) | Terkonfirmasi |
| BR-C06 | Masa kedaluwarsa cuti | 1 tahun sejak jatuh tempo | `system_parameters.leave_expiry_months` | Terkonfirmasi |
| BR-C07 | Notice period cuti tahunan | 7 hari kerja | `leave_types.min_notice_days` | Terkonfirmasi |
| BR-C08 | Notice period izin | 1 hari (H-1) | `leave_types.min_notice_days` (`IZIN`) | Terkonfirmasi |
| BR-C09 | SLA keputusan approval | 2 hari kerja | `approval_workflow_steps.sla_working_days` | Terkonfirmasi |
| BR-C10 | Cuti Bersama mengurangi hak cuti | Ya | `holidays.deducts_annual_leave` | Terkonfirmasi |
| BR-C11 | Sisa cuti saat resign | Dibayarkan pada gaji bulan terakhir | `system_parameters.leave_payout_on_resign` | Terkonfirmasi |
| BR-C12 | Alur approval cuti | Atasan Langsung → Division Head | `approval_workflows` (`LEAVE_DEFAULT`) | Terkonfirmasi |
| BR-C13 | Alur approval izin | Atasan Langsung | `approval_workflows` (`PERMIT_DEFAULT`) | Terkonfirmasi |

### 4.3 Aturan Absensi

| ID | Aturan | Nilai Default | Sumber Konfigurasi | Status |
|---|---|---|---|---|
| BR-A01 | Radius geofence | 150 m | `branches.geofence_radius_m` | ⚠️ Asumsi |
| BR-A02 | Kebijakan lokasi per jabatan | `GEOFENCE_TRACKED` untuk Sales/Driver; `GEOFENCE_STRICT` untuk Staff HO | `system_parameters` per `job_position` | ⚠️ Asumsi |
| BR-A03 | Toleransi keterlambatan | Per `work_schedule_days.late_tolerance_minutes` | `work_schedule_days` | ⚠️ **OQ-11** |
| BR-A04 | Ambang selisih waktu offline sync | 12 jam | `system_parameters.offline_sync_max_drift_hours` | ⚠️ Asumsi |
| BR-A05 | Jam kerja standar | **BELUM TERKONFIRMASI** | `work_schedules` | ⚠️ **OQ-11** |
| BR-A06 | Aksi saat mock GPS terdeteksi | Tandai, jangan blokir | `system_parameters.mock_gps_action` | Keputusan produk |

### 4.4 Aturan Pinjaman, Perdin & SIM (v2)

| ID | Aturan | Nilai Default | Sumber | Status |
|---|---|---|---|---|
| BR-L01 | Masa kerja minimum pinjaman | 2 tahun berturut-turut | `loan_types.min_service_months = 24` | Terkonfirmasi |
| BR-L02 | Frekuensi pengajuan pinjaman | Maks. 1× per tahun | `loan_types.max_per_year = 1` | Terkonfirmasi |
| BR-L03 | Outstanding memblokir pengajuan baru | Ya | Aturan validasi terkonfigurasi | Terkonfirmasi |
| BR-L04 | Jeda setelah pinjaman lunas | 1 bulan dari cicilan terakhir | `system_parameters.loan_cooldown_months` | Terkonfirmasi |
| BR-L05 | Plafon & tenor pinjaman | **BELUM ADA DATA** | `loan_types` | ⚠️ **OQ-04** |
| BR-L06 | Alur approval pinjaman | Atasan → Div. Head → HCGA/Comben → FAT Manager | `approval_workflows` | Terkonfirmasi |
| BR-T01 | Notice perjalanan dinas | H-7 hari kerja (H-1 bila darurat) | `system_parameters.trip_notice_days` | Terkonfirmasi |
| BR-T02 | Batas waktu LPJ | 7 hari setelah kembali | `system_parameters.trip_report_due_days` | Terkonfirmasi |
| BR-T03 | Sanksi LPJ telat | Uang muka menjadi tanggungan pribadi, dipotong payroll berjalan | Aturan otomatis + `payroll_components` | Terkonfirmasi |
| BR-T04 | LPJ outstanding memblokir uang muka baru | Ya | Aturan validasi terkonfigurasi | Terkonfirmasi |
| BR-T05 | Akomodasi menginap di kerabat | Maks. 50% dari tarif | `perdiem_rates` + modifier | Terkonfirmasi |
| BR-T06 | Sewa roda 4 | > 3 lokasi & jarak ≥ 60 km, approval min. Manager | Aturan kondisional workflow | Terkonfirmasi |
| BR-T07 | Sewa roda 2 | > 3 lokasi & jarak ≥ 30 km, approval min. Manager | Aturan kondisional workflow | Terkonfirmasi |
| BR-T08 | Pengganti hari libur saat perdin | Diambil maks. 14 hari setelah penugasan | `leave_types` (`LIBUR_PENGGANTI`) | Terkonfirmasi |
| BR-T09 | Tarif uang makan / saku / akomodasi / transport | **BELUM ADA LAMPIRAN SK** | `perdiem_rates` | ⚠️ **OQ-05** |
| BR-S01 | Eligibility pembiayaan SIM | Jabatan Driver, masa kerja ≥ 1 tahun | Aturan validasi terkonfigurasi | Terkonfirmasi |
| BR-S02 | Skema pembiayaan SIM | 50% perusahaan : 50% karyawan | `system_parameters.license_company_share_pct` | Terkonfirmasi |
| BR-S03 | Notice pengajuan SIM | ≥ 30 hari sebelum SIM habis | `system_parameters.license_notice_days` | Terkonfirmasi |
| BR-S04 | Plafon nominal SIM | **BELUM ADA DATA** | `system_parameters` | ⚠️ **OQ-06** |
| BR-S05 | Alur approval SIM | Dept. Head → Comben/HCGA → Finance | `approval_workflows` | Terkonfirmasi |

---

### 4.5 Registry Master Data — Aturan Kepemilikan & Perubahan

> Inventaris lengkap 36 tabel master ada di **PRD Seksi 6.M1B.4**. Bagian ini mengatur **bagaimana** master data boleh berubah.

#### 4.5.1 Klasifikasi Master Data

| Kelas | Definisi | Perilaku Saat Diubah | Contoh |
|---|---|---|---|
| **Kelas A — Finansial** | Memengaruhi perhitungan uang | **WAJIB effective-dated.** Perubahan menciptakan baris baru. Baris lama tidak boleh disentuh | `overtime_rate_rules`, `bpjs_rates`, `attendance_allowance_rules`, `employee_component_assignments`, `perdiem_rates`, `system_parameters` |
| **Kelas B — Struktural** | Memengaruhi routing & scope | **WAJIB effective-dated.** Perubahan struktur tidak boleh mengubah dokumen historis | `employee_assignments`, `reporting_lines` |
| **Kelas C — Referensial** | Daftar pilihan & atribut deskriptif | Update in-place diizinkan; hapus dilarang, hanya `is_active = false` | `job_grades`, `branches`, `divisions`, `job_positions`, `reference_data`, `banks` |
| **Kelas D — Sistem** | Registry teknis | Hanya lewat seed migration (permission) atau Super Admin (menu, feature flag) | `permissions`, `menus`, `sensitive_fields`, `feature_flags` |

**Aturan mengikat:**
1. Setiap tabel Kelas A dan B WAJIB memiliki `effective_from` (NOT NULL) dan `effective_to` (NULL = berlaku hingga sekarang).
2. Setiap tabel Kelas A dan B WAJIB memiliki constraint `EXCLUDE USING gist` anti-tumpang-tindih, seperti pola pada `system_parameters` (Seksi 6.2).
3. Setiap pembacaan tabel Kelas A dan B WAJIB menyertakan tanggal acuan. Query tanpa filter tanggal adalah **cacat blocker**.
4. Setiap tabel Kelas C WAJIB memiliki `is_active` dan `ON DELETE RESTRICT` pada foreign key yang merujuknya.

#### 4.5.2 Pola Layar Master Data (Wajib Seragam)

Seluruh layar master WAJIB memakai pola yang sama agar dapat dibangun sebagai *generic CRUD scaffold*, bukan 36 layar buatan tangan:

```
┌─ Header ────────────────────────────────────────────────┐
│ Judul  |  [Cari]  [Filter: Aktif/Nonaktif]  [+ Tambah]  │
│                          [Import Excel] [Export Excel]  │
├─ Tabel ─────────────────────────────────────────────────┤
│ Kode │ Nama │ ...atribut... │ Berlaku Sejak │ Status │ ⋮│
│                                                          │
│ ⋮ = Ubah | Riwayat Perubahan | Nonaktifkan               │
├─ Form (drawer/dialog) ──────────────────────────────────┤
│ Field...                                                 │
│ [Kelas A/B] Berlaku Sejak: [tanggal]  ← WAJIB           │
│                                                          │
│ ⚠ Dampak: 47 karyawan, 3 periode payroll terpengaruh    │
│                                    [Batal]  [Simpan]    │
└──────────────────────────────────────────────────────────┘
```

| # | Requirement Teknis |
|---|---|
| BR-MD-01 | Dibangun sebagai **satu komponen generik** (`<MasterDataTable>` + `<MasterDataForm>`) yang dikonfigurasi lewat definisi skema per entity, bukan 36 halaman terpisah |
| BR-MD-02 | Definisi kolom, validasi, dan label WAJIB berasal dari file skema deklaratif per entity (TypeScript config object), bukan JSX yang di-*copy-paste* |
| BR-MD-03 | Panel "Riwayat Perubahan" WAJIB membaca dari `audit_logs` dengan filter `entity_name` + `entity_id` |
| BR-MD-04 | Preview dampak (`⚠ Dampak: ...`) WAJIB dihitung server-side lewat endpoint `POST /config/{entity}/impact-preview` sebelum simpan |
| BR-MD-05 | Import Excel WAJIB memakai pipeline yang sama dengan import karyawan: staging table, dry-run, laporan error, atomic per batch, `import_batch_id` yang dapat di-rollback |

#### 4.5.3 Endpoint Master Data

| Method | Endpoint | Permission |
|---|---|---|
| GET/POST | `/master/companies` | `master.company.read` / `.manage` |
| GET/POST/PATCH | `/master/branches` | `master.branch.read` / `.manage` |
| GET/POST/PATCH | `/master/divisions` \| `/departments` | `master.org.read` / `.manage` |
| GET/POST/PATCH | `/master/job-positions` | `master.position.read` / `.manage` |
| GET/POST/PATCH | `/master/job-grades` | `master.grade.read` / `.manage` |
| GET/POST/PATCH | `/master/banks` | `master.bank.read` / `.manage` |
| GET/POST/PATCH | `/master/reference-data` | `master.reference.read` / `.manage` |
| GET/POST/PATCH | `/master/payroll-components` | `master.payroll_component.read` / `.manage` |
| GET/POST/PATCH | `/master/attendance-allowance-rules` | `master.allowance_rule.read` / `.manage` |
| GET/POST/PATCH | `/master/bpjs-rates` | `master.bpjs.read` / `.manage` |
| POST | `/master/{entity}/impact-preview` | `{entity}.manage` |
| POST | `/master/{entity}/import` | `{entity}.manage` |
| GET | `/master/{entity}/export` | `{entity}.read` |
| GET | `/master/{entity}/:id/history` | `audit.log.read` |

### 4.6 Registry Format, Validasi & Laporan (Modul M8B)

> Spesifikasi fungsional lengkap ada di **PRD Seksi 6.M8B**. Bagian ini adalah skema dan aturan implementasinya.

#### 4.6.1 DDL

```sql
-- ============================================================
-- FORMAT SETTINGS  — sumber tunggal seluruh format tampilan
-- ============================================================
CREATE TABLE format_settings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_key   VARCHAR(60)  NOT NULL UNIQUE,   -- date.display, currency.symbol, ...
    format_value TEXT         NOT NULL,
    data_type    VARCHAR(20)  NOT NULL,          -- STRING|NUMBER|JSON
    applies_to   VARCHAR(20)  NOT NULL,          -- WEB|MOBILE|BOTH|EXPORT
    description  TEXT,
    is_editable  BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VALIDATION RULES — backend adalah sumber kebenaran
-- ============================================================
CREATE TABLE validation_rules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name   VARCHAR(60) NOT NULL,
    field_name    VARCHAR(60) NOT NULL,
    rule_type     VARCHAR(30) NOT NULL,   -- REQUIRED|REGEX|RANGE|UNIQUE|
                                          -- LENGTH|CROSS_FIELD|LOOKUP
    rule_config   JSONB       NOT NULL,   -- {"pattern":"^\\d{16}$"} / {"min":15,"max":65}
    severity      VARCHAR(10) NOT NULL,   -- ERROR|WARNING|INFO
    error_message TEXT        NOT NULL,   -- Bahasa Indonesia, dapat diedit Admin
    applies_on    VARCHAR(20) NOT NULL,   -- CREATE|UPDATE|IMPORT|ALL
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order    INTEGER     NOT NULL DEFAULT 0,
    CONSTRAINT chk_vr_severity CHECK (severity IN ('ERROR','WARNING','INFO'))
);
CREATE INDEX idx_vr_entity ON validation_rules(entity_name, field_name)
    WHERE is_active;

-- ============================================================
-- NUMBER SEQUENCES — NIK karyawan & nomor dokumen
-- ============================================================
CREATE TABLE number_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_code   VARCHAR(60) NOT NULL UNIQUE,  -- EMPLOYEE_NIK, DOC_LEAVE, ...
    pattern         VARCHAR(200) NOT NULL,        -- {YYYY}{NNNN}
    reset_period    VARCHAR(20) NOT NULL DEFAULT 'NEVER',  -- NEVER|YEARLY|MONTHLY
    padding_length  SMALLINT    NOT NULL DEFAULT 4,
    current_number  BIGINT      NOT NULL DEFAULT 0,
    last_reset_key  VARCHAR(20),                  -- '2026' atau '2026-08'
    allow_manual    BOOLEAN     NOT NULL DEFAULT FALSE,
    scope_type      VARCHAR(20),                  -- NULL|COMPANY|BRANCH
    scope_ref_id    UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sequence_code, scope_type, scope_ref_id)
);

-- ============================================================
-- REPORT DEFINITIONS — kolom & layout laporan sebagai data
-- ============================================================
CREATE TABLE report_definitions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code      VARCHAR(30)  NOT NULL UNIQUE,  -- LAP-ABS-01
    name             VARCHAR(150) NOT NULL,
    category         VARCHAR(40)  NOT NULL,
    data_source      VARCHAR(100) NOT NULL,         -- nama view/query terdaftar
    columns          JSONB        NOT NULL,         -- [{field,label,width,align,format,subtotal}]
    default_filters  JSONB,
    group_by         JSONB,
    output_formats   JSONB        NOT NULL,         -- ["PDF","XLSX","CSV"]
    permission_code  VARCHAR(120) REFERENCES permissions(code),
    header_template  TEXT,
    footer_template  TEXT,
    filename_pattern VARCHAR(200),
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE
);
```

#### 4.6.2 Aturan Implementasi

| # | Aturan | Konsekuensi Pelanggaran |
|---|---|---|
| BR-FMT-01 | Tanggal disimpan sebagai `DATE`/`TIMESTAMPTZ` PostgreSQL. `DDMMYYYY` **hanya** format tampilan/input | Menyimpan `VARCHAR(8)` merusak `ORDER BY`, `BETWEEN`, dan perhitungan hari kerja → **cacat blocker** |
| BR-FMT-02 | API bertukar data dalam ISO 8601. Konversi terjadi di klien | Mengubah kontrak API demi preferensi tampilan mengunci integrasi masa depan |
| BR-FMT-03 | Frontend membaca format dari `GET /config/formats` saat bootstrap, disimpan di provider global | String format yang di-*hardcode* di komponen = **cacat blocker** |
| BR-FMT-04 | Flutter: buat satu `AppFormatter` singleton yang di-inject; **dilarang** memanggil `DateFormat(...)` langsung di widget | Format tidak konsisten antar layar |
| BR-FMT-05 | Web: buat satu modul `lib/format.ts`; **dilarang** memanggil `Intl.DateTimeFormat` atau `dayjs().format('...')` di komponen | Sama seperti di atas |
| BR-VAL-01 | Validasi backend adalah sumber kebenaran. Frontend boleh mencerminkannya lewat `GET /config/validation-rules?entity=...` untuk umpan balik instan | Validasi hanya di frontend = dapat di-*bypass* |
| BR-VAL-02 | Severity `WARNING` **wajib** disediakan untuk field yang datanya sudah kotor (NIK KTP, no. HP, BPJS). Memaksa `ERROR` akan menggagalkan migrasi 300 baris | Migrasi mandek |
| BR-VAL-03 | Pesan error tersimpan di database dalam Bahasa Indonesia dan dapat diedit HCGA tanpa deploy | — |
| BR-NUM-01 | Generator NIK & nomor dokumen wajib memakai `SELECT ... FOR UPDATE` atau `pg_advisory_xact_lock` pada baris sequence | Tabrakan nomor pada input bersamaan |
| BR-NUM-02 | Nomor dibangkitkan saat **submit**, bukan saat draft | Lompatan nomor → temuan audit ISO |
| BR-RPT-01 | Renderer laporan menerima `report_code` + filter, membaca definisi dari `report_definitions`, lalu mengeksekusi query terdaftar. **Dilarang** menyusun SQL dari input pengguna | SQL injection |
| BR-RPT-02 | Renderer wajib menerapkan scope guard yang sama dengan API biasa | Kebocoran data lintas cabang lewat laporan |

#### 4.6.3 Endpoint

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/config/formats` | *(publik untuk user terautentikasi)* |
| PATCH | `/config/formats` | `config.format.manage` |
| GET | `/config/validation-rules` | *(publik untuk user terautentikasi)* |
| POST/PATCH | `/config/validation-rules` | `config.validation.manage` |
| GET/PATCH | `/config/number-sequences` | `config.sequence.manage` |
| GET | `/config/number-sequences/:code/preview` | `config.sequence.manage` |
| GET/POST/PATCH | `/config/reports` | `config.report.manage` |
| POST | `/reports/:code/generate` | Dari `report_definitions.permission_code` |
| GET | `/config/app-settings` | *(publik untuk user terautentikasi)* — dipanggil Flutter saat start |

---

### 4.7 Skema Roster, Storage & Pajak

#### 4.7.1 Roster Management

```sql
CREATE TABLE work_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    code            VARCHAR(40)  NOT NULL UNIQUE,   -- HO_STANDARD, FIELD_MARKET
    name            VARCHAR(120) NOT NULL,
    schedule_type   VARCHAR(20)  NOT NULL,          -- FIXED|SHIFT|FLEXIBLE
    weekly_target_minutes INTEGER,                  -- 2400 = 40 jam
    daily_standard_minutes INTEGER,                 -- NULL untuk FLEXIBLE (lihat OQ-19)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_ws_type CHECK (schedule_type IN ('FIXED','SHIFT','FLEXIBLE'))
);

CREATE TABLE work_schedule_days (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_schedule_id       UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
    day_of_week            SMALLINT NOT NULL,       -- 1=Senin .. 7=Minggu
    is_working_day         BOOLEAN  NOT NULL DEFAULT TRUE,
    start_time             TIME,                    -- NULL untuk FLEXIBLE
    end_time               TIME,
    break_minutes          SMALLINT NOT NULL DEFAULT 60,
    late_tolerance_minutes SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (work_schedule_id, day_of_week)
);

-- Penugasan berjenjang; prioritas: EMPLOYEE > POSITION > GRADE > BRANCH > COMPANY
CREATE TABLE schedule_assignments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_schedule_id UUID NOT NULL REFERENCES work_schedules(id),
    scope_type       VARCHAR(20) NOT NULL,
    scope_ref_id     UUID        NOT NULL,
    priority         SMALLINT    NOT NULL,          -- 1=EMPLOYEE .. 5=COMPANY
    effective_from   DATE        NOT NULL,
    effective_to     DATE,
    CONSTRAINT chk_sa_scope CHECK (scope_type IN
        ('EMPLOYEE','POSITION','GRADE','BRANCH','COMPANY'))
);

-- Penimpaan per tanggal (tukar shift, lembur terjadwal, dsb.)
CREATE TABLE schedule_overrides (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id),
    work_date        DATE NOT NULL,
    work_schedule_id UUID REFERENCES work_schedules(id),
    is_day_off       BOOLEAN NOT NULL DEFAULT FALSE,
    reason           TEXT NOT NULL,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, work_date)
);
```

**Algoritma resolusi jadwal efektif (wajib dipakai seluruh modul):**

```
resolveSchedule(employee_id, work_date):
  1. Cek schedule_overrides  → jika ada, PAKAI (prioritas mutlak)
  2. Cek holidays            → jika libur, kembalikan LIBUR
  3. Query schedule_assignments yang berlaku pada work_date,
     cocokkan scope_ref_id ke employee/position/grade/branch/company
     ORDER BY priority ASC LIMIT 1
  4. Tidak ada hasil → error EMPLOYEE_HAS_NO_SCHEDULE
     (memblokir penutupan periode, bukan diam-diam dianggap libur)
```

#### 4.7.2 Berkas & Object Storage

```sql
CREATE TABLE upload_policies (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code        VARCHAR(40) NOT NULL UNIQUE,   -- ATTENDANCE_SELFIE, TRIP_RECEIPT
    allowed_mime_types JSONB       NOT NULL,
    max_size_kb        INTEGER     NOT NULL,
    max_width_px       INTEGER,
    max_height_px      INTEGER,
    compress_quality   SMALLINT    NOT NULL DEFAULT 70,   -- KEPUTUSAN PO
    max_files          SMALLINT    NOT NULL DEFAULT 1,
    retention_months   INTEGER,
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE attachments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code    VARCHAR(40) NOT NULL REFERENCES upload_policies(policy_code),
    entity_name    VARCHAR(60) NOT NULL,
    entity_id      UUID        NOT NULL,
    storage_driver VARCHAR(20) NOT NULL DEFAULT 'local-disk',
    object_key     VARCHAR(300) NOT NULL UNIQUE,  -- {entity}/{yyyy}/{mm}/{uuid}.{ext}
    original_name  VARCHAR(255) NOT NULL,
    mime_type      VARCHAR(100) NOT NULL,
    size_bytes     BIGINT      NOT NULL,
    checksum_sha256 CHAR(64)   NOT NULL,
    uploaded_by    UUID NOT NULL REFERENCES users(id),
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_orphan      BOOLEAN     NOT NULL DEFAULT TRUE,   -- FALSE saat transaksi commit
    purge_after    DATE
);
CREATE INDEX idx_att_entity ON attachments(entity_name, entity_id);
CREATE INDEX idx_att_orphan ON attachments(uploaded_at) WHERE is_orphan;
```

| # | Aturan Implementasi | Konsekuensi Pelanggaran |
|---|---|---|
| BR-FILE-01 | **Tidak ada kolom `BYTEA`/`BLOB` di seluruh skema.** Gerbang CI memindai migration dan gagal bila menemukannya | Backup membengkak, restore gagal → **cacat blocker** |
| BR-FILE-02 | Alur unggah: `POST /uploads/presign` → klien PUT langsung ke storage → `POST /uploads/confirm` (kirim `object_key` + checksum) → transaksi commit set `is_orphan = false` | Berkas melewati memori server = kehabisan memori saat unggah bersamaan |
| BR-FILE-03 | `StorageDriver` adalah antarmuka dengan dua implementasi: `LocalDiskDriver` (default, tanpa konfigurasi) dan `S3Driver` (aktif dengan mengubah `STORAGE_DRIVER=s3`) | — |
| BR-FILE-04 | Kompresi kualitas **70** dilakukan di klien: Flutter `flutter_image_compress(quality: 70)`, Web `canvas.toBlob('image/jpeg', 0.7)`. Server memverifikasi hasil akhir | Beban server naik, kuota data pengguna terbakar |
| BR-FILE-05 | Verifikasi tipe berkas dari **magic bytes** (`file-type`), bukan ekstensi/`Content-Type` | Unggahan berbahaya menyamar sebagai gambar |
| BR-FILE-06 | Job harian membersihkan `attachments WHERE is_orphan AND uploaded_at < NOW() - 24h` dan yang melewati `purge_after` | Storage penuh oleh berkas batal |
| BR-FILE-07 | Mobile: antrean unggah di Drift dengan retry *exponential backoff*; transaksi utama tersimpan dengan `attachment_pending = true` | Absensi gagal hanya karena foto gagal terkirim |

#### 4.7.3 Tarif Pajak (TER) & BPJS

```sql
CREATE TABLE tax_ter_categories (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code  VARCHAR(10) NOT NULL,          -- A | B | C
    ptkp_status    VARCHAR(10) NOT NULL,          -- TK/0, K/0, K/1, K/2, K/3, ...
    effective_from DATE NOT NULL,
    effective_to   DATE,
    UNIQUE (ptkp_status, effective_from)
);

CREATE TABLE tax_ter_brackets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code  VARCHAR(10)    NOT NULL,
    income_from    DECIMAL(18,2)  NOT NULL,
    income_to      DECIMAL(18,2),                 -- NULL = tak terbatas
    rate_percent   DECIMAL(6,3)   NOT NULL,
    effective_from DATE           NOT NULL,
    effective_to   DATE
);
CREATE INDEX idx_ter_lookup
    ON tax_ter_brackets(category_code, effective_from, income_from);

ALTER TABLE bpjs_rates
    ADD COLUMN salary_cap DECIMAL(18,2),          -- ceiling upah
    ADD COLUMN rounding_rule VARCHAR(20) DEFAULT 'ROUND';
```

| # | Aturan |
|---|---|
| BR-TAX-01 | Tabel `tax_ter_brackets` **wajib effective-dated** (Kelas A). Perubahan tarif tidak boleh mengubah perhitungan periode lampau |
| BR-TAX-02 | Nilai dikosongkan sampai OQ-23 dijawab. Sistem menampilkan "TER belum dikonfigurasi" dan **tidak menghitung PPh21**, bukan menghitung dengan 0% |
| BR-TAX-03 | Import Excel wajib tersedia untuk `tax_ter_brackets` (puluhan baris per kategori) |
| BR-TAX-04 | Setiap perhitungan menyimpan `ter_category`, `bracket_id`, `rate_percent`, dan `effective_from` ke `calculation_trace` — bukti wajib saat pemeriksaan pajak |
| BR-TAX-05 | **Sampai OQ-21 diputuskan, jalankan Opsi A**: TER dihitung dan ditampilkan sebagai *referensi* di feeder, belum memotong gaji |

---

## 5. Arsitektur Teknis

### 5.1 Tumpukan Teknologi

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Web Frontend | **Next.js 15 (App Router)** + TypeScript + **shadcn/ui** + Tailwind CSS | Component-driven, aksesibel, tanpa dependensi berat |
| Mobile | **Flutter 3.x (Dart)** | Ditetapkan PO. Performa native, konsisten di Android entry-level, satu basis kode dua platform |
| Mobile — State & Arsitektur | Riverpod + `freezed` + `dio` + `retrofit` | State management yang dapat diuji; klien HTTP dengan interceptor auth & retry |
| Mobile — Local DB | **Drift (SQLite)** + `flutter_secure_storage` | Antrean absensi offline terenkripsi, query yang aman secara tipe |
| Mobile — Lokasi & Kamera | `geolocator` (termasuk `isMocked`), `camera`, `flutter_image_compress` | Deteksi mock GPS bawaan; kompresi swafoto di device |
| Mobile — Background Sync | `workmanager` + `connectivity_plus` | Sinkronisasi antrean offline saat sinyal kembali |
| Backend API | **NestJS (Node 22)** + TypeScript | Modular, DI, dekorator cocok untuk anotasi permission |
| ORM | Prisma | Migration ketat, middleware untuk scope guard |
| Database | **PostgreSQL 16** | JSONB untuk `calculation_trace`, RLS, CTE rekursif untuk `TEAM_TREE` |
| Cache & Queue | Redis 7 + BullMQ | Cache permission, job terjadwal, antrean notifikasi |
| Object Storage | S3-compatible (MinIO on-prem / S3) | Foto absensi, lampiran, PDF slip |
| Auth | JWT (access 15 mnt + refresh 7 hr, rotasi) + Argon2id | Standar, tanpa vendor lock |
| Push | Firebase Cloud Messaging | Gratis, andal di Android |
| PDF | Puppeteer (worker terpisah) | Slip gaji dari template HTML yang dapat diedit |
| Observability | OpenTelemetry + Grafana/Loki + Sentry | Wajib untuk debugging payroll |
| CI/CD | GitHub Actions → Docker → target hosting | — |

> ⚠️ Keputusan hosting menunggu **OQ-13**. Seluruh komponen dipilih agar netral cloud/on-prem.

### 5.2 Diagram Komponen

```
┌───────────────┐        ┌───────────────┐
│  Mobile App   │        │  Web Dashboard│
│  (Flutter)    │        │  (Next.js)    │
│ • Drift/SQLite│        │ • shadcn/ui   │
│ • Riverpod    │        │ • Tailwind    │
│ • Offline queue│       │               │
└───────┬───────┘        └───────┬───────┘
        │  HTTPS / JWT           │
        └────────────┬───────────┘
                     ▼
        ┌────────────────────────────┐
        │      API Gateway (NestJS)  │
        │  • AuthGuard               │
        │  • PermissionGuard  ◄──────┼── permissions + group_permissions
        │  • DataScopeInterceptor ◄──┼── data_scope resolver
        │  • FieldMaskInterceptor ◄──┼── sensitive_fields
        │  • AuditInterceptor  ──────┼──► audit_logs
        └────────────┬───────────────┘
                     ▼
   ┌─────────────────────────────────────────────┐
   │            Domain Modules                    │
   │ Identity │ Org │ Attendance │ Leave │ OT     │
   │ Payroll  │ Loan│ Trip       │ License        │
   └───────┬──────────────────┬──────────────────┘
           ▼                  ▼
   ┌───────────────┐   ┌──────────────────┐
   │ Rule Engine   │   │ Workflow Engine  │
   │ • formula eval│   │ • step resolver  │
   │ • param lookup│   │ • SLA & escalate │
   │   (temporal)  │   │ • delegation     │
   └───────┬───────┘   └────────┬─────────┘
           ▼                    ▼
   ┌──────────────────────────────────────┐
   │  PostgreSQL 16   │  Redis  │  S3     │
   └──────────────────────────────────────┘
           ▲
   ┌───────┴────────────────────────┐
   │  Worker (BullMQ)               │
   │ • rekap absensi harian         │
   │ • kedaluwarsa cuti             │
   │ • pengingat SLA & eskalasi     │
   │ • pengingat kontrak & SIM      │
   │ • render PDF slip              │
   └────────────────────────────────┘
```

### 5.3 Implementasi "Zero Hardcode"

**Empat mekanisme yang WAJIB ada. Tanpa keempatnya, klaim zero-hardcode batal.**

#### (1) Temporal Parameter Resolver

```typescript
// src/core/config/parameter.service.ts
// Setiap pembacaan parameter WAJIB menyertakan tanggal acuan.
// Ini mencegah perubahan parameter merusak perhitungan periode lampau.

async resolve<T>(key: string, asOf: Date, scope?: ParamScope): Promise<T> {
  // SELECT param_value FROM system_parameters
  // WHERE param_key = $key
  //   AND (scope_type IS NULL OR (scope_type = $type AND scope_ref_id = $id))
  //   AND effective_from <= $asOf
  //   AND (effective_to IS NULL OR effective_to > $asOf)
  // ORDER BY scope_type NULLS LAST, effective_from DESC
  // LIMIT 1
}
```
**Aturan review:** setiap pemanggilan `resolve()` tanpa argumen `asOf` adalah **cacat blocker**.

#### (2) Formula Engine dengan Whitelist

```typescript
// src/core/rules/formula.engine.ts
// Formula disimpan sebagai string di payroll_components.formula_expression,
// contoh: "BASIC_SALARY / ABSENCE_DIVISOR * ABSENCE_DAYS"
// Dievaluasi dengan expr-eval (sandbox, TANPA akses ke scope JS).

const ALLOWED_FUNCTIONS = ['min','max','round','floor','ceil','abs','if'];
// Variabel hanya boleh berasal dari context yang di-inject secara eksplisit.
// eval(), Function(), dan akses properti dinamis DILARANG.

evaluate(expression: string, context: Record<string, number>): {
  value: number;
  trace: CalculationTrace;   // WAJIB: expression, variabel, nilai antara, hasil
}
```
> **Trade-off yang diakui secara sadar:** *primitive* matematika dan daftar variabel yang tersedia tetap berada di kode. Yang dikonfigurasi adalah **komposisinya**. Ini batas yang wajar — mengonfigurasi primitive akan menghasilkan bahasa pemrograman buatan sendiri yang tidak dapat dipelihara. Dokumentasikan daftar variabel yang tersedia di UI konfigurasi.

#### (3) Permission & Scope Guard

```typescript
// Setiap endpoint WAJIB dianotasi. Tanpa anotasi → deny by default.
@RequirePermission('leave.request.approve')
@ApplyDataScope('employee_id')
@Post(':id/approve')
async approve(@Param('id') id: string) { /* ... */ }
```

```typescript
// Prisma middleware menyuntikkan filter scope pada setiap query
// yang menyentuh tabel ber-scope. Ini adalah PERTAHANAN TERAKHIR:
// developer yang lupa memfilter tetap tidak bisa membocorkan data.
prisma.$use(async (params, next) => {
  if (SCOPED_MODELS.includes(params.model)) {
    params.args.where = {
      AND: [params.args.where, await scopeResolver.build(ctx.user, params.model)]
    };
  }
  return next(params);
});
```

#### (4) Workflow Engine

```json
// Contoh definisi approval_workflows — dibuat lewat UI, disimpan sebagai data
{
  "code": "LEAVE_DEFAULT",
  "module_code": "LEAVE",
  "version": 3,
  "steps": [
    {
      "step_order": 1,
      "approver_type": "DIRECT_SUPERVISOR",
      "sla_working_days": 2,
      "escalation_action": "NOTIFY_THEN_ESCALATE",
      "allow_delegate": true,
      "condition_expression": null
    },
    {
      "step_order": 2,
      "approver_type": "DIVISION_HEAD",
      "sla_working_days": 2,
      "escalation_action": "NOTIFY_ONLY",
      "allow_delegate": true,
      "condition_expression": "TOTAL_DAYS > 0"
    },
    {
      "step_order": 3,
      "approver_type": "SPECIFIC_GROUP",
      "approver_ref": "HCGA_MANAGER",
      "sla_working_days": 2,
      "condition_expression": "TOTAL_DAYS >= 5"
    }
  ]
}
```
**Aturan tegas:** `approval_instances` menyimpan `workflow_version` saat instance dibuat. Perubahan definisi **tidak boleh** mengubah instance yang sedang berjalan.

---

## 6. Skema Database — DDL Inti

> Berikut DDL untuk modul yang paling menentukan (Modul 0). Modul lain mengikuti pola yang sama; kerangka entitas lengkap ada di PRD Seksi 7.

### 6.1 Modul 0 — Akses & Otorisasi

```sql
-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id           UUID UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
    login_nik             VARCHAR(20)  UNIQUE,
    email                 VARCHAR(150) UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    status                VARCHAR(30)  NOT NULL DEFAULT 'PENDING_ACTIVATION',
    must_change_password  BOOLEAN      NOT NULL DEFAULT TRUE,
    two_factor_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
    two_factor_secret     VARCHAR(255),
    failed_attempts       SMALLINT     NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_status CHECK (
        status IN ('ACTIVE','INACTIVE','LOCKED','PENDING_ACTIVATION')),
    CONSTRAINT chk_users_identifier CHECK (
        login_nik IS NOT NULL OR email IS NOT NULL)
);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE user_groups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(50)  NOT NULL UNIQUE,
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    is_system           BOOLEAN      NOT NULL DEFAULT FALSE,
    requires_2fa        BOOLEAN      NOT NULL DEFAULT FALSE,
    max_session_minutes INTEGER,
    allowed_ip_cidr     TEXT[],
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE user_group_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES user_groups(id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, group_id)
);

-- ============================================================
-- PERMISSION REGISTRY  (diisi lewat seed migration per modul)
-- ============================================================
CREATE TABLE permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(120) NOT NULL UNIQUE,   -- format: modul.resource.action
    module       VARCHAR(50)  NOT NULL,
    resource     VARCHAR(50)  NOT NULL,
    action       VARCHAR(30)  NOT NULL,
    description  TEXT,
    is_dangerous BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_permissions_module ON permissions(module);

-- ============================================================
-- GROUP x PERMISSION  (inti matriks hak akses)
-- ============================================================
CREATE TABLE group_permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    data_scope    VARCHAR(30) NOT NULL DEFAULT 'SELF',
    scope_config  JSONB,        -- untuk data_scope = CUSTOM
    masked_fields JSONB,        -- ["basic_salary","bank_account_no"]
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, permission_id),
    CONSTRAINT chk_gp_scope CHECK (data_scope IN
        ('SELF','DIRECT_REPORT','TEAM_TREE','BRANCH',
         'DIVISION','ENTITY','ALL','CUSTOM'))
);

-- ============================================================
-- OVERRIDE PER USER  (DENY selalu menang)
-- ============================================================
CREATE TABLE user_permission_overrides (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    effect        VARCHAR(10) NOT NULL,
    data_scope    VARCHAR(30),
    reason        TEXT NOT NULL,
    granted_by    UUID NOT NULL REFERENCES users(id),
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, permission_id),
    CONSTRAINT chk_upo_effect CHECK (effect IN ('GRANT','DENY'))
);

-- ============================================================
-- SCOPE BINDING  (untuk data_scope = CUSTOM / BRANCH multi)
-- ============================================================
CREATE TABLE user_scope_bindings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_type   VARCHAR(20) NOT NULL,   -- BRANCH | DIVISION | COMPANY
    scope_ref_id UUID NOT NULL,
    UNIQUE (user_id, scope_type, scope_ref_id)
);

-- ============================================================
-- MENU REGISTRY
-- ============================================================
CREATE TABLE menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES menus(id) ON DELETE CASCADE,
    code            VARCHAR(60)  NOT NULL UNIQUE,
    label           VARCHAR(100) NOT NULL,
    icon            VARCHAR(60),
    route           VARCHAR(200),
    platform        VARCHAR(10)  NOT NULL DEFAULT 'BOTH',
    permission_code VARCHAR(120) REFERENCES permissions(code),
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_menu_platform CHECK (platform IN ('WEB','MOBILE','BOTH'))
);

-- ============================================================
-- SENSITIVE FIELDS
-- ============================================================
CREATE TABLE sensitive_fields (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name    VARCHAR(60) NOT NULL,
    field_name     VARCHAR(60) NOT NULL,
    default_masked BOOLEAN     NOT NULL DEFAULT TRUE,
    description    TEXT,
    UNIQUE (entity_name, field_name)
);

-- ============================================================
-- DELEGASI APPROVAL
-- ============================================================
CREATE TABLE approval_delegations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_user_id UUID NOT NULL REFERENCES users(id),
    delegate_user_id  UUID NOT NULL REFERENCES users(id),
    module_codes      JSONB NOT NULL,
    start_date        DATE  NOT NULL,
    end_date          DATE  NOT NULL,
    reason            TEXT  NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_deleg_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_deleg_self  CHECK (delegator_user_id <> delegate_user_id)
);

-- ============================================================
-- AUDIT LOG  (APPEND ONLY — user aplikasi tanpa hak UPDATE/DELETE)
-- ============================================================
CREATE TABLE audit_logs (
    id             BIGSERIAL PRIMARY KEY,
    actor_user_id  UUID REFERENCES users(id),
    action         VARCHAR(60) NOT NULL,
    entity_name    VARCHAR(60) NOT NULL,
    entity_id      VARCHAR(60),
    before_data    JSONB,
    after_data     JSONB,
    ip_address     INET,
    user_agent     TEXT,
    request_id     VARCHAR(60),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_user_id, created_at DESC);

REVOKE UPDATE, DELETE ON audit_logs FROM lahans_app;
```

### 6.2 Parameter Sistem (Temporal)

```sql
CREATE TABLE system_parameters (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    param_key      VARCHAR(100) NOT NULL,
    param_value    TEXT         NOT NULL,
    data_type      VARCHAR(20)  NOT NULL,   -- STRING|NUMBER|BOOLEAN|JSON|DATE
    scope_type     VARCHAR(20),             -- NULL = global
    scope_ref_id   UUID,
    effective_from DATE         NOT NULL,
    effective_to   DATE,
    description    TEXT,
    updated_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sp_period CHECK (effective_to IS NULL
                                    OR effective_to > effective_from)
);

-- Cegah periode berlaku yang tumpang tindih untuk key+scope yang sama
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE system_parameters ADD CONSTRAINT excl_sp_overlap
  EXCLUDE USING gist (
    param_key WITH =,
    COALESCE(scope_type,'')  WITH =,
    COALESCE(scope_ref_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  );
```

> **Constraint `EXCLUDE` di atas adalah inti keandalan sistem.** Tanpa itu, dua parameter yang berlaku bersamaan akan menghasilkan perhitungan payroll yang tidak deterministik.

### 6.3 Resolusi Data Scope — Contoh Query

```sql
-- TEAM_TREE: seluruh bawahan rekursif dari seorang atasan,
-- menghormati masa berlaku garis pelaporan, dengan batas kedalaman.
WITH RECURSIVE subordinates AS (
    SELECT e.id, 1 AS depth
    FROM employees e
    JOIN reporting_lines rl ON rl.employee_id = e.id
    WHERE rl.supervisor_id = $1
      AND rl.line_type = 'DIRECT'
      AND rl.effective_from <= CURRENT_DATE
      AND (rl.effective_to IS NULL OR rl.effective_to > CURRENT_DATE)

    UNION ALL

    SELECT e.id, s.depth + 1
    FROM employees e
    JOIN reporting_lines rl ON rl.employee_id = e.id
    JOIN subordinates s     ON rl.supervisor_id = s.id
    WHERE s.depth < $2                     -- batas kedalaman dari config
      AND rl.effective_from <= CURRENT_DATE
      AND (rl.effective_to IS NULL OR rl.effective_to > CURRENT_DATE)
)
SELECT DISTINCT id FROM subordinates;
```

### 6.4 Indeks Kritis

| Tabel | Indeks | Alasan |
|---|---|---|
| `attendance_logs` | `(employee_id, server_time DESC)` | Query riwayat absen |
| `attendance_logs` | `(is_mock_location) WHERE is_mock_location = TRUE` (parsial) | Antrean verifikasi anomali |
| `attendance_daily` | `(employee_id, work_date)` UNIQUE | Idempotensi job rekap |
| `attendance_daily` | `(payroll_period_id, status)` | Agregasi feeder |
| `employee_assignments` | `(employee_id, effective_from DESC)` | Resolusi penugasan pada tanggal |
| `reporting_lines` | `(supervisor_id, effective_from)` | Penelusuran TEAM_TREE |
| `leave_balance_ledger` | `(leave_balance_id, created_at)` | Rekonstruksi saldo |
| `approval_tasks` | `(assignee_user_id, status, due_at)` | Approval Inbox & job SLA |
| `system_parameters` | `(param_key, effective_from DESC)` | Resolver parameter (panas) |
| `audit_logs` | Partisi bulanan berdasarkan `created_at` | Volume tinggi, retensi panjang |

---

## 7. Kontrak API (Ringkasan)

> Basis: `/api/v1`. Autentikasi: `Authorization: Bearer <access_token>`.
> Setiap endpoint mencantumkan permission yang diwajibkan. Endpoint tanpa kolom permission tidak boleh ada.

### 7.1 Autentikasi & Sesi

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | — | NIK/email + password → token pair |
| POST | `/auth/refresh` | — | Rotasi refresh token |
| POST | `/auth/logout` | — | Cabut refresh token |
| POST | `/auth/forgot-password` | — | Kirim OTP ke HP terdaftar |
| POST | `/auth/reset-password` | — | OTP + password baru |
| POST | `/auth/2fa/enroll` \| `/verify` | — | TOTP |
| GET | `/me` | — | Profil + grup + permission efektif |
| GET | `/me/navigation` | — | **Struktur menu dinamis (web/mobile)** |
| GET | `/me/devices` | — | Daftar device terikat |
| DELETE | `/me/devices/:id` | — | Cabut device |

### 7.2 Modul 0 — User & Akses

| Method | Endpoint | Permission |
|---|---|---|
| GET/POST | `/users` | `identity.user.read` / `.create` |
| GET/PATCH | `/users/:id` | `identity.user.read` / `.update` |
| POST | `/users/:id/activate` \| `/deactivate` \| `/unlock` | `identity.user.update` |
| POST | `/users/:id/force-logout` | `identity.user.manage_session` |
| POST | `/users/:id/reset-password` | `identity.user.reset_password` |
| GET/POST | `/users/:id/overrides` | `identity.override.read` / `.create` |
| GET | `/users/:id/effective-access` | `identity.user.read` — **layar simulasi** |
| GET/POST | `/groups` | `identity.group.read` / `.create` |
| GET/PATCH/DELETE | `/groups/:id` | `identity.group.*` |
| POST | `/groups/:id/clone` | `identity.group.create` |
| GET/PUT | `/groups/:id/permissions` | `identity.group.read` / `.assign_permission` |
| GET/POST/DELETE | `/groups/:id/members` | `identity.group.assign_member` |
| GET | `/permissions` | `identity.permission.read` |
| GET/POST/PATCH | `/menus` | `config.menu.read` / `.manage` |
| POST | `/menus/reorder` | `config.menu.manage` |
| GET/POST | `/delegations` | `workflow.delegation.read` / `.create` |
| GET | `/audit-logs` | `audit.log.read` |

**Contoh — `PUT /groups/:id/permissions`**
```json
{
  "permissions": [
    {
      "permission_code": "employee.record.read",
      "data_scope": "BRANCH",
      "masked_fields": ["basic_salary", "bank_account_no", "id_card_no"]
    },
    {
      "permission_code": "leave.request.approve",
      "data_scope": "DIRECT_REPORT",
      "masked_fields": []
    }
  ]
}
```

**Contoh — `GET /me/navigation` (respons)**
```json
{
  "platform": "MOBILE",
  "menus": [
    { "code": "HOME",       "label": "Beranda",  "icon": "home",
      "route": "/home",     "children": [] },
    { "code": "ATTENDANCE", "label": "Absensi",  "icon": "fingerprint",
      "route": "/attendance", "children": [] },
    { "code": "LEAVE",      "label": "Cuti & Izin", "icon": "calendar",
      "route": "/leave",
      "children": [
        { "code": "LEAVE_REQUEST", "label": "Pengajuan", "route": "/leave/new" },
        { "code": "LEAVE_BALANCE", "label": "Saldo Cuti", "route": "/leave/balance" }
      ]},
    { "code": "PAYSLIP",    "label": "Slip Gaji", "icon": "receipt",
      "route": "/payslip",  "children": [] }
  ],
  "cache_ttl_seconds": 300
}
```

### 7.3 Modul Operasional (ringkas)

| Method | Endpoint | Permission |
|---|---|---|
| POST | `/attendance/check-in` \| `/check-out` | `attendance.log.create` |
| POST | `/attendance/sync` | `attendance.log.create` — batch offline, idempoten via `client_request_id` |
| GET | `/attendance/daily` | `attendance.daily.read` |
| POST | `/attendance/corrections` | `attendance.correction.create` |
| POST | `/attendance/proxy` | `attendance.log.create_proxy` |
| GET | `/leave/balances` | `leave.balance.read` |
| POST | `/leave/requests` | `leave.request.create` |
| POST | `/leave/requests/:id/cancel` | `leave.request.cancel` |
| GET | `/leave/team-calendar` | `leave.request.read` |
| POST | `/overtime/requests` | `overtime.request.create` |
| GET | `/approvals/inbox` | `workflow.task.read` |
| POST | `/approvals/tasks/:id/act` | `workflow.task.act` |
| POST | `/approvals/bulk-act` | `workflow.task.act` |
| POST | `/payroll/periods/:id/validate` | `payroll.period.close` |
| POST | `/payroll/periods/:id/lock` \| `/close` | `payroll.period.close` |
| GET | `/payroll/periods/:id/feeder` | `payroll.feeder.read` |
| GET | `/payroll/periods/:id/feeder/export` | `payroll.feeder.export` |
| GET | `/payroll/feeder-lines/:id/trace` | `payroll.feeder.read` |
| POST | `/payslips/import` \| `/publish` \| `/:id/revoke` | `payroll.payslip.publish` |
| GET | `/payslips/me` | `payroll.payslip.read_self` |
| GET/POST/PATCH | `/config/parameters` | `config.parameter.*` |
| GET/POST/PATCH | `/config/workflows` | `config.workflow.*` |
| GET/POST/PATCH | `/config/leave-types` | `config.leave_type.*` |
| GET/POST/PATCH | `/config/overtime-rules` | `config.overtime_rule.*` |
| GET/POST | `/config/holidays` | `config.holiday.*` |

### 7.4 Konvensi

| Aspek | Aturan |
|---|---|
| Format tanggal | ISO 8601 dengan offset (`2026-08-07T09:15:00+07:00`) |
| Penyimpanan waktu | UTC di database; konversi ke zona cabang di lapisan penyajian |
| Nominal uang | `DECIMAL(18,2)`; dikirim sebagai string di JSON untuk mencegah galat float |
| Paginasi | `?page=1&limit=50` (maks. 200), respons berisi `meta.total` |
| Format error | `{ "error": { "code": "LEAVE_INSUFFICIENT_BALANCE", "message": "...", "details": {...} } }` |
| Idempotensi | Header `Idempotency-Key` wajib untuk seluruh POST yang mengubah state |
| Versioning | Prefix path `/v1`; perubahan yang merusak kompatibilitas → `/v2` |
| Rate limit | 100 req/menit per user; 10 req/menit untuk endpoint auth |

---

## 8. Non-Functional Requirements

| Kategori | Persyaratan |
|---|---|
| **Performa** | API p95 ≤ 500 ms; submit absen p95 ≤ 3 dtk pada 3G; agregasi feeder 300 karyawan ≤ 60 dtk |
| **Skalabilitas** | Dirancang untuk 2.000 karyawan (6× populasi saat ini) tanpa perubahan arsitektur |
| **Ketersediaan** | ≥ 99,5% pada jam 06.00–20.00 WIB; jendela pemeliharaan di luar tanggal 20–25 |
| **Keamanan — Transport** | TLS 1.3; HSTS; certificate pinning di mobile |
| **Keamanan — At Rest** | Enkripsi kolom (AES-256) untuk: `bank_account_no`, `id_card_no`, `tax_id`, komponen gaji |
| **Keamanan — Password** | Argon2id (memory ≥ 64 MB, iterations ≥ 3) |
| **Keamanan — Sesi** | Access token 15 mnt, refresh 7 hr dengan rotasi + deteksi penggunaan ulang |
| **Keamanan — Aplikasi** | OWASP Top 10; scan dependensi di CI; SAST wajib lulus sebelum merge |
| **Privasi (UU PDP)** | Persetujuan pengumpulan data lokasi & biometrik saat onboarding; retensi & anonimisasi terkonfigurasi; hak akses & koreksi data lewat ESS |
| **Audit** | Seluruh aksi CRUD pada entitas sensitif tercatat; log *append-only*; retensi ≥ 5 tahun (ISO 9001 Klausul 7.5) |
| **Backup** | Full harian + WAL kontinu; RPO ≤ 15 menit; RTO ≤ 4 jam; uji restore triwulanan |
| **Kompatibilitas Mobile** | Android 9+ (API 28), RAM 2 GB; iOS 15+; APK ≤ 40 MB |
| **Aksesibilitas Web** | WCAG 2.1 AA; kontras ≥ 4.5:1; navigasi keyboard penuh (shadcn/ui + Radix memenuhi baseline) |
| **Lokalisasi** | Bahasa Indonesia; format Rupiah `Rp 1.234.567`; kalender hari libur Indonesia |
| **Observability** | Distributed tracing; alert pada: kegagalan job rekap absensi, antrean sync menumpuk, lonjakan 403 |

---

## 9. Strategi Migrasi Data

| Tahap | Aktivitas | Sumber | Risiko | Mitigasi |
|---|---|---|---|---|
| M-1 | Master entitas, cabang, divisi, jabatan, golongan | Manual dari `Matriks Gaji & Tunjangan` | Penamaan tidak konsisten (`PT LMN - Cirebon` vs `PT. LMN - Cirebon`) | **Normalisasi wajib.** Buat tabel pemetaan; bersihkan sebelum impor |
| M-2 | Master karyawan (300 baris, 24 kolom) | `data_pegawai_master` | Data **tersedia**, namun kotor: NIK KTP 15/17 digit, placeholder `000000`/`9999-01-01`/`1970-01-01`, casing & trailing space tidak konsisten | Severity `WARNING` pada validasi; laporan anomali per baris; Comben memutuskan, bukan sistem membersihkan diam-diam |
| M-2b | Nama Bank & Nama Pemilik Rekening | **Tidak ada di template** | Transfer gaji & uang muka gagal | **OQ-03c** — Comben lengkapi terpisah |
| M-3 | Garis pelaporan (atasan & division head) | **Tidak ada di template** | Tanpa ini approval tidak jalan | **BLOCKER — OQ-03 & OQ-10** |
| M-4 | Komponen gaji per karyawan | `GAJI POKOK` tersedia di template; tunjangan lain **belum** | Nilai tunjangan per karyawan kosong | Impor Gaji Pokok sebagai `employee_component_assignments` Kelas A; tunjangan diturunkan dari matriks jabatan (FR-M1B-011b), nominal dilengkapi Comben |
| M-5 | Saldo cuti berjalan | Rekap manual (sumber mencatat migrasi 2025 dilakukan manual karena backdate) | Salah saldo → keluhan massal | Impor sebagai entri ledger `OPENING_BALANCE`; verifikasi ganda oleh Comben; publikasikan ke karyawan untuk dikonfirmasi sebelum go-live |
| M-6 | Kalender hari libur 2026 | SKB 3 Menteri | Salah tipe (Libur Nasional vs Cuti Bersama) | Review Comben; Cuti Bersama mengurangi hak cuti, Libur Nasional tidak |
| M-7 | Pinjaman outstanding | Belum tersedia | v2 | Impor sebagai saldo awal berikut jadwal angsuran |

**Aturan migrasi yang mengikat:**
1. Seluruh impor lewat *staging table* dengan validasi, **tidak pernah** langsung ke tabel produksi.
2. Setiap batch impor punya `import_batch_id` dan **dapat di-rollback penuh**.
3. Saldo cuti diimpor sebagai **entri ledger**, bukan angka saldo, agar riwayat dapat direkonstruksi.
4. Karyawan **wajib mengonfirmasi** saldo cuti awalnya lewat ESS sebelum go-live. Sengketa diselesaikan sebelum, bukan sesudah.

---

## 10. Rencana Rilis & Modul

| Sprint | Minggu | Modul | Deliverable Kunci | Status |
|---|---|---|---|---|
| S0 | 1–2 | Fondasi | Repo (NestJS + Next.js + Flutter), CI/CD, Docker, skema DB inti, seed permission, design system shadcn, `AppFormatter` Flutter & `lib/format.ts` web | Belum mulai |
| S0b | 2 | **M8B** Format & Validasi | `format_settings`, `validation_rules`, `number_sequences` (generator NIK), endpoint `/config/formats` & `/config/app-settings` | Belum mulai |
| S1 | 3–4 | **M0** Identity | Auth, JWT, users, groups, permissions, PermissionGuard | Belum mulai |
| S2 | 5–6 | **M0** Akses | Data scope resolver, field masking, menu registry, `/me/navigation`, layar simulasi, audit log | Belum mulai |
| S3a | 7 | **M1B** Master Data | Scaffold CRUD generik + 12 master organisasi & referensi (entitas, cabang, divisi, departemen, jabatan, **golongan**, bank, reference_data) | Belum mulai |
| S3b | 8 | **M1** Org & Karyawan | Karyawan, penugasan ber-tanggal efektif, garis pelaporan, import Excel | **Tergantung OQ-03** |
| S4 | 9–10 | **M2** Absensi (backend) | Jadwal, kalender libur, geofence, API absen, job rekap harian | **Tergantung OQ-11** |
| S4b | 10 | **M2B** Roster Management | Pola jadwal (4 seed), penugasan berjenjang, kalender roster, override per tanggal | **Tergantung OQ-19** |
| S5 | 11–12 | **M2** Absensi (mobile Flutter) | Absen mobile, offline queue (Drift), swafoto q70, deteksi mock GPS, papan kehadiran | Belum mulai |
| S6 | 13–14 | **M7** Workflow | Workflow engine, approval inbox, delegasi, SLA & eskalasi, notifikasi | Belum mulai |
| S7 | 15–16 | **M3** Cuti & Izin | Jenis cuti config, saldo & ledger, prorata, advance, pengajuan, approval | **Tergantung OQ-02** |
| S8 | 17–18 | **M4** Lembur | Matriks tarif config, perintah lembur, realisasi dari absensi, approval | **Tergantung OQ-01** |
| S9 | 19–20 | **M6** Payroll Feeder | Periode, validasi pra-tutup, agregasi, calculation trace, export | Belum mulai |
| S10 | 21–22 | **M5** ESS & Payslip | Import payroll, publish slip, PIN protection, PDF | Belum mulai |
| S11 | 23–24 | **M8/M8B/M9** | Layar Pengaturan Umum, katalog & renderer laporan (17 laporan seed), dashboard, penguatan audit | Belum mulai |
| UAT | 25–26 | Semua | Parallel run 1 siklus payroll, perbaikan | — |
| Go-Live | 27 | — | Pilot HO Bandung + 2 cabang | — |
| Rollout | 28–32 | — | 18 area kerja bertahap | — |

> **Catatan penjadwalan:** S3, S4, S7, dan S8 memiliki ketergantungan pada Open Question yang belum terjawab. Jika OQ-03 tidak selesai pada akhir minggu 6, **seluruh jadwal setelah S3 bergeser 1:1**. Ini bukan risiko yang bisa diserap dengan lembur.

---

## 11. Kriteria Penerimaan (UAT)

### 11.1 Modul 0 — Akses

| ID | Skenario | Kriteria Lulus |
|---|---|---|
| UAT-M0-01 | Admin membuat grup baru "Admin Cabang Garut" dengan scope `BRANCH` | Selesai < 10 menit tanpa bantuan developer |
| UAT-M0-02 | User grup tersebut login | Hanya melihat karyawan Garut; menu Payroll tidak muncul |
| UAT-M0-03 | User mencoba akses `/employees/{id_karyawan_Bandung}` langsung | HTTP 403; tercatat sebagai `SECURITY_EVENT` di audit log |
| UAT-M0-04 | Supervisor membuka data bawahan | Kolom gaji pokok tampil `***`; export Excel juga `***` |
| UAT-M0-05 | Admin mengubah urutan & label menu | Perubahan terlihat oleh user dalam ≤ 5 menit tanpa deploy |
| UAT-M0-06 | Admin memberi override `DENY` pada user yang grupnya punya izin | Akses ditolak (DENY menang) |
| UAT-M0-07 | Karyawan diubah statusnya menjadi resign | Akun otomatis nonaktif; sesi aktif diakhiri |
| UAT-M0-08 | Auditor menarik riwayat perubahan hak akses | Tersedia lengkap dengan before/after, aktor, timestamp |

### 11.2 Absensi

| ID | Skenario | Kriteria Lulus |
|---|---|---|
| UAT-M2-01 | Absen dalam radius geofence | Tercatat < 3 detik, status `HADIR` |
| UAT-M2-02 | Absen dengan mode pesawat, lalu online kembali | Tersimpan lokal, sync otomatis, `is_offline_sync = true` |
| UAT-M2-03 | Absen dengan aplikasi fake GPS aktif | Tercatat, ditandai `is_mock_location`, muncul di antrean verifikasi |
| UAT-M2-04 | Salesman absen 5 km dari cabang | Diterima, ditandai `OUT_OF_ZONE`, jarak terlihat oleh approver |
| UAT-M2-05 | Absen masuk tanpa absen pulang | Status `INCOMPLETE`, notifikasi terkirim ke karyawan & atasan |
| UAT-M2-06 | Job rekap dijalankan dua kali | Hasil identik (idempoten), tidak ada duplikasi |

### 11.3 Cuti

| ID | Skenario | Kriteria Lulus |
|---|---|---|
| UAT-M3-01 | Karyawan masa kerja 5 bulan mengajukan cuti tahunan | Ditolak; sistem menawarkan Cuti Advance maks. 3 hari |
| UAT-M3-02 | Cuti diajukan H-3 | Diblokir dengan pesan jelas; opsi jalur darurat tersedia |
| UAT-M3-03 | Cuti melintasi hari libur nasional | Hari libur tidak dihitung sebagai hari cuti |
| UAT-M3-04 | Atasan tidak bertindak 3 hari kerja | Pengingat H+1, eskalasi H+2; **tidak** auto-approve |
| UAT-M3-05 | Karyawan resign dengan sisa cuti 4 hari | Muncul sebagai komponen kompensasi di feeder bulan terakhir |
| UAT-M3-06 | Admin menambah Cuti Bersama 2 hari | Preview dampak muncul; saldo terpotong setelah dikonfirmasi |

### 11.4 Payroll Feeder — **Gerbang Go/No-Go**

| ID | Skenario | Kriteria Lulus |
|---|---|---|
| UAT-M6-01 | Parallel run 1 siklus penuh, HO Bandung | **Selisih Rp 0** pada Lembur, Potongan Absen, dan Tunjangan Kehadiran untuk seluruh karyawan |
| UAT-M6-02 | Comben membuka drill-down sebuah angka lembur | Formula, ID aturan, versi parameter, dan nilai input terlihat |
| UAT-M6-03 | Tutup periode dengan 3 cuti masih pending | Diblokir; daftar dokumen penghambat ditampilkan |
| UAT-M6-04 | Admin mengubah divisor lembur, lalu buka periode lampau | Angka periode lampau **tidak berubah** |
| UAT-M6-05 | Karyawan mutasi golongan di tengah periode | Lembur sebelum mutasi memakai tarif lama; sesudahnya tarif baru |

> **Gerbang rilis:** UAT-M6-01 adalah syarat mutlak. Selisih ≠ Rp 0 berarti **no-go**, tanpa pengecualian. Sistem payroll yang angkanya tidak dapat dipercaya lebih buruk daripada Excel.

---

---

## 11A. Protokol Pengujian Wajib (Goal G7 — Tidak Dapat Dikecualikan)

> **Keputusan PO: seluruh modul WAJIB diuji setelah development. Tidak ada pengecualian.** Bagian ini mengubah pernyataan itu menjadi gerbang yang dapat ditegakkan mesin, bukan komitmen lisan.

### 11A.1 Piramida Pengujian per Modul

| Lapisan | Cakupan | Alat | Kapan Dijalankan | Gerbang |
|---|---|---|---|---|
| **Unit** | Rule engine, formula payroll, resolver scope, prorata cuti, tarif lembur, resolver jadwal | Jest (NestJS), `flutter_test` | Setiap commit | Coverage < ambang → **CI gagal** |
| **Integrasi** | Endpoint + database nyata (Testcontainers PostgreSQL), transaksi, constraint, RLS | Jest + Supertest | Setiap PR | Ada kegagalan → **merge diblokir** |
| **Kontrak** | Skema request/response vs OpenAPI; klien Flutter vs API | Pact / OpenAPI validator | Setiap PR | Ketidaksesuaian → **merge diblokir** |
| **E2E Web** | Alur utama end-to-end di browser | Playwright | Nightly + sebelum rilis | Ada kegagalan → **rilis diblokir** |
| **E2E Mobile** | Absen, offline sync, approval, slip gaji | `integration_test` Flutter + Patrol | Sebelum rilis | Ada kegagalan → **rilis diblokir** |
| **Keamanan** | Uji scope guard, field masking, IDOR, SQL injection, unggahan berbahaya | Skenario khusus + OWASP ZAP | Sebelum rilis | Ada temuan High → **rilis diblokir** |
| **Performa** | 300 karyawan, 1 periode payroll, 50 pengguna bersamaan | k6 | Sebelum rilis | p95 > SLO → **rilis diblokir** |
| **UAT** | Skenario bisnis oleh pengguna nyata | Manual, ditandatangani PIC | Sebelum go-live | Belum ditandatangani → **go-live diblokir** |

### 11A.2 Definition of Done per Modul

Modul **tidak boleh** dinyatakan selesai sebelum kesembilan butir berikut terpenuhi:

| # | Kriteria | Bukti |
|---|---|---|
| 1 | Seluruh FR modul terimplementasi | Ceklis FR ditandai, ditautkan ke PR |
| 2 | Unit test lulus dengan coverage ≥ ambang | Laporan coverage CI |
| 3 | Integration test lulus untuk setiap endpoint | Laporan CI |
| 4 | **Uji scope & masking** lulus untuk setiap grup pengguna | Matriks hasil uji akses |
| 5 | Tidak ada angka kebijakan sebagai literal | Lint rule `no-magic-policy-number` lulus |
| 6 | Setiap endpoint punya dekorator permission | Gerbang CI `permission-coverage` lulus |
| 7 | Skenario UAT modul dieksekusi & ditandatangani PIC | Berkas UAT bertanda tangan |
| 8 | Dokumentasi API diperbarui (OpenAPI) | Diff spesifikasi |
| 9 | Bug Critical/High = 0 | Papan issue tracker |

### 11A.3 Uji Wajib per Modul MVP

| Modul | Uji Wajib Spesifik |
|---|---|
| **M0** Akses | Setiap grup × setiap permission × setiap scope (matriks kombinatorial); IDOR lewat manipulasi ID; `DENY` mengalahkan union grup; pencabutan permission mid-session |
| **M1/M1B** Master | Import 300 baris (data kotor asli); rollback batch; overlap effective-date ditolak; hapus master yang dirujuk transaksi ditolak |
| **M2** Absensi | Offline queue (mode pesawat 24 jam); mock GPS; jam device dimundurkan; idempotensi sync; job rekap dijalankan dua kali |
| **M2B** Roster | Prioritas resolusi 5 tingkat; override per tanggal; karyawan tanpa jadwal memblokir tutup periode; rekalkulasi setelah jadwal diubah |
| **M3** Cuti | Prorata tahun pertama; advance lalu resign; cuti lintas periode payroll; cuti bersama mengurangi saldo; `leave_eligible = false` memblokir |
| **M4** Lembur | Tiap kombinasi golongan × tipe hari; mutasi golongan di tengah periode; tarif effective-dated |
| **M5** Payslip | PIN/biometrik; revoke & terbitkan revisi; masking pada ekspor |
| **M6** Payroll | **Parallel run selisih Rp 0**; validasi pra-tutup; `calculation_trace` lengkap; ubah parameter tidak mengubah periode lampau |
| **M7** Workflow | Self-approval dilewati; approver resign; SLA & eskalasi; delegasi; race dua approver; definisi berubah saat instance berjalan |
| **M8/M8B** Konfigurasi | Ubah format tanggal → seluruh layar ikut; ubah aturan validasi → langsung berlaku; **tidak ada BLOB di skema**; kompresi kualitas 70 terverifikasi; presigned URL kedaluwarsa |

### 11A.4 Gerbang CI (dijalankan mesin, bukan diingat manusia)

```yaml
# .github/workflows/quality-gate.yml — ringkasan gerbang wajib
gates:
  - name: no-blob-columns
    run: grep -rEi "BYTEA|BLOB|LONGBLOB" prisma/migrations/ && exit 1 || exit 0
  - name: no-magic-policy-number
    run: npx eslint --rule no-magic-policy-number src/    # 173, 25, 150000, 12, 173.0
  - name: permission-coverage
    run: node scripts/check-permission-decorators.js      # gagal bila ada endpoint tanpa @RequirePermission
  - name: no-group-name-check
    run: grep -rE "group(\.name|_code)\s*===" src/ && exit 1 || exit 0
  - name: no-hardcoded-date-format
    run: grep -rE "DD/MM/YYYY|dayjs\(.*\)\.format\(['\"]" src/components/ && exit 1 || exit 0
  - name: coverage-threshold
    run: jest --coverage --coverageThreshold='{"src/core/rules":{"lines":85},"global":{"lines":70}}'
  - name: openapi-drift
    run: npx openapi-diff spec/openapi.yaml spec/generated.yaml
```

### 11A.5 Aturan Tegas

| # | Aturan |
|---|---|
| QA-01 | **Modul tanpa test tidak boleh masuk `main`.** Tidak ada pengecualian untuk "kejar deadline" |
| QA-02 | Test ditulis **bersamaan** dengan kode, bukan di sprint terpisah di akhir. Sprint "hardening" bukan pengganti |
| QA-03 | Setiap bug yang ditemukan wajib menghasilkan **regression test** sebelum diperbaiki |
| QA-04 | Data uji wajib memakai **cuplikan data asli yang dianonimkan** (termasuk baris kotornya), bukan data sempurna buatan |
| QA-05 | UAT dijalankan oleh **Comben dan Admin Cabang sungguhan**, bukan oleh tim developer |
| QA-06 | Setiap hasil UAT ditandatangani PIC modul; berkasnya menjadi rekaman ISO 9001 Klausul 7.5 |

---

## 12. Risiko & Mitigasi

| # | Risiko | Dampak | Peluang | Mitigasi |
|---|---|---|---|---|
| R-01 | **Data master tidak lengkap (OQ-03)** | Kritis | Tinggi | Jadikan gerbang Sprint 3. Jangan mulai coding modul yang bergantung padanya. Tugaskan PIC Comben khusus |
| R-02 | Konflik aturan lembur SPV (OQ-01) tidak terselesaikan | Tinggi | Sedang | Seed `NONE`; UI konfigurasi memungkinkan koreksi cepat tanpa deploy |
| R-03 | Karyawan tanpa smartphone / literasi rendah | Tinggi | Tinggi | Fitur proxy attendance; pelatihan cabang; kartu panduan bergambar; pendamping (*champion*) per cabang |
| R-04 | Penolakan Comben terhadap angka sistem | Kritis | Sedang | `calculation_trace` wajib; parallel run; libatkan Comben sebagai penguji sejak Sprint 7 |
| R-05 | Penyalahgunaan fake GPS | Sedang | Tinggi | Deteksi + tandai; foto swafoto; laporan anomali mingguan; sanksi kebijakan HR (bukan teknis) |
| R-06 | Sinyal buruk di cabang terpencil | Tinggi | Tinggi | Offline-first wajib; payload ringan; retry dengan *exponential backoff* |
| R-07 | *Scope creep* ke SFA / Performance | Tinggi | Sedang | Non-goals tertulis di PRD; setiap permintaan baru masuk backlog, bukan sprint berjalan |
| R-08 | Data pribadi bocor (UU PDP) | Kritis | Rendah | Enkripsi at-rest, field masking, audit akses, scan penetrasi sebelum go-live |
| R-09 | Ketergantungan pada satu developer untuk rule engine | Tinggi | Sedang | Dokumentasi + *pair programming* + cakupan tes ≥ 80% pada modul rule & payroll |
| R-10 | Hosting belum diputuskan (OQ-13) | Sedang | Sedang | Kontainerisasi sejak awal; hindari layanan spesifik vendor |

---

## 13. Aturan Tegas untuk Developer

> Delapan aturan berikut adalah **kriteria code review**. Pelanggaran = **blocker**, bukan bahan diskusi.

| # | Aturan |
|---|---|
| **1** | **Dilarang** menuliskan angka kebijakan sebagai literal di kode. `173`, `25`, `12`, `150000`, `2`, `7`, `30` **wajib** berasal dari `system_parameters` atau tabel aturan. |
| **2** | **Dilarang** memeriksa nama/kode grup di logic (`if (user.group === 'COMBEN')`). Gunakan pemeriksaan permission. |
| **3** | **Setiap** endpoint wajib punya dekorator permission. Tanpa itu → ditolak *deny-by-default* dan CI gagal. |
| **4** | **Setiap** pembacaan parameter wajib menyertakan tanggal acuan (`asOf`). Tidak ada pembacaan "nilai saat ini" untuk perhitungan historis. |
| **5** | **Setiap** perhitungan finansial wajib menghasilkan `calculation_trace`. Perhitungan tanpa jejak tidak boleh di-*merge*. |
| **6** | **Dilarang** menghapus data transaksional secara fisik. Gunakan *soft delete* atau pembalikan ledger. `audit_logs` bersifat *append-only*. |
| **7** | Filter data scope wajib berada di lapisan repository/query. Menyembunyikan data di frontend **bukan** kontrol keamanan. |
| **8** | Menu, label, dan teks notifikasi berasal dari database. **Dilarang** ada array menu statis atau string notifikasi di kode frontend. |
| **9** | **Dilarang** menyimpan berkas biner di database. Tidak ada `BYTEA`, tidak ada base64 di kolom teks, tidak ada blob di SQLite mobile. |
| **10** | **Dilarang** menuliskan format tanggal di komponen. Web lewat `lib/format.ts`, Flutter lewat `AppFormatter`. Penyimpanan tetap ISO/`DATE`. |
| **11** | **Dilarang** menandai modul selesai tanpa unit test, integration test, dan uji scope. Gerbang CI menegakkannya; menonaktifkan gerbang memerlukan persetujuan Tech Lead tertulis. |
| **12** | **Dilarang** mengisi angka kebijakan yang belum ada dokumennya dengan nilai tebakan. Kosongkan dan blokir transaksinya (SD-05). |

---

## 14. Ketergantungan & Prasyarat

| # | Prasyarat | PIC | Dibutuhkan Sebelum |
|---|---|---|---|
| D-01 | Keputusan hosting & lingkungan (OQ-13) | IT + Manajemen | Sprint 0 |
| D-02 | Keputusan ruang lingkup entitas: LMN saja atau + LMI + Pabrik (OQ-18) | Manajemen | Sprint 0 |
| D-03 | Data master karyawan lengkap (OQ-03) | Comben | Sprint 3 |
| D-04 | Definisi jadwal kerja & shift per cabang (OQ-11) | Comben | Sprint 4 |
| D-05 | Keputusan basis siklus cuti (OQ-02) | HCGA Manager | Sprint 7 |
| D-06 | Keputusan lembur SPV hari biasa (OQ-01) | Comben + HCGA | Sprint 8 |
| D-07 | Akun Firebase (FCM) | IT | Sprint 5 |
| D-08 | Akun Google Play Console (jika distribusi publik) | IT | Sprint 8 |
| D-09 | Sertifikat SSL & domain | IT | Sprint 0 |
| D-10 | Penunjukan *champion* per cabang untuk pelatihan | HCGA | Sebelum rollout |

---

## Lampiran A — Seed Permission (Contoh Struktur)

```
identity.user.read              identity.user.create
identity.user.update            identity.user.reset_password
identity.user.manage_session    identity.group.read
identity.group.create           identity.group.update
identity.group.delete           identity.group.assign_permission
identity.group.assign_member    identity.permission.read
identity.override.read          identity.override.create

employee.record.read            employee.record.create
employee.record.update          employee.record.delete
employee.record.import          employee.assignment.manage
employee.document.read          employee.document.manage
org.structure.read              org.structure.manage

master.company.read             master.company.manage
master.branch.read              master.branch.manage
master.org.read                 master.org.manage
master.position.read            master.position.manage
master.grade.read               master.grade.manage
master.bank.read                master.bank.manage
master.reference.read           master.reference.manage
master.payroll_component.read   master.payroll_component.manage
master.allowance_rule.read      master.allowance_rule.manage
master.bpjs.read                master.bpjs.manage
master.loan_type.manage         master.perdiem_rate.manage

attendance.log.read             attendance.log.create
attendance.log.create_proxy     attendance.daily.read
attendance.daily.update         attendance.correction.create
attendance.correction.approve   attendance.schedule.manage

leave.request.read              leave.request.create
leave.request.approve           leave.request.cancel
leave.balance.read              leave.balance.adjust

overtime.request.read           overtime.request.create
overtime.request.approve

payroll.period.read             payroll.period.close
payroll.feeder.read             payroll.feeder.export
payroll.feeder.override         payroll.payslip.read_self
payroll.payslip.read_all        payroll.payslip.publish

workflow.task.read              workflow.task.act
workflow.delegation.read        workflow.delegation.create

config.parameter.read           config.parameter.manage
config.workflow.read            config.workflow.manage
config.menu.read                config.menu.manage
config.leave_type.manage        config.overtime_rule.manage
config.holiday.manage           config.reference_data.manage
config.format.manage            config.validation.manage
config.sequence.manage          config.report.manage
config.app_setting.manage

report.attendance.view          report.leave.view
report.overtime.view            report.payroll.view
audit.log.read                  audit.log.export
```

> **Aturan:** Setiap modul baru menambahkan permission-nya lewat *seed migration* miliknya sendiri. Daftar ini tumbuh lewat data, bukan lewat perubahan kode aplikasi.

---

## Lampiran B — Ringkasan Modul & PIC

| Modul | Kode | Rilis | Kompleksitas | Ketergantungan | PIC | Status |
|---|---|---|---|---|---|---|
| Identity & Akses | M0 | MVP | Tinggi | — | *TBD* | Belum mulai |
| Master Data & Referensi | M1B | MVP | Sedang | M0 | *TBD* | **Belum mulai — tidak terblokir** |
| Employee Master & Org | M1 | MVP | Sedang | M0, M1B | *TBD* | Terblokir (OQ-03) |
| Absensi & Jadwal | M2 | MVP | **Sangat Tinggi** | M0, M1 | *TBD* | Terblokir (OQ-11) |
| Roster Management | M2B | MVP | Sedang | M1B | *TBD* | Terblokir (OQ-19) |
| Cuti & Izin | M3 | MVP | Tinggi | M0, M1, M7, M2B | *TBD* | Terblokir (OQ-02) |
| Lembur | M4 | MVP | Sedang | M2, M7 | *TBD* | Terblokir (OQ-01) |
| ESS & e-Payslip | M5 | MVP | Sedang | M0, M1 | *TBD* | Belum mulai |
| Payroll Feeder | M6 | MVP | **Sangat Tinggi** | M2, M3, M4 | *TBD* | Belum mulai |
| Notifikasi & Workflow | M7 | MVP | Tinggi | M0 | *TBD* | Belum mulai |
| Konfigurasi Sistem | M8 | MVP | Sedang | M0 | *TBD* | Belum mulai |
| Pengaturan Umum, Format & Laporan | M8B | MVP | Sedang | M0 | *TBD* | **Belum mulai — tidak terblokir** |
| Audit & Laporan | M9 | MVP | Rendah | Semua | *TBD* | Belum mulai |
| Payroll Engine | V1 | v2 | **Sangat Tinggi** | M6 | *TBD* | — |
| Pinjaman Karyawan | V2 | v2 | Sedang | M7, V1 | *TBD* | Terblokir (OQ-04) |
| Perjalanan Dinas | V3 | v2 | Tinggi | M7, V1 | *TBD* | Terblokir (OQ-05) |
| Pembiayaan SIM | V4 | v2 | Rendah | M7 | *TBD* | Terblokir (OQ-06) |

---

*Dokumen ini adalah blueprint teknis. Setiap perubahan pada Business Rule Registry (Seksi 4) wajib melalui persetujuan Product Owner dan menaikkan versi dokumen.*
