# 03 — Bulk Actions: nonaktifkan, hapus, export, assign jadwal

**What to build:** Operasi massal pada daftar karyawan. Setiap baris punya checkbox; saat ada baris tercentang, muncul toolbar bulk menampilkan "N dipilih" dengan aksi: **Nonaktifkan** (ubah status ke Resign/Nonaktif — konfirmasi dulu), **Hapus** (konfirmasi dulu), **Export CSV** (unduh baris terpilih sebagai CSV di sisi klien), dan **Assign Jadwal** (dialog memilih work schedule, lalu memakai endpoint bulk-assignment roster yang sudah ada). Toolbar bisa dibatalkan (✕). Aksi massal hanya tersedia bagi yang punya hak tulis karyawan.

Di sisi API: dua endpoint baru untuk nonaktifkan massal dan hapus massal (menerima daftar id); hapus massal memperlakukan data sesuai aturan yang ada (soft-delete / status). Export CSV sepenuhnya di sisi klien dari baris yang sudah dimuat.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Checkbox per baris; toolbar bulk muncul dengan jumlah terpilih saat ada centangan
- [ ] Nonaktifkan massal mengubah status dan meminta konfirmasi
- [ ] Hapus massal menghapus baris terpilih dan meminta konfirmasi
- [ ] Export CSV mengunduh baris terpilih
- [ ] Assign Jadwal membuka dialog pilihan work schedule dan memanggil endpoint roster yang ada
- [ ] Aksi massal terkunci tanpa hak tulis
- [ ] Gates CI hijau
