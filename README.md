# LaundryLand Project - Cloudflare Pages + GitHub

## Cara Deploy ke Cloudflare Pages via GitHub (Recommended)

### Kenapa icon hilang kalau upload cuma html?
Cloudflare Pages Direct Upload itu **replace total**, bukan tambah. Tiap upload baru, semua file lama kehapus. Jadi kalau upload cuma `index.html`, icon-icon hilang → favicon jadi globe.

**Solusi: Upload via GitHub**

1. Buat repo baru di GitHub, misal `laundryland-madiun`
2. Upload semua file dari folder ini ke repo:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `supabase-laundry.js`
   - `icon-32.png`, `icon-64.png`, `icon-180.png`, `icon-192.png`, `icon-512.png`
3. Di Cloudflare Dashboard → Pages → Create project → Connect to Git → pilih repo `laundryland-madiun`
4. Build settings:
   - Framework preset: None
   - Build command: (kosongkan)
   - Output directory: `/`
5. Deploy → selesai. Icon tidak akan hilang lagi.

### Update selanjutnya
- Edit file di lokal atau langsung di GitHub
- `git add .`, `git commit -m "update"`, `git push`
- Cloudflare otomatis deploy ulang **semua file** — icon tetap ada.

### Favicon sudah fix
`<head>` sudah ada:
```html
<link rel="icon" type="image/png" sizes="32x32" href="./icon-32.png">
<link rel="apple-touch-icon" href="./icon-180.png">
<link rel="manifest" href="./manifest.json">
```

### PWA
- `manifest.json` wajib untuk Add to Home Screen
- `sw.js` cache `v7-fix-ringkasan-global-label`

### Supabase
- Project: zfyjcaklaithzykkdrne
- Jika muncul banner "Investigating", itu normal untuk free tier baru, tunggu 10-30 menit, akan hilang sendiri. Bukan pelanggaran.
- Jangan commit anon key ke public repo, pakai env variable di Cloudflare Pages → Settings → Environment Variables

## Rollback
Restore point ada di `restore-point-before-price-list.json` dan `restore-point-after-price-list.json`
