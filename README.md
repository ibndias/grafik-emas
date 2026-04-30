# Grafik Emas

Website grafik harga emas, data harian dari **LBMA Gold Price (AM Fix)** via FRED
seri `GOLDAMGBD228NLBM` (1968–sekarang) plus harga resmi era Gold Standard /
Bretton Woods (1925–1967) sebagai data statis.

## Jalan lokal

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Lokal hanya akan menampilkan data statis 1925–1967 — file `api/fred-gold.csv`
di-generate saat build Netlify. Untuk dev penuh, jalankan `bash scripts/fetch-fred.sh`
sekali lalu serve.

## Deploy

Site ini connected langsung ke repo via Netlify. Setiap push ke branch
production akan trigger build:

1. `bash scripts/fetch-fred.sh` — fetch CSV harian dari FRED, simpan ke
   `api/fred-gold.csv`. Kalau gagal (mis. FRED unreachable), build tetap sukses
   dan client fallback ke data statis.
2. Netlify publish root sebagai static site.

`netlify.toml` mengatur publish dir, build command, dan headers.

### Update data harian

Build hanya jalan saat ada push. Untuk auto-update harian, bikin **build hook**
di Netlify (*Site settings → Build & deploy → Build hooks*) lalu trigger via
cron eksternal (cron-job.org / GitHub Actions schedule) yang `curl -X POST` ke
URL build hook tiap pagi.
