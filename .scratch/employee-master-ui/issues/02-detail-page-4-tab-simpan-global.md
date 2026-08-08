# 02 — Halaman Detail: 4 tab + simpan global

**What to build:** Halaman detail karyawan (`/master/employees/<id>`) yang menggantikan dialog pop-up 24-field. Halaman ini punya header sticky dengan tombol kembali, avatar inisial, nama, NIK, ringkasan pekerjaan (jabatan · area kerja · status), dan tombol Simpan global. Di bawah header ada bar tab sticky: **Identitas** (NIK, nama, jenis kelamin, agama, TTL, KTP, NPWP), **Keluarga & Kontak** (status pernikahan, alamat, HP, kontak darurat), **Pekerjaan** (area kerja, jabatan, golongan, status kepegawaian, tanggal masuk, status kontrak, tanggal mulai/akhir kontrak), **Payroll & BPJS** (PTKP, BPJS TK/Kes, bank, rekening). Form langsung editable bagi yang punya hak tulis; read-only otomatis bagi yang hanya punya hak baca. NIK editable saat tambah baru, readonly saat edit. Satu tombol Simpan mengirim semua perubahan dari semua tab; tab yang punya perubahan belum tersimpan ditandai "•", dan konfirmasi muncul saat user pindah tab/kembali dengan perubahan belum tersimpan. Validasi gagal menandai field dan menandai tab yang bermasalah.

Mode tambah baru memakai halaman yang sama dengan field kosong dan NIK editable.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Halaman detail menampilkan 4 tab dengan field terkelompok sesuai keputusan desain
- [ ] NIK readonly saat edit, editable saat tambah baru
- [ ] Simpan global mengirim semua perubahan sekali klik; indikator "•" tampil di tab yang berubah
- [ ] Konfirmasi muncul saat pindah/kembali dengan perubahan belum tersimpan
- [ ] Read-only otomatis tanpa hak tulis; error validasi menandai field + tab
- [ ] Gates CI hijau
