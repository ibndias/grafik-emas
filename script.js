(function () {
  const data = window.GOLD_DATA;
  const ctx = document.getElementById('chart').getContext('2d');

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = latest.price - prev.price;
  const changePct = (change / prev.price) * 100;

  document.getElementById('legendPrice').textContent = latest.price.toFixed(1);
  const legendChange = document.getElementById('legendChange');
  const sign = change >= 0 ? '+' : '';
  legendChange.textContent = `${sign}${change.toFixed(1)} (${sign}${changePct.toFixed(1)}%)`;
  legendChange.classList.toggle('up', change >= 0);

  function filterByYears(years) {
    if (years === 'all') return data;
    const cutoff = latest.year - years;
    return data.filter(d => d.year >= cutoff);
  }

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        data: data.map(d => d.price),
        borderColor: '#2c7be5',
        backgroundColor: 'rgba(44,123,229,0.05)',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
          ticks: { color: '#8892a0', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
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

  function setRange(rangeKey) {
    const filtered = rangeKey === 'all' ? data : filterByYears(parseInt(rangeKey, 10));
    chart.data.labels = filtered.map(d => d.year);
    chart.data.datasets[0].data = filtered.map(d => d.price);
    chart.update();
    const label = rangeKey === 'all' ? 'All' : `${rangeKey}Y`;
    document.getElementById('currentRange').textContent = label;
  }

  document.querySelectorAll('.ranges button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ranges button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setRange(btn.dataset.range);
    });
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = ['year,price_usd_per_oz', ...data.map(d => `${d.year},${d.price}`)].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gold-prices.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  setRange('10');
})();
