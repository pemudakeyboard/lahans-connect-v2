# 01 — List Karyawan: filter + kolom kaya

**What to build:** Halaman daftar karyawan yang menampilkan data ringkas tapi informatif untuk scanning cepat oleh HR. Setiap baris menampilkan avatar inisial, NIK (monospace), nama, area kerja, jabatan, golongan, status kontrak, tanggal akhir kontrak, status kepegawaian (badge berwarna: Aktif hijau / Cuti kuning / Resign abu), dan tanggal mulai kerja. Kolom tanggal akhir kontrak menampilkan badge peringatan `⚠ N hari lagi` saat kontrak tinggal < 30 hari. Di atas tabel ada toolbar: kolom pencarian (nama/NIK, sudah ada), filter dropdown Area Kerja, dan filter dropdown Status Kepegawaian. Klik baris membawa ke halaman detail karyawan (boleh stub sementara menunggu ticket 02).

Dibangun sebagai halaman khusus karyawan (bukan dialog generik), memakai pola list yang sudah ada di aplikasi.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Baris list menampilkan avatar inisial, NIK, nama, area kerja, jabatan, golongan, status kontrak, akhir kontrak, status badge berwarna, mulai kerja
- [ ] Badge "⚠ N hari lagi" muncul saat kontrak berakhir < 30 hari
- [ ] Filter Area Kerja dan filter Status berfungsi dan dikombinasikan dengan pencarian
- [ ] Klik baris berpindah ke halaman detail karyawan
- [ ] Gates CI hijau (lint, format, test, build, DI boot)
