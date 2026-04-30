(function () {
  const OZ_TO_GRAM = 31.1034768;
  const ctx = document.getElementById('chart').getContext('2d');
  const legendPriceEl = document.getElementById('legendPrice');
  const legendChangeEl = document.getElementById('legendChange');
  const legendUnitEl = document.getElementById('legendUnit');
  const currentRangeEl = document.getElementById('currentRange');

  let goldData = [];
  let idrRateMap = new Map();
  let chart = null;
  let currentRangeKey = '10';
  let currentCurrency = 'IDR';

  function parseFredCSV(text) {
    const lines = text.trim().split('\n');
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, val] = lines[i].split(',');
      if (!date || !val || val === '.' || val === 'NA') continue;
      const num = parseFloat(val);
      if (Number.isFinite(num)) out.push({ date, value: num });
    }
    return out;
  }

  async function fetchCSV(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      const text = await res.text();
      const head = text.slice(0, 100).toUpperCase();
      if (!head.includes('DATE')) return null;
      return parseFredCSV(text);
    } catch {
      return null;
    }
  }

  async function loadAll() {
    const [goldFred, idrFred] = await Promise.all([
      fetchCSV('/api/gold.csv'),
      fetchCSV('/api/idr.csv')
    ]);

    if (goldFred && goldFred.length) {
      // Live data wins over static fallback when dates overlap.
      const byDate = new Map();
      for (const d of window.GOLD_STATIC) byDate.set(d.date, d.price);
      for (const d of goldFred) byDate.set(d.date, d.value);
      goldData = Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, price]) => ({ date, price }));
    } else {
      console.warn('Gold live data unavailable; using static fallback only.');
      goldData = window.GOLD_STATIC.map(d => ({ date: d.date, price: d.price }));
    }

    if (idrFred && idrFred.length) {
      // Forward-fill rates so weekend/holiday gold prices still get a rate.
      let lastRate = null;
      const sorted = idrFred.slice().sort((a, b) => a.date.localeCompare(b.date));
      for (const r of sorted) {
        lastRate = r.value;
        idrRateMap.set(r.date, lastRate);
      }
    } else {
      console.warn('IDR FRED data unavailable; IDR mode will be disabled.');
    }
  }

  function nearestIdrRate(dateStr) {
    if (idrRateMap.has(dateStr)) return idrRateMap.get(dateStr);
    // Walk back up to ~10 days to find nearest prior trading day rate.
    const d = new Date(dateStr);
    for (let i = 0; i < 10; i++) {
      d.setDate(d.getDate() - 1);
      const key = d.toISOString().slice(0, 10);
      if (idrRateMap.has(key)) return idrRateMap.get(key);
    }
    return null;
  }

  function projectData(data, currency) {
    if (currency === 'USD') {
      return data.map(d => ({ date: d.date, value: d.price }));
    }
    // IDR mode: convert USD/oz to IDR/gram. Skip rows without a rate (pre-1971).
    const out = [];
    for (const d of data) {
      const rate = nearestIdrRate(d.date);
      if (rate == null) continue;
      out.push({ date: d.date, value: (d.price * rate) / OZ_TO_GRAM });
    }
    return out;
  }

  function filterByYears(data, years) {
    if (!data.length) return data;
    if (years === 'all') return data;
    const last = new Date(data[data.length - 1].date);
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - parseInt(years, 10));
    return data.filter(d => new Date(d.date) >= cutoff);
  }

  function formatPrice(v, currency) {
    if (currency === 'USD') {
      return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return 'Rp ' + Math.round(v).toLocaleString('id-ID');
  }

  function updateLegend(filtered, currency) {
    legendUnitEl.textContent = currency === 'USD' ? 'Gold (USD/t.oz)' : 'Gold (IDR/gram)';
    if (!filtered.length) {
      legendPriceEl.textContent = '—';
      legendChangeEl.textContent = '—';
      return;
    }
    if (filtered.length < 2) {
      legendPriceEl.textContent = formatPrice(filtered[0].value, currency);
      legendChangeEl.textContent = '—';
      return;
    }
    const last = filtered[filtered.length - 1];
    const first = filtered[0];
    const diff = last.value - first.value;
    const pct = (diff / first.value) * 100;
    const sign = diff >= 0 ? '+' : '';
    legendPriceEl.textContent = formatPrice(last.value, currency);
    const diffStr = currency === 'USD'
      ? `${sign}${diff.toFixed(1)}`
      : `${sign}Rp ${Math.round(diff).toLocaleString('id-ID')}`;
    legendChangeEl.textContent = `${diffStr} (${sign}${pct.toFixed(1)}%)`;
    legendChangeEl.classList.toggle('up', diff >= 0);
  }

  function buildChart(filtered, currency) {
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filtered.map(d => d.date),
        datasets: [{
          data: filtered.map(d => d.value),
          borderColor: '#2c7be5',
          backgroundColor: 'rgba(44,123,229,0.05)',
          borderWidth: 1.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.1,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#222',
            bodyColor: '#2c7be5',
            borderColor: '#e3e6eb',
            borderWidth: 1,
            displayColors: false,
            padding: 8,
            callbacks: {
              title: items => items[0].label,
              label: item => {
                const v = item.parsed.y;
                if (currency === 'USD') {
                  return `USD ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz`;
                }
                return `Rp ${Math.round(v).toLocaleString('id-ID')}/gram`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f0f2f5', drawTicks: false },
            ticks: {
              color: '#8892a0',
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
              callback: function (val) {
                const label = this.getLabelForValue(val);
                return label?.slice(0, 4);
              }
            },
            border: { display: false }
          },
          y: {
            position: 'right',
            grid: { color: '#f0f2f5', drawTicks: false },
            ticks: {
              color: '#8892a0',
              font: { size: 11 },
              callback: v => currency === 'USD'
                ? v.toLocaleString('en-US')
                : Math.round(v).toLocaleString('id-ID')
            },
            border: { display: false }
          }
        }
      }
    });
  }

  function render() {
    const projected = projectData(goldData, currentCurrency);
    const filtered = filterByYears(projected, currentRangeKey);
    buildChart(filtered, currentCurrency);
    updateLegend(filtered, currentCurrency);
    currentRangeEl.textContent = currentRangeKey === 'all' ? 'All' : `${currentRangeKey}Y`;
  }

  document.querySelectorAll('.ranges button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ranges button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRangeKey = btn.dataset.range;
      render();
    });
  });

  document.querySelectorAll('.ccy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ccy = btn.dataset.ccy;
      if (ccy === 'IDR' && idrRateMap.size === 0) {
        alert('Data kurs IDR belum tersedia (build belum berhasil fetch FRED DEXINUS).');
        return;
      }
      document.querySelectorAll('.ccy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCurrency = ccy;
      render();
    });
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const projected = projectData(goldData, currentCurrency);
    const header = currentCurrency === 'USD' ? 'date,price_usd_per_oz' : 'date,price_idr_per_gram';
    const rows = [header, ...projected.map(d => `${d.date},${d.value.toFixed(2)}`)].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gold-prices-${currentCurrency.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  legendPriceEl.textContent = 'Loading...';
  loadAll().then(() => {
    if (idrRateMap.size === 0) {
      // Auto-fallback ke USD jika data IDR tidak tersedia.
      currentCurrency = 'USD';
      document.querySelectorAll('.ccy-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.ccy === 'USD');
      });
    }
    render();
  });
})();
