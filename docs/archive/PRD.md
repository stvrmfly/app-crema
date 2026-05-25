# Product Requirements Document — SimplePOS

---

## Informasi Proyek

| Field | Detail |
|-------|--------|
| Nama produk | SimplePOS |
| Deskripsi | Sistem kasir berbasis resep untuk bisnis F&B mahasiswa Binus |
| Versi | 1.0 |
| Tanggal | 19 Mei 2026 |

### Tim

| No | Nama | NIM |
|----|------|-----|
| 1 | Cedric Aryasatya | 2802504296 |
| 2 | Ubay Manarul | 2802539210 |
| 3 | Nadhif Dinev | 2802556053 |
| 4 | Chiara Kaalisha Trizta | 2802539154 |
| 5 | Zello Chairunisa Hassan | 2802520551 |

---

## 1. Latar Belakang

Mahasiswa Binus yang menjalankan bisnis kuliner dalam mata kuliah kewirausahaan menghadapi tiga masalah utama:

1. **Tidak tahu apakah bisnis mereka untung atau rugi** — harga jual sudah ditentukan, tapi biaya bahan per porsi tidak pernah dihitung secara akurat.
2. **Stok bahan baku kacau** — sering kehabisan bahan di tengah event atau bazaar karena tidak ada sistem tracking otomatis.
3. **Laporan akhir semester menyita waktu** — data penjualan tersebar di catatan manual atau spreadsheet yang tidak konsisten.

Solusi yang ada di pasar (Moka, Pawoon) terlalu mahal untuk mahasiswa (Rp 250k+/bulan), dan Google Sheets gratis tapi manual serta tidak menghitung margin per resep.

---

## 2. Target Pengguna

**Persona utama: Dewi Pratiwi**

- Mahasiswa Binus semester 4, jurusan DKV
- Menjalankan bisnis seblak "Mama Dewi" bersama 2 teman (tim 3 orang)
- Volume: 30–80 pesanan/minggu, harga Rp 12.000–25.000
- Channel: pre-order via WhatsApp + bazaar kampus
- Budget: terbatas, tidak bisa bayar Rp 250k/bulan untuk POS komersial
- Butuh: tahu untung-rugi per produk, stok tidak habis mendadak, laporan semester tidak ribet

**Karakteristik umum pengguna:**

- Tim kecil (maks 3 orang)
- Bisnis F&B berbasis project/semester
- Butuh setup cepat (< 30 menit)
- Tidak mau tampilan yang terlalu "enterprise"
- Harga harus di bawah Rp 200k/semester untuk satu tim

---

## 3. Tujuan Produk

| Tujuan | Metrik Keberhasilan |
|--------|---------------------|
| Pengguna tahu margin keuntungan per produk | Setiap produk memiliki komposisi resep, biaya bahan terhitung otomatis |
| Stok bahan terjaga saat operasional | Stok berkurang otomatis saat order, peringatan muncul saat bahan hampir habis |
| Laporan bisa diekspor untuk tugas akademik | Export ke Excel dengan ringkasan revenue, cost, profit, dan detail per produk |
| Onboarding cepat | Tim bisa mulai jualan dalam < 15 menit setelah data produk dimasukkan |

---

## 4. Fitur Utama

### 4.1 Dashboard

Halaman utama yang menampilkan ringkasan kondisi bisnis secara real-time:

- **Jumlah total pesanan** — ditampilkan sebagai angka besar agar langsung terlihat.
- **Peringatan stok rendah** — daftar bahan baku yang hampir habis, beserta sisa stok dan batas minimumnya.
- **Quick restock** — pengguna bisa langsung menambah stok bahan dari dashboard tanpa berpindah halaman.

### 4.2 Kasir (POS)

Halaman untuk mencatat pesanan pelanggan:

- Daftar menu produk yang bisa dipilih dengan kontrol jumlah (+/−).
- Ringkasan keranjang belanja: daftar item, total harga, dan tombol submit.
- **Validasi stok otomatis** — saat pesanan disubmit, sistem mengecek apakah bahan cukup:
  - Jika cukup → pesanan berhasil, stok bahan langsung berkurang.
  - Jika tidak cukup → pesanan ditolak, ditampilkan detail bahan mana yang kurang beserta jumlahnya.
- Riwayat pesanan yang sudah pernah dibuat.

### 4.3 Manajemen Produk

Halaman untuk mengelola daftar produk dan komposisi resepnya:

- Daftar produk dengan nama, harga, dan resep bahan.
- **Tambah produk baru** — isi nama, harga, dan komposisi resep (bahan + jumlah per porsi).
- **Edit produk** — ubah nama, harga, atau komposisi resep yang sudah ada.
- **Hapus produk** — hanya bisa dilakukan jika produk belum pernah dipesan (untuk menjaga integritas data).
- **Tambah bahan baru langsung** — jika bahan belum ada di sistem, bisa ditambahkan langsung dari form produk.

### 4.4 Manajemen Inventori

Halaman untuk mengelola stok bahan baku:

- Daftar bahan dengan nama, satuan, stok saat ini, biaya per unit, dan batas stok minimum.
- **Edit stok dan batas minimum secara langsung** dari tabel tanpa perlu membuka form terpisah.
- Tambah bahan baru.
- Hapus bahan (hanya jika tidak sedang digunakan di resep manapun).

### 4.5 Laporan Keuangan

Halaman untuk melihat performa bisnis dan mengekspor data:

- **4 kartu ringkasan:** Revenue (pendapatan), Cost (biaya bahan), Profit (keuntungan), dan ROI.
- **Grafik penjualan bulanan** — menampilkan pendapatan harian dalam satu bulan.
- **Grafik komposisi produk** — proporsi kontribusi revenue dari masing-masing produk.
- **Tabel rincian biaya bahan** — penggunaan dan biaya setiap bahan yang terpakai.
- **Export ke Excel (.xlsx)** — dengan pilihan rentang tanggal, berisi:
  - Ringkasan finansial dan breakdown per produk
  - Detail setiap pesanan beserta profit per baris
  - Penggunaan dan biaya per bahan

---

## 5. Data yang Dikelola

Sistem mengelola lima jenis data utama:

| Data | Keterangan |
|------|------------|
| **Produk** | Nama produk dan harga jual. Setiap produk memiliki komposisi resep. |
| **Bahan Baku** | Nama bahan, satuan (gram/ml/pcs), stok saat ini, biaya per unit, dan batas minimum stok. |
| **Resep** | Hubungan antara produk dan bahan — menentukan berapa banyak bahan yang dibutuhkan per porsi. |
| **Pesanan** | Catatan setiap transaksi: total harga, waktu pembuatan, dan daftar item yang dipesan. |
| **Item Pesanan** | Detail per baris pesanan: produk apa, berapa banyak, harga saat dipesan, dan biaya bahan saat dipesan. |

Harga dan biaya bahan di-*snapshot* (disimpan salinannya) saat pesanan dibuat, sehingga laporan tetap akurat meskipun harga berubah di kemudian hari.

---

## 6. Alur Pemrosesan Pesanan

Ini adalah logika inti sistem — memastikan stok selalu akurat dan pesanan tidak bisa dibuat jika bahan tidak cukup.

**Saat pesanan baru disubmit:**

1. Sistem mengambil data semua produk yang dipesan beserta resep dan bahannya.
2. Sistem menghitung total kebutuhan setiap bahan berdasarkan resep × jumlah yang dipesan.
3. Sistem mengecek apakah stok setiap bahan mencukupi:
   - **Jika ada yang kurang** → seluruh pesanan ditolak, tidak ada stok yang berubah. Pengguna diberitahu bahan mana yang kurang dan berapa kekurangannya.
   - **Jika semua cukup** → lanjut ke langkah berikut.
4. Stok setiap bahan dikurangi sesuai kebutuhan.
5. Total harga dihitung dari harga produk yang tersimpan di server (bukan dari input pengguna).
6. Pesanan dan detail item-nya disimpan, lengkap dengan snapshot harga dan biaya bahan.

**Perlindungan terhadap kesalahan:**
- Produk tanpa resep tetap bisa dipesan (tidak ada stok yang dikurangi).
- Jumlah pesanan harus lebih dari 0.
- Pesanan kosong (tanpa item) akan ditolak.
- Seluruh proses berjalan dalam satu transaksi — jika ada yang gagal, tidak ada data yang berubah.

---

## 7. Contoh Data Awal

Untuk memudahkan pengujian, sistem menyediakan data awal berupa 3 bahan dan 3 produk:

**Bahan baku:**

| Bahan | Stok Awal | Satuan | Biaya/unit | Batas Minimum |
|-------|-----------|--------|------------|---------------|
| Coffee Beans | 1.000 | gram | Rp 150 | 200 |
| Milk | 2.000 | ml | Rp 30 | 500 |
| Cup | 50 | pcs | Rp 500 | 10 |

**Produk:**

| Produk | Harga | Komposisi Resep |
|--------|-------|-----------------|
| Espresso | Rp 25.000 | 20g coffee beans + 1 cup |
| Latte | Rp 35.000 | 20g coffee beans + 150ml milk + 1 cup |
| Cappuccino | Rp 32.000 | 20g coffee beans + 100ml milk + 1 cup |

---

## 8. Desain Antarmuka

### Navigasi
- Sidebar tetap di sisi kiri layar dengan 5 menu: Dashboard, Kasir, Produk, Inventori, Laporan.
- Sidebar bisa di-collapse menjadi icon saja untuk menghemat ruang.

### Tampilan Visual
- Nuansa warna hangat (cream/parchment) dengan aksen cokelat karamel.
- Desain bersih dan minimalis — tidak terlihat seperti software enterprise yang rumit.
- Animasi halus pada interaksi (tombol, transisi halaman, angka berubah).
- Loading skeleton saat data sedang dimuat.

### Tipografi
- Font body yang modern dan mudah dibaca.
- Font serif untuk heading agar terasa hangat dan personal.

---

## 9. Batasan Versi 1.0

| Keputusan | Alasan |
|-----------|--------|
| Tidak ada sistem login/akun | Scope v1.0 — diasumsikan satu pengguna terpercaya |
| Tidak ada integrasi pembayaran | Pembayaran ditangani secara manual (cash/QRIS di luar sistem) |
| Harga ditampilkan tanpa desimal | Rupiah tidak menggunakan sen |
| Produk tanpa resep boleh dijual | Fleksibilitas untuk produk non-racikan (misal: air mineral kemasan) |
| Biaya bahan disimpan per pesanan | Agar laporan tetap akurat meskipun harga bahan berubah |

---

## 10. Roadmap

### Fitur yang direncanakan (belum dibangun)

- Custom opsi produk (level es, level pedas, dll.)
- Integrasi pembayaran QRIS untuk billing langganan
- Capture bukti pembayaran pelanggan (foto struk)
- Multi-member per tim (maks 3 orang)
- Tracking metode pembayaran per order (cash/QRIS/transfer)
- Export laporan format khusus tugas akademik Binus

### Visi jangka panjang

- Saran restock dan produk andalan berbasis AI
- Forecasting penjualan
- Integrasi WhatsApp ordering via chatbot
- Multi-outlet

### Tidak akan dibangun

- Kalkulasi pajak
- Batch tracking / tanggal kedaluwarsa
- Program loyalitas
- Accounting / jurnal detail
