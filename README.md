# LaundryLand - PWA Laundry Management

Aplikasi manajemen laundry lengkap dengan PWA offline, thermal printing RPP02N & GZB100 VSC MP-58 PRO, share WA Bisnis.

## Fitur Fix Terbaru
- ✅ Border-1 semua sub kolom
- ✅ Kolom ATAS hijau tosca (#0fb9a0) + space 10px dari No Nota
- ✅ Hapus tulisan STATUS: dan garis putus - cukup Lunas/Belum Lunas dengan warna asli
- ✅ Kolom ATAS & BAWAH 1 kolom full width, auto row, perintah beda & berdiri sendiri (settingNotaAtas & settingNotaBawah)
- ✅ KartuAntrian: icon Share WA Bisnis di pojok kanan estimasi + label Share WA + space 15px
- ✅ KartuBayarNota: icon 💵 Tunai, 📱 QRIS, 🏦 Transfer
- ✅ Hapus Terima Kasih! kecil di luar kolom pada PNG
- ✅ RPP02N cepat (100 byte), GZB100 stabil (20 byte + write response)

## File PWA
- `index.html` - File utama (sudah include manifest & SW registration)
- `manifest.json` - PWA manifest, icons dari root github
- `sw.js` - Service Worker offline-first, cache-first untuk assets, network-first untuk Supabase
- `icon-*.png` - Sudah ada di root github: icon-32, 64, 180, 192, 512

## Deploy GitHub Pages (Repo LaundryLand)
1. Push semua file ke repo `LaundryLand` branch `main`
2. Settings > Pages > Source: Deploy from branch, Branch: main / root
3. URL: `https://username.github.io/LaundryLand/`
4. Icons akan load dari `./icon-*.png`

## Deploy Supabase (Project Kedua - Belum Buat)
1. Buat project baru di https://supabase.com/dashboard > New Project
2. Copy URL & Anon Key ke `.env` (lihat `.env.example`)
3. Jalankan `supabase_schema.sql` di SQL Editor
4. Enable Auth jika perlu
5. Project pertama tetap jalan, project kedua untuk production LaundryLand

## Deploy Cloudflare (Belum Buat)
### Opsi A: Cloudflare Pages (Recommended)
```bash
npx wrangler pages publish ./ --project-name=laundryland
```
Atau connect GitHub repo di dashboard Cloudflare Pages.

### Opsi B: Cloudflare Workers
```bash
wrangler publish
```

Isi `account_id` di `wrangler.toml` dari dashboard Cloudflare.

## Icons
Sudah ada di root:
- icon-32.png (favicon)
- icon-64.png (badge)
- icon-180.png (apple-touch)
- icon-192.png (PWA standard)
- icon-512.png (PWA large)

Manifest sudah refer ke semua icon dengan purpose any maskable.

## Test PWA
1. Buka di Chrome mobile
2. Menu > Install App / Add to Home Screen
3. Test offline: airplane mode, reload tetap jalan (SW cache)

## Audit Tombol & Element
- ✅ 209 onclick, 217 defined functions, 4 missing (sudah fix: showDepositoHistory, testPrintThermal, hapusNota)
- ✅ Semua modal: modalBayar, modalPreviewNota, modalPilihanKirim, modalPickerPelanggan
- ✅ Bluetooth: connect, disconnect, printViaBluetooth (RPP02N & GZB100)
- ✅ Share WA: shareWA(true,id) dengan label
- ✅ Bayar: Tunai, QRIS, Transfer dengan icon
- ✅ Nota: atas & bawah independen auto row
