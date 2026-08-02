/**
 * Shared score-over-time SVG charts (bite index / dive score).
 * Visual language matches the King Harbor tide plot: day/night bands, NOW line, 24h ticks.
 * Expects helpers from the dashboard (or pass overrides in opts).
 */
(function (global) {
  'use strict';

  function pick(opts, key, fallback) {
    if (opts && opts[key] != null) return opts[key];
    if (global[key] != null) return global[key];
    return fallback;
  }

  function findPeaks(pts, minScore, minSepMs) {
    const out = [];
    if (!pts || pts.length < 3) return out;
    const sep = minSepMs != null ? minSepMs : 6 * 3600000;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1].v, b = pts[i].v, c = pts[i + 1].v;
      if (b < minScore) continue;
      if (b >= a && b >= c) {
        if (out.length && pts[i].t - out[out.length - 1].t < sep) {
          if (b > out[out.length - 1].v) out[out.length - 1] = pts[i];
        } else {
          out.push(pts[i]);
        }
      }
    }
    return out;
  }

  /**
   * @param {object} opts
   * @param {HTMLElement|string} opts.host
   * @param {{t:number,v:number}[]} opts.pts
   * @param {number} [opts.tMin]
   * @param {number} [opts.tMax]
   * @param {string} [opts.yLabel]
   * @param {string} [opts.stroke]
   * @param {string} [opts.fillId]
   * @param {HTMLElement|string} [opts.nowEl]
   * @param {HTMLElement|string} [opts.metaEl]
   * @param {HTMLElement|string} [opts.noteEl]
   * @param {string} [opts.note]
   * @param {function(number):string} [opts.scoreColor]
   * @param {object} [opts.daily] sun daily for day/night bands
   * @param {number} [opts.goodAt] default 75
   * @param {number} [opts.fairAt] default 55
   * @param {boolean} [opts.markPeaks]
   * @param {number|null} [opts.highlightMs] plan-time instant to mark (hide when null/out of window)
   * @param {string} [opts.highlightLabel] default "PLAN"
   * @param {string} [opts.highlightColor] default cyan (distinct from NOW)
   */
  function renderScoreChart(opts) {
    opts = opts || {};
    const $ = pick(opts, '$', global.$) || (id => (typeof id === 'string' ? document.getElementById(id) : id));
    const host = typeof opts.host === 'string' ? $(opts.host) : opts.host;
    const nowEl = typeof opts.nowEl === 'string' ? $(opts.nowEl) : opts.nowEl;
    const metaEl = typeof opts.metaEl === 'string' ? $(opts.metaEl) : opts.metaEl;
    const noteEl = typeof opts.noteEl === 'string' ? $(opts.noteEl) : opts.noteEl;
    if (!host) return;

    const pts = (opts.pts || []).filter(p => p && isFinite(p.t) && isFinite(p.v));
    const clamp = pick(opts, 'clamp', (v, a, b) => Math.max(a, Math.min(b, v)));
    const f0 = pick(opts, 'f0', v => (v == null || !isFinite(v) ? '—' : String(Math.round(v))));
    const f1 = pick(opts, 'f1', v => (v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1)));
    const esc = pick(opts, 'esc', s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const fmtDayTime = pick(opts, 'fmtDayTime', t => {
      try { return new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }); }
      catch (e) { return String(t); }
    });
    const HR = pick(opts, 'HR', 3600000);
    const CHART = pick(opts, 'CHART', {
      now: '#e8ecff', good: '#3dff9a', fair: '#ffd966', poor: '#ff6644', muted: '#91a0b0'
    });
    const WX_C = pick(opts, 'WX_C', {
      day: 'rgba(24,34,48,0.42)', night: 'rgba(4,8,14,0.72)', sunMarker: '#91a0b0'
    });
    const scoreColor = opts.scoreColor || (v =>
      v >= (opts.goodAt != null ? opts.goodAt : 75) ? CHART.good
        : v >= (opts.fairAt != null ? opts.fairAt : 55) ? CHART.fair
          : CHART.poor);

    if (pts.length < 2) {
      host.innerHTML = '<div class="skel">Not enough forecast points for this window</div>';
      if (nowEl) nowEl.textContent = '—';
      if (metaEl) metaEl.innerHTML = '';
      if (noteEl && opts.note) noteEl.textContent = opts.note;
      return;
    }

    const dataMin = pts[0].t, dataMax = pts[pts.length - 1].t;
    const tMin = opts.tMin != null ? Math.max(opts.tMin, dataMin) : dataMin;
    const tMax = opts.tMax != null ? Math.min(opts.tMax, dataMax) : dataMax;
    const winPts = pts.filter(p => p.t >= tMin && p.t <= tMax);
    if (winPts.length < 2 || tMax <= tMin) {
      host.innerHTML = '<div class="skel">Forecast does not cover chart window</div>';
      if (nowEl) nowEl.textContent = '—';
      if (metaEl) metaEl.innerHTML = '';
      return;
    }

    const now = opts.nowMs != null ? opts.nowMs : Date.now();
    function valueAt(t) {
      let v = null;
      for (let i = 0; i < pts.length - 1; i++) {
        if (t >= pts[i].t && t <= pts[i + 1].t) {
          const r = (t - pts[i].t) / (pts[i + 1].t - pts[i].t || 1);
          v = pts[i].v + r * (pts[i + 1].v - pts[i].v);
          break;
        }
      }
      if (v == null) {
        let best = pts[0], bd = Math.abs(pts[0].t - t);
        for (const p of pts) {
          const d = Math.abs(p.t - t);
          if (d < bd) { best = p; bd = d; }
        }
        if (bd <= 1.5 * HR) v = best.v;
      }
      return v;
    }
    const nowV = valueAt(now);
    if (nowEl) {
      nowEl.textContent = nowV != null ? 'Now ' + f0(nowV) + '/100' : '—';
    }

    /* Extra top pad so NOW + PLAN labels can stack without clipping (.tide-chart overflow:hidden). */
    const W = 860, H = 280, padL = 46, padR = 14, padT = 48, padB = 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    let vMin = 0, vMax = 100;
    const xS = t => padL + (t - tMin) / (tMax - tMin) * plotW;
    const yS = v => padT + plotH - (v - vMin) / (vMax - vMin) * plotH;

    const stroke = opts.stroke || 'var(--accent)';
    const fillId = opts.fillId || ('scoreFill_' + Math.random().toString(36).slice(2, 8));
    const yLabel = opts.yLabel || 'score';

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    svg += '<defs><linearGradient id="' + fillId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="' + stroke + '" stop-opacity=".02"/>' +
      '</linearGradient></defs>';

    const daily = opts.daily;
    const dayNight = opts.dayNightBands || pick(opts, 'wxChartDayNightBands', null);
    const sunMark = opts.sunMarkers || pick(opts, 'wxChartSunMarkers', null);
    if (typeof dayNight === 'function' && daily) {
      svg = dayNight(svg, daily, xS, padT, padT + plotH, tMin, tMax);
    } else if (daily) {
      /* Minimal fallback band if helpers missing */
      svg += '<rect x="' + xS(tMin).toFixed(1) + '" y="' + padT + '" width="' + (xS(tMax) - xS(tMin)).toFixed(1) +
        '" height="' + plotH + '" fill="' + WX_C.day + '" opacity="0.35" pointer-events="none"/>';
    }
    if (typeof sunMark === 'function' && daily) {
      svg = sunMark(svg, daily, xS, padT, padT + plotH, tMin, tMax);
    }

    const goodAt = opts.goodAt != null ? opts.goodAt : 75;
    const fairAt = opts.fairAt != null ? opts.fairAt : 55;
    [[goodAt, CHART.good], [fairAt, CHART.fair]].forEach(([th, col]) => {
      const y = yS(th);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="' + col + '" stroke-width="1" stroke-dasharray="4 5" opacity="0.45"/>';
    });

    for (let v = 0; v <= 100; v += 25) {
      const y = yS(v);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="var(--line2)" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--ink3)" font-weight="500">' + v + '</text>';
    }

    const tickMs = 24 * HR;
    let tick = Math.ceil(tMin / tickMs) * tickMs;
    while (tick <= tMax) {
      const x = xS(tick);
      svg += '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (padT + plotH) +
        '" stroke="var(--line2)" stroke-width="1" stroke-dasharray="3 4"/>';
      svg += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--ink3)" font-weight="500">' +
        esc(fmtDayTime(new Date(tick))) + '</text>';
      tick += tickMs;
    }

    const line = winPts.map((p, i) => (i ? 'L' : 'M') + xS(p.t).toFixed(1) + ',' + yS(p.v).toFixed(1)).join(' ');
    const area = line + ' L' + xS(winPts[winPts.length - 1].t).toFixed(1) + ',' + (padT + plotH) +
      ' L' + xS(winPts[0].t).toFixed(1) + ',' + (padT + plotH) + ' Z';
    svg += '<path d="' + area + '" fill="url(#' + fillId + ')"/>';
    svg += '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';

    if (opts.markPeaks !== false) {
      const peaks = findPeaks(winPts, goodAt, 5 * HR);
      peaks.forEach(pk => {
        const x = xS(pk.t), y = yS(pk.v);
        const col = scoreColor(pk.v);
        let lx = x, anchor = 'middle';
        if (x < padL + 40) { lx = padL + 2; anchor = 'start'; }
        else if (x > W - padR - 40) { lx = W - padR - 2; anchor = 'end'; }
        svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="var(--card)" stroke="' + col + '" stroke-width="2"/>';
        svg += '<text x="' + lx.toFixed(1) + '" y="' + (y - 10) + '" text-anchor="' + anchor +
          '" font-size="11" fill="' + col + '" font-weight="700">' + f0(pk.v) + '</text>';
      });
    }

    if (now >= tMin && now <= tMax && nowV != null) {
      const nx = xS(now), ny = yS(nowV);
      svg += '<line x1="' + nx + '" y1="' + padT + '" x2="' + nx + '" y2="' + (padT + plotH) +
        '" stroke="' + CHART.now + '" stroke-width="2" opacity="0.95"/>';
      svg += '<circle cx="' + nx + '" cy="' + ny + '" r="6" fill="' + CHART.now + '" stroke="var(--card)" stroke-width="2"/>';
      svg += '<text x="' + nx + '" y="' + (padT - 4) + '" text-anchor="middle" font-size="11" fill="' + CHART.now + '" font-weight="bold">NOW</text>';
    }

    /* Plan-time cursor — same geometry as NOW; cyan dashed so it reads even when near NOW */
    const hlRaw = opts.highlightMs;
    const hl = (hlRaw != null && isFinite(+hlRaw)) ? +hlRaw : null;
    const hlLabel = opts.highlightLabel || 'PLAN';
    const hlColor = opts.highlightColor || CHART.feel || '#56d4e9';
    let hlShown = false;
    if (hl != null && hl >= tMin && hl <= tMax) {
      let hlV = valueAt(hl);
      /* In-window plan must always paint — sparse forecast gaps can miss the 1.5h nearest rule */
      if (hlV == null && pts.length) {
        let best = pts[0], bd = Math.abs(pts[0].t - hl);
        for (let i = 1; i < pts.length; i++) {
          const d = Math.abs(pts[i].t - hl);
          if (d < bd) { best = pts[i]; bd = d; }
        }
        hlV = best.v;
      }
      if (hlV != null) {
        hlShown = true;
        const hx = xS(hl), hy = yS(hlV);
        let labelY = padT - 6;
        /* Stack above NOW when cursors collide */
        if (now >= tMin && now <= tMax && Math.abs(hx - xS(now)) < 36) labelY = padT - 20;
        svg += '<line x1="' + hx + '" y1="' + padT + '" x2="' + hx + '" y2="' + (padT + plotH) +
          '" stroke="' + hlColor + '" stroke-width="2.5" stroke-dasharray="7 4" opacity="0.95"/>';
        svg += '<circle cx="' + hx + '" cy="' + hy + '" r="6" fill="' + hlColor + '" stroke="var(--card)" stroke-width="2"/>';
        svg += '<text x="' + hx + '" y="' + labelY + '" text-anchor="middle" font-size="11" fill="' + hlColor +
          '" font-weight="bold">' + esc(hlLabel) + '</text>';
      }
    }

    svg += '<text x="' + padL + '" y="' + (padT - 18) + '" font-size="10" fill="var(--ink3)" font-weight="600">' + esc(yLabel) + '</text>';
    svg += '</svg>';
    host.innerHTML = svg;

    if (metaEl) {
      metaEl.innerHTML =
        '<span><i style="background:' + CHART.now + '"></i> Now</span>' +
        (hlShown ? '<span><i style="background:' + hlColor + '"></i> ' + esc(hlLabel) + '</span>' : '') +
        '<span><i style="background:' + CHART.good + '"></i> ≥' + goodAt + ' hot</span>' +
        '<span><i style="background:' + CHART.fair + '"></i> ≥' + fairAt + ' fair</span>' +
        '<span><i style="background:' + WX_C.day + '"></i> Day</span>' +
        '<span><i style="background:' + WX_C.night + '"></i> Night</span>' +
        '<span>' + esc(fmtDayTime(new Date(tMin))) + ' → ' + esc(fmtDayTime(new Date(tMax))) + '</span>';
    }
    if (noteEl) {
      noteEl.textContent = opts.note || '';
      noteEl.hidden = !opts.note;
    }
  }

  global.BoatForecastCharts = {
    renderScoreChart,
    findPeaks
  };
})(typeof window !== 'undefined' ? window : globalThis);
