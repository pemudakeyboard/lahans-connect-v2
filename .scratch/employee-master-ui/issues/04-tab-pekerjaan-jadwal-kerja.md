# 04 — Tab Pekerjaan: jadwal kerja saat ini (read-only)

**What to build:** Di tab Pekerjaan pada halaman detail karyawan, tampilkan kartu info read-only "Jadwal Kerja" yang menunjukkan jadwal/shift yang sedang berlaku untuk karyawan itu — misalnya `PABRIK_SHIFT_3X — rotasi 3 shift` atau `HO_STANDARD — 09:00–17:00`. Info ini diambil dari resolver jadwal roster (M2B) yang sudah ada, sehingga HR melihat jadwal tanpa pindah ke halaman roster. Satu endpoint ringan untuk membaca jadwal aktif karyawan saat ini.

**Blocked by:** 02 — Detail Page (ditampilkan di dalam halaman detail)

**Status:** ready-for-agent

- [ ] Kartu "Jadwal Kerja" read-only tampil di tab Pekerjaan
- [ ] Kartu menunjukkan nama jadwal berpola (rotasi/global) atau jam kerja harian sesuai resolusi roster
- [ ] Data diambil live dari resolver roster, bukan hardcode
- [ ] Tidak ada ralat saat karyawan tanpa jadwal (tampil "belum ada jadwal")
- [ ] Gates CI hijau
