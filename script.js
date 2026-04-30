(function () {
  'use strict';

  const OZ_TO_GRAM = 31.1034768;
  const ctx = document.getElementById('chart').getContext('2d');
  const legendPriceEl = document.getElementById('legendPrice');
  const legendChangeEl = document.getElementById('legendChange');
  const legendUnitEl = document.getElementById('legendUnit');
  const currentRangeEl = document.getElementById('currentRange');
  const todayLabelEl = document.getElementById('todayLabel');
  const buildInfoEl = document.getElementById('buildInfo');

  let goldData = [];
  let idrRateMap = new Map();
  let chart = null;
  let currentRangeKey = '10';
  let currentCurrency = 'IDR';

  const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];

  // ---------- CSV Parsing ----------

  function parseCSV(text) {
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
      const bust = `${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(url + bust, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const head = text.slice(0, 100).toUpperCase();
      if (!head.includes('DATE')) return null;
      return parseCSV(text);
    } catch {
      return null;
    }
  }

  async function fetchBuildInfo() {
    try {
      const res = await fetch(`/api/build-info.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ---------- Data Loading ----------

  async function loadAll() {
    const [gold, idr, buildInfo] = await Promise.all([
      fetchCSV('/api/gold.csv'),
      fetchCSV('/api/idr.csv'),
      fetchBuildInfo()
    ]);

    if (gold && gold.length) {
      const byDate = new Map();
      for (const d of window.GOLD_STATIC) byDate.set(d.date, d.price);
      for (const d of gold) byDate.set(d.date, d.value);
      goldData = Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, price]) => ({ date, price }));
    } else {
      console.warn('Gold live data unavailable; using static fallback only.');
      goldData = window.GOLD_STATIC.map(d => ({ date: d.date, price: d.price }));
    }

    if (idr && idr.length) {
      for (const r of idr) idrRateMap.set(r.date, r.value);
    }

    return buildInfo;
  }

  // ---------- Data Projection ----------

  function nearestIdrRate(dateStr) {
    if (idrRateMap.has(dateStr)) return idrRateMap.get(dateStr);
    const d = new Date(dateStr);
    for (let i = 0; i < 14; i++) {
      d.setDate(d.getDate() - 1);
      const key = d.toISOString().slice(0, 10);
      if (idrRateMap.has(key)) return idrRateMap.get(key);
    }
    return null;
  }

  function projectData(data, currency) {
    if (currency === 'USD') return data.map(d => ({ date: d.date, value: d.price }));
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

  // ---------- Formatting ----------

  function formatPrice(v, currency) {
    if (currency === 'USD') {
      return '$' + v.toLocaleString('en-US', {
        minimumFractionDigits: 0, maximumFractionDigits: 2
      });
    }
    return 'Rp ' + Math.round(v).toLocaleString('id-ID');
  }

  function formatChange(diff, currency) {
    const sign = diff >= 0 ? '+' : '\u2212';
    const abs = Math.abs(diff);
    if (currency === 'USD') {
      return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }
    return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
  }

  function formatDateLong(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y) return dateStr;
    return `${d || 15} ${MONTHS_ID[(m || 1) - 1]} ${y}`;
  }

  function formatCompactIDR(v) {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' M';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2) + ' jt';
    if (v >= 1_000) return Math.round(v / 1_000) + ' rb';
    return Math.round(v).toLocaleString('id-ID');
  }

  function formatCompactUSD(v) {
    if (v >= 1000) return '$' + (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'k';
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  // ---------- UI Updates ----------

  function setTodayLabel() {
    if (!todayLabelEl || !goldData.length) return;
    const lastDate = goldData[goldData.length - 1].date;
    todayLabelEl.textContent = formatDateLong(lastDate);
  }

  function updateLegend(filtered, currency) {
    legendUnitEl.textContent = currency === 'USD' ? 'USD / oz' : 'IDR / gram';

    // Clear existing children
    while (legendChangeEl.firstChild) legendChangeEl.removeChild(legendChangeEl.firstChild);

    if (!filtered.length) {
      legendPriceEl.textContent = '\u2014';
      legendChangeEl.textContent = '\u2014';
      legendChangeEl.className = 'hero-change neutral';
      return;
    }

    if (filtered.length < 2) {
      legendPriceEl.textContent = formatPrice(filtered[0].value, currency);
      legendChangeEl.textContent = '';
      legendChangeEl.className = 'hero-change neutral';
      return;
    }

    const last = filtered[filtered.length - 1];
    const first = filtered[0];
    const diff = last.value - first.value;
    const pct = (diff / first.value) * 100;

    legendPriceEl.textContent = formatPrice(last.value, currency);

    const pctSign = pct >= 0 ? '+' : '\u2212';
    const rangeLabel = currentRangeKey === 'all' ? 'sejak 1833' : currentRangeKey + 'Y';
    const changeText = `${formatChange(diff, currency)} (${pctSign}${Math.abs(pct).toFixed(1)}%) \u00B7 ${rangeLabel}`;

    // Build arrow element
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.setAttribute('aria-hidden', 'true');
    legendChangeEl.appendChild(arrow);

    // Append text
    legendChangeEl.appendChild(document.createTextNode(changeText));

    legendChangeEl.className = 'hero-change' + (diff >= 0 ? ' up' : '');
  }

  // ---------- Chart ----------

  function buildChart(filtered, currency) {
    if (chart) chart.destroy();

    const css = getComputedStyle(document.documentElement);
    const lineColor = css.getPropertyValue('--line').trim() || '#1A1915';
    const accent = css.getPropertyValue('--accent').trim() || '#C2724D';
    const inkSoft = css.getPropertyValue('--ink-soft').trim() || '#4A4A45';
    const muted = css.getPropertyValue('--muted').trim() || '#8A8A82';
    const ruleSoft = css.getPropertyValue('--rule-soft').trim() || '#EFECE3';
    const card = css.getPropertyValue('--card').trim() || '#FFFFFF';

    const canvasEl = ctx.canvas;
    const grad = ctx.createLinearGradient(0, 0, 0, canvasEl.clientHeight || 260);
    grad.addColorStop(0, css.getPropertyValue('--line-fill-top').trim() || 'rgba(194, 114, 77, 0.14)');
    grad.addColorStop(1, css.getPropertyValue('--line-fill-bottom').trim() || 'rgba(194, 114, 77, 0)');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filtered.map(d => d.date),
        datasets: [{
          data: filtered.map(d => d.value),
          borderColor: lineColor,
          backgroundColor: grad,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: accent,
          pointHoverBorderColor: card,
          pointHoverBorderWidth: 2,
          tension: 0.2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 12, right: 4, bottom: 4, left: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: card,
            titleColor: inkSoft,
            bodyColor: lineColor,
            titleFont: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '500' },
            bodyFont: { family: 'Source Serif 4, Georgia, serif', size: 14, weight: '500' },
            borderColor: ruleSoft,
            borderWidth: 1,
            displayColors: false,
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 8,
            caretPadding: 10,
            callbacks: {
              title: function(items) { return formatDateLong(items[0].label); },
              label: function(item) {
                var v = item.parsed.y;
                if (currency === 'USD') {
                  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / oz';
                }
                return 'Rp ' + Math.round(v).toLocaleString('id-ID') + ' / gram';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: muted,
              font: { family: 'Inter, system-ui, sans-serif', size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
              padding: 6,
              callback: function (val) {
                var label = this.getLabelForValue(val);
                return label ? label.slice(0, 4) : '';
              }
            },
            border: { display: false }
          },
          y: {
            position: 'right',
            grid: { color: ruleSoft, drawTicks: false },
            ticks: {
              color: muted,
              font: { family: 'Inter, system-ui, sans-serif', size: 10 },
              padding: 6,
              maxTicksLimit: 5,
              callback: function(v) {
                return currency === 'USD' ? formatCompactUSD(v) : formatCompactIDR(v);
              }
            },
            border: { display: false }
          }
        }
      }
    });
  }

  // ---------- Render ----------

  function render() {
    var projected = projectData(goldData, currentCurrency);
    var filtered = filterByYears(projected, currentRangeKey);
    buildChart(filtered, currentCurrency);
    updateLegend(filtered, currentCurrency);
    currentRangeEl.textContent = currentRangeKey === 'all' ? 'All' : currentRangeKey + 'Y';
  }

  // ---------- Event Handlers ----------

  // Range buttons
  document.querySelectorAll('.ranges button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.ranges button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentRangeKey = btn.dataset.range;
      render();
    });
  });

  // Currency toggle
  document.querySelectorAll('.ccy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var ccy = btn.dataset.ccy;
      if (ccy === 'IDR' && idrRateMap.size === 0) {
        alert('Data kurs IDR belum tersedia.');
        return;
      }
      document.querySelectorAll('.ccy-btn').forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      currentCurrency = ccy;
      render();
    });
  });

  // Export CSV
  document.getElementById('exportBtn').addEventListener('click', function() {
    var projected = projectData(goldData, currentCurrency);
    var header = currentCurrency === 'USD' ? 'date,price_usd_per_oz' : 'date,price_idr_per_gram';
    var rows = [header].concat(projected.map(function(d) { return d.date + ',' + d.value.toFixed(2); })).join('\n');
    var blob = new Blob([rows], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'harga-emas-' + currentCurrency.toLowerCase() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Handle dark mode changes — rebuild chart gradient
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      if (goldData.length) render();
    });
  }

  // ---------- Init ----------

  loadAll().then(function(buildInfo) {
    // Mark loaded to hide skeletons
    document.body.classList.add('loaded');

    if (idrRateMap.size === 0) {
      currentCurrency = 'USD';
      document.querySelectorAll('.ccy-btn').forEach(function(b) {
        var isUSD = b.dataset.ccy === 'USD';
        b.classList.toggle('active', isUSD);
        b.setAttribute('aria-checked', String(isUSD));
      });
    }

    setTodayLabel();
    render();

    if (buildInfoEl && buildInfo) {
      var built = (buildInfo.built_at || '').slice(0, 10);
      buildInfoEl.textContent = 'Data terakhir diperbarui ' + built;
    }
  });
})();
