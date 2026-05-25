#!/usr/bin/env python3
"""Generate a branded PDF from the SimplePOS PRD (dosen-friendly version)."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable
)

# Brand colors
CARAMEL = HexColor('#a3643e')
CARAMEL_DARK = HexColor('#8c5432')
CARAMEL_LIGHT = HexColor('#f5ebe3')
PARCHMENT = HexColor('#faf7f2')
INK = HexColor('#262624')
INK_SECONDARY = HexColor('#64615a')
INK_TERTIARY = HexColor('#948f89')
DIVIDER = HexColor('#e1dbd0')
WHITE = HexColor('#ffffff')

PAGE_W, PAGE_H = A4
MARGIN = 2.2 * cm

FONT = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

# ── Styles ──

style_title = ParagraphStyle(
    'Title', fontName=FONT_BOLD, fontSize=28, leading=34,
    textColor=CARAMEL_DARK, spaceAfter=4*mm,
)
style_subtitle = ParagraphStyle(
    'Subtitle', fontName=FONT, fontSize=11, leading=15,
    textColor=INK_SECONDARY, spaceAfter=8*mm,
)
style_h1 = ParagraphStyle(
    'H1', fontName=FONT_BOLD, fontSize=16, leading=22,
    textColor=CARAMEL_DARK, spaceBefore=10*mm, spaceAfter=4*mm,
)
style_h2 = ParagraphStyle(
    'H2', fontName=FONT_BOLD, fontSize=12, leading=16,
    textColor=INK, spaceBefore=6*mm, spaceAfter=3*mm,
)
style_body = ParagraphStyle(
    'Body', fontName=FONT, fontSize=9.5, leading=14,
    textColor=INK, spaceAfter=2*mm,
)
style_body_bold = ParagraphStyle(
    'BodyBold', fontName=FONT_BOLD, fontSize=9.5, leading=14,
    textColor=INK, spaceAfter=2*mm,
)
style_bullet = ParagraphStyle(
    'Bullet', fontName=FONT, fontSize=9.5, leading=14,
    textColor=INK, leftIndent=12, spaceAfter=1.5*mm,
)
style_sub_bullet = ParagraphStyle(
    'SubBullet', fontName=FONT, fontSize=9, leading=13,
    textColor=INK_SECONDARY, leftIndent=24, spaceAfter=1*mm,
)
style_numbered = ParagraphStyle(
    'Numbered', fontName=FONT, fontSize=9.5, leading=14,
    textColor=INK, leftIndent=16, spaceAfter=2*mm,
)

def make_divider():
    return HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceBefore=4*mm, spaceAfter=4*mm)

def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CARAMEL),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('LEADING', (0, 0), (-1, -1), 13),
        ('TEXTCOLOR', (0, 1), (-1, -1), INK),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, 0), 0.5, CARAMEL),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, DIVIDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PARCHMENT]),
    ]))
    return t

def make_light_table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CARAMEL_LIGHT),
        ('TEXTCOLOR', (0, 0), (-1, 0), CARAMEL_DARK),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('LEADING', (0, 0), (-1, -1), 13),
        ('TEXTCOLOR', (0, 1), (-1, -1), INK),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, DIVIDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PARCHMENT]),
    ]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(CARAMEL)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN, PAGE_H - MARGIN + 8*mm, PAGE_W - MARGIN, PAGE_H - MARGIN + 8*mm)
    canvas.setFont(FONT_BOLD, 7)
    canvas.setFillColor(INK_TERTIARY)
    canvas.drawString(MARGIN, PAGE_H - MARGIN + 10*mm, "SimplePOS")
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 10*mm, "Product Requirements Document")
    canvas.setFont(FONT, 7)
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 10*mm, f"Halaman {doc.page}")
    canvas.restoreState()

def first_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CARAMEL)
    canvas.rect(0, PAGE_H - 8*mm, PAGE_W, 8*mm, fill=1, stroke=0)
    canvas.setFont(FONT, 7)
    canvas.setFillColor(INK_TERTIARY)
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 10*mm, f"Halaman {doc.page}")
    canvas.restoreState()

def build():
    output_path = '/Users/cedric/erp-coffeeshop/PRD.pdf'
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 6*mm, bottomMargin=MARGIN + 2*mm,
    )

    story = []
    avail_w = PAGE_W - 2 * MARGIN

    # ── Cover ──
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph("Product Requirements Document", style_title))
    story.append(Paragraph(
        "SimplePOS — Sistem kasir berbasis resep untuk bisnis F&amp;B mahasiswa Binus",
        style_subtitle))

    story.append(make_table(
        ['Field', 'Detail'],
        [
            ['Nama produk', 'SimplePOS'],
            ['Deskripsi', 'Sistem kasir berbasis resep untuk bisnis F&B mahasiswa Binus'],
            ['Versi', '1.0'],
            ['Tanggal', '19 Mei 2026'],
        ],
        col_widths=[avail_w * 0.3, avail_w * 0.7],
    ))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("Tim", style_h2))
    story.append(make_table(
        ['No', 'Nama', 'NIM'],
        [
            ['1', 'Cedric Aryasatya', '2802504296'],
            ['2', 'Ubay Manarul', '2802539210'],
            ['3', 'Nadhif Dinev', '2802556053'],
            ['4', 'Chiara Kaalisha Trizta', '2802539154'],
            ['5', 'Zello Chairunisa Hassan', '2802520551'],
        ],
        col_widths=[avail_w * 0.08, avail_w * 0.55, avail_w * 0.37],
    ))

    story.append(make_divider())

    # ── 1. Latar Belakang ──
    story.append(Paragraph("1. Latar Belakang", style_h1))
    story.append(Paragraph(
        "Mahasiswa Binus yang menjalankan bisnis kuliner dalam mata kuliah kewirausahaan "
        "menghadapi tiga masalah utama:", style_body))

    problems = [
        ("<b>Tidak tahu apakah bisnis mereka untung atau rugi</b> — harga jual sudah ditentukan, "
         "tapi biaya bahan per porsi tidak pernah dihitung secara akurat."),
        ("<b>Stok bahan baku kacau</b> — sering kehabisan bahan di tengah event atau bazaar "
         "karena tidak ada sistem tracking otomatis."),
        ("<b>Laporan akhir semester menyita waktu</b> — data penjualan tersebar di catatan manual "
         "atau spreadsheet yang tidak konsisten."),
    ]
    for i, p in enumerate(problems):
        story.append(Paragraph(f"{i+1}.  {p}", style_numbered))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Solusi yang ada di pasar (Moka, Pawoon) terlalu mahal untuk mahasiswa (Rp 250k+/bulan), "
        "dan Google Sheets gratis tapi manual serta tidak menghitung margin per resep.", style_body))

    story.append(make_divider())

    # ── 2. Target Pengguna ──
    story.append(Paragraph("2. Target Pengguna", style_h1))
    story.append(Paragraph("<b>Persona utama: Dewi Pratiwi</b>", style_body_bold))

    for p in [
        "Mahasiswa Binus semester 4, jurusan DKV",
        'Menjalankan bisnis seblak "Mama Dewi" bersama 2 teman (tim 3 orang)',
        "Volume: 30-80 pesanan/minggu, harga Rp 12.000-25.000",
        "Channel: pre-order via WhatsApp + bazaar kampus",
        "Budget: terbatas, tidak bisa bayar Rp 250k/bulan untuk POS komersial",
        "Butuh: tahu untung-rugi per produk, stok tidak habis mendadak, laporan semester tidak ribet",
    ]:
        story.append(Paragraph(f"•  {p}", style_bullet))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("<b>Karakteristik umum pengguna:</b>", style_body_bold))
    for c in [
        "Tim kecil (maks 3 orang)",
        "Bisnis F&amp;B berbasis project/semester",
        "Butuh setup cepat (&lt; 30 menit)",
        'Tidak mau tampilan yang terlalu "enterprise"',
        "Harga harus di bawah Rp 200k/semester untuk satu tim",
    ]:
        story.append(Paragraph(f"•  {c}", style_bullet))

    story.append(make_divider())

    # ── 3. Tujuan Produk ──
    story.append(Paragraph("3. Tujuan Produk", style_h1))
    story.append(make_table(
        ['Tujuan', 'Metrik Keberhasilan'],
        [
            ['Pengguna tahu margin keuntungan per produk',
             'Setiap produk memiliki komposisi resep, biaya bahan terhitung otomatis'],
            ['Stok bahan terjaga saat operasional',
             'Stok berkurang otomatis saat order, peringatan muncul saat bahan hampir habis'],
            ['Laporan bisa diekspor untuk tugas akademik',
             'Export ke Excel dengan ringkasan revenue, cost, profit, dan detail per produk'],
            ['Onboarding cepat',
             'Tim bisa mulai jualan dalam < 15 menit setelah data produk dimasukkan'],
        ],
        col_widths=[avail_w * 0.4, avail_w * 0.6],
    ))

    story.append(make_divider())

    # ── 4. Fitur Utama ──
    story.append(Paragraph("4. Fitur Utama", style_h1))

    # 4.1 Dashboard
    story.append(Paragraph("4.1 Dashboard", style_h2))
    story.append(Paragraph(
        "Halaman utama yang menampilkan ringkasan kondisi bisnis secara real-time:", style_body))
    for b in [
        "<b>Jumlah total pesanan</b> — ditampilkan sebagai angka besar agar langsung terlihat.",
        "<b>Peringatan stok rendah</b> — daftar bahan baku yang hampir habis, beserta sisa stok dan batas minimumnya.",
        "<b>Quick restock</b> — pengguna bisa langsung menambah stok bahan dari dashboard tanpa berpindah halaman.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    # 4.2 Kasir
    story.append(Paragraph("4.2 Kasir (POS)", style_h2))
    story.append(Paragraph("Halaman untuk mencatat pesanan pelanggan:", style_body))
    for b in [
        "Daftar menu produk yang bisa dipilih dengan kontrol jumlah (+/−).",
        "Ringkasan keranjang belanja: daftar item, total harga, dan tombol submit.",
        "<b>Validasi stok otomatis</b> — saat pesanan disubmit, sistem mengecek apakah bahan cukup.",
        "Riwayat pesanan yang sudah pernah dibuat.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))
    for sb in [
        "Jika cukup → pesanan berhasil, stok bahan langsung berkurang.",
        "Jika tidak cukup → pesanan ditolak, ditampilkan detail bahan mana yang kurang.",
    ]:
        story.append(Paragraph(f"–  {sb}", style_sub_bullet))

    # 4.3 Manajemen Produk
    story.append(Paragraph("4.3 Manajemen Produk", style_h2))
    story.append(Paragraph("Halaman untuk mengelola daftar produk dan komposisi resepnya:", style_body))
    for b in [
        "Daftar produk dengan nama, harga, dan resep bahan.",
        "<b>Tambah produk baru</b> — isi nama, harga, dan komposisi resep (bahan + jumlah per porsi).",
        "<b>Edit produk</b> — ubah nama, harga, atau komposisi resep yang sudah ada.",
        "<b>Hapus produk</b> — hanya bisa dilakukan jika produk belum pernah dipesan.",
        "<b>Tambah bahan baru langsung</b> — jika bahan belum ada, bisa ditambahkan dari form produk.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    # 4.4 Manajemen Inventori
    story.append(Paragraph("4.4 Manajemen Inventori", style_h2))
    story.append(Paragraph("Halaman untuk mengelola stok bahan baku:", style_body))
    for b in [
        "Daftar bahan dengan nama, satuan, stok saat ini, biaya per unit, dan batas stok minimum.",
        "<b>Edit stok dan batas minimum secara langsung</b> dari tabel tanpa perlu membuka form terpisah.",
        "Tambah bahan baru dan hapus bahan (hanya jika tidak digunakan di resep manapun).",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    # 4.5 Laporan
    story.append(Paragraph("4.5 Laporan Keuangan", style_h2))
    story.append(Paragraph("Halaman untuk melihat performa bisnis dan mengekspor data:", style_body))
    for b in [
        "<b>4 kartu ringkasan:</b> Revenue (pendapatan), Cost (biaya bahan), Profit (keuntungan), dan ROI.",
        "<b>Grafik penjualan bulanan</b> — pendapatan harian dalam satu bulan.",
        "<b>Grafik komposisi produk</b> — proporsi kontribusi revenue dari masing-masing produk.",
        "<b>Tabel rincian biaya bahan</b> — penggunaan dan biaya setiap bahan yang terpakai.",
        "<b>Export ke Excel (.xlsx)</b> — dengan pilihan rentang tanggal, berisi ringkasan finansial, detail pesanan, dan penggunaan bahan.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    story.append(make_divider())

    # ── 5. Data yang Dikelola ──
    story.append(Paragraph("5. Data yang Dikelola", style_h1))
    story.append(Paragraph("Sistem mengelola lima jenis data utama:", style_body))
    story.append(make_table(
        ['Data', 'Keterangan'],
        [
            ['Produk', 'Nama produk dan harga jual. Setiap produk memiliki komposisi resep.'],
            ['Bahan Baku', 'Nama bahan, satuan (gram/ml/pcs), stok saat ini, biaya per unit, dan batas minimum stok.'],
            ['Resep', 'Hubungan antara produk dan bahan — berapa banyak bahan yang dibutuhkan per porsi.'],
            ['Pesanan', 'Catatan setiap transaksi: total harga, waktu, dan daftar item yang dipesan.'],
            ['Item Pesanan', 'Detail per baris: produk, jumlah, harga saat dipesan, dan biaya bahan saat dipesan.'],
        ],
        col_widths=[avail_w * 0.2, avail_w * 0.8],
    ))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Harga dan biaya bahan disimpan salinannya (snapshot) saat pesanan dibuat, sehingga laporan "
        "tetap akurat meskipun harga berubah di kemudian hari.", style_body))

    story.append(make_divider())

    # ── 6. Alur Pemrosesan Pesanan ──
    story.append(Paragraph("6. Alur Pemrosesan Pesanan", style_h1))
    story.append(Paragraph(
        "Logika inti sistem — memastikan stok selalu akurat dan pesanan tidak bisa dibuat "
        "jika bahan tidak cukup.", style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>Saat pesanan baru disubmit:</b>", style_body_bold))

    steps = [
        "Sistem mengambil data semua produk yang dipesan beserta resep dan bahannya.",
        "Sistem menghitung total kebutuhan setiap bahan berdasarkan resep x jumlah yang dipesan.",
        "Sistem mengecek apakah stok setiap bahan mencukupi.",
        "Jika ada yang kurang → seluruh pesanan ditolak, tidak ada stok yang berubah.",
        "Jika semua cukup → stok setiap bahan dikurangi sesuai kebutuhan.",
        "Total harga dihitung dari harga produk di server (bukan dari input pengguna).",
        "Pesanan dan detail item-nya disimpan, lengkap dengan snapshot harga dan biaya bahan.",
    ]
    for i, s in enumerate(steps):
        story.append(Paragraph(f"{i+1}.  {s}", style_numbered))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("<b>Perlindungan terhadap kesalahan:</b>", style_body_bold))
    for e in [
        "Produk tanpa resep tetap bisa dipesan (tidak ada stok yang dikurangi).",
        "Jumlah pesanan harus lebih dari 0.",
        "Pesanan kosong (tanpa item) akan ditolak.",
        "Seluruh proses berjalan dalam satu transaksi — jika ada yang gagal, tidak ada data yang berubah.",
    ]:
        story.append(Paragraph(f"•  {e}", style_bullet))

    story.append(make_divider())

    # ── 7. Contoh Data Awal ──
    story.append(Paragraph("7. Contoh Data Awal", style_h1))
    story.append(Paragraph(
        "Untuk memudahkan pengujian, sistem menyediakan data awal berupa 3 bahan dan 3 produk:",
        style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>Bahan baku:</b>", style_body_bold))
    story.append(make_light_table(
        ['Bahan', 'Stok Awal', 'Satuan', 'Biaya/unit', 'Batas Minimum'],
        [
            ['Coffee Beans', '1.000', 'gram', 'Rp 150', '200'],
            ['Milk', '2.000', 'ml', 'Rp 30', '500'],
            ['Cup', '50', 'pcs', 'Rp 500', '10'],
        ],
        col_widths=[avail_w*0.22, avail_w*0.16, avail_w*0.14, avail_w*0.2, avail_w*0.28],
    ))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("<b>Produk:</b>", style_body_bold))
    story.append(make_light_table(
        ['Produk', 'Harga', 'Komposisi Resep'],
        [
            ['Espresso', 'Rp 25.000', '20g coffee beans + 1 cup'],
            ['Latte', 'Rp 35.000', '20g coffee beans + 150ml milk + 1 cup'],
            ['Cappuccino', 'Rp 32.000', '20g coffee beans + 100ml milk + 1 cup'],
        ],
        col_widths=[avail_w*0.2, avail_w*0.2, avail_w*0.6],
    ))

    story.append(make_divider())

    # ── 8. Desain Antarmuka ──
    story.append(Paragraph("8. Desain Antarmuka", style_h1))

    story.append(Paragraph("Navigasi", style_h2))
    for b in [
        "Sidebar tetap di sisi kiri layar dengan 5 menu: Dashboard, Kasir, Produk, Inventori, Laporan.",
        "Sidebar bisa di-collapse menjadi icon saja untuk menghemat ruang.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    story.append(Paragraph("Tampilan Visual", style_h2))
    for b in [
        "Nuansa warna hangat (cream/parchment) dengan aksen cokelat karamel.",
        "Desain bersih dan minimalis — tidak terlihat seperti software enterprise yang rumit.",
        "Animasi halus pada interaksi (tombol, transisi halaman, angka berubah).",
        "Loading skeleton saat data sedang dimuat.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    story.append(Paragraph("Tipografi", style_h2))
    for b in [
        "Font body yang modern dan mudah dibaca.",
        "Font serif untuk heading agar terasa hangat dan personal.",
    ]:
        story.append(Paragraph(f"•  {b}", style_bullet))

    story.append(make_divider())

    # ── 9. Batasan Versi 1.0 ──
    story.append(Paragraph("9. Batasan Versi 1.0", style_h1))
    story.append(make_table(
        ['Keputusan', 'Alasan'],
        [
            ['Tidak ada sistem login/akun', 'Scope v1.0 — diasumsikan satu pengguna terpercaya'],
            ['Tidak ada integrasi pembayaran', 'Pembayaran ditangani secara manual (cash/QRIS di luar sistem)'],
            ['Harga ditampilkan tanpa desimal', 'Rupiah tidak menggunakan sen'],
            ['Produk tanpa resep boleh dijual', 'Fleksibilitas untuk produk non-racikan (misal: air mineral)'],
            ['Biaya bahan disimpan per pesanan', 'Agar laporan tetap akurat meskipun harga bahan berubah'],
        ],
        col_widths=[avail_w * 0.4, avail_w * 0.6],
    ))

    story.append(make_divider())

    # ── 10. Roadmap ──
    story.append(Paragraph("10. Roadmap", style_h1))

    story.append(Paragraph("Fitur yang direncanakan (belum dibangun)", style_h2))
    for p in [
        "Custom opsi produk (level es, level pedas, dll.)",
        "Integrasi pembayaran QRIS untuk billing langganan",
        "Capture bukti pembayaran pelanggan (foto struk)",
        "Multi-member per tim (maks 3 orang)",
        "Tracking metode pembayaran per order (cash/QRIS/transfer)",
        "Export laporan format khusus tugas akademik Binus",
    ]:
        story.append(Paragraph(f"•  {p}", style_bullet))

    story.append(Paragraph("Visi jangka panjang", style_h2))
    for p in [
        "Saran restock dan produk andalan berbasis AI",
        "Forecasting penjualan",
        "Integrasi WhatsApp ordering via chatbot",
        "Multi-outlet",
    ]:
        story.append(Paragraph(f"•  {p}", style_bullet))

    story.append(Paragraph("Tidak akan dibangun", style_h2))
    for p in [
        "Kalkulasi pajak",
        "Batch tracking / tanggal kedaluwarsa",
        "Program loyalitas",
        "Accounting / jurnal detail",
    ]:
        story.append(Paragraph(f"•  {p}", style_bullet))

    doc.build(story, onFirstPage=first_page, onLaterPages=header_footer)
    print(f"PDF generated: {output_path}")

if __name__ == '__main__':
    build()
