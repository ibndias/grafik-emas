(function () {
  const ctx = document.getElementById('chart').getContext('2d');
  const legendPriceEl = document.getElementById('legendPrice');
  const legendChangeEl = document.getElementById('legendChange');
  const currentRangeEl = document.getElementById('currentRange');

  let allData = [];
  let chart = null;
  let currentRangeKey = '10';

  function parseFredCSV(text) {
    const lines = text.trim().split('\n');
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, val] = lines[i].split(',');
      if (!date || !val || val === '.' || val === 'NA') continue;
      const price = parseFloat(val);
      if (Number.isFinite(price)) out.push({ date, price });
    }
    return out;
  }

  async function loadData() {
    try {
      const res = await fetch(window.FRED_CSV_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
      const text = await res.text();
      const fred = parseFredCSV(text);
      if (!fred.length) throw new Error('FRED returned empty data');
      return [...window.GOLD_STATIC, ...fred];
    } catch (err) {
      console.warn('FRED fetch failed, using static fallback only:', err);
      return [...window.GOLD_STATIC];
    }
  }

  function filterByYears(data, years) {
    if (years === 'all') return data;
    const last = new Date(data[data.length - 1].date);
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - parseInt(years, 10));
    return data.filter(d => new Date(d.date) >= cutoff);
  }

  function updateLegend(filtered) {
    if (filtered.length < 2) {
      legendPriceEl.textContent = filtered[0]?.price.toFixed(1) ?? '—';
      legendChangeEl.textContent = '—';
      return;
    }
    const last = filtered[filtered.length - 1];
    const first = filtered[0];
    const diff = last.price - first.price;
    const pct = (diff / first.price) * 100;
    const sign = diff >= 0 ? '+' : '';
    legendPriceEl.textContent = last.price.toLocaleString('en-US', {
      minimumFractionDigits: 1, maximumFractionDigits: 1
    });
    legendChangeEl.textContent = `${sign}${diff.toFixed(1)} (${sign}${pct.toFixed(1)}%)`;
    legendChangeEl.classList.toggle('up', diff >= 0);
  }

  function buildChart(filtered) {
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filtered.map(d => d.date),
        datasets: [{
          data: filtered.map(d => d.price),
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
              label: item => `USD ${item.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz`
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
              callback: v => v.toLocaleString('en-US')
            },
            border: { display: false }
          }
        }
      }
    });
  }

  function setRange(rangeKey) {
    currentRangeKey = rangeKey;
    const filtered = filterByYears(allData, rangeKey);
    buildChart(filtered);
    updateLegend(filtered);
    currentRangeEl.textContent = rangeKey === 'all' ? 'All' : `${rangeKey}Y`;
  }

  document.querySelectorAll('.ranges button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ranges button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setRange(btn.dataset.range);
    });
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = ['date,price_usd_per_oz', ...allData.map(d => `${d.date},${d.price}`)].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gold-prices.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  legendPriceEl.textContent = 'Loading...';
  loadData().then(data => {
    allData = data;
    setRange(currentRangeKey);
  });
})();
