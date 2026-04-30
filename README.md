# Grafik Emas

Website grafik harga emas 100 tahun (1925–2026), data rata-rata tahunan USD/oz.

## Jalan lokal

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

## Deploy ke Netlify (CI/CD via GitHub Actions)

Workflow di `.github/workflows/deploy.yml` akan:
- **Push ke `main`** → deploy production
- **Pull request** → deploy preview + komentar URL preview di PR

### Setup sekali

1. Buat site kosong di Netlify (web UI: *Add new site → Deploy manually*, drag folder kosong, atau pakai CLI `netlify sites:create`).
2. Ambil dua nilai berikut:
   - **Site ID** — di *Site settings → General → Site information → Site ID*.
   - **Personal access token** — di *User settings → Applications → Personal access tokens → New access token*.
3. Tambah keduanya sebagai GitHub repo secrets (*Settings → Secrets and variables → Actions → New repository secret*):
   - `NETLIFY_SITE_ID`
   - `NETLIFY_AUTH_TOKEN`

Setelah itu, push ke `main` akan otomatis deploy.

## Alternatif tanpa GitHub Actions

Netlify bisa langsung connect ke repo (*Add new site → Import from Git*), nggak perlu workflow file ini sama sekali. `netlify.toml` tetap dipakai untuk config publish dir dan headers.
