// Data statis era harga resmi (fixed by law), tidak ada di FRED:
// 1925-1933: Gold Standard, USD 20.67/oz.
// 1933-1934: devaluasi (Gold Reserve Act).
// 1934-1967: Bretton Woods, USD 35/oz.
// Dari 1968 ke atas: di-fetch live dari FRED seri GOLDAMGBD228NLBM
// (LBMA Gold Price - AM Fix, USD per troy ounce, harian).
window.GOLD_STATIC = [
  { date: '1925-12-31', price: 20.67 },
  { date: '1926-12-31', price: 20.67 },
  { date: '1927-12-31', price: 20.67 },
  { date: '1928-12-31', price: 20.67 },
  { date: '1929-12-31', price: 20.67 },
  { date: '1930-12-31', price: 20.67 },
  { date: '1931-12-31', price: 20.67 },
  { date: '1932-12-31', price: 20.67 },
  { date: '1933-12-31', price: 26.33 },
  { date: '1934-12-31', price: 34.69 },
  { date: '1935-12-31', price: 34.84 },
  { date: '1936-12-31', price: 34.87 },
  { date: '1937-12-31', price: 34.79 },
  { date: '1938-12-31', price: 34.85 },
  { date: '1939-12-31', price: 34.42 },
  { date: '1940-12-31', price: 33.85 },
  { date: '1941-12-31', price: 33.85 },
  { date: '1942-12-31', price: 33.85 },
  { date: '1943-12-31', price: 33.85 },
  { date: '1944-12-31', price: 33.85 },
  { date: '1945-12-31', price: 34.71 },
  { date: '1946-12-31', price: 34.71 },
  { date: '1947-12-31', price: 34.71 },
  { date: '1948-12-31', price: 34.71 },
  { date: '1949-12-31', price: 31.69 },
  { date: '1950-12-31', price: 34.72 },
  { date: '1951-12-31', price: 34.72 },
  { date: '1952-12-31', price: 34.60 },
  { date: '1953-12-31', price: 34.84 },
  { date: '1954-12-31', price: 35.04 },
  { date: '1955-12-31', price: 35.03 },
  { date: '1956-12-31', price: 34.99 },
  { date: '1957-12-31', price: 34.95 },
  { date: '1958-12-31', price: 35.10 },
  { date: '1959-12-31', price: 35.10 },
  { date: '1960-12-31', price: 35.27 },
  { date: '1961-12-31', price: 35.25 },
  { date: '1962-12-31', price: 35.23 },
  { date: '1963-12-31', price: 35.09 },
  { date: '1964-12-31', price: 35.10 },
  { date: '1965-12-31', price: 35.12 },
  { date: '1966-12-31', price: 35.13 },
  { date: '1967-12-31', price: 34.95 }
];

// CSV-CSV berikut di-bake saat Netlify build (lihat scripts/fetch-fred.sh):
//   /api/fred-gold.csv  - LBMA Gold Price AM Fix (USD/oz, harian, 1968+)
//   /api/fred-idr.csv   - Indonesian Rupiah per USD (DEXINUS, harian, 1971+)
