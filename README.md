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

Build hanya jalan saat ada push. Untuk auto-update harian, bikin **build hook**
di Netlify (*Site settings → Build & deploy → Build hooks*) lalu trigger via
cron eksternal (cron-job.org / GitHub Actions schedule) yang `curl -X POST` ke
URL build hook tiap pagi.
