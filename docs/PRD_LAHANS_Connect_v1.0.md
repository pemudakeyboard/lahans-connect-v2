# PRD — LAHANS Connect

### Web Dashboard & Mobile Apps — HRIS PT Lahan Mekar Niaga (LMN Group)

| Field            | Value                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokumen          | Product Requirements Document                                                                                                                                                      |
| Versi            | 1.0                                                                                                                                                                                |
| Tanggal          | 07 Agustus 2026                                                                                                                                                                    |
| Status           | Draft for Development Kick-off                                                                                                                                                     |
| Product Owner    | Dept. Compensation & Benefit / HCGA                                                                                                                                                |
| Basis Dokumen    | SOP.LMN.CBN.02, .03, .04, .09; SOP.LMN.CMBN.06; SK Perdin; Matriks Perhitungan Payroll; Matriks Gaji & Tunjangan; Data Pegawai Master                                              |
| Prinsip Rekayasa | **ZERO HARDCODE** — seluruh aturan bisnis, menu, hak akses, formula, plafon, dan lead time berada di tabel konfigurasi ber-versi tanggal (_effective-dated_), bukan di dalam kode. |

---

## 0. Ringkasan Eksekutif (Top-Down)

**Rekomendasi:** Bangun LAHANS Connect sebagai **HR Operations Platform** untuk ±300 karyawan di 18 area kerja, dengan MVP yang fokus pada **rantai data payroll** (Absensi → Lembur → Cuti/Izin → Slip Gaji), bukan pada modul yang paling banyak diminta.

**Tiga keputusan arsitektural yang mengunci seluruh dokumen ini:**

1. **Payroll di MVP adalah _feeder_, bukan _engine_.** Sistem menghasilkan _payroll input file_ terverifikasi; perhitungan final tetap di Excel/akunting eksisting selama 1 siklus paralel. Payroll Engine penuh masuk v2. Alasan: 60% risiko proyek HRIS adalah data absensi kotor, bukan formula.
2. **Satu mesin approval untuk semua modul.** Cuti, Izin, Lembur, Pinjaman, SIM, dan Perdin memakai `approval_workflow` yang sama, dikonfigurasi lewat UI. Tidak ada `if (role == 'DIV_HEAD')` di kode.
3. **RBAC adalah Modul 0.** Matriks hak akses menu _dan_ data dibangun lebih dulu, dari tabel registry. Setiap modul baru mendaftarkan permission-nya sendiri (seed/migration), bukan menambah enum.

**Definisi "Done" MVP:** 1 siklus payroll penuh (periode 22–21) di HO Bandung berjalan paralel dengan Excel, dengan **selisih Rp 0** pada komponen Lembur, Potongan Absen, dan Tunjangan Kehadiran.

---

## 1. Problem Statement — Siapa yang Sakit dan Kenapa

### 1.1 Kondisi Saat Ini

Proses HR PT Lahan Mekar Niaga saat ini berjalan di atas **formulir kertas + WhatsApp + Excel**, untuk populasi yang **secara geografis tersebar dan secara mayoritas tidak duduk di kantor**.

### 1.2 Titik Nyeri per Aktor

| Aktor                                                         | Rasa Sakit                                                                                                                                                                                                  | Bukti dari Dokumen                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Dept. Comben (3–5 orang)**                                  | Menjadi _single point of failure_. Merekap absensi 300 karyawan × 18 area, memverifikasi hak cuti manual, menghitung 15+ komponen gaji dengan aturan berbeda per golongan, dalam jendela 22–21 yang sempit. | `Matriks Perhitungan Payroll` — 5 kelompok golongan, formula lembur berbeda, divisor absen tetap 25 |
| **Karyawan lapangan (Sales, Driver, Helper — ±70% populasi)** | Tidak punya visibilitas sisa cuti, status pengajuan, atau slip gaji. Harus datang/menelepon cabang untuk formulir kertas.                                                                                   | SOP Cuti mewajibkan _dua_ jalur: formulir fisik **dan** input HRIS                                  |
| **Atasan Langsung & Division Head**                           | Approval berjenjang lewat WhatsApp/kertas tanpa jejak audit. SLA 2 hari kerja tidak terukur.                                                                                                                | SOP.LMN.CBN.04 poin VI.A.7                                                                          |
| **Dept. Finance / FAT**                                       | Uang muka perjalanan dinas dan pinjaman karyawan tidak punya _ledger_ terpusat. Aturan "tidak boleh ajukan uang muka baru bila LPJ lama belum selesai" ditegakkan berdasarkan ingatan.                      | SK Perdin Pasal 3 poin 6; SOP.LMN.CBN.09 poin A.5                                                   |
| **Manajemen / Auditor ISO**                                   | ISO 9001:2015 Klausul 7.5 menuntut _documented information_ yang terkendali. Rekaman tersebar di ordner fisik per cabang.                                                                                   | Acuan di seluruh SOP                                                                                |

### 1.3 Biaya Masalah (Estimasi — perlu validasi)

| Item                                      | Estimasi                  | `[ASUMSI]` |
| ----------------------------------------- | ------------------------- | ---------- |
| Man-hour rekap payroll manual             | ~120 jam/bulan tim Comben | Ya         |
| Koreksi payroll pasca-bayar               | 5–15 kasus/bulan          | Ya         |
| Lead time approval cuti aktual            | 4–7 hari (vs SLA 2 hari)  | Ya         |
| Kebocoran potensial: absensi tidak akurat | 1–2% dari total payroll   | Ya         |

> **FLAG:** Angka di atas belum diverifikasi. PO wajib mengisi baseline aktual sebelum sprint 1, karena metrik keberhasilan di Seksi 9 mengacu ke sini.

---

## 2. Target User + 2 Persona

### 2.1 Segmentasi Pengguna

| Segmen                        | Populasi | Platform Utama        | Frekuensi        |
| ----------------------------- | -------- | --------------------- | ---------------- |
| Karyawan Non-Staff Lapangan   | ~180     | **Mobile**            | Harian (absen)   |
| Karyawan Staff / Admin Cabang | ~60      | Mobile + Web          | Harian           |
| Supervisor / Atasan Langsung  | ~35      | **Mobile** (approval) | Harian           |
| Manager / Division Head       | ~15      | Mobile + Web          | Mingguan         |
| Comben / HCGA                 | ~5       | **Web**               | Harian, intensif |
| Finance / FAT                 | ~5       | Web                   | Mingguan         |
| IT Admin                      | 1–2      | Web                   | Ad-hoc           |
| Auditor Internal / ISO        | 2        | Web (read-only)       | Kuartalan        |

### 2.2 Persona 1 — "Asep", Driver Canvas, Cabang Garut

| Atribut              | Detail                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Umur / Masa kerja    | 38 tahun / 6 tahun (NIK 20200xxx)                                                                               |
| Golongan             | Non-Staff                                                                                                       |
| Device               | Android entry-level, RAM 3GB, Android 11, kuota data terbatas                                                   |
| Literasi digital     | Rendah–menengah. Nyaman dengan WhatsApp, tidak nyaman dengan form panjang                                       |
| Hari kerjanya        | Berangkat 06.30 dari gudang cabang, keliling rute, kembali sore. Sinyal hilang di beberapa titik rute           |
| **Job to be done**   | "Saya mau absen tanpa harus mampir kantor, tahu sisa cuti saya, dan lihat slip gaji tanpa nunggu dibagi admin." |
| **Kekhawatiran**     | "Kalau HP saya mati / sinyal hilang saat absen, gaji saya kepotong?"                                            |
| **Kriteria sukses**  | Absen selesai < 10 detik, ≤ 3 tap. Slip gaji bisa dibuka offline. Notifikasi bahasa Indonesia sederhana         |
| **Implikasi desain** | Mobile-first (Flutter), offline-first queue, font besar, ikon dominan, tanpa jargon HR                          |

### 2.3 Persona 2 — "Tintin", Staff Compensation & Benefit, HO Bandung

| Atribut              | Detail                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Umur / Masa kerja    | 29 tahun / 4 tahun                                                                                                                            |
| Device               | Laptop Windows, dual monitor, Excel adalah alat utamanya                                                                                      |
| Literasi digital     | Tinggi untuk Excel; skeptis terhadap sistem baru yang "hasilnya beda dari hitungan saya"                                                      |
| Hari kerjanya        | Tanggal 22–25 adalah neraka: rekap absensi 18 cabang, validasi lembur, hitung tunjangan kehadiran bertingkat, kejar approval yang menggantung |
| **Job to be done**   | "Saya mau angka payroll yang bisa saya percaya dan bisa saya buktikan ke Manager kalau ditanya kenapa gaji si A beda."                        |
| **Kekhawatiran**     | "Kalau sistem salah hitung dan saya tidak bisa lihat kenapa, saya yang disalahkan."                                                           |
| **Kriteria sukses**  | Setiap angka bisa di-_drill down_ sampai transaksi asalnya. Bisa override manual **dengan alasan wajib**. Export Excel tetap tersedia         |
| **Implikasi desain** | **Calculation trace wajib** di setiap baris payroll. Bulk action. Import/export Excel di setiap modul. Tidak ada "black box"                  |

> **Prinsip desain turunan dari Tintin:** Sistem yang tidak bisa menjelaskan angkanya akan ditolak oleh Comben, dan proyek gagal di bulan ke-2. `calculation_trace` bukan _nice to have_.

---

## 3. Goals dan Non-Goals

### 3.1 Goals (MVP — 4 bulan)

| #   | Goal                                         | Terukur Sebagai                                                                                           |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| G1  | Mengeliminasi rekap absensi manual           | 100% absensi tercatat digital, ≤ 2% membutuhkan koreksi manual                                            |
| G2  | Menegakkan SLA approval SOP secara sistemik  | ≥ 90% pengajuan diputus ≤ 2 hari kerja                                                                    |
| G3  | Sumber kebenaran tunggal untuk data karyawan | 1 master data, 0 duplikat NIK, kelengkapan field wajib ≥ 98%                                              |
| G4  | Transparansi hak & slip ke karyawan          | ≥ 80% karyawan aktif membuka e-payslip dalam 7 hari publikasi                                             |
| G5  | Kepatuhan ISO 9001 Klausul 7.5               | 100% transaksi punya audit trail _immutable_; rekaman dapat ditarik per nomor dokumen                     |
| G6  | **Nol hardcode aturan bisnis**               | Perubahan divisor lembur, plafon pinjaman, atau alur approval dapat dilakukan Admin **tanpa deploy**      |
| G7  | **Nol modul yang lolos tanpa pengujian**     | 100% modul memiliki bukti uji unit, integrasi, dan UAT yang ditandatangani PIC sebelum dinyatakan selesai |

### 3.2 Non-Goals (Eksplisit TIDAK dikerjakan)

| #   | Non-Goal                                                                                                                | Alasan                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NG1 | **[DIREVISI]** Pelaporan pajak eksternal: **e-Bupot, e-Filing, SPT Masa, dan rekonsiliasi tahunan Desember (gross-up)** | Domain pelaporan, bukan penggajian. **Konfigurasi tarif TER kini MASUK ruang lingkup** (FR-M8B-073); eksekusinya menjadi potongan gaji mengikuti Payroll Engine — lihat OQ-21 |
| NG2 | Integrasi API BPJS TK / BPJS Kesehatan                                                                                  | Tidak ada API publik yang layak; MVP hanya menghitung iuran dan menghasilkan file upload manual                                                                               |
| NG3 | Recruitment, Onboarding, Performance Management, Training, KPI                                                          | Bukan titik nyeri terbesar; jangan diperluas                                                                                                                                  |
| NG4 | Sales Force Automation / kunjungan outlet / SFA                                                                         | Domain berbeda meski penggunanya sama. **Jangan digabung.**                                                                                                                   |
| NG5 | Payment gateway / disbursement otomatis ke bank                                                                         | MVP hanya menghasilkan file transfer; eksekusi tetap manual oleh Finance                                                                                                      |
| NG6 | Mengganti mesin fingerprint eksisting di HO                                                                             | Mesin tetap jalan; sistem hanya _import_ datanya di MVP                                                                                                                       |
| NG7 | Multi-bahasa (EN)                                                                                                       | Seluruh pengguna berbahasa Indonesia. Struktur i18n disiapkan, konten hanya ID                                                                                                |
| NG8 | Web version untuk karyawan Non-Staff                                                                                    | Mereka mobile-only. Jangan bangun dua UI untuk satu persona                                                                                                                   |

### 3.3 Disiplin Ruang Lingkup — Aturan Sumber Dokumen

> **Keputusan PO:** ruang lingkup dibatasi pada apa yang **bersumber dari dokumen yang tersedia**.

| #     | Aturan                                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SD-01 | Setiap requirement WAJIB dapat ditelusuri ke dokumen sumber (SOP, SK, Matriks, Form, atau berkas data). Kolom "Acuan" pada Business Rule Registry (BRD Seksi 4) adalah alat penelusurannya.                                              |
| SD-02 | Requirement **tanpa** dokumen sumber hanya boleh berstatus **`OPEN`**, ditandai ⚠️, dan masuk daftar Open Questions. **Dilarang** dinaikkan menjadi requirement aktif berdasarkan asumsi, praktik umum industri, atau "biasanya begini". |
| SD-03 | Bila dua dokumen sumber bertentangan (mis. lembur SPV, jam kerja lapangan), developer **DILARANG memilih**. Konflik diangkat sebagai Open Question ber-status BLOCKER, dan seed memakai opsi paling konservatif.                         |
| SD-04 | Fitur di luar dokumen sumber masuk backlog `Later`, tidak dikerjakan di MVP maupun v2, sekalipun terlihat mudah.                                                                                                                         |
| SD-05 | Angka yang belum ada dokumennya (plafon pinjaman, tarif perdin, plafon SIM, tarif JP) WAJIB **dikosongkan**, bukan diisi nilai tebakan. Sistem menampilkan status "Belum dikonfigurasi" dan memblokir transaksi terkait.                 |

---

## 4. User Stories

### 4.1 Modul 0 — User, Grup Pengguna & Hak Akses

| ID      | Story                                                                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-00.1 | Sebagai **IT Admin**, saya ingin membuat grup pengguna baru dan mencentang permission dari daftar yang tersedia, sehingga saya bisa menambah peran baru tanpa meminta developer deploy ulang.                                |
| US-00.2 | Sebagai **IT Admin**, saya ingin menentukan _cakupan data_ per permission (Diri Sendiri / Bawahan Langsung / Seluruh Bawahan / Cabang / Divisi / Entitas / Semua), sehingga Admin Cabang Garut hanya melihat karyawan Garut. |
| US-00.3 | Sebagai **IT Admin**, saya ingin menyembunyikan field sensitif (gaji pokok, no. rekening, NIK KTP) untuk grup tertentu, sehingga Supervisor bisa approve cuti tanpa melihat gaji bawahannya.                                 |
| US-00.4 | Sebagai **IT Admin**, saya ingin menyusun struktur menu (web & mobile) dari registry dan mengaitkannya ke permission, sehingga menu yang tidak berhak otomatis hilang dari sidebar dan bottom-nav.                           |
| US-00.5 | Sebagai **HCGA Manager**, saya ingin memberi _override_ permission ke satu user tertentu (grant/revoke) tanpa mengubah grupnya, sehingga kasus pengecualian tidak merusak matriks.                                           |
| US-00.6 | Sebagai **Auditor**, saya ingin melihat riwayat perubahan hak akses (siapa, kapan, dari apa ke apa), sehingga saya bisa membuktikan pengendalian akses ke auditor ISO.                                                       |
| US-00.7 | Sebagai **Karyawan**, saya ingin akun saya otomatis nonaktif saat status saya menjadi _resign_, sehingga tidak ada akses tertinggal.                                                                                         |

### 4.2 Modul 1 — Employee Master & Organisasi

| ID      | Story                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-01.1 | Sebagai **Comben**, saya ingin mengimpor data karyawan dari Excel dengan validasi per baris dan laporan error, sehingga migrasi 300 data tidak memakan berhari-hari.                      |
| US-01.2 | Sebagai **Comben**, saya ingin mencatat mutasi/promosi sebagai _record ber-tanggal efektif_, sehingga payroll periode lalu tetap memakai jabatan lama.                                    |
| US-01.3 | Sebagai **Comben**, saya ingin menetapkan atasan langsung dan division head per karyawan dengan masa berlaku, sehingga routing approval selalu benar meski struktur berubah.              |
| US-01.4 | Sebagai **Karyawan**, saya ingin mengajukan perubahan data pribadi (alamat, no. HP, rekening) untuk diverifikasi Comben, sehingga data saya akurat tanpa saya bisa mengubahnya diam-diam. |
| US-01.5 | Sebagai **HCGA**, saya ingin diingatkan 60/30/14 hari sebelum kontrak karyawan berakhir, sehingga tidak ada kontrak lewat tanpa keputusan.                                                |

### 4.3 Modul 2 — Absensi & Jadwal Kerja

| ID      | Story                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-02.1 | Sebagai **Asep (Driver)**, saya ingin absen masuk dengan swafoto + lokasi dalam ≤ 3 tap, sehingga saya tidak terlambat berangkat rute.                  |
| US-02.2 | Sebagai **Asep**, saya ingin absen tetap tersimpan saat tidak ada sinyal dan terkirim otomatis saat sinyal kembali, sehingga saya tidak dianggap alpha. |
| US-02.3 | Sebagai **Comben**, saya ingin sistem menandai absensi yang terindikasi _fake GPS_/emulator, sehingga saya bisa memverifikasi sebelum payroll.          |
| US-02.4 | Sebagai **Admin Cabang**, saya ingin mengatur jadwal kerja/shift per karyawan per periode, sehingga perhitungan terlambat & lembur akurat.              |
| US-02.5 | Sebagai **Comben**, saya ingin mengoreksi absensi dengan alasan wajib dan jejak audit, sehingga koreksi sah tapi tidak bisa disalahgunakan.             |
| US-02.6 | Sebagai **Supervisor**, saya ingin melihat papan kehadiran tim hari ini secara real-time, sehingga saya tahu siapa yang belum absen sebelum jam 09.00.  |

### 4.4 Modul 3 — Cuti & Izin

| ID      | Story                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-03.1 | Sebagai **Karyawan**, saya ingin melihat saldo cuti (hak, terpakai, sisa, advance, tanggal hangus) sebelum mengajukan, sehingga saya tidak salah ajukan.               |
| US-03.2 | Sebagai **Karyawan**, saya ingin sistem menolak pengajuan cuti tahunan < 7 hari kerja sebelum pelaksanaan dengan pesan yang jelas, kecuali saya memilih jalur darurat. |
| US-03.3 | Sebagai **Karyawan < 1 tahun**, saya ingin mengajukan Cuti Advance maks. 3 hari, dan sistem otomatis memotongnya saat hak cuti saya terbit.                            |
| US-03.4 | Sebagai **Atasan Langsung**, saya ingin approve/reject dari HP dengan melihat kalender ketersediaan tim, sehingga operasional tidak kosong.                            |
| US-03.5 | Sebagai **Division Head**, saya ingin menerima pengajuan hanya setelah Atasan Langsung menyetujui, sesuai SOP.LMN.CBN.04.                                              |
| US-03.6 | Sebagai **Karyawan**, saya ingin mencatat cuti darurat secara _backdate_ setelah kembali bekerja dengan lampiran, sesuai jalur darurat SOP.                            |
| US-03.7 | Sebagai **Comben**, saya ingin sistem menghitung hak cuti prorata tahun pertama secara otomatis dan menandai cuti yang akan hangus dalam 30 hari.                      |
| US-03.8 | Sebagai **Karyawan**, saya ingin mengajukan Izin maks. H-1 dan melihat dampak potongannya sebelum submit, sehingga saya sadar konsekuensi finansialnya.                |

### 4.5 Modul 4 — Lembur

| ID      | Story                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| US-04.1 | Sebagai **Supervisor**, saya ingin membuat perintah lembur untuk beberapa anggota tim sekaligus sebelum pelaksanaan.                         |
| US-04.2 | Sebagai **Karyawan**, saya ingin melihat estimasi nilai lembur saya sebelum dan sesudah approval.                                            |
| US-04.3 | Sebagai **Comben**, saya ingin sistem otomatis mengenali hari libur nasional/cuti bersama dan menerapkan pengali yang benar per golongan.    |
| US-04.4 | Sebagai **Comben**, saya ingin jam lembur aktual diambil dari log absensi, bukan diketik ulang, dengan selisih terhadap rencana ditampilkan. |

### 4.6 Modul 5 — ESS & e-Payslip

| ID      | Story                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-05.1 | Sebagai **Comben**, saya ingin mengunggah hasil payroll final dan mempublikasikannya sebagai e-payslip per karyawan dalam satu aksi.             |
| US-05.2 | Sebagai **Karyawan**, saya ingin membuka slip gaji dengan PIN/biometrik terpisah, sehingga orang lain yang pegang HP saya tidak bisa melihatnya. |
| US-05.3 | Sebagai **Karyawan**, saya ingin mengunduh slip PDF dan melihat 12 bulan terakhir.                                                               |
| US-05.4 | Sebagai **Comben**, saya ingin menarik kembali (_unpublish_) slip yang salah dan menerbitkan revisi dengan penandaan versi.                      |

### 4.7 Modul 6 — Payroll Feeder

| ID      | Story                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-06.1 | Sebagai **Comben**, saya ingin menutup periode 22–21 dan menghasilkan berkas input payroll berisi hari hadir, hari izin/alpha, jam lembur per tipe hari, status tunjangan kehadiran, dan angsuran pinjaman per karyawan. |
| US-06.2 | Sebagai **Comben**, saya ingin sistem menolak penutupan periode jika masih ada approval menggantung atau absensi anomali yang belum diselesaikan.                                                                        |
| US-06.3 | Sebagai **Comben**, saya ingin melihat _calculation trace_ untuk setiap angka di berkas tersebut.                                                                                                                        |

---

## 5. Feature List — MVP / v2 / Later

### 5.1 MVP (Rilis 1 — target 16 minggu)

| Kode    | Modul                                            | Cakupan                                                                                                                                                                                                                           | Prioritas        |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **M0**  | **User, Grup Pengguna & Matriks Hak Akses**      | Registry permission & menu, grup, data scope, field masking, override per user, delegasi approver, audit log akses                                                                                                                | **P0 — blocker** |
| **M1**  | Employee Master & Organisasi                     | Karyawan, kontrak, penugasan ber-tanggal efektif, garis pelaporan, import Excel, dokumen karyawan                                                                                                                                 | **P0**           |
| **M1B** | **Master Data & Data Referensi**                 | 36 tabel master (entitas, cabang, divisi, departemen, jabatan, **golongan**, jenis cuti, tarif lembur, komponen gaji, tunj. kehadiran, BPJS, bank, data referensi umum) — **masing-masing dengan layar CRUD, bukan seed SQL**     | **P0**           |
| **M2**  | Absensi & Jadwal Kerja                           | Absen mobile (GPS + swafoto + anti-mock), geofence per cabang, offline queue, shift & jadwal, kalender hari libur, koreksi absensi, papan kehadiran tim                                                                           | **P0**           |
| **M2B** | **Roster Management**                            | Pola jadwal & shift terkonfigurasi (`FIXED`/`SHIFT`/`FLEXIBLE`), penugasan berjenjang ber-tanggal efektif, kalender roster bulanan, penimpaan per tanggal, salin & import jadwal                                                  | **P0**           |
| **M3**  | Cuti & Izin                                      | Jenis cuti/izin terkonfigurasi, saldo & prorata, cuti advance, pengajuan + lampiran, jalur darurat/backdate, approval berjenjang, kalender tim                                                                                    | **P0**           |
| **M4**  | Lembur                                           | Perintah lembur, aturan tarif per golongan × tipe hari (config), realisasi dari absensi, approval                                                                                                                                 | **P0**           |
| **M5**  | ESS & e-Payslip                                  | Profil, saldo, riwayat pengajuan, publish & lihat slip (PIN-protected), unduh PDF                                                                                                                                                 | **P0**           |
| **M6**  | Payroll Feeder                                   | Periode 22–21, agregasi komponen variabel, calculation trace, export Excel/CSV, validasi pra-tutup                                                                                                                                | **P0**           |
| **M7**  | Notifikasi & Approval Inbox                      | Push (FCM), in-app, email opsional; inbox terpadu; eskalasi SLA; delegasi                                                                                                                                                         | **P0**           |
| **M8**  | Konfigurasi Sistem                               | System parameter ber-tanggal efektif, master data referensi, workflow builder, template notifikasi, penomoran dokumen                                                                                                             | **P0**           |
| **M8B** | **Pengaturan Umum (Format, Validasi & Laporan)** | Registry format (tanggal `DDMMYYYY`, angka, mata uang), registry validasi (NIK, KTP, NPWP, rekening, BPJS), generator Nomor Induk Karyawan, penomoran dokumen ISO, katalog & template laporan, identitas perusahaan, retensi data | **P0**           |
| **M9**  | Audit & Laporan Dasar                            | Audit trail immutable, laporan kehadiran, laporan cuti, laporan lembur, ekspor untuk ISO                                                                                                                                          | **P1**           |

### 5.2 v2 (Rilis 2 — +12 minggu)

| Kode | Modul                              | Catatan                                                                                                               |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| V1   | **Payroll Engine penuh**           | Komponen gaji ber-tanggal efektif per karyawan, formula engine, BPJS TK/Kes, THR, bank transfer file, jurnal akunting |
| V2   | Pinjaman Karyawan (SOP.LMN.CBN.09) | Plafon config, cek outstanding, angsuran otomatis ke payroll, pelunasan dipercepat                                    |
| V3   | Perjalanan Dinas & Petty Cash      | Pengajuan, matriks tarif per golongan × tier kota, uang muka, LPJ, reimbursement, auto-deduct LPJ telat               |
| V4   | Pembiayaan SIM (SOP.LMN.CBN.02)    | Eligibility Driver ≥1 th, skema 50:50, reminder SIM kedaluwarsa H-30                                                  |
| V5   | Dashboard Analitik                 | Turnover, absensi, biaya lembur per cabang, aging approval                                                            |
| V6   | Integrasi mesin fingerprint        | Konektor import terjadwal                                                                                             |
| V7   | PPh 21 (TER)                       | Butuh keputusan kebijakan pajak lebih dulu                                                                            |

### 5.3 Later (Backlog Bersyarat)

| Kode | Modul                                  | Prasyarat                               |
| ---- | -------------------------------------- | --------------------------------------- |
| L1   | Performance Management / KPI           | Kerangka penilaian belum ada            |
| L2   | Recruitment & Onboarding               | Volume rekrutmen belum terukur          |
| L3   | Employee Self Development / e-Learning | —                                       |
| L4   | Portal Vendor / Outsourcing            | Jika model bisnis berubah               |
| L5   | Face recognition on-device             | Setelah data swafoto MVP terbukti cukup |
| L6   | Modul Aset & Inventaris Karyawan       | —                                       |

---

## 6. Functional Requirements — per Fitur MVP

> Notasi: **WAJIB** = _must_, **SEBAIKNYA** = _should_. Setiap FR yang mengandung angka kebijakan menunjuk ke `system_parameters`, **bukan konstanta di kode**.

---

### 6.M0 — Modul User, Grup Pengguna & Matriks Hak Akses

#### 6.M0.1 Prinsip

| #         | Requirement                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-001 | Model otorisasi WAJIB berupa **RBAC + ABAC**: _apa_ yang boleh dilakukan (permission) dipisah dari _data siapa_ yang boleh disentuh (data scope).                                                                                                    |
| FR-M0-002 | Seluruh permission WAJIB terdaftar di tabel `permissions` dengan format kode `{modul}.{resource}.{action}` (contoh: `leave.request.approve`). Kode baru masuk lewat _seed migration_, **dilarang** ditulis sebagai enum/konstanta di logic aplikasi. |
| FR-M0-003 | Backend WAJIB melakukan pengecekan otorisasi di lapisan _service/policy_, bukan hanya menyembunyikan tombol di frontend. Setiap endpoint WAJIB dianotasi permission-nya.                                                                             |
| FR-M0-004 | Endpoint tanpa deklarasi permission WAJIB **ditolak secara default** (_deny-by-default_), dan CI WAJIB gagal jika ada controller tanpa anotasi.                                                                                                      |

#### 6.M0.2 User

| #         | Requirement                                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-010 | Satu `user` WAJIB dapat ditautkan ke maksimal satu `employee`. User sistem (integrasi/IT) boleh tanpa `employee`.                                                           |
| FR-M0-011 | Login WAJIB mendukung: NIK + password (mobile), dan email + password (web). Username tidak dipakai.                                                                         |
| FR-M0-012 | Kebijakan password (panjang minimum, kompleksitas, masa berlaku, riwayat) WAJIB dari `system_parameters`.                                                                   |
| FR-M0-013 | Sistem WAJIB mengunci akun setelah N kali gagal login (N dari config) selama M menit.                                                                                       |
| FR-M0-014 | Status user: `ACTIVE`, `INACTIVE`, `LOCKED`, `PENDING_ACTIVATION`. Perubahan status karyawan menjadi `RESIGNED`/`TERMINATED` WAJIB otomatis menonaktifkan user (US-00.7).   |
| FR-M0-015 | Sistem WAJIB mendukung **device binding** untuk mobile: 1 akun aktif di 1 device pada satu waktu (_configurable_); login di device baru memerlukan approval Admin atau OTP. |
| FR-M0-016 | Reset password WAJIB lewat OTP ke nomor HP terdaftar atau reset oleh Admin dengan password sementara sekali pakai.                                                          |
| FR-M0-017 | Sistem WAJIB menyimpan sesi aktif dan memungkinkan Admin melakukan _force logout_ per user/device.                                                                          |
| FR-M0-018 | 2FA (TOTP) WAJIB tersedia dan **dipaksa** untuk grup yang ditandai `requires_2fa = true` (default: Super Admin, Finance, HCGA Manager).                                     |

#### 6.M0.3 Grup Pengguna

| #         | Requirement                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M0-020 | Admin WAJIB dapat membuat, mengubah, menonaktifkan, dan menggandakan (_clone_) grup pengguna lewat UI.                                     |
| FR-M0-021 | Satu user WAJIB dapat menjadi anggota **lebih dari satu grup**. Hak akses efektif = **union** dari seluruh grup.                           |
| FR-M0-022 | Sistem WAJIB menyediakan `user_permission_overrides` dengan efek `GRANT` atau `DENY`. **`DENY` selalu menang** atas union grup.            |
| FR-M0-023 | Grup bertanda `is_system = true` (mis. Super Admin) WAJIB tidak bisa dihapus, dan permission intinya tidak bisa dicabut.                   |
| FR-M0-024 | Sistem WAJIB menyediakan layar **simulasi**: "Tampilkan menu & data yang terlihat sebagai user X" tanpa perlu login sebagai user tersebut. |
| FR-M0-025 | Grup WAJIB dapat ditandai `requires_2fa`, `max_session_minutes`, dan `allowed_ip_cidr` (opsional).                                         |

#### 6.M0.4 Data Scope (Hak Akses Data)

| #         | Requirement                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-030 | Setiap pasangan (grup × permission) WAJIB memiliki `data_scope` dari enumerasi berikut, tersimpan sebagai **data referensi**, bukan enum kode. |

**Enumerasi Data Scope:**

| Kode            | Nama                | Definisi Resolusi                                                     |
| --------------- | ------------------- | --------------------------------------------------------------------- |
| `SELF`          | Diri sendiri        | `employee_id = current_user.employee_id`                              |
| `DIRECT_REPORT` | Bawahan langsung    | `reporting_lines.supervisor_id = me` (1 level, tanggal berlaku aktif) |
| `TEAM_TREE`     | Seluruh bawahan     | Penelusuran rekursif `reporting_lines` ke bawah                       |
| `BRANCH`        | Cabang / area kerja | `employee.branch_id ∈ user.scoped_branch_ids`                         |
| `DIVISION`      | Divisi              | `employee.division_id ∈ user.scoped_division_ids`                     |
| `ENTITY`        | Badan hukum         | `employee.company_id ∈ user.scoped_company_ids`                       |
| `ALL`           | Seluruh organisasi  | Tanpa filter                                                          |
| `CUSTOM`        | Kombinasi eksplisit | Daftar `branch_id`/`division_id` yang dipilih manual di UI            |

| #         | Requirement                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M0-031 | Bila satu user memperoleh permission yang sama dari beberapa grup dengan scope berbeda, scope efektif = **yang paling luas**.                          |
| FR-M0-032 | Filter scope WAJIB diterapkan di lapisan repository/query (mis. Prisma middleware atau Row-Level Security PostgreSQL), **bukan** difilter di frontend. |
| FR-M0-033 | Scope `TEAM_TREE` WAJIB dibatasi kedalaman maksimum dari config untuk mencegah rekursi tak terbatas pada data organisasi yang salah.                   |
| FR-M0-034 | Setiap query yang mengembalikan data karyawan WAJIB melewati _scope guard_; unit test WAJIB memverifikasi kebocoran lintas cabang.                     |

#### 6.M0.5 Field-Level Masking

| #         | Requirement                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-040 | Field sensitif WAJIB terdaftar di `sensitive_fields` (entity, field, default_masked). Minimal: `gaji_pokok`, `komponen tunjangan`, `nomor_rekening`, `nik_ktp`, `npwp`, `alamat`, `nomor_hp`, `data_medis`. |
| FR-M0-041 | Per grup × permission, Admin WAJIB dapat memilih field mana yang di-_mask_. Nilai ter-_mask_ dikembalikan API sebagai `"***"`, **bukan** dikirim penuh lalu disembunyikan CSS.                              |
| FR-M0-042 | Export (Excel/PDF) WAJIB menghormati aturan masking yang sama dengan tampilan layar.                                                                                                                        |

#### 6.M0.6 Menu Registry

| #         | Requirement                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-050 | Struktur menu WAJIB tersimpan di tabel `menus`: `code`, `parent_id`, `label`, `icon`, `route`, `platform` (`WEB`/`MOBILE`/`BOTH`), `sort_order`, `is_active`, `permission_code`. |
| FR-M0-051 | Frontend WAJIB merender navigasi dari endpoint `GET /me/navigation`, **bukan** dari array statis di kode frontend.                                                               |
| FR-M0-052 | Menu induk WAJIB otomatis tersembunyi bila seluruh anaknya tidak dapat diakses.                                                                                                  |
| FR-M0-053 | Admin WAJIB dapat mengubah urutan, label, dan ikon menu tanpa deploy. Route dan `permission_code` hanya dapat diubah oleh Super Admin.                                           |
| FR-M0-054 | Perubahan menu/permission WAJIB tersedia bagi user pada login berikutnya atau maksimal N menit (TTL cache dari config), dan Admin WAJIB dapat memaksa _cache invalidation_.      |

#### 6.M0.7 Delegasi & Audit

| #         | Requirement                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M0-060 | Approver WAJIB dapat mendelegasikan wewenang approval ke user lain untuk rentang tanggal tertentu, terbatas pada modul tertentu.                                    |
| FR-M0-061 | Approval hasil delegasi WAJIB tercatat sebagai "disetujui oleh X atas nama Y".                                                                                      |
| FR-M0-062 | Seluruh perubahan pada `users`, `user_groups`, `group_permissions`, `menus` WAJIB tercatat di `audit_logs` dengan `before`/`after` JSON, aktor, IP, dan user-agent. |
| FR-M0-063 | `audit_logs` WAJIB _append-only_; user aplikasi tidak memiliki hak `UPDATE`/`DELETE` di level database.                                                             |

#### 6.M0.8 Matriks Hak Akses Default (Seed — **dapat diubah Admin**)

**Legenda:** `C`=Create, `R`=Read, `U`=Update, `D`=Delete, `A`=Approve, `P`=Publish/Post, `X`=Export, `—`=tidak ada akses. Sufiks = data scope.

| Modul / Menu                        | Super Admin | HCGA Mgr | Comben   | Finance/FAT       | Div. Head   | Manager      | Supervisor                  | Admin Cabang           | Karyawan | Auditor              |
| ----------------------------------- | ----------- | -------- | -------- | ----------------- | ----------- | ------------ | --------------------------- | ---------------------- | -------- | -------------------- |
| Dashboard                           | R·ALL       | R·ALL    | R·ALL    | R·ALL             | R·DIVISION  | R·TEAM_TREE  | R·TEAM_TREE                 | R·BRANCH               | R·SELF   | R·ALL                |
| **Master Karyawan**                 | CRUD·ALL    | CRUD·ALL | CRUD·ALL | R·ALL (mask gaji) | R·DIVISION  | R·TEAM_TREE  | R·DIRECT_REPORT (mask gaji) | CRU·BRANCH (mask gaji) | R·SELF   | R·ALL (mask)         |
| Kontrak & Penugasan                 | CRUD·ALL    | CRUD·ALL | CRUD·ALL | R·ALL             | R·DIVISION  | R·TEAM_TREE  | —                           | R·BRANCH               | R·SELF   | R·ALL                |
| Struktur Organisasi (bagan)         | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·DIVISION  | R·TEAM_TREE  | R·TEAM_TREE                 | R·BRANCH               | R·SELF   | R·ALL                |
| **— Master Entitas Perusahaan**     | CRUD·ALL    | RU·ALL   | R·ALL    | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Master Area Kerja / Cabang**    | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·DIVISION  | R·ALL        | R·ALL                       | R·BRANCH               | —        | R·ALL                |
| **— Master Divisi & Departemen**    | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·DIVISION  | R·ALL        | R·ALL                       | R·BRANCH               | —        | R·ALL                |
| **— Master Jabatan**                | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·DIVISION  | R·ALL        | R·ALL                       | R·BRANCH               | —        | R·ALL                |
| **— Master Golongan**               | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·ALL       | R·ALL        | R·ALL                       | R·ALL                  | —        | R·ALL                |
| **— Master Jenis Cuti & Izin**      | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | R·ALL       | R·ALL        | R·ALL                       | R·ALL                  | R·ALL    | R·ALL                |
| **— Master Aturan Tarif Lembur**    | CRUD·ALL    | CRUD·ALL | RU·ALL   | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Master Komponen Gaji**          | CRUD·ALL    | RU·ALL   | CRUD·ALL | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Master Aturan Tunj. Kehadiran** | CRUD·ALL    | RU·ALL   | CRUD·ALL | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Master Tarif BPJS**             | CRUD·ALL    | RU·ALL   | CRUD·ALL | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Master Bank & Rekening**        | CRUD·ALL    | RU·ALL   | RU·ALL   | CRUD·ALL          | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Data Referensi Umum**           | CRUD·ALL    | CRUD·ALL | CRU·ALL  | R·ALL             | R·ALL       | R·ALL        | R·ALL                       | R·ALL                  | R·ALL    | R·ALL                |
| **Absensi — Log**                   | CRUD·ALL    | RU·ALL   | CRU·ALL  | R·ALL             | R·DIVISION  | R·TEAM_TREE  | R·TEAM_TREE                 | CRU·BRANCH             | CR·SELF  | R·ALL                |
| Absensi — Koreksi                   | CRUD·ALL    | A·ALL    | CU·ALL   | —                 | A·DIVISION  | A·TEAM_TREE  | C·TEAM_TREE                 | C·BRANCH               | C·SELF   | R·ALL                |
| Jadwal Kerja / Pola Shift           | CRUD·ALL    | CRUD·ALL | CRUD·ALL | —                 | R·DIVISION  | R·TEAM_TREE  | R·TEAM_TREE                 | R·BRANCH               | R·SELF   | R·ALL                |
| Roster Bulanan (penugasan)          | CRUD·ALL    | CRUD·ALL | CRUD·ALL | —                 | R·DIVISION  | RU·TEAM_TREE | RU·TEAM_TREE                | CRU·BRANCH             | R·SELF   | R·ALL                |
| Kalender Hari Libur                 | CRUD·ALL    | CRUD·ALL | CRUD·ALL | R·ALL             | R·ALL       | R·ALL        | R·ALL                       | R·ALL                  | R·ALL    | R·ALL                |
| **Cuti — Pengajuan**                | CRUD·ALL    | RA·ALL   | CRU·ALL  | —                 | A·DIVISION  | A·TEAM_TREE  | A·DIRECT_REPORT             | R·BRANCH               | CR·SELF  | R·ALL                |
| Cuti — Saldo                        | CRUD·ALL    | RU·ALL   | CRUD·ALL | R·ALL             | R·DIVISION  | R·TEAM_TREE  | R·DIRECT_REPORT             | R·BRANCH               | R·SELF   | R·ALL                |
| Izin — Pengajuan                    | CRUD·ALL    | RA·ALL   | CRU·ALL  | —                 | R·DIVISION  | A·TEAM_TREE  | A·DIRECT_REPORT             | R·BRANCH               | CR·SELF  | R·ALL                |
| **Lembur**                          | CRUD·ALL    | RA·ALL   | CRU·ALL  | R·ALL             | A·DIVISION  | A·TEAM_TREE  | CA·DIRECT_REPORT            | R·BRANCH               | R·SELF   | R·ALL                |
| **Payroll — Periode**               | CRUD·ALL    | R·ALL    | CRUD·ALL | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| Payroll — Feeder/Export             | CRUDX·ALL   | RX·ALL   | CRUX·ALL | RX·ALL            | —           | —            | —                           | —                      | —        | RX·ALL               |
| **e-Payslip — Publish**             | P·ALL       | P·ALL    | P·ALL    | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL (mask nominal) |
| e-Payslip — Lihat                   | R·ALL       | R·ALL    | R·ALL    | R·ALL             | —           | —            | —                           | —                      | R·SELF   | —                    |
| **Pinjaman** _(v2)_                 | CRUD·ALL    | A·ALL    | CRU·ALL  | A·ALL             | A·DIVISION  | R·TEAM_TREE  | A·DIRECT_REPORT             | R·BRANCH               | CR·SELF  | R·ALL                |
| **Perjalanan Dinas** _(v2)_         | CRUD·ALL    | RA·ALL   | CRU·ALL  | A·ALL             | A·DIVISION  | A·TEAM_TREE  | A·DIRECT_REPORT             | R·BRANCH               | CR·SELF  | R·ALL                |
| **Pembiayaan SIM** _(v2)_           | CRUD·ALL    | A·ALL    | CRU·ALL  | A·ALL             | A·DIVISION  | A·TEAM_TREE  | —                           | R·BRANCH               | CR·SELF  | R·ALL                |
| **Laporan**                         | RX·ALL      | RX·ALL   | RX·ALL   | RX·ALL            | RX·DIVISION | RX·TEAM_TREE | RX·TEAM_TREE                | RX·BRANCH              | —        | RX·ALL               |
| **Konfigurasi Sistem**              | CRUD·ALL    | RU·ALL   | R·ALL    | —                 | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Pengaturan Umum & Format**      | CRUD·ALL    | RU·ALL   | R·ALL    | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Registry Validasi Data**        | CRUD·ALL    | RU·ALL   | R·ALL    | —                 | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Format Nomor Induk Karyawan**   | CRUD·ALL    | RU·ALL   | R·ALL    | —                 | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Penomoran Dokumen**             | CRUD·ALL    | RU·ALL   | R·ALL    | —                 | —           | —            | —                           | —                      | —        | R·ALL                |
| **— Definisi & Katalog Laporan**    | CRUD·ALL    | CRU·ALL  | CRU·ALL  | R·ALL             | —           | —            | —                           | —                      | —        | R·ALL                |
| **User & Grup Akses**               | CRUD·ALL    | CRU·ALL  | —        | —                 | —           | —            | —                           | —                      | —        | R·ALL                |
| **Audit Log**                       | R·ALL       | R·ALL    | —        | R·ALL             | —           | —            | —                           | —                      | —        | RX·ALL               |

> **Aturan tegas:** Matriks di atas adalah **data seed**, bukan spesifikasi kode. Developer WAJIB memuatnya lewat migration/seeder. Jika ditemukan kode yang mengecek nama grup (`if (group.name === 'Comben')`), itu **cacat blocker** dan harus ditolak di code review.

---

### 6.M1 — Employee Master & Organisasi

| #          | Requirement                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M1-001  | Sistem WAJIB mendukung multi-entitas (LMN, LMI, Pabrik) dengan konfigurasi tarif BPJS berbeda per entitas.                                                                                                                                                                                                                                             |
| FR-M1-002  | `NIK` WAJIB unik lintas seluruh entitas dan tidak dapat diubah setelah dibuat (hanya Super Admin dengan alasan wajib).                                                                                                                                                                                                                                 |
| FR-M1-003  | Perubahan jabatan, golongan, cabang, dan atasan WAJIB disimpan sebagai record `employee_assignments` ber-`effective_from`/`effective_to`, **bukan** menimpa kolom.                                                                                                                                                                                     |
| FR-M1-004  | Seluruh perhitungan (payroll, cuti, lembur) WAJIB mengambil penugasan **yang berlaku pada tanggal transaksi**, bukan yang terkini.                                                                                                                                                                                                                     |
| FR-M1-005  | Import Excel WAJIB: validasi per baris, _dry-run preview_, laporan error yang dapat diunduh, dan bersifat _atomic_ (semua berhasil atau tidak sama sekali) per batch, maks. 300 baris per file.                                                                                                                                                        |
| FR-M1-006  | Field wajib minimum: NIK, Nama, Tanggal Masuk, Entitas, Area Kerja, Jabatan, Golongan, Status Kontrak, Atasan Langsung.                                                                                                                                                                                                                                |
| FR-M1-007  | **KOREKSI ATAS ASESMEN AWAL — data master TERSEDIA.** File `data_pegawai_master` berisi **24 kolom**, bukan 5 seperti asesmen pertama. Inventaris lengkap ada di 6.M1B.6. Yang **masih belum ada** hanya: **Atasan Langsung** dan **Division Head** (`reporting_lines`). Ini tetap blocker untuk modul approval, tetapi bukan blocker untuk M1/M1B/M2. |
| FR-M1-007a | Template import WAJIB mengikuti struktur 24 kolom pada 6.M1B.6, termasuk penanda wajib (*) yang sama, agar Comben tidak perlu memformat ulang berkasnya.                                                                                                                                                                                               |
| FR-M1-007b | Batas 300 baris per file (sesuai catatan pada template sumber) WAJIB menjadi parameter, bukan literal.                                                                                                                                                                                                                                                 |
| FR-M1-008  | Sistem WAJIB menyimpan dokumen karyawan (KTP, KK, NPWP, SIM, ijazah, kontrak) dengan tanggal kedaluwarsa dan pengingat otomatis.                                                                                                                                                                                                                       |
| FR-M1-009  | Perubahan data pribadi oleh karyawan WAJIB masuk antrean verifikasi Comben, tidak langsung mengubah master.                                                                                                                                                                                                                                            |

---

### 6.M1B — Master Data & Data Referensi

> **Kenapa ini dipisah menjadi sub-modul sendiri:** entity yang ada di ERD tidak otomatis berarti ada layar untuk mengelolanya. Tanpa FR di bawah ini, tim akan mengisi tabel master lewat SQL manual — dan itu adalah bentuk lain dari hardcode: aturan bisnis terkunci di skrip migrasi yang tidak bisa disentuh Admin.

#### 6.M1B.1 Prinsip

| #          | Requirement                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-001 | **Setiap** tabel master di Registry (6.M1B.4) WAJIB memiliki layar CRUD di Web Dashboard. Pengisian lewat SQL manual hanya diizinkan untuk _seed_ awal pada Sprint 0, dan WAJIB dapat diubah lewat UI setelahnya.    |
| FR-M1B-002 | Master data yang memengaruhi perhitungan finansial WAJIB **ber-tanggal efektif** (`effective_from`, `effective_to`), bukan di-_update in-place_. Mengubah nilainya menciptakan baris baru, tidak menimpa baris lama. |
| FR-M1B-003 | Master data yang sudah dirujuk transaksi **DILARANG dihapus fisik**. Hanya boleh dinonaktifkan (`is_active = false`) dan tetap muncul di data historis.                                                              |
| FR-M1B-004 | Setiap layar master WAJIB menyediakan: pencarian, filter status aktif, import/export Excel, dan riwayat perubahan (audit trail per record).                                                                          |
| FR-M1B-005 | Sebelum menyimpan perubahan pada master yang memengaruhi perhitungan, sistem WAJIB menampilkan **dampak**: jumlah karyawan/transaksi terpengaruh dan periode mana saja.                                              |
| FR-M1B-006 | Kode (`code`) pada seluruh master WAJIB unik, tidak dapat diubah setelah dirujuk transaksi, dan menjadi kunci referensi di konfigurasi (bukan ID numerik yang tidak bermakna).                                       |

#### 6.M1B.2 Master Golongan (Job Grade)

| #           | Requirement                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-010  | Field: `code`, `name`, `level_order`, `is_staff`, `overtime_eligible`, `default_work_schedule_id`, `attendance_allowance_rule_set`, `is_active`.                                                                                            |
| FR-M1B-011  | Seed golongan (sesuai `Matriks Gaji & Tunjangan`): `NON_STAFF`, `STAFF`, `SUPERVISOR`, `MANAGER`. Admin WAJIB dapat menambah golongan baru tanpa deploy.                                                                                    |
| FR-M1B-011a | **Normalisasi wajib:** sumber menulis golongan sebagai `Non Staff` (tanpa tanda hubung) di `data_pegawai_master`, tetapi `Non-Staff` (dengan tanda hubung) di `Matriks Gaji & Tunjangan`. Importer WAJIB memetakan keduanya ke satu `code`. |
| FR-M1B-011b | **Seed jabatan per golongan** (sesuai `Matriks Gaji & Tunjangan`), beserta matriks komponen tunjangan yang berhak diterima:                                                                                                                 |

**Golongan Non-Staff**

| Kelompok Jabatan                                                                      | Makan | Transport | Jabatan | Akomodasi | Kendaraan | Pulsa | Kehadiran | Sewa Motor | Appearance | Operasional |
| ------------------------------------------------------------------------------------- | :---: | :-------: | :-----: | :-------: | :-------: | :---: | :-------: | :--------: | :--------: | :---------: |
| Sales Canvas, Horeca Executive                                                        |  ✅   |    ✅     |         |           |           |       |    ✅     |            |            |             |
| Sales Executive, Sales Exclusive, Sales Taking Order, Canvas Motoris, FSR, Task Force |  ✅   |    ✅     |         |           |           |  ✅   |    ✅     |            |            |             |
| SP-GT                                                                                 |  ✅   |    ✅     |         |           |           |       |    ✅     |            |            |             |
| SP-MT, Key Account Executive                                                          |  ✅   |    ✅     |         |           |           |  ✅   |    ✅     |            |            |             |
| Driver Canvas                                                                         |  ✅   |    ✅     |         |           |           |       |    ✅     |            |            |             |
| Driver Distributor, Driver Operasional, Delivery Man                                  |  ✅   |    ✅     |         |           |           |       |    ✅     |            |            |             |
| Helper Canvas, Helper Delivery                                                        |  ✅   |    ✅     |         |           |           |       |    ✅     |            |            |             |
| Helper Gudang                                                                         |  ✅   |    ✅     |         |           |           |       |           |            |            |             |

**Golongan Staff, Supervisor, Manager**

| Jabatan                       | Makan | Transport |    Jabatan    |   Akomodasi   | Kendaraan | Pulsa | Kehadiran | Operasional |
| ----------------------------- | :---: | :-------: | :-----------: | :-----------: | :-------: | :---: | :-------: | :---------: |
| Staff (HO)                    |  ✅   |    ✅     | ✅ (opsional) |               |           |       |           |             |
| Administration Staff (Cabang) |  ✅   |    ✅     |      ✅       | ✅ (opsional) |           |       |           |             |
| Supervisor (HO)               |  ✅   |           |      ✅       |               |           |       |           |             |
| Area Sales Supervisor (ASS)   |  ✅   |    ✅     |      ✅       |      ✅       |    ✅     |       |           |             |
| Manager (Support / HO)        |  ✅   |           |               |               |           |       |           |             |
| Manager (Sales / Marketing)   |  ✅   |           |      ✅       |               |           |       |           |             |

| #           | Requirement                                                                                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M1B-011c | Matriks di atas WAJIB tersimpan sebagai tabel `position_component_eligibility` (jabatan × komponen × wajib/opsional), bukan `if` bertingkat. Saat Comben menambahkan komponen ke karyawan yang jabatannya tidak berhak, sistem WAJIB memberi peringatan (bukan blokir) dan mencatat alasannya.                           |
| FR-M1B-011d | Sistem WAJIB membedakan **Tunjangan Tetap** (Jabatan, Akomodasi, Kendaraan, Pulsa, Kehadiran, Appearance, Operasional) dan **Tunjangan Tidak Tetap** (Makan, Transport, Sewa Motor) lewat flag `is_fixed_allowance` pada `payroll_components`, karena hanya Tunjangan Tidak Tetap yang hangus saat karyawan tidak masuk. |
| FR-M1B-011e | **FLAG:** `data_pegawai_master` hanya memuat nilai golongan `Non Staff` pada baris yang terbaca. Apakah karyawan Staff/SPV/Manager berada di file terpisah, atau memang belum diinput? PO wajib mengonfirmasi.                                                                                                           |
| FR-M1B-012  | Golongan WAJIB menjadi kunci pada: `overtime_rate_rules`, `perdiem_rates`, dan template komponen gaji. Menambah golongan baru WAJIB memicu peringatan bahwa aturan tarif untuk golongan tersebut belum didefinisikan.                                                                                                    |
| FR-M1B-013  | `level_order` WAJIB dipakai untuk aturan berbasis hierarki (contoh: "persetujuan minimal Manager" pada SK Perdin), **bukan** perbandingan string nama jabatan.                                                                                                                                                           |

#### 6.M1B.3 Master Area Kerja (Cabang)

| #           | Requirement                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-020  | Field: `company_id`, `code`, `name`, `address`, `latitude`, `longitude`, `geofence_radius_m`, `timezone`, `attendance_policy`, `city_tier`, `is_active`.                                                                                                                                                                                                                                          |
| FR-M1B-021  | Admin WAJIB dapat menetapkan titik geofence lewat **peta interaktif** (klik/geser pin + slider radius), bukan mengetik koordinat manual.                                                                                                                                                                                                                                                          |
| FR-M1B-022  | `attendance_policy` per cabang: `GEOFENCE_STRICT` \| `GEOFENCE_TRACKED`, dapat di-_override_ per jabatan.                                                                                                                                                                                                                                                                                         |
| FR-M1B-023  | `city_tier` WAJIB ada sejak MVP meski dipakai baru di v2, karena menjadi kunci matriks tarif perjalanan dinas.                                                                                                                                                                                                                                                                                    |
| FR-M1B-024  | **Area Kerja adalah area milik entitas, bukan entitas itu sendiri.** Sumber menuliskannya sebagai string gabungan berformat `{ENTITAS} - {AREA}` (contoh: `PT LMN - Bandung`). Sistem WAJIB memecahnya menjadi dua kolom terpisah: `companies.code` dan `branches.name`. Menyimpannya sebagai satu string adalah **cacat blocker** — akibatnya scope `ENTITY` dan `BRANCH` tidak dapat dibedakan. |
| FR-M1B-024a | Importer WAJIB memakai parser dengan pola terkonfigurasi (default regex: `^(PT\.?\s+[A-Z]+)\s*-\s*(.+)$`), menormalkan varian penulisan entitas, lalu mencocokkan ke master. Baris yang tidak cocok **ditolak dengan pesan spesifik**, tidak dibuatkan cabang baru secara diam-diam.                                                                                                              |
| FR-M1B-024b | **Inkonsistensi terdeteksi di data sumber:** `PT LMN -` (194 baris) vs `PT. LMN -` (8 baris, seluruhnya Cirebon). Keduanya WAJIB dipetakan ke entitas yang sama.                                                                                                                                                                                                                                  |
| FR-M1B-024c | **Seed 19 area kerja** dari data sumber, dikelompokkan per entitas `PT LMN`:                                                                                                                                                                                                                                                                                                                      |

| No  | Area Kerja  | Jml Karyawan | No  | Area Kerja  | Jml Karyawan |
| --- | ----------- | -----------: | --- | ----------- | -----------: |
| 1   | Bandung     |           55 | 11  | Solo        |            5 |
| 2   | Garut       |           36 | 12  | Semarang    |            5 |
| 3   | Wangon      |           15 | 13  | Probolinggo |            5 |
| 4   | Tasikmalaya |           13 | 14  | Jember      |            5 |
| 5   | Wonosobo    |           11 | 15  | Tegal       |            4 |
| 6   | Cirebon     |            8 | 16  | Sidoarjo    |            4 |
| 7   | Purwakarta  |            8 | 17  | Jombang     |            4 |
| 8   | Subang      |            7 | 18  | Banyuwangi  |            4 |
| 9   | Sukabumi    |            6 | 19  | Malang      |            3 |
| 10  | Bogor       |            6 |     |             |              |

| #           | Requirement                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-024d | Seluruh 19 area berada di zona `Asia/Jakarta` (WIB). Kolom `timezone` tetap disediakan untuk ekspansi, dengan default WIB.                                        |
| FR-M1B-024e | **FLAG:** Seluruh baris yang terbaca berentitas `PT LMN`. Data untuk **LMI** dan **Pabrik** tidak ditemukan di berkas. Terkait OQ-18 — ruang lingkup entitas MVP. |
| FR-M1B-025  | Menonaktifkan cabang WAJIB diblokir bila masih ada karyawan aktif yang ditugaskan di sana.                                                                        |

#### 6.M1B.4 Registry Master Data — Inventaris Lengkap

**Legenda Kolom:**

- **Efektif-Tanggal**: apakah perubahan menciptakan versi baru (wajib untuk yang memengaruhi uang)
- **Pemilik**: grup yang berhak mengubah
- **Rilis**: kapan layarnya harus ada

| #                         | Master Data            | Entity                             | Efektif-Tanggal | Pemilik                   | Sumber Migrasi                            | Rilis |
| ------------------------- | ---------------------- | ---------------------------------- | --------------- | ------------------------- | ----------------------------------------- | ----- |
| **A. Organisasi**         |                        |                                    |                 |                           |                                           |
| 1                         | Entitas Perusahaan     | `companies`                        | Tidak           | Super Admin               | Manual (LMN, LMI, Pabrik)                 | MVP   |
| 2                         | Area Kerja / Cabang    | `branches`                         | Tidak           | HCGA                      | `data_pegawai_master` (perlu normalisasi) | MVP   |
| 3                         | Divisi                 | `divisions`                        | Tidak           | HCGA                      | Struktur Organisasi                       | MVP   |
| 4                         | Departemen             | `departments`                      | Tidak           | HCGA                      | Struktur Organisasi                       | MVP   |
| 5                         | Golongan               | `job_grades`                       | Tidak           | HCGA                      | `Matriks Gaji & Tunjangan`                | MVP   |
| 6                         | Jabatan                | `job_positions`                    | Tidak           | HCGA                      | `Matriks Gaji & Tunjangan`                | MVP   |
| 7                         | Garis Pelaporan        | `reporting_lines`                  | **Ya**          | HCGA/Comben               | ⚠️ **Belum ada — OQ-03**                  | MVP   |
| **B. Karyawan**           |                        |                                    |                 |                           |                                           |
| 8                         | Karyawan               | `employees`                        | Tidak           | Comben                    | `data_pegawai_master` (tidak lengkap)     | MVP   |
| 9                         | Penugasan Karyawan     | `employee_assignments`             | **Ya**          | Comben                    | ⚠️ **Belum ada — OQ-03**                  | MVP   |
| 10                        | Dokumen Karyawan       | `employee_documents`               | Tidak           | Comben                    | Arsip fisik                               | MVP   |
| 11                        | Master Bank            | `banks`                            | Tidak           | Finance                   | Manual                                    | MVP   |
| **C. Akses**              |                        |                                    |                 |                           |                                           |
| 12                        | User                   | `users`                            | Tidak           | Super Admin/HCGA          | Diturunkan dari `employees`               | MVP   |
| 13                        | Grup Pengguna          | `user_groups`                      | Tidak           | Super Admin               | Seed (10 grup default)                    | MVP   |
| 14                        | Permission             | `permissions`                      | Tidak           | _Sistem (seed migration)_ | Seed per modul                            | MVP   |
| 15                        | Menu                   | `menus`                            | Tidak           | Super Admin               | Seed                                      | MVP   |
| 16                        | Field Sensitif         | `sensitive_fields`                 | Tidak           | Super Admin               | Seed                                      | MVP   |
| **D. Waktu Kerja**        |                        |                                    |                 |                           |                                           |
| 17                        | Jadwal Kerja / Shift   | `work_schedules`                   | Tidak           | Comben/Admin Cabang       | ⚠️ **Belum ada — OQ-11**                  | MVP   |
| 18                        | Detail Hari Jadwal     | `work_schedule_days`               | Tidak           | Comben                    | ⚠️ **OQ-11**                              | MVP   |
| 19                        | Kalender Hari Libur    | `holidays`                         | Per tahun       | Comben                    | SKB 3 Menteri                             | MVP   |
| **E. Cuti & Lembur**      |                        |                                    |                 |                           |                                           |
| 20                        | Jenis Cuti & Izin      | `leave_types`                      | Tidak           | HCGA                      | SOP.LMN.CBN.03 & .04                      | MVP   |
| 21                        | Aturan Tarif Lembur    | `overtime_rate_rules`              | **Ya**          | HCGA                      | `Matriks Payroll` (⚠️ konflik OQ-01)      | MVP   |
| **F. Payroll**            |                        |                                    |                 |                           |                                           |
| 22                        | Komponen Gaji          | `payroll_components`               | Tidak           | Comben                    | `Matriks Gaji & Tunjangan`                | MVP   |
| 23                        | Komponen per Karyawan  | `employee_component_assignments`   | **Ya**          | Comben                    | ⚠️ **Belum ada — OQ-03**                  | MVP   |
| 24                        | Aturan Tunj. Kehadiran | `attendance_allowance_rules`       | **Ya**          | Comben                    | `Tintin — Matriks` (2 rule set)           | MVP   |
| 25                        | Profil & Tarif BPJS    | `bpjs_rate_profiles`, `bpjs_rates` | **Ya**          | Comben                    | `Tintin — Matriks` (⚠️ JP hilang, OQ-07)  | MVP   |
| 26                        | Periode Payroll        | `payroll_periods`                  | —               | Comben                    | Dibangkitkan sistem                       | MVP   |
| **G. Konfigurasi Sistem** |                        |                                    |                 |                           |                                           |
| 27                        | Parameter Sistem       | `system_parameters`                | **Ya**          | Super Admin/HCGA          | Seed dari Business Rule Registry          | MVP   |
| 28                        | Definisi Workflow      | `approval_workflows` + `_steps`    | Ber-versi       | HCGA                      | Seed dari SOP                             | MVP   |
| 29                        | Template Notifikasi    | `notification_templates`           | Tidak           | HCGA                      | Seed                                      | MVP   |
| 30                        | Penomoran Dokumen      | `number_sequences`                 | Tidak           | Super Admin               | Konvensi ISO (`FRM.LMN.CBN.xx`)           | MVP   |
| 31                        | Feature Flag           | `feature_flags`                    | Tidak           | Super Admin               | Seed                                      | MVP   |
| 32                        | Data Referensi Umum    | `reference_data`                   | Tidak           | HCGA/Comben               | Seed                                      | MVP   |
| **H. Modul v2**           |                        |                                    |                 |                           |                                           |
| 33                        | Jenis Pinjaman         | `loan_types`                       | **Ya**          | HCGA                      | ⚠️ SK Direksi belum ada — OQ-04           | v2    |
| 34                        | Tarif Perjalanan Dinas | `perdiem_rates`                    | **Ya**          | Comben                    | ⚠️ Lampiran SK belum ada — OQ-05          | v2    |
| 35                        | Tier Kota              | `city_tiers`                       | Tidak           | Comben                    | ⚠️ **OQ-05**                              | v2    |
| 36                        | Plafon Pembiayaan SIM  | `system_parameters`                | **Ya**          | Comben                    | ⚠️ SK 006/2024 belum ada — OQ-06          | v2    |

#### 6.M1B.5 Inventaris Kolom `data_pegawai_master` (Hasil Pembacaan Berkas)

> Berkas sumber adalah **template upload data pegawai** dengan 24 kolom, bukan sekadar daftar nama. Kolom bertanda (*) wajib diisi. Batas 300 baris per unggahan.

| #   | Kolom Sumber           | Wajib | Target Entity.Field                               | Format Sumber                              | Catatan Kualitas Data                            |
| --- | ---------------------- | :---: | ------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| 1   | NIK                    |  ✅   | `employees.nik`                                   | 8 digit: `YYYY` + 4 urut                   | Pola tidak konsisten antar tahun — lihat 6.M8B.3 |
| 2   | NAMA                   |  ✅   | `employees.full_name`                             | Teks                                       | Casing tidak konsisten (`RESNA SULISTIAWATY`)    |
| 3   | TANGGAL MASUK          |  ✅   | `employees.join_date`                             | `YYYY-MM-DD`                               | Ada anomali `1970-01-01` (Ridwan Arif)           |
| 4   | AREA KERJA             |  ✅   | `companies` + `branches`                          | `{ENTITAS} - {AREA}`                       | **Wajib dipecah** — FR-M1B-024                   |
| 5   | STATUS KONTRAK         |  ✅   | `employee_assignments.contract_type`              | Teks                                       | Seluruh baris terbaca bernilai `Kontrak`         |
| 6   | JABATAN                |  ✅   | `job_positions.name`                              | Teks                                       | Cocokkan ke seed FR-M1B-011b                     |
| 7   | GOLONGAN               |  ✅   | `job_grades.code`                                 | Teks                                       | `Non Staff` vs `Non-Staff` — normalisasi         |
| 8   | GAJI POKOK             |  ✅   | `employee_component_assignments` (`BASIC_SALARY`) | Numerik                                    | **Kelas A — wajib effective-dated**              |
| 9   | NO. IDENTITAS          |       | `employees.id_card_no`                            | 16 digit NIK KTP                           | Ditemukan 15 & 17 digit — lihat 6.M8B.2          |
| 10  | TEMPAT LAHIR           |       | `employees.birth_place`                           | Teks                                       | Casing campur (`BANDUNG` / `Bandung`)            |
| 11  | TANGGAL LAHIR          |       | `employees.birth_date`                            | `YYYY-MM-DD`                               |                                                  |
| 12  | ALAMAT                 |       | `employees.address`                               | Teks panjang                               | Mengandung `\r\n` — wajib dibersihkan            |
| 13  | NO. HP                 |       | `employees.phone`                                 | Numerik                                    | Ada placeholder `000000`                         |
| 14  | REKAN/KELUARGA         |       | `employees.emergency_contact_relation`            | Teks                                       | ISTRI, IBU, BAPAK → `reference_data`             |
| 15  | NPWP                   |       | `employees.tax_id`                                | Numerik                                    | Banyak kosong                                    |
| 16  | STATUS PTKP            |       | `employees.ptkp_status`                           | `K0`–`K3`, `TK/x`                          | Untuk PPh21 (v2)                                 |
| 17  | NO. REKENING           |       | `employees.bank_account_no`                       | Numerik                                    | Nama bank tidak ada — FR-M1B-031                 |
| 18  | AGAMA                  |       | `employees.religion`                              | Teks                                       | → `reference_data`                               |
| 19  | JENIS KELAMIN          |       | `employees.gender`                                | `Pria` / `Wanita`                          |                                                  |
| 20  | PERNIKAHAN             |       | `employees.marital_status`                        | `Menikah` / `Belum Menikah` / `Janda/duda` |                                                  |
| 21  | _(tanggal pernikahan)_ |       | `employees.marriage_date`                         | `YYYY-MM-DD`                               | Mayoritas placeholder `9999-01-01`               |
| 22  | NOMOR BPJS (2 kolom)   |       | `employees.bpjs_tk_no`, `bpjs_kes_no`             | Numerik                                    | Placeholder `00000000000`                        |
| 23  | **BOLEH CUTI**         |       | `employees.leave_eligible`                        | `Ya` / `Tidak`                             | **Aturan bisnis baru — FR-M1B-030**              |
| 24  | DIVISI / DEPARTEMEN    |       | `divisions`, `departments`                        | Teks                                       | Trailing space; `Sales` vs `Sales Dept`          |

| #          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-030 | **Kolom `BOLEH CUTI` adalah aturan bisnis yang belum tertangkap di SOP mana pun.** Sistem WAJIB menyediakan flag `employees.leave_eligible`; bila `false`, pengajuan cuti tahunan diblokir dengan pesan eksplisit. **FLAG: seluruh baris yang terbaca bernilai `Tidak`** — bertentangan dengan SOP.LMN.CBN.04 yang memberi hak 12 hari kepada karyawan masa kerja ≥ 1 tahun. PO wajib menjelaskan: nilai default template yang belum diisi, atau kebijakan nyata? **Jangan diasumsikan.** |
| FR-M1B-031 | **FLAG — kolom hilang:** template memuat `NO. REKENING` tetapi **tidak memuat NAMA BANK maupun NAMA PEMILIK REKENING**, padahal `Form Petty Cash` mensyaratkan ketiganya. Sistem WAJIB menyediakan ketiga field; dua di antaranya dilengkapi Comben di luar berkas ini.                                                                                                                                                                                                                   |
| FR-M1B-032 | **FLAG — kolom hilang:** tidak ada kolom **ATASAN LANGSUNG** maupun **DIVISION HEAD**. Ini satu-satunya gap yang tersisa, dan tetap **BLOCKER** untuk seluruh modul approval (OQ-03 revisi).                                                                                                                                                                                                                                                                                              |
| FR-M1B-033 | Importer WAJIB **menolak, bukan membersihkan diam-diam**, nilai placeholder (`000000`, `00000000000`, `9999-01-01`, `1970-01-01`) dan melaporkannya sebagai peringatan per baris agar Comben yang memutuskan.                                                                                                                                                                                                                                                                             |

**Pengaturan `BOLEH CUTI` — Dua Jalur, Wajib Keduanya**

| #          | Requirement                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M1B-034 | **Jalur individual:** toggle `Boleh Cuti` tersedia di form karyawan, dengan hint yang menjelaskan dampaknya. Perubahan tercatat di audit log berikut alasannya.                                                                                                                                                                             |
| FR-M1B-035 | **Jalur massal (bulk):** dari layar daftar karyawan, Comben WAJIB dapat memfilter, memilih beberapa baris (termasuk _select all matching filter_), lalu menerapkan `Boleh Cuti = Ya/Tidak` sekaligus dengan satu alasan bersama.                                                                                                            |
| FR-M1B-036 | **Jalur import:** kolom `BOLEH CUTI` diterima pada template import (`Ya`/`Tidak`/kosong). Kosong berarti **tidak mengubah nilai yang ada**, bukan mengosongkan.                                                                                                                                                                             |
| FR-M1B-037 | Aksi massal WAJIB menampilkan konfirmasi berisi jumlah baris terdampak dan contoh 5 nama pertama sebelum dieksekusi, lalu menampilkan ringkasan hasil (berhasil / dilewati / gagal beserta alasan).                                                                                                                                         |
| FR-M1B-038 | Aksi massal WAJIB **dapat dibatalkan (undo)** dalam jendela waktu terkonfigurasi (default 15 menit) lewat `bulk_operations.batch_id`, karena salah klik pada 300 baris tidak boleh memerlukan pemulihan basis data.                                                                                                                         |
| FR-M1B-039 | **Pola ini berlaku umum, bukan khusus `Boleh Cuti`.** Layar daftar karyawan WAJIB memakai satu komponen aksi massal yang sama untuk: `Boleh Cuti`, Golongan, Jabatan, Area Kerja, Divisi/Departemen, Atasan Langsung, Jadwal Kerja, dan Status Karyawan. Membuat aksi massal terpisah per field adalah pemborosan dan sumber inkonsistensi. |
| FR-M1B-040 | Setiap perubahan massal pada field Kelas A/B (Golongan, Jabatan, Area Kerja, Atasan) WAJIB meminta **tanggal berlaku**, karena field tersebut ber-tanggal efektif (BRD 4.5.1).                                                                                                                                                              |

**Pedoman UX Aksi Massal (wajib diikuti):**

| Aspek            | Ketentuan                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Pemilihan        | Checkbox per baris + checkbox header + tautan "Pilih semua N hasil filter"                                    |
| Umpan balik      | Bilah aksi mengambang muncul saat ≥ 1 baris terpilih, menampilkan jumlah terpilih                             |
| Pencegahan galat | Baris yang tidak memenuhi syarat (mis. karyawan resign) ditandai dan otomatis dikecualikan, dengan penjelasan |
| Eksekusi         | Asinkron via antrean bila > 50 baris, dengan indikator progres; tidak memblokir layar                         |
| Hasil            | Ringkasan yang dapat diunduh (XLSX) berisi status per baris                                                   |
| Pembatalan       | Tombol "Batalkan" pada notifikasi hasil, aktif selama jendela undo                                            |

#### 6.M1B.6 Data Referensi Umum (`reference_data`)

Tabel generik bertipe _category–code–label_ untuk daftar pilihan yang tidak layak memiliki tabel sendiri. **Seluruhnya dikelola Admin lewat UI, tanpa deploy.**

| Kategori                       | Contoh Isi                                                                                                    | Dipakai Di                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `CONTRACT_TYPE`                | Kontrak, Tetap, Probation, Harian Lepas                                                                       | Kontrak karyawan                             |
| `EMPLOYMENT_STATUS`            | Aktif, Cuti Panjang, Resign, PHK, Pensiun                                                                     | Master karyawan                              |
| `MARITAL_STATUS`               | TK/0 … K/3                                                                                                    | PTKP (v2)                                    |
| `RELIGION`                     | —                                                                                                             | Master karyawan                              |
| `EDUCATION_LEVEL`              | SD…S3                                                                                                         | Master karyawan                              |
| `DOCUMENT_TYPE`                | KTP, KK, NPWP, SIM A/B1/B2/C, Ijazah, Kontrak                                                                 | Dokumen karyawan                             |
| `ATTENDANCE_CORRECTION_REASON` | Lupa absen, HP rusak, Sinyal hilang, Baterai habis, Dinas luar                                                | Koreksi absensi                              |
| `LEAVE_REJECT_REASON`          | Kebutuhan operasional, Tenaga kerja tidak tersedia, Prioritas pekerjaan                                       | Approval cuti (sesuai SOP.LMN.CBN.04 VI.A.7) |
| `LOAN_PURPOSE`                 | Pengobatan, Pemakaman, Pernikahan, Sewa/Perbaikan Rumah, Perbaikan Kendaraan, DP Kredit Kendaraan, Pendidikan | Pinjaman (v2, sesuai SOP.LMN.CBN.09)         |
| `TRIP_EXPENSE_TYPE`            | Transportasi, Akomodasi, Uang Makan, Uang Saku, Entertainment, Biaya Lain-lain                                | Perdin (v2)                                  |
| `RESIGN_REASON`                | —                                                                                                             | Offboarding                                  |

> **Aturan tegas:** Bila developer perlu menambah pilihan baru pada dropdown mana pun dan solusinya adalah mengedit array di kode frontend, itu **cacat blocker**. Pilihan berasal dari `reference_data`.

---

### 6.M2 — Absensi & Jadwal Kerja

| #         | Requirement                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M2-001 | Absen masuk/pulang WAJIB merekam: timestamp server, timestamp device, latitude, longitude, akurasi GPS (meter), foto swafoto, ID device, versi aplikasi, dan flag `is_mock_location`.                                                                                                       |
| FR-M2-002 | Waktu WAJIB disimpan dalam UTC dan ditampilkan dalam zona waktu cabang (`Asia/Jakarta` atau `Asia/Makassar` per konfigurasi cabang).                                                                                                                                                        |
| FR-M2-003 | Sistem WAJIB mendukung dua mode kebijakan lokasi per jabatan/cabang, keduanya dari config: (a) `GEOFENCE_STRICT` — absen ditolak di luar radius; (b) `GEOFENCE_TRACKED` — absen diterima namun ditandai `OUT_OF_ZONE` untuk verifikasi. **Default untuk Sales/Driver: `GEOFENCE_TRACKED`.** |
| FR-M2-004 | Radius geofence per cabang WAJIB dapat dikonfigurasi (default dari `system_parameters`, sarankan 150 m).                                                                                                                                                                                    |
| FR-M2-005 | Aplikasi mobile WAJIB mendeteksi _mock location_ (Android `isFromMockProvider`, developer options, aplikasi fake-GPS yang dikenal) dan menandai record — **bukan memblokir absen**, karena false-positive merugikan karyawan yang jujur.                                                    |
| FR-M2-006 | **Offline mode WAJIB:** absen tersimpan di antrean lokal terenkripsi bila jaringan gagal, dengan retry otomatis. Record hasil sync WAJIB ditandai `is_offline_sync = true` dengan selisih waktu device vs server.                                                                           |
| FR-M2-007 | Sistem WAJIB menolak sinkronisasi record offline yang selisih device-vs-server melebihi ambang config (sarankan 12 jam) dan mengalihkannya ke antrean koreksi manual.                                                                                                                       |
| FR-M2-008 | Foto swafoto WAJIB dikompresi di device (target ≤ 200 KB) dan disimpan di object storage, bukan di database.                                                                                                                                                                                |
| FR-M2-009 | Sistem WAJIB menghitung record harian (`attendance_daily`): status (`HADIR`, `TERLAMBAT`, `PULANG_CEPAT`, `ALPHA`, `IZIN`, `SAKIT`, `CUTI`, `LIBUR`, `DINAS`), menit terlambat, jam kerja efektif — dijalankan sebagai job harian dan dapat diulang (_idempotent_).                         |
| FR-M2-010 | Kalender hari libur WAJIB dapat dikonfigurasi per tahun per entitas, membedakan `LIBUR_NASIONAL` dan `CUTI_BERSAMA` (karena Cuti Bersama memotong hak cuti tahunan, hari libur nasional tidak).                                                                                             |
| FR-M2-011 | Koreksi absensi WAJIB memerlukan alasan (dari daftar terkonfigurasi) + catatan bebas, dan melewati approval sesuai workflow.                                                                                                                                                                |
| FR-M2-012 | Absensi periode yang sudah `CLOSED` WAJIB terkunci; koreksi hanya lewat jalur _adjustment_ yang tercatat di periode berjalan.                                                                                                                                                               |

---

### 6.M2B — Roster Management (Jadwal & Shift Kerja)

> Jadwal kerja adalah **fondasi seluruh perhitungan**: terlambat, pulang cepat, jam lembur, dan tipe hari (biasa vs libur) semuanya diturunkan dari sini. Salah jadwal = salah payroll.

#### 6.M2B.1 Requirement

| #          | Requirement                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M2B-001 | Jadwal kerja WAJIB dapat dikonfigurasi penuh: nama pola, hari kerja, jam masuk & pulang per hari, durasi istirahat, toleransi keterlambatan, total jam mingguan.                                                                |
| FR-M2B-002 | Sistem WAJIB mendukung tiga tipe pola: `FIXED` (jam sama tiap minggu), `SHIFT` (rotasi antar shift), `FLEXIBLE` (target jam tanpa jam masuk tetap — untuk sales lapangan).                                                      |
| FR-M2B-003 | Penugasan jadwal WAJIB ber-tanggal efektif (`schedule_assignments`) dan dapat diterapkan pada level: individu, jabatan, golongan, cabang, atau entitas — dengan prioritas **individu > jabatan > golongan > cabang > entitas**. |
| FR-M2B-004 | Kalender roster bulanan WAJIB tersedia: Admin Cabang melihat grid karyawan × tanggal, dapat menimpa shift per tanggal (misal karyawan masuk shift lain menggantikan rekan).                                                     |
| FR-M2B-005 | Penimpaan per tanggal (`schedule_overrides`) WAJIB memerlukan alasan dan tercatat di audit log.                                                                                                                                 |
| FR-M2B-006 | Sistem WAJIB memvalidasi bahwa setiap karyawan aktif memiliki jadwal berlaku pada setiap tanggal periode payroll. Karyawan tanpa jadwal WAJIB memblokir penutupan periode (FR-M6-003).                                          |
| FR-M2B-007 | Perubahan jadwal untuk tanggal yang sudah lewat dan sudah direkap WAJIB memicu **rekalkulasi ulang `attendance_daily`** untuk rentang terdampak, dengan konfirmasi dan preview dampak.                                          |
| FR-M2B-008 | Roster WAJIB dapat disalin antar periode ("salin jadwal Agustus ke September") dan diimpor dari Excel.                                                                                                                          |
| FR-M2B-009 | Karyawan WAJIB dapat melihat jadwalnya sendiri di mobile, minimal 14 hari ke depan.                                                                                                                                             |

#### 6.M2B.2 Seed Pola Jadwal (dari `Contoh Jadwal Kerja`)

| Kode              | Nama Pola                      | Berlaku Untuk                                                          | Sen         | Sel         | Rab         | Kam         | Jum         | Sab         | Total      |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ---------- |
| `HO_STANDARD`     | Kantor LMI & LMN               | Staff, SPV, Manager (HO)                                               | 09.00–17.00 | 09.00–17.00 | 09.00–17.00 | 09.00–17.00 | 09.00–17.00 | 09.00–15.30 | 40 jam     |
| `PABRIK_STAFFUP`  | Pabrik Staff-Up                | Staff pabrik                                                           | 07.30–15.30 | 07.30–15.30 | 07.30–15.30 | 07.30–15.00 | 07.30–15.00 | 07.30–15.00 | 40 jam     |
| `PABRIK_OPERATOR` | Pabrik Non-Staff-Up / Operator | Operator pabrik                                                        | 07.30–15.30 | 07.30–15.30 | 07.30–15.30 | 07.30–15.00 | 07.30–15.00 | 07.30–15.00 | 40 jam     |
| `FIELD_MARKET`    | Lapangan (mengikuti jam pasar) | Driver, Salesman, Helper, Task Force, Sales Merchandiser, Sales Horeka | _fleksibel_ | _fleksibel_ | _fleksibel_ | _fleksibel_ | _fleksibel_ | _fleksibel_ | lihat FLAG |

| #          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M2B-010 | Pola `FIELD_MARKET` WAJIB bertipe `FLEXIBLE`: tidak ada jam masuk tetap, sehingga **tidak ada perhitungan keterlambatan**. Yang dihitung hanya hadir/tidak hadir dan total jam.                                                                                                                                                                                                                                                           |
| FR-M2B-011 | **FLAG — ANGKA BERTENTANGAN.** Sumber `Contoh Jadwal Kerja` menyatakan untuk kelompok lapangan: _"dihitung 8 Jam nya saja"_ pada catatan, tetapi baris Total menunjukkan **6 Jam** per hari. Selisih 2 jam/hari × 180 karyawan lapangan adalah selisih material pada perhitungan lembur. `standard_work_hours` disimpan sebagai parameter; **nilainya dikosongkan sampai PO memutuskan.** Lihat OQ-19.                                    |
| FR-M2B-012 | **FLAG — sistem eksisting terdeteksi.** Sumber menyebut **Gadjianku** sebagai HRIS berjalan, **Google Form** untuk pengajuan cuti Operator, dan formulir cuti manual, dengan catatan _"Terkendala Approval"_. Ini mengubah proyek dari _greenfield_ menjadi **migrasi + penggantian**. Strategi _cutover_ (paralel berapa lama, data historis mana yang ditarik dari Gadjian, kapan Google Form dimatikan) WAJIB ditetapkan. Lihat OQ-20. |
| FR-M2B-013 | **Laporan Realisasi Jam Bulanan** WAJIB tersedia (target vs realisasi vs selisih per karyawan), sesuai pola yang sudah dipakai Comben (`500 jam` target vs `499 jam` realisasi → `-1`). Ditambahkan ke katalog laporan sebagai `LAP-ABS-05`.                                                                                                                                                                                              |

---

### 6.M3 — Cuti & Izin

| #         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M3-001 | Jenis cuti/izin WAJIB berupa data konfigurasi dengan atribut: kode, nama, `deduct_quota` (Y/N), `deduct_salary` (Y/N), `salary_deduction_formula_code`, `max_days_per_request`, `min_notice_days`, `requires_attachment`, `allow_backdate`, `allow_half_day`, `gender_restriction`, `min_service_months`, `workflow_code`, `affects_attendance_allowance` (Y/N), `affects_meal_transport_allowance` (Y/N).                      |
| FR-M3-002 | **Seed jenis cuti/izin** (dapat diubah Admin): Cuti Tahunan, Cuti Advance, Cuti Khusus (Menikah, Menikahkan Anak, Khitan/Baptis Anak, Istri Melahirkan/Keguguran, Keluarga Meninggal, Anggota Serumah Meninggal), Cuti Melahirkan, Cuti Haid, Sakit (dengan/tanpa Surat Dokter), Izin, Alpha.                                                                                                                                   |
| FR-M3-003 | Hak cuti tahunan = 12 hari kerja/tahun (dari config), diberikan setelah masa kerja mencapai ambang config (12 bulan). Tahun pertama dihitung prorata: `(bulan_kerja_efektif / 12) × 12` hari, dibulatkan sesuai aturan pembulatan config.                                                                                                                                                                                       |
| FR-M3-004 | Cuti Bersama (SKB 3 Menteri) WAJIB otomatis mengurangi saldo cuti tahunan karyawan yang berhak, dengan preview dampak sebelum diterapkan Admin.                                                                                                                                                                                                                                                                                 |
| FR-M3-005 | Cuti Advance: maks. 3 hari (config) untuk karyawan dengan masa kerja < ambang. Saldo negatif WAJIB dicatat dan otomatis dipotong saat hak cuti terbit.                                                                                                                                                                                                                                                                          |
| FR-M3-006 | Saldo cuti yang tidak terpakai WAJIB hangus setelah 1 tahun (config) dari tanggal jatuh tempo, lewat job terjadwal, dengan notifikasi H-30 dan H-7.                                                                                                                                                                                                                                                                             |
| FR-M3-007 | Pengajuan cuti tahunan default minimal H-7 hari kerja. Sistem WAJIB memblokir pengajuan yang melanggar, **kecuali** karyawan memilih jenis `DARURAT` yang mengaktifkan alur backdate.                                                                                                                                                                                                                                           |
| FR-M3-008 | Alur darurat: karyawan/Comben mencatat cuti setelah karyawan kembali bekerja, dengan lampiran wajib, dan approval tetap berjalan (persetujuan retrospektif).                                                                                                                                                                                                                                                                    |
| FR-M3-009 | Approval Cuti default = 2 tahap: Atasan Langsung → Division Head, keduanya SLA 2 hari kerja (config). Approval Izin default = 1 tahap: Atasan Langsung. **Alur ini berasal dari `approval_workflows`, bukan kode.**                                                                                                                                                                                                             |
| FR-M3-010 | Perhitungan jumlah hari cuti WAJIB mengecualikan hari libur dan hari non-kerja sesuai jadwal karyawan yang bersangkutan.                                                                                                                                                                                                                                                                                                        |
| FR-M3-011 | Sistem WAJIB memblokir pengajuan yang tumpang tindih dengan pengajuan lain yang berstatus `PENDING` atau `APPROVED`.                                                                                                                                                                                                                                                                                                            |
| FR-M3-012 | Approver WAJIB melihat kalender ketersediaan tim (siapa lagi yang cuti di rentang tanggal yang sama) pada layar approval.                                                                                                                                                                                                                                                                                                       |
| FR-M3-013 | Saat karyawan resign, sisa cuti WAJIB muncul sebagai komponen tambahan di feeder payroll bulan terakhir.                                                                                                                                                                                                                                                                                                                        |
| FR-M3-014 | **FLAG — AMBIGUITAS PERIODE CUTI:** `Tintin Compensation & Benefit — Matriks` mencantumkan _"Refresh? Tidak Melihat Join Date"_, sedangkan SOP.LMN.CBN.04 mendefinisikan hak setelah 12 bulan berturut-turut dan prorata tahun pertama. Ini dua model berbeda: **basis kalender (Jan–Des)** vs **basis ulang tahun kerja (anniversary)**. Sistem WAJIB mendukung keduanya lewat parameter `leave_cycle_basis` = `CALENDAR_YEAR` | `ANNIVERSARY`. **PO WAJIB memutuskan nilai default sebelum Sprint 5.** |

---

### 6.M4 — Lembur

| #         | Requirement                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M4-001 | Tarif lembur WAJIB tersimpan di `overtime_rate_rules` sebagai matriks konfigurasi: `job_grade` × `day_type` → `calc_method` (`HOURLY_DIVISOR` \| `FLAT_PER_DAY` \| `NONE`), `divisor`, `multiplier`, `flat_amount`, `max_hours_per_day`, `effective_from/to`. |
| FR-M4-002 | **Seed aturan tarif (sesuai `Matriks Perhitungan Payroll`):**                                                                                                                                                                                                 |

| Golongan   | Hari Libur / Tanggal Merah     | Hari Biasa                     |
| ---------- | ------------------------------ | ------------------------------ |
| Non-Staff  | `(Gaji Pokok ÷ 173) × 2 × jam` | `(Gaji Pokok ÷ 173) × 1 × jam` |
| Staff      | `(Gaji Pokok ÷ 173) × 1 × jam` | `(Gaji Pokok ÷ 173) × 1 × jam` |
| Supervisor | `Rp 150.000 / hari (8 jam)`    | **KONFLIK — lihat FR-M4-003**  |
| Manager    | Tidak ada                      | Tidak ada                      |

| #         | Requirement                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M4-003 | **FLAG — KONFLIK SUMBER:** Untuk Supervisor di hari biasa, `Matriks Perhitungan Payroll` menyebut **Rp 150.000/hari**, sedangkan `Tintin Compensation & Benefit — LEMBUR & ABSEN` menyebut **"TIDAK ADA"**. Developer **DILARANG memilih sendiri**. Nilai default seed = `NONE` (opsi paling konservatif secara biaya); PO WAJIB mengonfirmasi tertulis sebelum Sprint 7. |
| FR-M4-004 | Divisor `173` dan flat `150.000` WAJIB berada di `system_parameters`/`overtime_rate_rules`, **tidak boleh** muncul sebagai angka literal di kode.                                                                                                                                                                                                                         |
| FR-M4-005 | Tipe hari (`WEEKDAY`, `WEEKEND`, `NATIONAL_HOLIDAY`, `JOINT_HOLIDAY`) WAJIB ditentukan dari kalender hari libur × jadwal kerja karyawan, bukan dari input manual.                                                                                                                                                                                                         |
| FR-M4-006 | Lembur WAJIB melalui pengajuan yang disetujui **sebelum** dibayarkan. Lembur tanpa perintah yang disetujui tidak masuk feeder payroll.                                                                                                                                                                                                                                    |
| FR-M4-007 | Jam lembur aktual WAJIB diusulkan sistem dari log absensi (selisih jam pulang aktual vs jadwal), dan approver WAJIB melihat rencana vs aktual berdampingan.                                                                                                                                                                                                               |
| FR-M4-008 | Sistem WAJIB menandai (bukan memblokir) lembur yang melebihi ambang harian/mingguan config sebagai anomali untuk ditinjau.                                                                                                                                                                                                                                                |

---

### 6.M5 — ESS & e-Payslip

| #         | Requirement                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M5-001 | Comben WAJIB dapat mengunggah hasil payroll final (Excel/CSV) dengan pemetaan kolom ke `payroll_components`, preview per karyawan, lalu publish.                  |
| FR-M5-002 | Slip gaji WAJIB dilindungi lapisan autentikasi kedua di mobile: PIN 6 digit atau biometrik.                                                                       |
| FR-M5-003 | Slip WAJIB tersedia dalam tampilan in-app dan unduhan PDF. PDF WAJIB dienkripsi dengan password (default: tanggal lahir/NIK — dari config).                       |
| FR-M5-004 | Setiap pembukaan slip WAJIB tercatat di audit log (siapa, kapan, dari device apa).                                                                                |
| FR-M5-005 | Comben WAJIB dapat _unpublish_ dan menerbitkan revisi. Karyawan WAJIB mendapat notifikasi bahwa slip direvisi, dengan versi lama tetap tersimpan (tidak dihapus). |
| FR-M5-006 | Riwayat slip minimal 24 bulan tersedia bagi karyawan aktif; karyawan resign kehilangan akses login namun datanya tetap diarsipkan.                                |
| FR-M5-007 | Slip WAJIB menampilkan seluruh komponen income & deduction sesuai `Matriks Gaji & Tunjangan`, dengan komponen bernilai nol disembunyikan (opsi config).           |

---

### 6.M6 — Payroll Feeder

| #         | Requirement                                                                                                                                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M6-001 | Periode payroll WAJIB dari config, default **tanggal 22 bulan sebelumnya s.d. tanggal 21 bulan berjalan**. Tanggal cut-off WAJIB parameter, bukan literal.                                                                                                                                                       |
| FR-M6-002 | Status periode: `OPEN` → `LOCKED` → `CLOSED`. Transisi WAJIB memerlukan permission `payroll.period.close`.                                                                                                                                                                                                       |
| FR-M6-003 | Sistem WAJIB memblokir penutupan periode bila masih ada: pengajuan cuti/izin/lembur berstatus `PENDING`, absensi anomali belum diverifikasi, atau karyawan aktif tanpa data absensi sama sekali. Blokir dapat di-_override_ Super Admin dengan alasan wajib yang tercatat.                                       |
| FR-M6-004 | Feeder WAJIB menghasilkan per karyawan: hari hadir, hari libur, hari sakit, hari cuti (per jenis), hari izin, hari alpha, jam lembur hari biasa, jam lembur hari libur, nilai lembur terhitung, status tunjangan kehadiran (%), potongan absen terhitung, angsuran pinjaman berjalan (v2), dan penyesuaian lain. |
| FR-M6-005 | **Potongan absen** WAJIB memakai formula `Gaji Pokok ÷ 25 × jumlah hari tidak masuk` dengan **divisor tetap 25** terlepas dari jumlah hari kerja aktual periode tersebut (sesuai catatan `Tintin — LEMBUR & ABSEN`). Divisor 25 WAJIB dari config.                                                               |
| FR-M6-006 | **Tunjangan Kehadiran** WAJIB mendukung **beberapa set aturan** yang berbeda per kelompok, karena sumber menunjukkan dua skema berbeda:                                                                                                                                                                          |

| Set Aturan          | Kondisi              | Nilai             |
| ------------------- | -------------------- | ----------------- |
| `NON_STAFF_DEFAULT` | 0 hari tidak masuk   | 100%              |
|                     | 1 hari tidak masuk   | 50%               |
|                     | > 1 hari tidak masuk | 0%                |
| `OPERATOR_TINTIN`   | 0 hari tidak masuk   | 100% (Rp 130.000) |
|                     | 1 hari tidak masuk   | 80% (Rp 104.000)  |
|                     | 2 hari tidak masuk   | 50% (Rp 65.000)   |
|                     | > 2 hari tidak masuk | 0%                |

| #         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M6-007 | Besaran tunjangan kehadiran berbeda per posisi (contoh dari sumber: Salesman/Driver Rp 200.000; SPG/Sales Merchandiser Rp 100.000; Operator Rp 130.000). Nilai ini WAJIB dari tabel `employee_component_assignments`, **bukan** dari kode.                                                                                                                                                                              |
| FR-M6-008 | Perlakuan ketidakhadiran terhadap tunjangan (sesuai `Tintin — Matriks`): Sakit → tidak memotong gaji pokok, namun **uang makan & transport tidak diberikan**; Cuti → sama; Izin/Alpha → gaji pokok dipotong prorata **dan** uang makan & transport tidak diberikan. Aturan ini WAJIB direpresentasikan lewat flag `affects_meal_transport_allowance` dan `affects_attendance_allowance` pada `leave_types` (FR-M3-001). |
| FR-M6-009 | Setiap angka di feeder WAJIB menyimpan `calculation_trace` (JSON): formula yang dipakai, ID aturan, versi parameter, nilai input, dan hasil antara. UI WAJIB menampilkannya sebagai _drill-down_.                                                                                                                                                                                                                       |
| FR-M6-010 | Export WAJIB tersedia dalam format Excel dengan template yang dapat dikonfigurasi (pemetaan kolom), agar cocok dengan format yang dipakai tim payroll saat ini.                                                                                                                                                                                                                                                         |
| FR-M6-011 | **Iuran BPJS** (untuk v2 engine, dihitung dan ditampilkan sebagai referensi di MVP) WAJIB dari tabel konfigurasi per entitas:                                                                                                                                                                                                                                                                                           |

| Entitas   | Karyawan JHT | Karyawan Kes | Perusahaan JHT | JKK   | JKM  | Perusahaan Kes |
| --------- | ------------ | ------------ | -------------- | ----- | ---- | -------------- |
| LMN & LMI | 2%           | 1%           | 3,7%           | 0,24% | 0,3% | 4%             |
| Pabrik    | 2%           | 1%           | 3,7%           | 0,89% | 0,3% | 4%             |

| #         | Requirement                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M6-012 | **FLAG — KOMPONEN HILANG:** Matriks sumber tidak mencantumkan **Jaminan Pensiun (JP)** maupun batas atas (_ceiling_) upah BPJS Kesehatan. Developer **DILARANG mengasumsikan**. Struktur tabel WAJIB mengakomodasi komponen tambahan dan _ceiling_; nilainya dikosongkan sampai PO mengonfirmasi. |

---

### 6.M7 — Notifikasi & Approval Inbox

| #         | Requirement                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M7-001 | Seluruh isi notifikasi WAJIB berasal dari `notification_templates` yang dapat diedit Admin, dengan variabel placeholder. Tidak ada string notifikasi di kode.                                                  |
| FR-M7-002 | Kanal: Push (FCM), In-app, Email (opsional per template), WhatsApp (_hook_ disiapkan, implementasi v2).                                                                                                        |
| FR-M7-003 | Approval Inbox WAJIB terpadu lintas modul dengan filter dan aksi massal (approve/reject beberapa item sekaligus dengan satu alasan).                                                                           |
| FR-M7-004 | Eskalasi SLA: bila approver tidak bertindak dalam N hari kerja (config per workflow), sistem WAJIB mengirim pengingat, lalu meneruskan ke atasan berikutnya sesuai aturan eskalasi. **Auto-approve DILARANG.** |
| FR-M7-005 | Perhitungan hari kerja untuk SLA WAJIB memakai kalender hari libur, bukan hari kalender.                                                                                                                       |

---

### 6.M8 — Konfigurasi Sistem

| #         | Requirement                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8-001 | `system_parameters` WAJIB ber-tanggal efektif (`effective_from`, `effective_to`) sehingga perhitungan periode lampau memakai nilai yang berlaku saat itu. **Ini non-negotiable** — tanpa ini, mengubah divisor akan merusak seluruh riwayat payroll. |
| FR-M8-002 | Approval Workflow Builder: Admin WAJIB dapat mendefinisikan tahapan (urutan, tipe approver, kondisi, SLA, aturan eskalasi) per tipe dokumen lewat UI.                                                                                                |
| FR-M8-003 | Tipe approver yang didukung: `DIRECT_SUPERVISOR`, `DIVISION_HEAD`, `SPECIFIC_GROUP`, `SPECIFIC_USER`, `POSITION_IN_BRANCH`, `DYNAMIC_EXPRESSION`.                                                                                                    |
| FR-M8-004 | Tahapan workflow WAJIB mendukung kondisi (contoh: "jika nominal > X maka tambahkan tahap Direksi"), dievaluasi oleh rule engine.                                                                                                                     |
| FR-M8-005 | Penomoran dokumen WAJIB dari `number_sequences` yang dapat dikonfigurasi (prefix, format, reset periode) agar cocok dengan konvensi ISO perusahaan (mis. `FRM.LMN.CBN.09.01`).                                                                       |
| FR-M8-006 | Feature flag per modul WAJIB tersedia agar modul v2 dapat dirilis bertahap tanpa cabang kode terpisah.                                                                                                                                               |
| FR-M8-007 | Setiap perubahan konfigurasi WAJIB masuk audit log dan WAJIB menampilkan peringatan dampak (berapa transaksi/karyawan terpengaruh) sebelum disimpan.                                                                                                 |

---

### 6.M8B — Pengaturan Umum: Format, Validasi & Laporan

> **Kenapa dipisah dari M8:** M8 mengatur _aturan bisnis_. M8B mengatur _bagaimana data ditulis, divalidasi, dan ditampilkan_. Keduanya sering dicampur, lalu format tanggal berakhir sebagai `dayjs('DD/MM/YYYY')` yang tersebar di 40 file frontend. Bagian ini mencegah itu.

#### 6.M8B.1 Format Tampilan & Input

| #          | Requirement                                                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-001 | Seluruh format tampilan WAJIB berasal dari `format_settings`, dibaca sekali saat aplikasi start lewat `GET /config/formats`. **Dilarang** ada string format di kode frontend.                                                                               |
| FR-M8B-002 | **Format tanggal default: `DDMMYYYY`.** Ini berlaku untuk **input dan tampilan**, bukan untuk penyimpanan.                                                                                                                                                  |
| FR-M8B-003 | **Penyimpanan tetap ISO 8601 / `DATE` PostgreSQL.** Konversi hanya terjadi di lapisan penyajian dan parsing. Menyimpan tanggal sebagai string `DDMMYYYY` di database adalah **cacat blocker** — pengurutan, rentang, dan perhitungan hari kerja akan rusak. |
| FR-M8B-004 | API WAJIB tetap menerima dan mengembalikan ISO 8601. Transformasi `DDMMYYYY` dilakukan di klien, agar integrasi pihak ketiga tidak ikut terdampak preferensi tampilan.                                                                                      |

**Registry Format (seed, dapat diubah Admin):**

| Kunci                       | Nilai Default                                         | Contoh Hasil         | Berlaku Di                                   |
| --------------------------- | ----------------------------------------------------- | -------------------- | -------------------------------------------- |
| `date.display`              | `DDMMYYYY`                                            | `07082026`           | Tabel, label, cetakan                        |
| `date.display_separated`    | `DD/MM/YYYY`                                          | `07/08/2026`         | Form input, date picker                      |
| `date.long`                 | `DD MMMM YYYY`                                        | `07 Agustus 2026`    | Dokumen resmi, slip gaji                     |
| `datetime.display`          | `DD/MM/YYYY HH:mm`                                    | `07/08/2026 08:15`   | Log absensi, audit trail                     |
| `date.file_suffix`          | `DDMMYYYY`                                            | `_07082026`          | Nama berkas ekspor                           |
| `date.import_accepted`      | `["DD/MM/YYYY","DDMMYYYY","YYYY-MM-DD","DD-MM-YYYY"]` | —                    | Parser import Excel                          |
| `number.decimal_separator`  | `,`                                                   | `1.234,50`           | Seluruh angka                                |
| `number.thousand_separator` | `.`                                                   | `1.234.567`          | Seluruh angka                                |
| `currency.symbol`           | `Rp`                                                  | `Rp 1.234.567`       | Nominal uang                                 |
| `currency.decimal_places`   | `0`                                                   | `Rp 1.234.567`       | Tampilan (penyimpanan tetap `DECIMAL(18,2)`) |
| `time.format`               | `HH:mm` (24 jam)                                      | `17:30`              | Jadwal, absensi                              |
| `timezone.default`          | `Asia/Jakarta`                                        | WIB                  | Konversi dari UTC                            |
| `name.display_case`         | `TITLE_CASE`                                          | `Resna Sulistiawaty` | Normalisasi tampilan nama                    |
| `locale`                    | `id-ID`                                               | —                    | Nama bulan, hari                             |

| #          | Requirement                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-005 | Parser import WAJIB mencoba seluruh format pada `date.import_accepted` secara berurutan. **Ambiguitas WAJIB ditolak, bukan ditebak:** `01022026` bisa berarti 1 Feb atau… tidak ambigu di `DDMMYYYY`, tetapi `01/02/2026` ambigu bila sumber memakai `MM/DD`. Bila berkas sumber tidak menyatakan formatnya, importer WAJIB meminta Comben memilih format di layar preview. |
| FR-M8B-006 | Date picker mobile (Flutter) dan web WAJIB memakai format yang sama dan menerima ketikan langsung `DDMMYYYY` tanpa pemisah, karena pengguna lapangan mengetik lebih cepat daripada memilih di kalender.                                                                                                                                                                     |

#### 6.M8B.2 Aturan Validasi Data

| #          | Requirement                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-010 | Seluruh aturan validasi WAJIB tersimpan di `validation_rules` (entity, field, tipe, pola regex, pesan error, tingkat keparahan), dan diterapkan **di backend sebagai sumber kebenaran**. Validasi frontend hanya cermin untuk pengalaman pengguna. |
| FR-M8B-011 | Tingkat keparahan: `ERROR` (blokir simpan), `WARNING` (izinkan dengan konfirmasi + alasan), `INFO` (catat saja). Ini penting karena data eksisting mengandung anomali yang tidak bisa langsung diblokir.                                           |

**Registry Validasi (seed):**

| Field                            | Aturan                                        | Pola / Batas             | Severity    | Alasan                                                                     |
| -------------------------------- | --------------------------------------------- | ------------------------ | ----------- | -------------------------------------------------------------------------- |
| `employees.nik`                  | Wajib, unik lintas entitas, immutable         | `^\d{8}$`                | ERROR       | Kunci utama identitas                                                      |
| `employees.id_card_no` (NIK KTP) | Tepat 16 digit numerik                        | `^\d{16}$`               | **WARNING** | Data sumber mengandung 15 & 17 digit — memblokir akan menggagalkan migrasi |
| `employees.id_card_no`           | 6 digit pertama = kode wilayah valid          | Lookup tabel wilayah     | INFO        | Deteksi salah ketik                                                        |
| `employees.id_card_no`           | Digit 7–12 = tanggal lahir (wanita: tgl + 40) | Cocokkan `birth_date`    | WARNING     | Konsistensi silang                                                         |
| `employees.id_card_no`           | Unik                                          | —                        | ERROR       | Cegah duplikat orang                                                       |
| `employees.full_name`            | 3–100 karakter, huruf/spasi/titik/apostrof    | `^[A-Za-z .'\-]{3,100}$` | ERROR       | —                                                                          |
| `employees.phone`                | 9–15 digit, awalan `08` atau `+62`            | `^(08\|\+628)\d{7,12}$`  | WARNING     | Data sumber ada `000000`                                                   |
| `employees.tax_id` (NPWP)        | 15 atau 16 digit                              | `^\d{15,16}$`            | WARNING     | NPWP 16 digit sejak NIK-NPWP                                               |
| `employees.bank_account_no`      | 8–20 digit numerik                            | `^\d{8,20}$`             | ERROR       | Salah = gaji nyasar                                                        |
| `employees.bpjs_tk_no`           | 11 digit                                      | `^\d{11}$`               | WARNING     | Placeholder di data sumber                                                 |
| `employees.bpjs_kes_no`          | 13 digit                                      | `^\d{13}$`               | WARNING     | Placeholder di data sumber                                                 |
| `employees.join_date`            | ≤ hari ini, ≥ 1990-01-01                      | Rentang                  | WARNING     | Data sumber ada `1970-01-01`                                               |
| `employees.birth_date`           | Usia 15–65 tahun pada tanggal masuk           | Rentang                  | ERROR       | Kepatuhan ketenagakerjaan                                                  |
| `employees.marriage_date`        | Kosongkan bila `9999-01-01`                   | Placeholder              | INFO        | Bersihkan saat import                                                      |
| `basic_salary`                   | > 0, ≥ UMK area kerja                         | Numerik                  | WARNING     | UMK per area dari `system_parameters`                                      |
| `latitude` / `longitude`         | Dalam bounding box Indonesia                  | `-11..6`, `95..141`      | ERROR       | Deteksi GPS palsu kasar                                                    |
| `attachment`                     | Ukuran & tipe MIME                            | Dari config              | ERROR       | Keamanan                                                                   |

#### 6.M8B.3 Format Nomor Induk Karyawan (NIK)

| #           | Requirement                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-020  | **KEPUTUSAN PO: NIK diinput MANUAL, bukan dibangkitkan otomatis.** Mode default `number_sequences.EMPLOYEE_NIK` adalah `MANUAL`. Generator otomatis tetap tersedia di kode namun **nonaktif**, agar dapat diaktifkan kelak tanpa perubahan skema. |
| FR-M8B-020a | **Data NIK eksisting dibiarkan apa adanya.** Tidak ada penomoran ulang, tidak ada normalisasi retroaktif. Ketidakkonsistenan pola historis diterima sebagai fakta.                                                                                |
| FR-M8B-021  | **Validasi NIK saat input (wajib, real-time):**                                                                                                                                                                                                   |

| Aturan            | Ketentuan                                                            | Severity    | Pesan                                                             |
| ----------------- | -------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| Wajib diisi       | Tidak boleh kosong                                                   | ERROR       | "NIK wajib diisi"                                                 |
| Format            | Tepat 8 digit numerik (`^\d{8}$`) — pola terkonfigurasi              | ERROR       | "NIK harus 8 digit angka"                                         |
| **Unik**          | Unik lintas seluruh entitas dan cabang, **termasuk karyawan resign** | ERROR       | "NIK 20260079 sudah digunakan oleh Budi Santoso (resign 2024)"    |
| Konsistensi tahun | 4 digit pertama sebaiknya = tahun masuk                              | **WARNING** | "4 digit awal (2024) berbeda dari tahun masuk (2026). Lanjutkan?" |
| Immutable         | Tidak dapat diubah setelah karyawan punya transaksi                  | ERROR       | Hanya Super Admin, dengan alasan wajib                            |

| #           | Requirement                                                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-022  | Pengecekan keunikan WAJIB dilakukan **saat pengguna selesai mengetik** (debounce ~500 ms) lewat `GET /employees/check-nik?nik=...`, bukan menunggu tombol Simpan. Pengalaman "sudah isi 20 field lalu ditolak karena NIK duplikat" tidak dapat diterima. |
| FR-M8B-023  | Keunikan WAJIB ditegakkan di **level database** (`UNIQUE` constraint), bukan hanya di aplikasi. Pengecekan aplikasi adalah kenyamanan; constraint adalah jaminan.                                                                                        |
| FR-M8B-024  | Sistem WAJIB menampilkan **saran NIK berikutnya** sebagai teks bantuan yang dapat diklik (misal: "Urutan terakhir 2026: 20260078 — saran: 20260079"), tanpa mengisinya otomatis. Ini memberi kenyamanan generator tanpa memaksakan pola.                 |
| FR-M8B-025a | **NIK dilarang dipakai ulang** setelah karyawan resign. Karyawan yang bergabung kembali mendapat NIK baru dengan tautan `previous_employee_id`.                                                                                                          |

#### 6.M8B.4 Penomoran Dokumen

| #          | Requirement                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M8B-030 | Penomoran dokumen transaksi WAJIB mengikuti konvensi ISO perusahaan dan terkonfigurasi per tipe dokumen. Pola default mengacu ke penomoran SOP yang berlaku: |

| Tipe Dokumen         | Pola Default                                   | Contoh                        | Acuan                                   |
| -------------------- | ---------------------------------------------- | ----------------------------- | --------------------------------------- |
| Form Cuti            | `FRM.{ENTITAS}.CBN.04.{NNNN}/{MM}/{YYYY}`      | `FRM.LMN.CBN.04.0012/08/2026` | SOP.LMN.CBN.04                          |
| Form Izin            | `FRM.{ENTITAS}.CBN.03.{NNNN}/{MM}/{YYYY}`      | —                             | SOP.LMN.CBN.03                          |
| Form Pinjaman        | `FRM.{ENTITAS}.CBN.09.01.{NNNN}/{MM}/{YYYY}`   | —                             | SOP.LMN.CBN.09                          |
| Form Pembiayaan SIM  | `FRM.{ENTITAS}.CBN.02.{NNNN}/{MM}/{YYYY}`      | —                             | SOP.LMN.CBN.02                          |
| Pengajuan Petty Cash | `FRM.{ENTITAS}.CMBN.09.001.{NNNN}/{MM}/{YYYY}` | —                             | Form Petty Cash                         |
| Perintah Lembur      | `FRM.{ENTITAS}.CBN.OT.{NNNN}/{MM}/{YYYY}`      | —                             | _(baru — perlu penetapan Doc. Control)_ |

| #          | Requirement                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-031 | **FLAG:** tipe dokumen Perintah Lembur dan Koreksi Absensi belum memiliki nomor SOP resmi. Doc. Control wajib menetapkannya sebelum go-live agar konsisten dengan Daftar Induk Dokumen. |
| FR-M8B-032 | Nomor dokumen WAJIB dibangkitkan **saat submit**, bukan saat draft, agar tidak ada lompatan nomor akibat draft yang dibatalkan.                                                         |

#### 6.M8B.5 Format Laporan & Ekspor

| #          | Requirement                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-040 | Seluruh laporan WAJIB memakai **satu template header/footer bersama** yang terkonfigurasi: logo, nama entitas, judul laporan, periode, tanggal cetak, dicetak oleh, nomor halaman, dan penanda `Uncontrolled Copy` sesuai konvensi ISO perusahaan. |
| FR-M8B-041 | Format keluaran yang WAJIB didukung per laporan: **PDF** (cetak/arsip), **XLSX** (olah lanjut), **CSV** (integrasi). Format aktif per laporan dapat dikonfigurasi.                                                                                 |
| FR-M8B-042 | Definisi laporan (kolom, urutan, pengelompokan, subtotal, filter default) WAJIB tersimpan sebagai konfigurasi `report_definitions`, sehingga menambah kolom tidak memerlukan deploy.                                                               |
| FR-M8B-043 | Setiap laporan WAJIB menghormati data scope dan field masking pengguna yang mencetaknya (FR-M0-042). Laporan yang di-_generate_ oleh job terjadwal memakai scope pemilik jadwal.                                                                   |
| FR-M8B-044 | Setiap pencetakan/ekspor WAJIB tercatat di audit log: siapa, laporan apa, filter apa, berapa baris.                                                                                                                                                |
| FR-M8B-045 | Penamaan berkas ekspor WAJIB mengikuti pola terkonfigurasi. Default: `{KODE_LAPORAN}_{ENTITAS}_{AREA}_{PERIODE}_{DDMMYYYY}.{ext}` — contoh: `LAP_ABSENSI_LMN_BANDUNG_202608_07082026.xlsx`.                                                        |

**Katalog Laporan MVP (seed):**

| Kode         | Laporan                                     | Format    | Pemilik                         | Sumber Data                     |
| ------------ | ------------------------------------------- | --------- | ------------------------------- | ------------------------------- |
| `LAP-ABS-01` | Rekap Kehadiran Harian                      | PDF, XLSX | Comben, Admin Cabang            | `attendance_daily`              |
| `LAP-ABS-02` | Rekap Kehadiran per Periode Payroll         | XLSX      | Comben                          | `attendance_daily`              |
| `LAP-ABS-03` | Daftar Anomali Absensi                      | XLSX      | Comben                          | `attendance_daily.is_anomaly`   |
| `LAP-ABS-04` | Rekap Keterlambatan                         | XLSX      | Supervisor, Comben              | `attendance_daily.late_minutes` |
| `LAP-CTI-01` | Saldo Cuti per Karyawan                     | PDF, XLSX | Comben, Karyawan (diri sendiri) | `leave_balances`                |
| `LAP-CTI-02` | Realisasi Cuti per Periode                  | XLSX      | Comben                          | `leave_requests`                |
| `LAP-CTI-03` | Cuti Akan Hangus (H-30)                     | XLSX      | Comben                          | `leave_balances.expires_at`     |
| `LAP-LBR-01` | Rekap Lembur per Karyawan                   | XLSX      | Comben                          | `overtime_requests`             |
| `LAP-LBR-02` | Biaya Lembur per Cabang                     | PDF, XLSX | Manager, Finance                | `overtime_requests`             |
| `LAP-PAY-01` | Berkas Input Payroll (Feeder)               | XLSX, CSV | Comben                          | `payroll_feeder_lines`          |
| `LAP-PAY-02` | Slip Gaji                                   | PDF       | Comben, Karyawan                | `payslips`                      |
| `LAP-PAY-03` | Rekap Payroll per Cabang                    | XLSX      | Comben, Finance                 | `payroll_feeder_lines`          |
| `LAP-PEG-01` | Daftar Karyawan Aktif                       | PDF, XLSX | HCGA, Comben                    | `employees`                     |
| `LAP-PEG-02` | Kontrak Akan Berakhir (H-60/30/14)          | XLSX      | HCGA                            | `employee_assignments`          |
| `LAP-PEG-03` | Dokumen Karyawan Kedaluwarsa (termasuk SIM) | XLSX      | Comben                          | `employee_documents`            |
| `LAP-APP-01` | Aging Approval / Pelanggaran SLA            | XLSX      | HCGA, Manager                   | `approval_tasks`                |
| `LAP-AUD-01` | Jejak Audit per Entitas/Periode             | PDF, XLSX | Auditor                         | `audit_logs`                    |

#### 6.M8B.7 Kebijakan Berkas & Unggahan

| #          | Requirement                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-060 | **BLOB DILARANG.** Berkas biner **tidak boleh** disimpan di kolom database (`BYTEA`/`BLOB`) maupun di `localStorage`/SQLite mobile. Database hanya menyimpan **metadata + kunci objek**. Menyimpan berkas di database adalah **cacat blocker** — backup membengkak, replikasi melambat, dan pemulihan menjadi mustahil. |
| FR-M8B-061 | Berkas disimpan di **object storage** lewat satu antarmuka `StorageDriver`. Driver default: **`local-disk`** — tidak memerlukan akun cloud, kredensial, atau konfigurasi rumit saat deployment. Driver `s3` tersedia dan diaktifkan hanya dengan mengganti satu variabel lingkungan.                                    |
| FR-M8B-062 | Unggahan WAJIB memakai **presigned URL**: klien meminta URL ke API, mengunggah langsung ke storage, lalu mengirim kunci objek kembali. Berkas **tidak melewati** memori server aplikasi.                                                                                                                                |
| FR-M8B-063 | Pengunduhan/penayangan WAJIB memakai presigned URL berumur pendek (default 15 menit). Bucket **tidak boleh** publik.                                                                                                                                                                                                    |
| FR-M8B-064 | **Kompresi di sisi klien, kualitas 70%**, sebelum unggah — berlaku di web maupun mobile. Server WAJIB memverifikasi ukuran akhir dan menolak berkas yang melebihi batas.                                                                                                                                                |

**Matriks Kebijakan Unggahan (terkonfigurasi, bukan hardcode):**

| Jenis Berkas                            | Format Diizinkan | Kualitas Kompresi | Dimensi Maks | Ukuran Maks | Jml Maks         | Retensi                |
| --------------------------------------- | ---------------- | ----------------- | ------------ | ----------- | ---------------- | ---------------------- |
| Swafoto absensi                         | JPEG             | **70%**           | 1024×1024    | 200 KB      | 1 per log        | 12 bulan _(config)_    |
| Foto profil karyawan                    | JPEG, PNG        | **70%**           | 512×512      | 150 KB      | 1                | Selama aktif + retensi |
| Bukti perjalanan dinas                  | JPEG, PNG, PDF   | **70%** (gambar)  | 1600×1600    | 1 MB        | 20 per LPJ       | 5 tahun (ISO)          |
| Bukti petty cash                        | JPEG, PNG, PDF   | **70%**           | 1600×1600    | 1 MB        | 20 per pengajuan | 5 tahun                |
| Bukti reimbursement                     | JPEG, PNG, PDF   | **70%**           | 1600×1600    | 1 MB        | 20 per klaim     | 5 tahun                |
| Lampiran cuti/izin (surat dokter, dsb.) | JPEG, PNG, PDF   | **70%**           | 1600×1600    | 1 MB        | 5 per pengajuan  | 5 tahun                |
| Dokumen karyawan (KTP, KK, SIM, ijazah) | JPEG, PNG, PDF   | **70%**           | 2048×2048    | 2 MB        | 1 per tipe       | Selama aktif + retensi |
| Import Excel                            | XLSX, CSV        | —                 | —            | 5 MB        | 1                | 90 hari                |

| #          | Requirement                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-065 | Nilai pada matriks di atas WAJIB berada di `upload_policies`, dapat diubah Admin tanpa deploy.                                                                              |
| FR-M8B-066 | Nama objek WAJIB memakai pola tak tertebak: `{entity}/{yyyy}/{mm}/{uuid}.{ext}`. **Dilarang** memakai NIK atau nama karyawan pada path — path dapat bocor lewat log.        |
| FR-M8B-067 | Server WAJIB memverifikasi tipe berkas dari **magic bytes**, bukan dari ekstensi atau `Content-Type` kiriman klien.                                                         |
| FR-M8B-068 | Mobile (Flutter): unggahan WAJIB masuk antrean jika jaringan gagal, dengan retry _exponential backoff_. Transaksi utama tetap tersimpan dengan `attachment_pending = true`. |
| FR-M8B-069 | Berkas yatim (terunggah tetapi transaksinya batal) WAJIB dibersihkan oleh job harian setelah tenggang 24 jam.                                                               |

#### 6.M8B.8 Pengaturan Perusahaan, BPJS & Pajak (TER)

| #          | Requirement                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-070 | Layar **Pengaturan Perusahaan** per entitas WAJIB memuat: nama legal, NPWP, alamat, logo, nomor pendaftaran BPJS TK & Kesehatan, zona waktu, tanda tangan pejabat untuk dokumen cetak, dan profil tarif yang dipakai.                                               |
| FR-M8B-071 | **Tarif BPJS** WAJIB terkonfigurasi per entitas, per komponen iuran, per pihak penanggung, **ber-tanggal efektif**, dan mendukung **batas atas upah (_ceiling_)** serta pemilihan komponen gaji yang menjadi dasar perhitungan.                                     |
| FR-M8B-072 | Struktur tabel WAJIB mengakomodasi komponen yang saat ini belum ada datanya — khususnya **Jaminan Pensiun (JP)** — tanpa perubahan skema. Nilainya dikosongkan sampai PO mengonfirmasi (OQ-07).                                                                     |
| FR-M8B-073 | **Tarif Efektif Rata-rata (TER) PPh 21** WAJIB terkonfigurasi: kategori TER (A/B/C) dipetakan dari Status PTKP karyawan, dan tiap kategori memiliki tabel _bracket_ (batas bawah–batas atas penghasilan bruto → persentase), **ber-tanggal efektif**.               |
| FR-M8B-074 | Tabel TER WAJIB dapat diimpor dari Excel, karena berisi puluhan baris _bracket_ per kategori dan mengetiknya manual rawan salah.                                                                                                                                    |
| FR-M8B-075 | Sistem WAJIB menyimpan pemetaan `Status PTKP → Kategori TER` sebagai data konfigurasi, bukan logika di kode.                                                                                                                                                        |
| FR-M8B-076 | **KONSEKUENSI RUANG LINGKUP — WAJIB DIBACA PO:** perhitungan TER hanya dapat _memengaruhi gaji_ apabila **Payroll Engine** aktif. Pada rencana saat ini Payroll Engine berada di **v2**, sedangkan MVP hanya menghasilkan berkas input (feeder). Tersedia dua opsi: |

| Opsi                | Isi                                                                                                                                                                          | Konsekuensi                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A — Rekomendasi** | MVP: layar konfigurasi TER/BPJS + tabel siap pakai, **nilai dihitung dan ditampilkan sebagai referensi** di feeder. v2: Payroll Engine mengeksekusinya menjadi potongan riil | Timeline MVP tetap 16 minggu. Comben sudah dapat memvalidasi angka TER selama parallel run                       |
| **B**               | Tarik Payroll Engine ke MVP agar TER langsung memotong gaji                                                                                                                  | MVP bertambah **6–8 minggu**. Risiko meningkat: perhitungan gaji riil masuk sebelum data absensi terbukti bersih |

| #          | Requirement                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-077 | **KEPUTUSAN TERTUNDA — OQ-21.** Sampai PO memilih, developer mengerjakan **Opsi A**.                                                                                                                        |
| FR-M8B-078 | Seluruh nilai tarif (BPJS & TER) yang dipakai pada suatu perhitungan WAJIB tercatat di `calculation_trace` berikut `effective_from`-nya, agar angka periode lampau tetap dapat dibuktikan saat audit pajak. |

#### 6.M8B.9 Template PDF Formulir Resmi

| #          | Requirement                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-080 | Formulir yang dicetak dari sistem WAJIB **mereproduksi tata letak formulir resmi perusahaan**, bukan tata letak buatan sendiri, karena berkas cetak masuk ke arsip ISO dan harus dikenali auditor. |
| FR-M8B-081 | Template WAJIB tersimpan sebagai HTML+CSS di `report_definitions.header_template`/`footer_template`/`body_template`, dapat diedit tanpa deploy.                                                    |

**Template Wajib — mengikuti contoh pada dokumen sumber:**

| Kode         | Formulir                        | No. Dokumen           | Sumber Layout     |
| ------------ | ------------------------------- | --------------------- | ----------------- |
| `FRM-PC-01`  | Pengajuan Petty Cash            | `FRM.LMN.CMBN.09.001` | `Form Petty Cash` |
| `FRM-PD-01`  | Pengajuan Perjalanan Dinas      | `FRM.LMN.CMBN.06.001` | SOP.LMN.CMBN.06   |
| `FRM-PD-02`  | Laporan Perjalanan Dinas (LPJ)  | `FRM.LMN.CMBN.06.002` | SOP.LMN.CMBN.06   |
| `FRM-CT-01`  | Form Cuti Karyawan              | SOP.LMN.CBN.04        | SOP Cuti          |
| `FRM-IZ-01`  | Form Izin Karyawan              | SOP.LMN.CBN.03        | SOP Izin          |
| `FRM-PJ-01`  | Form Pengajuan Pinjaman         | `FRM.LMN.CBN.09.01`   | SOP.LMN.CBN.09    |
| `FRM-SIM-01` | Form Pengajuan Perpanjangan SIM | SOP.LMN.CBN.02        | SOP SIM           |

**Struktur `FRM-PC-01` — Pengajuan Petty Cash (sesuai contoh):**

```
┌─────────────────────────────────────────────────────────────┐
│ PT Lahan Mekar Niaga    │ FORMULIR                          │
│                         │ No Dokumen    : FRM.LMN.CMBN.09.001│
│ PENGAJUAN PETTY CASH    │ Tanggal Efektif: {DDMMYYYY}        │
│                         │ No. Revisi    : 00                 │
│                         │ Halaman       : 01 dari 01         │
├─────────────────────────────────────────────────────────────┤
│ A. Informasi Perjalanan                                      │
│    Penempatan Kerja      : {area_kerja}                      │
│    Tanggal Keberangkatan : {DDMMYYYY}                        │
│    Tanggal Kembali       : {DDMMYYYY}                        │
│    Lokasi Tujuan         : {tujuan}                          │
│    Keperluan Perjalanan  : {keperluan}                       │
│    Jenis Perjalanan      : [ ] Dalam Kota  [ ] Luar Kota     │
│    Status Pengajuan      : [ ] Terencana   [ ] Mendadak      │
├─────────────────────────────────────────────────────────────┤
│ B. Data Karyawan   (maks. 5 baris sesuai formulir asli)      │
│    No │ Nama │ NIK │ Jabatan                                 │
├─────────────────────────────────────────────────────────────┤
│ C. Perkiraan Biaya   (3 baris + Total)                       │
│    No │ Uraian (Transportasi/Akomodasi/Konsumsi) │ Jumlah    │
│                                          Total   │ Rp ______ │
├─────────────────────────────────────────────────────────────┤
│ Diisi jika perjalanan dinas bersifat mendadak:               │
│    Biaya diperlukan pada tanggal : {DDMMYYYY}                │
├─────────────────────────────────────────────────────────────┤
│ Metode Pembayaran Uang Muka Perjalanan Dinas                 │
│    [ ] Tunai   [ ] Transfer ke Rekening                      │
│        - Nama Bank            : {bank}                       │
│        - Nama Pemilik Rekening: {atas_nama}                  │
│        - Nomor Rekening       : {no_rekening}                │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Dibuat Oleh  │ Diketahui    │ Diperiksa    │ Disetujui Oleh │
│              │ Oleh         │ Oleh         │                │
│ Tanggal      │              │              │                │
│ Tanda Tangan │              │              │                │
│ Nama         │              │              │                │
│ Jabatan:     │ Atasan       │ Dept.        │ Direksi        │
│ {jabatan}    │ Langsung     │ Comben       │                │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

| #          | Requirement                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M8B-082 | Blok tanda tangan WAJIB terisi otomatis dari `approval_tasks`: nama, jabatan, dan **tanggal persetujuan** diambil dari sistem, bukan kolom kosong untuk ditulis tangan.                                                                                                                         |
| FR-M8B-083 | Dokumen yang seluruh tahapnya telah disetujui WAJIB memuat **QR code verifikasi** yang mengarah ke halaman validasi publik (menampilkan nomor dokumen, status, dan tanggal — tanpa data pribadi maupun nominal).                                                                                |
| FR-M8B-084 | Dokumen berstatus belum final WAJIB dicetak dengan watermark **"DRAFT — BELUM DISETUJUI"**.                                                                                                                                                                                                     |
| FR-M8B-085 | **FLAG:** layout `FRM.LMN.CMBN.06.001` dan `.002` (Pengajuan & Laporan Perjalanan Dinas) **disebut** di SOP.LMN.CMBN.06 tetapi **berkas contohnya tidak tersedia**. Template dibangun mengikuti pola `FRM-PC-01`; PO wajib menyediakan contoh aslinya untuk verifikasi sebelum v2. Lihat OQ-22. |

#### 6.M8B.6 Pengaturan Umum Lainnya

| Kelompok                 | Item Konfigurasi                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Identitas Perusahaan** | Logo (terang & gelap), nama legal, alamat, NPWP, kontak, tanda tangan digital pejabat untuk dokumen cetak |
| **Aplikasi**             | Nama aplikasi, warna primer/aksen, ikon mobile, teks splash, versi minimum yang dipaksa (_force update_)  |
| **Sesi & Keamanan**      | Durasi token, kebijakan password, ambang kunci akun, TTL cache permission, kebijakan device binding       |
| **Notifikasi**           | Kanal aktif per template, jam senyap (_quiet hours_), batas kirim ulang                                   |
| **Absensi**              | Radius geofence default, ambang selisih waktu offline, kebijakan mock GPS, ukuran maksimum swafoto        |
| **Unggahan**             | Tipe MIME diizinkan, ukuran maksimum per berkas, jumlah lampiran per pengajuan                            |
| **Bahasa & Lokal**       | Locale, zona waktu default, awal minggu (Senin), kalender hari libur aktif                                |
| **Retensi Data**         | Masa simpan foto absensi, log audit, dokumen karyawan resign (kepatuhan UU PDP)                           |

| #          | Requirement                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-M8B-050 | Seluruh item di atas WAJIB dapat diubah lewat layar Pengaturan Umum oleh grup berwenang, dengan preview dampak dan audit log. Tidak ada yang berada di berkas `.env` kecuali kredensial infrastruktur. |
| FR-M8B-051 | Perubahan yang memengaruhi klien (format, warna, versi minimum) WAJIB tersebar ke mobile lewat endpoint konfigurasi yang dipanggil saat start, tanpa memerlukan rilis ulang aplikasi.                  |

---

## 7. Data Model Sketch

> Detail DDL, indeks, dan constraint ada di **BRD Seksi 6**. Berikut kerangka entitas dan field kunci.

### 7.1 Organisasi & Karyawan

```
companies            id, code, legal_name, tax_id, bpjs_rate_profile_id, timezone, is_active
branches             id, company_id, code, name, address, latitude, longitude,
                     geofence_radius_m, timezone, is_active
divisions            id, company_id, code, name, parent_id
departments          id, division_id, code, name
job_grades           id, code, name, level_order, is_staff, overtime_eligible
job_positions        id, department_id, job_grade_id, code, name
employees            id, nik (UNIQUE), full_name, email, phone, gender, birth_date,
                     birth_place, id_card_no, tax_id, marital_status, dependents_count,
                     bank_name, bank_account_no, bank_account_name, join_date,
                     employment_status, resign_date, photo_url, is_active
employee_assignments id, employee_id, company_id, branch_id, department_id,
                     job_position_id, job_grade_id, contract_type, contract_start,
                     contract_end, effective_from, effective_to, is_primary
reporting_lines      id, employee_id, supervisor_id, line_type (DIRECT|DIVISION_HEAD),
                     effective_from, effective_to
employee_documents   id, employee_id, doc_type, doc_number, issued_date, expiry_date,
                     file_url, verified_by, verified_at
```

### 7.2 Akses & Keamanan (Modul 0)

```
users                     id, employee_id (NULLABLE), login_nik, email, password_hash,
                          status, must_change_password, last_login_at, failed_attempts,
                          locked_until, two_factor_secret, two_factor_enabled
user_groups               id, code, name, description, is_system, requires_2fa,
                          max_session_minutes, allowed_ip_cidr, is_active
user_group_members        id, user_id, group_id, assigned_by, assigned_at
permissions               id, code (UNIQUE), module, resource, action, description,
                          is_dangerous
group_permissions         id, group_id, permission_id, data_scope, scope_config (JSONB),
                          masked_fields (JSONB)
user_permission_overrides id, user_id, permission_id, effect (GRANT|DENY), data_scope,
                          reason, granted_by, expires_at
user_scope_bindings       id, user_id, scope_type (BRANCH|DIVISION|COMPANY),
                          scope_ref_id      -- untuk data_scope CUSTOM
menus                     id, parent_id, code, label, icon, route, platform,
                          permission_code, sort_order, is_active
sensitive_fields          id, entity_name, field_name, default_masked, description
approval_delegations      id, delegator_user_id, delegate_user_id, module_codes (JSONB),
                          start_date, end_date, reason, is_active
user_devices              id, user_id, device_id, platform, model, os_version,
                          app_version, fcm_token, is_trusted, last_seen_at
audit_logs                id, actor_user_id, action, entity_name, entity_id,
                          before_data (JSONB), after_data (JSONB), ip_address,
                          user_agent, created_at        -- APPEND ONLY
```

### 7.3 Absensi

```
work_schedules       id, company_id, code, name, is_shift_based
work_schedule_days   id, work_schedule_id, day_of_week, start_time, end_time,
                     break_minutes, is_working_day, late_tolerance_minutes
schedule_assignments id, employee_id, work_schedule_id, effective_from, effective_to
holidays             id, company_id, date, name, holiday_type
                     (NATIONAL|JOINT_LEAVE|COMPANY), deducts_annual_leave, region_scope
attendance_logs      id, employee_id, log_type (IN|OUT), server_time, device_time,
                     latitude, longitude, gps_accuracy_m, photo_url, branch_id,
                     distance_from_geofence_m, is_out_of_zone, is_mock_location,
                     is_offline_sync, device_id, app_version, raw_payload (JSONB)
attendance_daily     id, employee_id, work_date, schedule_id, first_in_at, last_out_at,
                     status, late_minutes, early_leave_minutes, work_minutes,
                     overtime_minutes, source (MOBILE|MACHINE|MANUAL|SYSTEM),
                     is_anomaly, anomaly_reasons (JSONB), payroll_period_id, locked_at
attendance_corrections id, attendance_daily_id, requested_by, reason_code, notes,
                     proposed_values (JSONB), approval_instance_id, status
```

### 7.4 Cuti, Izin & Lembur

```
leave_types          id, code, name, deduct_quota, deduct_salary,
                     salary_deduction_formula_code, max_days_per_request,
                     min_notice_days, requires_attachment, allow_backdate,
                     allow_half_day, gender_restriction, min_service_months,
                     workflow_code, affects_attendance_allowance,
                     affects_meal_transport_allowance, is_active
leave_balances       id, employee_id, leave_type_id, period_year, entitlement_days,
                     prorate_days, carried_over_days, used_days, advance_used_days,
                     pending_days, expired_days, balance_days, valid_from, expires_at
leave_requests       id, doc_number, employee_id, leave_type_id, start_date, end_date,
                     total_days, is_half_day, reason, attachment_urls (JSONB),
                     is_emergency, is_backdated, status, approval_instance_id,
                     submitted_at, decided_at
leave_request_days   id, leave_request_id, leave_date, day_portion, is_counted
leave_balance_ledger id, leave_balance_id, entry_type (GRANT|USE|ADVANCE|EXPIRE|
                     ADJUST|PAYOUT), days, reference_type, reference_id, notes,
                     created_by, created_at        -- APPEND ONLY
overtime_rate_rules  id, company_id, job_grade_id, day_type, calc_method, divisor,
                     multiplier, flat_amount, max_hours_per_day, effective_from,
                     effective_to
overtime_requests    id, doc_number, employee_id, overtime_date, day_type,
                     planned_start, planned_end, planned_hours, actual_hours,
                     rate_rule_id, calculated_amount, calculation_trace (JSONB),
                     reason, status, approval_instance_id
```

### 7.5 Payroll

```
payroll_components   id, code, name, component_type (INCOME|DEDUCTION),
                     is_fixed_allowance, calc_method (FIXED|PER_DAY|PERCENTAGE|
                     FORMULA|IMPORTED), formula_expression, taxable, bpjs_base,
                     display_order, is_active
employee_component_assignments  id, employee_id, payroll_component_id, amount,
                     effective_from, effective_to, notes
attendance_allowance_rules      id, rule_set_code, absence_days_min, absence_days_max,
                     percentage, effective_from, effective_to
bpjs_rate_profiles   id, code, name
bpjs_rates           id, profile_id, contribution_code, payer (EMPLOYEE|COMPANY),
                     percentage, base_component_codes (JSONB), salary_cap,
                     effective_from, effective_to
payroll_periods      id, company_id, code, cutoff_start, cutoff_end, payment_date,
                     status (OPEN|LOCKED|CLOSED), closed_by, closed_at
payroll_feeder_lines id, payroll_period_id, employee_id, component_code, quantity,
                     amount, calculation_trace (JSONB), is_manual_override,
                     override_reason, overridden_by
payslips             id, payroll_period_id, employee_id, version, gross_amount,
                     deduction_amount, net_amount, pdf_url, status
                     (DRAFT|PUBLISHED|REVOKED), published_at, first_viewed_at
payslip_lines        id, payslip_id, component_code, component_name, component_type,
                     quantity, amount, display_order
```

### 7.6 Workflow, Konfigurasi & Notifikasi

```
approval_workflows       id, code, module_code, name, is_active, version
approval_workflow_steps  id, workflow_id, step_order, approver_type, approver_ref,
                         condition_expression, sla_working_days, escalation_action,
                         allow_delegate, is_mandatory
approval_instances       id, workflow_id, workflow_version, document_type, document_id,
                         current_step_order, status, started_at, completed_at
approval_tasks           id, approval_instance_id, step_order, assignee_user_id,
                         delegated_from_user_id, status, due_at, acted_at,
                         action (APPROVE|REJECT|RETURN), comments
system_parameters        id, param_key, param_value, data_type, scope_type, scope_ref_id,
                         effective_from, effective_to, description, updated_by
reference_data           id, category, code, label, sort_order, metadata (JSONB),
                         is_active
number_sequences         id, doc_type, prefix_pattern, current_number, reset_period,
                         padding_length
notification_templates   id, code, channel, subject_template, body_template,
                         variables (JSONB), is_active
notifications            id, user_id, template_code, title, body, payload (JSONB),
                         channel, status, read_at, sent_at
feature_flags            id, code, is_enabled, scope_type, scope_ref_id, description
```

### 7.7 Modul v2 (struktur disiapkan sejak awal)

```
loan_types           id, code, name, max_amount, max_tenor_months, min_service_months,
                     max_per_year, requires_attachment, workflow_code
loan_applications    id, doc_number, employee_id, loan_type_id, requested_amount,
                     tenor_months, purpose, attachment_urls, status, approval_instance_id
loans                id, loan_application_id, employee_id, principal_amount,
                     tenor_months, monthly_installment, outstanding_amount,
                     start_period_id, status
loan_installments    id, loan_id, payroll_period_id, sequence_no, amount, status,
                     paid_at
perdiem_rates        id, job_grade_id, city_tier, expense_type (MEAL|LODGING|POCKET|
                     TRANSPORT), amount, unit, effective_from, effective_to
trip_requests        id, doc_number, requester_employee_id, trip_type (IN_CITY|
                     OUT_OF_CITY), urgency (PLANNED|URGENT), destination,
                     depart_date, return_date, purpose, status, approval_instance_id
trip_participants    id, trip_request_id, employee_id, role
trip_budget_lines    id, trip_request_id, expense_type, estimated_amount, notes
cash_advances        id, trip_request_id, amount, payment_method (CASH|TRANSFER),
                     bank_name, account_no, disbursed_by, disbursed_at
trip_reports         id, trip_request_id, submitted_at, due_at, total_actual,
                     variance_amount, settlement_type (REFUND|REIMBURSE|NONE), status
trip_expense_lines   id, trip_report_id, expense_type, expense_date, amount,
                     receipt_url, has_valid_receipt, is_approved, rejection_reason
license_financings   id, doc_number, employee_id, license_type, old_license_no,
                     old_expiry_date, total_cost, company_share_pct,
                     company_amount, employee_amount, status, approval_instance_id,
                     new_license_no, new_license_file_url
```

### 7.8 Relasi Kunci

```
companies 1─N branches 1─N employees 1─N employee_assignments
employees 1─N reporting_lines (self-referencing via supervisor_id)
employees 1─1 users 1─N user_group_members N─1 user_groups N─N permissions
employees 1─N attendance_logs → (agregasi) → attendance_daily
employees 1─N leave_balances 1─N leave_balance_ledger
leave_requests / overtime_requests / loan_applications / trip_requests
    ─1─ approval_instances 1─N approval_tasks
payroll_periods 1─N payroll_feeder_lines 1─1 payslips 1─N payslip_lines
```

---

## 8. Edge Cases & Failure States

### 8.1 Absensi

| #     | Skenario                                | Perilaku yang Diwajibkan                                                                                                                              |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-01 | Tidak ada sinyal saat absen             | Simpan di antrean lokal terenkripsi, tampilkan badge "Menunggu Sinkronisasi", retry otomatis. Jangan tampilkan "Berhasil" sampai server mengonfirmasi |
| EC-02 | Jam device diubah manual                | Simpan `device_time` dan `server_time`; hitung selisih. Selisih > ambang config → tandai anomali                                                      |
| EC-03 | Terdeteksi fake GPS                     | Absen **tetap tercatat**, ditandai `is_mock_location`, masuk antrean verifikasi Comben. Jangan blokir                                                 |
| EC-04 | Absen masuk tanpa absen pulang          | `attendance_daily` berstatus `INCOMPLETE`. Job harian memberi notifikasi ke karyawan & atasan. Tidak otomatis dihitung alpha                          |
| EC-05 | Absen ganda dalam 5 menit               | Terima yang pertama, abaikan duplikat (deduplikasi idempoten dengan `client_request_id`)                                                              |
| EC-06 | Absen di luar geofence (Sales keliling) | Kebijakan `GEOFENCE_TRACKED`: diterima, ditandai `OUT_OF_ZONE`, tampilkan jarak. Approver melihat peta                                                |
| EC-07 | Karyawan tidak punya smartphone         | Admin Cabang dapat mencatatkan absen manual (_proxy attendance_) dengan permission khusus + alasan wajib + audit                                      |
| EC-08 | HP hilang / ganti device                | Device binding memaksa approval Admin; absen tetap bisa lewat proxy sementara                                                                         |
| EC-09 | Baterai habis di tengah rute            | Absen pulang lewat koreksi absensi dengan approval atasan                                                                                             |
| EC-10 | Cabang di zona waktu berbeda            | Simpan UTC, tampilkan per `branch.timezone`. Batas hari kerja ditentukan zona cabang                                                                  |
| EC-11 | Foto swafoto gagal diunggah             | Absen tetap tersimpan dengan `photo_url = NULL` + flag `photo_pending`; unggah ulang di latar belakang                                                |

### 8.2 Cuti & Izin

| #     | Skenario                                                                   | Perilaku yang Diwajibkan                                                                                 |
| ----- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| EC-20 | Cuti melewati batas periode payroll (mis. 19–24)                           | Alokasikan hari ke periode payroll masing-masing berdasarkan tanggal hari cuti, bukan tanggal pengajuan  |
| EC-21 | Cuti diajukan, disetujui, lalu dibatalkan setelah periode ditutup          | Blokir pembatalan; wajibkan jalur _adjustment_ di periode berjalan dengan approval                       |
| EC-22 | Saldo cuti berubah setelah pengajuan pending (mis. Cuti Bersama diumumkan) | Hitung ulang saldo, tandai pengajuan pending yang menjadi tidak valid, notifikasi ke karyawan & approver |
| EC-23 | Karyawan resign dengan saldo Cuti Advance negatif                          | Munculkan sebagai potongan di feeder payroll bulan terakhir                                              |
| EC-24 | Karyawan resign dengan sisa cuti positif                                   | Munculkan sebagai komponen tambahan (kompensasi) di feeder bulan terakhir                                |
| EC-25 | Cuti Advance diajukan, lalu karyawan mencapai 1 tahun di tengah cuti       | Ledger memisahkan hari yang memakai advance dan hari yang memakai hak baru                               |
| EC-26 | Cuti darurat backdate melewati periode yang sudah `CLOSED`                 | Blokir. Arahkan ke jalur _adjustment_ periode berjalan, dengan referensi ke tanggal asli                 |
| EC-27 | Pengajuan tumpang tindih dengan lembur yang sudah disetujui                | Blokir dengan pesan eksplisit menyebut dokumen yang bentrok                                              |
| EC-28 | Cuti melahirkan melewati batas tahun                                       | Ledger lintas tahun; tidak mengurangi hak cuti tahunan                                                   |

### 8.3 Approval

| #     | Skenario                                            | Perilaku yang Diwajibkan                                                                              |
| ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| EC-40 | Approver adalah pemohon itu sendiri                 | Lewati tahap tersebut dan eskalasi otomatis ke level di atasnya, catat alasan `SELF_APPROVAL_SKIPPED` |
| EC-41 | Approver resign / nonaktif dengan tugas menggantung | Job harian mendeteksi dan mengalihkan ke atasan berikutnya, notifikasi ke HCGA                        |
| EC-42 | Atasan langsung belum ditetapkan                    | Blokir pengajuan dengan pesan jelas dan notifikasi ke HCGA — **jangan diam-diam auto-approve**        |
| EC-43 | SLA 2 hari terlampaui                               | Pengingat H+1, eskalasi H+2 sesuai config. **Tidak pernah auto-approve**                              |
| EC-44 | Approver cuti tanpa mendelegasikan                  | Sistem menawarkan pembuatan delegasi saat cuti disetujui; bila diabaikan, aturan eskalasi berlaku     |
| EC-45 | Definisi workflow diubah saat ada instance berjalan | Instance yang berjalan tetap memakai `workflow_version` saat dimulai                                  |
| EC-46 | Dua approver bertindak bersamaan (_race_)           | Kunci optimistis di level task; aksi kedua ditolak dengan pesan "sudah diputuskan oleh X"             |

### 8.4 Payroll & Data

| #     | Skenario                                                   | Perilaku yang Diwajibkan                                                                                                                                            |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-60 | Karyawan mutasi cabang/golongan di tengah periode          | Perhitungan memisahkan per segmen tanggal berdasarkan `employee_assignments`. Formula lembur mengikuti golongan pada tanggal lembur                                 |
| EC-61 | Karyawan bergabung/resign di tengah periode                | Prorata berdasarkan hari aktif; feeder menandai baris parsial                                                                                                       |
| EC-62 | Parameter (mis. divisor) diubah setelah periode ditutup    | Perhitungan periode lampau tidak berubah karena parameter ber-tanggal efektif. UI memperingatkan jika ada upaya mengubah nilai dengan `effective_from` di masa lalu |
| EC-63 | Gaji pokok nol atau kosong                                 | Blokir penutupan periode; laporkan sebagai error data, jangan hitung dengan nol diam-diam                                                                           |
| EC-64 | Duplikat NIK saat import                                   | Tolak seluruh batch, laporkan nomor baris                                                                                                                           |
| EC-65 | Slip gaji telanjur dipublikasi dengan angka salah          | Revoke → terbitkan versi baru → notifikasi. Versi lama tetap tersimpan untuk audit                                                                                  |
| EC-66 | Storage/object storage tidak tersedia saat unggah lampiran | Antrean unggah; transaksi utama tetap tersimpan dengan `attachment_pending = true`                                                                                  |
| EC-67 | Kunci enkripsi hilang / rotasi                             | Prosedur rotasi kunci terdokumentasi; data terenkripsi dengan versi kunci                                                                                           |

### 8.5 Akses & Keamanan

| #     | Skenario                                                 | Perilaku yang Diwajibkan                                                                                                 |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| EC-80 | User punya dua grup dengan scope berbeda                 | Scope efektif = paling luas; `DENY` override selalu menang                                                               |
| EC-81 | Permission dicabut saat user sedang login                | Cache permission di-_invalidate_; permintaan berikutnya ditolak 403 dengan pesan "hak akses berubah, silakan muat ulang" |
| EC-82 | Grup terakhir yang punya `user.manage` dihapus           | Blokir. Sistem WAJIB selalu punya minimal satu akun Super Admin aktif                                                    |
| EC-83 | Loop pada `reporting_lines` (A→B→A)                      | Validasi saat simpan; tolak dengan pesan jelas. Penelusuran `TEAM_TREE` juga dibatasi kedalaman                          |
| EC-84 | Karyawan tanpa akun user tapi perlu diapprove            | Data tetap ada di master; hanya tidak bisa login. Modul lain tetap berjalan                                              |
| EC-85 | Percobaan akses lintas cabang lewat manipulasi ID di URL | Scope guard di repository menolak; catat sebagai `SECURITY_EVENT` di audit log                                           |
| EC-86 | Export data massal oleh user non-Admin                   | Rate limit + audit + notifikasi ke HCGA bila melebihi ambang baris                                                       |

---

## 9. Success Metrics

### 9.1 Metrik Utama (North Star)

> **Waktu siklus payroll**: dari penutupan cut-off (tgl 21) sampai file payroll final siap.
> **Baseline:** `[PERLU DIISI PO]` (estimasi saat ini 5–7 hari kerja).
> **Target MVP (bulan ke-3 pasca go-live): ≤ 2 hari kerja.**

### 9.2 Metrik Adopsi

| Metrik                                  | Target Bulan 1 | Target Bulan 3 | Cara Ukur                  |
| --------------------------------------- | -------------- | -------------- | -------------------------- |
| Karyawan aktif menggunakan absen mobile | ≥ 60%          | ≥ 92%          | DAU absen ÷ karyawan aktif |
| Pengajuan cuti lewat sistem (vs kertas) | ≥ 50%          | ≥ 95%          | Hitungan dokumen           |
| Approval dilakukan dari mobile          | ≥ 40%          | ≥ 75%          | `approval_tasks.source`    |
| e-Payslip dibuka dalam 7 hari publikasi | ≥ 60%          | ≥ 85%          | `payslips.first_viewed_at` |

### 9.3 Metrik Kualitas Proses

| Metrik                                                            | Target   | Cara Ukur                                    |
| ----------------------------------------------------------------- | -------- | -------------------------------------------- |
| Pengajuan diputus ≤ 2 hari kerja                                  | ≥ 90%    | `decided_at − submitted_at` dalam hari kerja |
| Record absensi butuh koreksi manual                               | ≤ 2%     | `attendance_corrections ÷ attendance_daily`  |
| Absensi ditandai anomali (fake GPS / out-of-zone tak terjelaskan) | ≤ 1%     | Flag di `attendance_daily`                   |
| Selisih feeder vs perhitungan Excel (parallel run)                | **Rp 0** | Rekonsiliasi manual                          |
| Slip gaji direvisi pasca-publikasi                                | ≤ 1%     | `payslips.version > 1`                       |
| Kelengkapan field wajib master karyawan                           | ≥ 98%    | Query validasi                               |

### 9.4 Metrik Teknis (SLO)

| Metrik                                    | Target                             |
| ----------------------------------------- | ---------------------------------- |
| Waktu respons API p95                     | ≤ 500 ms                           |
| Waktu submit absen (tap → konfirmasi) p95 | ≤ 3 detik pada 3G                  |
| Cold start aplikasi mobile p95            | ≤ 4 detik pada Android entry-level |
| Tingkat keberhasilan sinkronisasi offline | ≥ 99,5% dalam 24 jam               |
| Ketersediaan (jam kerja 06.00–20.00 WIB)  | ≥ 99,5%                            |
| Tingkat crash mobile                      | ≤ 0,5% sesi                        |
| Ukuran APK (Flutter, split-per-abi)       | ≤ 25 MB per ABI                    |

### 9.5 Metrik Pengujian (Gerbang Wajib — Goal G7)

| Metrik                                                       | Target            | Gerbang                |
| ------------------------------------------------------------ | ----------------- | ---------------------- |
| Cakupan unit test — modul rule engine, payroll, cuti, lembur | **≥ 85%**         | CI gagal bila di bawah |
| Cakupan unit test — modul lainnya                            | ≥ 70%             | CI gagal bila di bawah |
| Modul MVP tanpa test integrasi                               | **0**             | Blokir rilis           |
| Skenario UAT yang dieksekusi & ditandatangani PIC            | **100%**          | Blokir go-live         |
| Bug severity Critical/High terbuka saat go-live              | **0**             | Blokir go-live         |
| Kebocoran data lintas scope pada uji otomatis                | **0**             | Blokir rilis           |
| Uji restore backup                                           | Lulus, triwulanan | —                      |

### 9.6 Metrik "Zero Hardcode" (Metrik Rekayasa)

| Metrik                                        | Target                | Kenapa Diukur              |
| --------------------------------------------- | --------------------- | -------------------------- |
| Perubahan aturan bisnis yang butuh deploy     | **0**                 | Ini janji utama arsitektur |
| Waktu mengubah alur approval                  | ≤ 15 menit oleh Admin | Uji nyata di UAT           |
| Waktu menambah grup pengguna + hak akses baru | ≤ 10 menit oleh Admin | Uji nyata di UAT           |
| Endpoint tanpa deklarasi permission           | **0**                 | Gerbang CI                 |
| Angka kebijakan sebagai literal di kode       | **0**                 | Lint rule + code review    |

---

## 10. Open Questions

> **Aturan main:** Setiap pertanyaan di bawah punya PIC dan tenggat. Pertanyaan **BLOCKER** menghentikan sprint terkait bila belum terjawab. Developer **DILARANG** menebak jawaban dan melanjutkan.

| #      | Pertanyaan                                                                                                                                                               | Dampak                                                     | PIC                 | Tenggat            | Prioritas   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------- | ------------------ | ----------- |
| OQ-01  | **Lembur Supervisor hari biasa: Rp 150.000/hari atau tidak ada?** Dua dokumen sumber bertentangan (FR-M4-003)                                                            | Salah hitung payroll seluruh SPV                           | Comben + HCGA Mgr   | Sebelum Sprint 7   | **BLOCKER** |
| OQ-02  | **Basis siklus cuti: kalender (Jan–Des) atau anniversary?** (FR-M3-014)                                                                                                  | Salah hitung saldo cuti seluruh karyawan                   | HCGA Mgr            | Sebelum Sprint 5   | **BLOCKER** |
| OQ-03  | **[DIREVISI]** Data master **sudah tersedia** (24 kolom, lihat 6.M1B.5). Yang masih hilang hanya **Atasan Langsung & Division Head** untuk 300 karyawan                  | Modul approval tidak dapat berjalan                        | Comben + HCGA       | Sebelum Sprint 6   | **BLOCKER** |
| OQ-03a | **Kolom `BOLEH CUTI` seluruhnya bernilai `Tidak`** — apakah ini kebijakan nyata, atau default template yang belum diisi? Bertentangan dengan SOP.LMN.CBN.04              | Salah blokir hak cuti 300 karyawan                         | HCGA Manager        | Sebelum Sprint 7   | **BLOCKER** |
| OQ-03b | Data yang terbaca hanya golongan `Non Staff` dan entitas `PT LMN`. Di mana data Staff/SPV/Manager, dan data LMI & Pabrik?                                                | Ruang lingkup migrasi                                      | Comben              | Sebelum Sprint 3   | Tinggi      |
| OQ-03c | **Nama Bank & Nama Pemilik Rekening tidak ada** di template, padahal Form Petty Cash mensyaratkannya                                                                     | Transfer gaji & uang muka                                  | Comben + Finance    | Sebelum Sprint 3   | Tinggi      |
| OQ-03d | Kebijakan penomoran NIK ke depan: reset per tahun atau berlanjut? Data sumber menunjukkan **dua pola berbeda** (FR-M8B-021)                                              | Generator NIK salah                                        | HCGA Manager        | Sebelum Sprint 3   | Tinggi      |
| OQ-03e | Nomor dokumen resmi untuk **Perintah Lembur** dan **Koreksi Absensi** belum ada di Daftar Induk Dokumen                                                                  | Kepatuhan ISO                                              | Doc. Control        | Sebelum go-live    | Sedang      |
| OQ-19  | **Jam kerja standar karyawan lapangan: 8 jam atau 6 jam?** Sumber `Contoh Jadwal Kerja` menyebut keduanya (FR-M2B-011)                                                   | Selisih 2 jam/hari × ±180 karyawan pada perhitungan lembur | Comben              | Sebelum Sprint 4   | **BLOCKER** |
| OQ-20  | **Sistem eksisting Gadjianku + Google Form** terdeteksi di dokumen. Strategi cutover: paralel berapa lama, data historis mana yang ditarik, kapan Google Form dimatikan? | Mengubah proyek dari greenfield menjadi migrasi            | IT + HCGA           | Sebelum Sprint 1   | **BLOCKER** |
| OQ-21  | **Opsi A atau B untuk TER?** (FR-M8B-076) — konfigurasi saja di MVP, atau tarik Payroll Engine ke MVP (+6–8 minggu)                                                      | Timeline MVP                                               | PO + Manajemen      | Sebelum Sprint 9   | **BLOCKER** |
| OQ-22  | Contoh layout **FRM.LMN.CMBN.06.001 & .002** (Pengajuan & Laporan Perjalanan Dinas) tidak tersedia                                                                       | Template PDF v2 tidak dapat diverifikasi                   | Doc. Control        | Sebelum v2         | Tinggi      |
| OQ-23  | Tabel _bracket_ **TER A/B/C** dan pemetaan Status PTKP → Kategori TER: apakah memakai PMK yang berlaku apa adanya, atau ada kebijakan internal?                          | Perhitungan pajak                                          | Comben + Tax        | Sebelum Sprint 9   | Tinggi      |
| OQ-04  | **SK Direksi Pinjaman Karyawan** (001/SK/Direksi/LMN/XII/2022): berapa plafon, tenor maksimum, dan apakah ada bunga/biaya admin?                                         | Modul v2 tidak dapat dispesifikasikan                      | HCGA Mgr            | Sebelum v2 kickoff | Tinggi      |
| OQ-05  | **Lampiran SK Perdin**: matriks tarif uang makan, uang saku, akomodasi, dan transportasi per golongan × tier kota tidak ada di berkas yang tersedia                      | Modul v3 tidak dapat dispesifikasikan                      | Comben              | Sebelum v2 kickoff | Tinggi      |
| OQ-06  | **SK Direksi Kompensasi Perpanjangan SIM** (006/SK/Direksi/LMN/II/2024): plafon nominal per jenis SIM?                                                                   | Modul v4                                                   | Comben              | Sebelum v2 kickoff | Sedang      |
| OQ-07  | **Jaminan Pensiun (JP) dan ceiling BPJS Kesehatan** tidak ada di matriks. Apakah memang tidak diikutkan, atau terlewat didokumentasikan?                                 | Risiko kepatuhan                                           | Comben + Finance    | Sebelum Sprint 10  | Tinggi      |
| OQ-08  | Berapa banyak karyawan yang **tidak memiliki smartphone**? Berapa persentase per cabang?                                                                                 | Menentukan bobot fitur proxy attendance                    | HCGA + Admin Cabang | Sebelum Sprint 4   | Tinggi      |
| OQ-09  | Apakah **mesin fingerprint eksisting** tetap dipakai? Merek/model apa? Ada akses ke database/SDK-nya?                                                                    | Menentukan ada/tidaknya konektor import                    | IT                  | Sebelum Sprint 4   | Sedang      |
| OQ-10  | Definisi **"Division Head"** secara operasional: apakah selalu 2 level di atas, atau ditetapkan eksplisit per karyawan?                                                  | Konfigurasi routing approval                               | HCGA Mgr            | Sebelum Sprint 5   | Tinggi      |
| OQ-11  | Kebijakan **jam kerja & shift** per cabang: apakah seragam 08.00–17.00, atau berbeda per cabang/posisi? Berkas `Contoh Jadwal Kerja` tidak terbaca detailnya             | Konfigurasi jadwal & perhitungan terlambat                 | Comben              | Sebelum Sprint 4   | Tinggi      |
| OQ-12  | Apakah ada aturan **potongan keterlambatan** (bukan hanya ketidakhadiran penuh)? Sumber menyebut "Izin pulang cepat atau Terlambat" tanpa formula                        | Perhitungan payroll                                        | Comben              | Sebelum Sprint 7   | Tinggi      |
| OQ-13  | **Hosting**: cloud (region Jakarta) atau on-premise? Ada kewajiban lokalisasi data terkait UU PDP?                                                                       | Arsitektur deployment & biaya                              | IT + Manajemen      | Sebelum Sprint 1   | **BLOCKER** |
| OQ-14  | Distribusi aplikasi mobile: **Google Play publik**, atau distribusi internal (APK/MDM)?                                                                                  | Timeline rilis (review Play Store 1–2 minggu)              | IT                  | Sebelum Sprint 8   | Sedang      |
| OQ-15  | Berapa **tahun data historis** yang harus dimigrasikan? Sumber menyebut migrasi data cuti 2025 dilakukan manual karena backdate                                          | Ruang lingkup migrasi                                      | Comben              | Sebelum Sprint 3   | Sedang      |
| OQ-16  | Apakah **Direksi** perlu menjadi tahap approval di sistem (form Petty Cash menunjukkan kolom tanda tangan Direksi)?                                                      | Desain workflow                                            | HCGA Mgr            | Sebelum v2         | Sedang      |
| OQ-17  | Kebijakan **retensi data** karyawan resign — berapa lama disimpan sebelum dianonimkan?                                                                                   | Kepatuhan UU PDP                                           | HCGA + Legal        | Sebelum go-live    | Sedang      |
| OQ-18  | Apakah entitas **LMI** dan **Pabrik** masuk ruang lingkup MVP, atau hanya LMN? Data master yang tersedia hanya LMN                                                       | Ruang lingkup & kompleksitas                               | Manajemen           | Sebelum Sprint 1   | **BLOCKER** |

---

## Lampiran A — Asumsi yang Dipakai (Semua Perlu Konfirmasi)

| #    | Asumsi                                                                                                      | Basis                                              |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A-01 | MVP = M0–M9; Payroll sebagai _feeder_, bukan _engine_                                                       | Default yang disetujui PO                          |
| A-02 | Stack: **NestJS + PostgreSQL** (backend), **Next.js + shadcn/ui + Tailwind** (web FE), **Flutter** (mobile) | Ditetapkan PO                                      |
| A-03 | "Done" = parallel run 1 cabang, 1 siklus payroll, selisih Rp 0                                              | Default yang disetujui PO                          |
| A-04 | Populasi ±300 karyawan, 18 area kerja                                                                       | `data_pegawai_master`                              |
| A-05 | Seluruh cabang berada di zona `Asia/Jakarta` (WIB)                                                          | Daftar cabang: Jawa Barat, Jawa Tengah, Jawa Timur |
| A-06 | Bahasa antarmuka: Indonesia saja                                                                            | Profil pengguna                                    |
| A-07 | Tidak ada integrasi ERP/akunting di MVP                                                                     | Tidak disebut di dokumen sumber                    |
| A-08 | Karyawan memiliki nomor rekening bank pribadi                                                               | Form Petty Cash menunjukkan pola transfer          |

---

_Dokumen ini adalah PRD. Spesifikasi teknis, skema database lengkap, kontrak API, alur proses bisnis, dan rencana pengujian ada di **BRD LAHANS Connect v1.0**._
