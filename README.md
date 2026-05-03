# Grafik Emas

Grafik historis harga emas dunia — IDR per gram dan USD per troy ounce.

Data dari 1833 (era Gold Standard) hingga hari ini, di-render sebagai static site tanpa backend.

## Stack

- **Frontend**: Vanilla HTML/CSS/JS + Chart.js 4.x
- **Data build**: Python 3 (`scripts/fetch-data.py`) — dijalankan saat Netlify build
- **Deploy**: Netlify (static)

## Sumber Data

| Seri | Sumber | Rentang |
|------|--------|---------|
| Emas (harian) | Yahoo Finance `GC=F` (COMEX gold futures) | ~1995–sekarang |
| Emas (bulanan) | [datahub.io](https://datahub.io/core/gold-prices) | 1833–~2020 |
| Emas (statis) | `data.js` — harga resmi Gold Standard & Bretton Woods | 1925–1967 |
| Kurs USD/IDR | [frankfurter.app](https://www.frankfurter.app) (ECB) | 1999–sekarang |

## Develop Lokal

```bash
python3 scripts/fetch-data.py   # fetch data terbaru ke api/
npx serve .                     # atau python3 -m http.server
```

Lokal tanpa fetch tetap bisa jalan — file CSV di `api/` sudah committed ke repo
sebagai fallback.

## Struktur

```
├── index.html          # Single-page UI
├── style.css           # Mobile-first CSS, dark mode support
├── script.js           # Client runtime (data merge, chart, events)
├── data.js             # Static gold prices 1925–1967
├── netlify.toml        # Build + header config
├── scripts/
│   └── fetch-data.py   # Build-time data fetcher
└── api/
    ├── gold.csv        # Gold USD/oz (committed + refreshed on build)
    ├── idr.csv         # USD/IDR rate (committed + refreshed on build)
    └── build-info.json # Build metadata (timestamp, sources)
```

## Fitur

- Mode IDR/gram dan USD/oz
- Rentang 1Y, 5Y, 10Y, 25Y, 50Y, 100Y, All
- Dark mode otomatis (prefers-color-scheme)
- Mobile-first responsive design
- Export CSV
- Loading skeleton
- Accessibility (ARIA, focus-visible, reduced-motion)

## Deploy

Site connected langsung ke repo via Netlify. Setiap push ke branch
production trigger build:

1. `python3 scripts/fetch-data.py` — fetch gold CSV + IDR rates. Kalau gagal,
   build tetap sukses (exit 0) dan client pakai data committed.
2. Netlify publish root sebagai static site.

### Update data harian

GitHub Actions workflow di `.github/workflows/refresh-data.yml` jalan setiap
hari pukul **06:30 WIB** (23:30 UTC). Workflow:

1. Checkout branch `claude/gold-price-chart-website-TJLCz`
2. Run `python3 scripts/fetch-data.py` — fetch Yahoo + datahub + frankfurter
3. Kalau ada perubahan: commit `api/*.csv` + `api/build-info.json`, push ke
   branch yang sama
4. Push otomatis trigger Netlify rebuild → site update

Bisa juga trigger manual lewat *Actions → Refresh gold + IDR data → Run workflow*
di GitHub UI.

Workflow butuh permission `contents: write` (sudah di-deklarasi). Tidak butuh
secret tambahan — pakai `GITHUB_TOKEN` bawaan.
