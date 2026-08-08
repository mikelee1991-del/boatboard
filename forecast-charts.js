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

  function svgEl(name, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        if (attrs[k] != null) el.setAttribute(k, String(attrs[k]));
      });
    }
    return el;
  }

  /**
   * Exact cursor marks for multi-series charts — no Y/X nudge of scores.
   * Equal scores share one (x,y); concentric rings keep each series color visible.
   * marks: [{ i, color, v, y }]
   */
  function exactSeriesMarkLayouts(marks) {
    if (!marks || !marks.length) return [];
    const sorted = marks.slice().sort((a, b) => a.i - b.i);
    const groups = [];
    sorted.forEach(m => {
      let g = null;
      for (let i = 0; i < groups.length; i++) {
        if (Math.abs(groups[i].v - m.v) < 0.51) { g = groups[i]; break; }
      }
      if (!g) {
        g = { v: m.v, y: m.y, members: [] };
        groups.push(g);
      }
      g.members.push(m);
    });
    const out = [];
    groups.forEach(g => {
      const n = g.members.length;
      /* Largest ring first so smaller rings paint on top at the same true Y */
      for (let k = n - 1; k >= 0; k--) {
        const m = g.members[k];
        const r = n === 1 ? (m.i === 0 ? 5 : 4) : (3.2 + k * 1.7);
        out.push({ i: m.i, color: m.color, v: m.v, y: g.y, r: r });
      }
    });
    return out;
  }

  function appendExactSeriesMarksDom(g, marks, x) {
    exactSeriesMarkLayouts(marks).forEach(m => {
      g.appendChild(svgEl('circle', {
        cx: x.toFixed(1),
        cy: m.y.toFixed(1),
        r: String(m.r),
        fill: m.color,
        stroke: 'var(--card)',
        'stroke-width': m.r >= 5 ? '1.5' : '1.25',
        'pointer-events': 'none'
      }));
    });
  }

  function exactSeriesMarksSvg(marks, x) {
    return exactSeriesMarkLayouts(marks).map(m =>
      '<circle cx="' + x.toFixed(1) + '" cy="' + m.y.toFixed(1) + '" r="' + m.r +
      '" fill="' + m.color + '" stroke="var(--card)" stroke-width="' +
      (m.r >= 5 ? '1.5' : '1.25') + '" pointer-events="none"/>'
    ).join('');
  }

  /**
   * Click / drag the PLAN cursor (or the plot track) to pick a trip time.
   * Live-previews the marker; commits via onHighlightChange(ms) on pointerup.
   * Optional ctx.seriesAt(t) keeps multi-series dots locked to exact scores while dragging.
   */
  function attachHighlightInteraction(host, ctx) {
    const svg = host.querySelector('svg');
    if (!svg || typeof ctx.onHighlightChange !== 'function') return;

    const {
      padL, padR, padT, plotW, plotH, W,
      tMin, tMax, xS, yS, valueAt,
      hlColor, hlLabel, nowMs, snapMs
    } = ctx;
    const clamp = ctx.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
    const step = snapMs != null ? snapMs : 15 * 60 * 1000;
    const showValueDot = ctx.showValueDot !== false;
    const seriesAt = typeof ctx.seriesAt === 'function' ? ctx.seriesAt : null;
    const onPreview = typeof ctx.onPreview === 'function' ? ctx.onPreview : null;

    function snapT(t) {
      return Math.round(t / step) * step;
    }
    function tFromClientX(clientX) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return tMin;
      const x = ((clientX - rect.left) / rect.width) * W;
      const raw = tMin + (x - padL) / (plotW || 1) * (tMax - tMin);
      return snapT(clamp(raw, tMin, tMax));
    }

    let planG = svg.querySelector('g.score-plan-cursor');
    if (!planG) {
      planG = svgEl('g', { class: 'score-plan-cursor', 'aria-hidden': 'true' });
      svg.appendChild(planG);
    }
    let marksG = svg.querySelector('g.score-plan-series-marks');
    if (!marksG && seriesAt) {
      marksG = svgEl('g', { class: 'score-plan-series-marks', 'aria-hidden': 'true' });
      if (planG.nextSibling) svg.insertBefore(marksG, planG.nextSibling);
      else svg.appendChild(marksG);
    }

    function paintPlanAt(t) {
      let v = valueAt(t);
      if (v == null && !seriesAt) return;
      const hx = xS(t);
      const hy = v != null ? yS(v) : padT + plotH / 2;
      let labelY = padT - 6;
      if (nowMs != null && nowMs >= tMin && nowMs <= tMax && Math.abs(hx - xS(nowMs)) < 36) {
        labelY = padT - 20;
      }
      while (planG.firstChild) planG.removeChild(planG.firstChild);
      planG.appendChild(svgEl('line', {
        x1: hx.toFixed(1), y1: padT, x2: hx.toFixed(1), y2: padT + plotH,
        stroke: hlColor, 'stroke-width': '2.5', 'stroke-dasharray': '7 4', opacity: '0.95',
        'pointer-events': 'none'
      }));
      /* Single-series: cyan value dot. Multi-series: series-colored dots carry the scores. */
      if (showValueDot && v != null) {
        planG.appendChild(svgEl('circle', {
          cx: hx.toFixed(1), cy: hy.toFixed(1), r: '6',
          fill: hlColor, stroke: 'var(--card)', 'stroke-width': '2',
          'pointer-events': 'none'
        }));
      }
      planG.appendChild(svgEl('text', {
        x: hx.toFixed(1), y: String(labelY), 'text-anchor': 'middle',
        'font-size': '11', fill: hlColor, 'font-weight': 'bold',
        'pointer-events': 'none'
      })).textContent = hlLabel;
      /* Wide vertical grab strip so the PLAN marker is easy to drag on touch */
      planG.appendChild(svgEl('rect', {
        class: 'score-plan-hit',
        x: (hx - 18).toFixed(1), y: padT, width: '36', height: String(plotH),
        fill: hlColor, 'fill-opacity': '0.001', stroke: 'none'
      }));
      planG.setAttribute('data-t', String(t));

      if (marksG && seriesAt) {
        while (marksG.firstChild) marksG.removeChild(marksG.firstChild);
        const marks = seriesAt(t) || [];
        appendExactSeriesMarksDom(marksG, marks, hx);
      }
      if (onPreview) onPreview(t);
    }

    /* Invisible plot track — tap / drag anywhere in the plot to move PLAN */
    let track = svg.querySelector('rect.score-plan-track');
    if (!track) {
      track = svgEl('rect', {
        class: 'score-plan-track',
        x: padL, y: padT, width: plotW, height: plotH,
        fill: 'transparent', stroke: 'none'
      });
      /* Under the series stroke but above day/night so clicks hit the track */
      const firstPath = svg.querySelector('path');
      if (firstPath && firstPath.parentNode === svg) svg.insertBefore(track, firstPath);
      else svg.insertBefore(track, planG);
    }

    host.classList.add('score-plan-interactive');
    const baseAria = (host.getAttribute('data-aria-base') || host.getAttribute('aria-label') || 'Score over time')
      .replace(/\s*—\s*drag PLAN.*$/i, '');
    host.setAttribute('data-aria-base', baseAria);
    host.setAttribute('aria-label', baseAria + ' — drag PLAN or tap the chart to set trip time');

    let dragging = false;
    let activeId = null;
    let lastT = ctx.highlightMs != null && isFinite(+ctx.highlightMs)
      ? snapT(clamp(+ctx.highlightMs, tMin, tMax))
      : null;

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      activeId = e.pointerId;
      host.classList.add('score-plan-dragging');
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      lastT = tFromClientX(e.clientX);
      paintPlanAt(lastT);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging || (activeId != null && e.pointerId !== activeId)) return;
      lastT = tFromClientX(e.clientX);
      paintPlanAt(lastT);
      e.preventDefault();
    }
    function onUp(e) {
      if (!dragging || (activeId != null && e.pointerId !== activeId)) return;
      dragging = false;
      host.classList.remove('score-plan-dragging');
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
      const t = lastT != null ? lastT : tFromClientX(e.clientX);
      activeId = null;
      if (t != null && isFinite(t)) ctx.onHighlightChange(t);
      e.preventDefault();
    }

    [track, planG].forEach(el => {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
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
   * @param {number} [opts.goodAt] default 82
   * @param {number} [opts.fairAt] default 55
   * @param {boolean} [opts.markPeaks]
   * @param {number|null} [opts.highlightMs] plan-time instant to mark (hide when null/out of window)
   * @param {string} [opts.highlightLabel] default "PLAN"
   * @param {string} [opts.highlightColor] default cyan (distinct from NOW)
   * @param {function(number):void} [opts.onHighlightChange] if set, PLAN is draggable / plot is tappable
   * @param {number} [opts.snapMs] time snap while dragging (default 15 min)
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
      v >= (opts.goodAt != null ? opts.goodAt : 82) ? CHART.good
        : v >= (opts.fairAt != null ? opts.fairAt : 55) ? CHART.fair
          : CHART.poor);

    host.classList.remove('score-plan-interactive', 'score-plan-dragging');

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
    const interactive = typeof opts.onHighlightChange === 'function';

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

    const goodAt = opts.goodAt != null ? opts.goodAt : 82;
    const fairAt = opts.fairAt != null ? opts.fairAt : 55;
    [[goodAt, CHART.good], [fairAt, CHART.fair]].forEach(([th, col]) => {
      const y = yS(th);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="' + col + '" stroke-width="1" stroke-dasharray="4 5" opacity="0.45" pointer-events="none"/>';
    });

    for (let v = 0; v <= 100; v += 25) {
      const y = yS(v);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="var(--line2)" stroke-width="1" pointer-events="none"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--ink3)" font-weight="500" pointer-events="none">' + v + '</text>';
    }

    const tickMs = 24 * HR;
    let tick = Math.ceil(tMin / tickMs) * tickMs;
    while (tick <= tMax) {
      const x = xS(tick);
      svg += '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (padT + plotH) +
        '" stroke="var(--line2)" stroke-width="1" stroke-dasharray="3 4" pointer-events="none"/>';
      svg += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--ink3)" font-weight="500" pointer-events="none">' +
        esc(fmtDayTime(new Date(tick))) + '</text>';
      tick += tickMs;
    }

    const line = winPts.map((p, i) => (i ? 'L' : 'M') + xS(p.t).toFixed(1) + ',' + yS(p.v).toFixed(1)).join(' ');
    const area = line + ' L' + xS(winPts[winPts.length - 1].t).toFixed(1) + ',' + (padT + plotH) +
      ' L' + xS(winPts[0].t).toFixed(1) + ',' + (padT + plotH) + ' Z';
    svg += '<path d="' + area + '" fill="url(#' + fillId + ')" pointer-events="none"/>';
    svg += '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>';

    if (opts.markPeaks !== false) {
      const peaks = findPeaks(winPts, goodAt, 5 * HR);
      peaks.forEach(pk => {
        const x = xS(pk.t), y = yS(pk.v);
        const col = scoreColor(pk.v);
        let lx = x, anchor = 'middle';
        if (x < padL + 40) { lx = padL + 2; anchor = 'start'; }
        else if (x > W - padR - 40) { lx = W - padR - 2; anchor = 'end'; }
        svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="var(--card)" stroke="' + col + '" stroke-width="2" pointer-events="none"/>';
        svg += '<text x="' + lx.toFixed(1) + '" y="' + (y - 10) + '" text-anchor="' + anchor +
          '" font-size="11" fill="' + col + '" font-weight="700" pointer-events="none">' + f0(pk.v) + '</text>';
      });
    }

    if (now >= tMin && now <= tMax && nowV != null) {
      const nx = xS(now), ny = yS(nowV);
      svg += '<line x1="' + nx + '" y1="' + padT + '" x2="' + nx + '" y2="' + (padT + plotH) +
        '" stroke="' + CHART.now + '" stroke-width="2" opacity="0.95" pointer-events="none"/>';
      svg += '<circle cx="' + nx + '" cy="' + ny + '" r="6" fill="' + CHART.now + '" stroke="var(--card)" stroke-width="2" pointer-events="none"/>';
      svg += '<text x="' + nx + '" y="' + (padT - 4) + '" text-anchor="middle" font-size="11" fill="' + CHART.now + '" font-weight="bold" pointer-events="none">NOW</text>';
    }

    /* Plan-time cursor — painted into a group so drag handlers can move it live */
    const hlRaw = opts.highlightMs;
    const hl = (hlRaw != null && isFinite(+hlRaw)) ? +hlRaw : null;
    const hlLabel = opts.highlightLabel || 'PLAN';
    const hlColor = opts.highlightColor || CHART.feel || '#56d4e9';
    let hlShown = false;
    let hlV = null;
    if (hl != null && hl >= tMin && hl <= tMax) {
      hlV = valueAt(hl);
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
        if (now >= tMin && now <= tMax && Math.abs(hx - xS(now)) < 36) labelY = padT - 20;
        svg += '<g class="score-plan-cursor" data-t="' + hl + '" aria-hidden="true">';
        svg += '<line x1="' + hx + '" y1="' + padT + '" x2="' + hx + '" y2="' + (padT + plotH) +
          '" stroke="' + hlColor + '" stroke-width="2.5" stroke-dasharray="7 4" opacity="0.95" pointer-events="none"/>';
        svg += '<circle cx="' + hx + '" cy="' + hy + '" r="6" fill="' + hlColor + '" stroke="var(--card)" stroke-width="2" pointer-events="none"/>';
        svg += '<text x="' + hx + '" y="' + labelY + '" text-anchor="middle" font-size="11" fill="' + hlColor +
          '" font-weight="bold" pointer-events="none">' + esc(hlLabel) + '</text>';
        if (interactive) {
          svg += '<rect class="score-plan-hit" x="' + (hx - 18).toFixed(1) + '" y="' + padT +
            '" width="36" height="' + plotH + '" fill="' + hlColor + '" fill-opacity="0.001" stroke="none"/>';
        }
        svg += '</g>';
      }
    } else if (interactive) {
      /* Empty cursor group so first tap can paint a preview before commit */
      svg += '<g class="score-plan-cursor" aria-hidden="true"></g>';
    }

    svg += '<text x="' + padL + '" y="' + (padT - 18) + '" font-size="10" fill="var(--ink3)" font-weight="600" pointer-events="none">' + esc(yLabel) + '</text>';
    svg += '</svg>';
    host.innerHTML = svg;

    if (interactive) {
      attachHighlightInteraction(host, {
        padL, padR, padT, plotW, plotH, W,
        tMin, tMax, xS, yS, valueAt, clamp,
        hlColor, hlLabel, nowMs: now,
        highlightMs: hlShown ? hl : null,
        snapMs: opts.snapMs,
        onHighlightChange: opts.onHighlightChange
      });
    }

    if (metaEl) {
      metaEl.innerHTML =
        '<span><i style="background:' + CHART.now + '"></i> Now</span>' +
        (hlShown || interactive
          ? '<span><i style="background:' + hlColor + '"></i> ' + esc(hlLabel) +
            (interactive ? ' · drag / tap chart' : '') + '</span>'
          : '') +
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

  const MULTI_SERIES_COLORS = [
    '#56d4e9', '#3dff9a', '#ffd966', '#ff8844', '#f0a0c0', '#a8d4ff', '#c4e86a',
    '#ffb070', '#7ec8e3', '#e8d48a'
  ];

  /**
   * Multi-location score-over-time chart (top plan picks).
   * @param {object} opts
   * @param {{id?:string,name:string,color?:string,pts:{t:number,v:number}[]}[]} opts.series
   * Same highlight / day-night / PLAN-drag options as renderScoreChart.
   */
  function renderMultiScoreChart(opts) {
    opts = opts || {};
    const $ = pick(opts, '$', global.$) || (id => (typeof id === 'string' ? document.getElementById(id) : id));
    const host = typeof opts.host === 'string' ? $(opts.host) : opts.host;
    const nowEl = typeof opts.nowEl === 'string' ? $(opts.nowEl) : opts.nowEl;
    const metaEl = typeof opts.metaEl === 'string' ? $(opts.metaEl) : opts.metaEl;
    const noteEl = typeof opts.noteEl === 'string' ? $(opts.noteEl) : opts.noteEl;
    if (!host) return;

    const clamp = pick(opts, 'clamp', (v, a, b) => Math.max(a, Math.min(b, v)));
    const f0 = pick(opts, 'f0', v => (v == null || !isFinite(v) ? '—' : String(Math.round(v))));
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

    host.classList.remove('score-plan-interactive', 'score-plan-dragging');

    const seriesIn = (opts.series || []).map((s, i) => ({
      id: s.id != null ? String(s.id) : String(i),
      name: s.name || ('Series ' + (i + 1)),
      color: s.color || MULTI_SERIES_COLORS[i % MULTI_SERIES_COLORS.length],
      pts: (s.pts || []).filter(p => p && isFinite(p.t) && isFinite(p.v))
        .slice()
        .sort((a, b) => a.t - b.t)
    })).filter(s => s.pts.length >= 2);

    if (!seriesIn.length) {
      host.innerHTML = '<div class="skel">Need ranked locations to compare scores over time</div>';
      if (nowEl) nowEl.textContent = '—';
      if (metaEl) metaEl.innerHTML = '';
      if (noteEl && opts.note) noteEl.textContent = opts.note;
      return;
    }

    let dataMin = Infinity, dataMax = -Infinity;
    seriesIn.forEach(s => {
      if (s.pts[0].t < dataMin) dataMin = s.pts[0].t;
      if (s.pts[s.pts.length - 1].t > dataMax) dataMax = s.pts[s.pts.length - 1].t;
    });
    const tMin = opts.tMin != null ? Math.max(opts.tMin, dataMin) : dataMin;
    const tMax = opts.tMax != null ? Math.min(opts.tMax, dataMax) : dataMax;
    if (!(tMax > tMin)) {
      host.innerHTML = '<div class="skel">Forecast does not cover chart window</div>';
      return;
    }

    function valueAtSeries(pts, t) {
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
    /* PLAN / NOW use the lead (#1) series for the marker Y position */
    function valueAt(t) {
      return valueAtSeries(seriesIn[0].pts, t);
    }

    const now = opts.nowMs != null ? opts.nowMs : Date.now();
    function topScoreBits(atT, n) {
      const lim = n != null ? n : 3;
      return seriesIn.slice(0, lim).map((s, i) => {
        const v = valueAtSeries(s.pts, atT);
        return v != null ? ('#' + (i + 1) + ' ' + f0(v)) : null;
      }).filter(Boolean);
    }
    function writeNowEl(planT) {
      if (!nowEl) return;
      const nowBits = topScoreBits(now, 3);
      const planBits = planT != null && isFinite(planT) ? topScoreBits(planT, 3) : [];
      let txt = nowBits.length ? ('Now ' + nowBits.join(' · ')) : '—';
      if (planBits.length) txt += ' · Plan ' + planBits.join(' · ');
      nowEl.textContent = txt;
    }
    const hlPreview = (opts.highlightMs != null && isFinite(+opts.highlightMs)) ? +opts.highlightMs : null;
    writeNowEl(hlPreview);

    /* padB only needs day labels — series key lives in meta (SVG key clipped after ~4 names). */
    const W = 860, H = 286, padL = 46, padR = 14, padT = 48, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const vMin = 0, vMax = 100;
    const xS = t => padL + (t - tMin) / (tMax - tMin) * plotW;
    const yS = v => padT + plotH - (v - vMin) / (vMax - vMin) * plotH;
    const yLabel = opts.yLabel || 'score';
    const interactive = typeof opts.onHighlightChange === 'function';
    const goodAt = opts.goodAt != null ? opts.goodAt : 82;
    const fairAt = opts.fairAt != null ? opts.fairAt : 55;
    const DASH = [null, '9 4', '3 3', '12 3 3 3', '2 2', '8 3 2 3', '14 4', '5 2 2 2', '10 2 2 2 2 2', '4 4'];

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

    const daily = opts.daily;
    const dayNight = opts.dayNightBands || pick(opts, 'wxChartDayNightBands', null);
    const sunMark = opts.sunMarkers || pick(opts, 'wxChartSunMarkers', null);
    if (typeof dayNight === 'function' && daily) {
      svg = dayNight(svg, daily, xS, padT, padT + plotH, tMin, tMax);
    } else if (daily) {
      svg += '<rect x="' + xS(tMin).toFixed(1) + '" y="' + padT + '" width="' + (xS(tMax) - xS(tMin)).toFixed(1) +
        '" height="' + plotH + '" fill="' + WX_C.day + '" opacity="0.35" pointer-events="none"/>';
    }
    if (typeof sunMark === 'function' && daily) {
      svg = sunMark(svg, daily, xS, padT, padT + plotH, tMin, tMax);
    }

    [[goodAt, CHART.good], [fairAt, CHART.fair]].forEach(([th, col]) => {
      const y = yS(th);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="' + col + '" stroke-width="1" stroke-dasharray="4 5" opacity="0.45" pointer-events="none"/>';
    });

    for (let v = 0; v <= 100; v += 25) {
      const y = yS(v);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
        '" stroke="var(--line2)" stroke-width="1" pointer-events="none"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--ink3)" font-weight="500" pointer-events="none">' + v + '</text>';
    }

    const tickMs = 24 * HR;
    let tick = Math.ceil(tMin / tickMs) * tickMs;
    while (tick <= tMax) {
      const x = xS(tick);
      svg += '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (padT + plotH) +
        '" stroke="var(--line2)" stroke-width="1" stroke-dasharray="3 4" pointer-events="none"/>';
      svg += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="var(--ink3)" font-weight="500" pointer-events="none">' +
        esc(fmtDayTime(new Date(tick))) + '</text>';
      tick += tickMs;
    }

    function marksAt(atT) {
      return seriesIn.map((s, i) => {
        const v = valueAtSeries(s.pts, atT);
        return v == null ? null : { i: i, color: s.color, v: v, y: yS(v) };
      }).filter(Boolean);
    }
    function paintSeriesDots(atT, xBase) {
      if (atT == null || !(atT >= tMin && atT <= tMax)) return '';
      return exactSeriesMarksSvg(marksAt(atT), xBase);
    }
    function countTiedScores(atT) {
      const marks = marksAt(atT);
      if (marks.length < 2) return 0;
      let ties = 0;
      for (let i = 0; i < marks.length; i++) {
        for (let j = i + 1; j < marks.length; j++) {
          if (Math.abs(marks[i].v - marks[j].v) < 0.51) { ties++; break; }
        }
      }
      return ties;
    }

    /* Draw #1 last so it sits on top; dash secondary lines so overlaps stay distinguishable */
    const drawOrder = seriesIn.map((_, i) => i).reverse();
    drawOrder.forEach(i => {
      const s = seriesIn[i];
      const winPts = s.pts.filter(p => p.t >= tMin && p.t <= tMax);
      if (winPts.length < 2) return;
      const line = winPts.map((p, j) => (j ? 'L' : 'M') + xS(p.t).toFixed(1) + ',' + yS(p.v).toFixed(1)).join(' ');
      const sw = i === 0 ? 2.8 : 2.1;
      const op = i === 0 ? '1' : '0.92';
      const dash = DASH[i % DASH.length];
      svg += '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="' + sw +
        '" stroke-linejoin="round" stroke-linecap="round" opacity="' + op + '"' +
        (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' pointer-events="none"/>';
      const last = winPts[winPts.length - 1];
      const lx = Math.min(xS(last.t), W - padR - 2);
      const ly = yS(last.v);
      svg += '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="' + (i === 0 ? 4.5 : 3.5) +
        '" fill="' + s.color + '" stroke="var(--card)" stroke-width="1.5" pointer-events="none"/>';
    });

    if (now >= tMin && now <= tMax) {
      const nx = xS(now);
      svg += '<line x1="' + nx + '" y1="' + padT + '" x2="' + nx + '" y2="' + (padT + plotH) +
        '" stroke="' + CHART.now + '" stroke-width="2" opacity="0.95" pointer-events="none"/>';
      svg += '<text x="' + nx + '" y="' + (padT - 4) + '" text-anchor="middle" font-size="11" fill="' + CHART.now +
        '" font-weight="bold" pointer-events="none">NOW</text>';
      svg += '<g class="score-now-series-marks" aria-hidden="true">' + paintSeriesDots(now, nx) + '</g>';
    }

    const hlRaw = opts.highlightMs;
    const hl = (hlRaw != null && isFinite(+hlRaw)) ? +hlRaw : null;
    const hlLabel = opts.highlightLabel || 'PLAN';
    const hlColor = opts.highlightColor || CHART.feel || '#56d4e9';
    let hlShown = false;
    if (hl != null && hl >= tMin && hl <= tMax) {
      hlShown = true;
      const hx = xS(hl);
      let labelY = padT - 6;
      if (now >= tMin && now <= tMax && Math.abs(hx - xS(now)) < 36) labelY = padT - 20;
      svg += '<g class="score-plan-cursor" data-t="' + hl + '" aria-hidden="true">';
      svg += '<line x1="' + hx + '" y1="' + padT + '" x2="' + hx + '" y2="' + (padT + plotH) +
        '" stroke="' + hlColor + '" stroke-width="2.5" stroke-dasharray="7 4" opacity="0.95" pointer-events="none"/>';
      /* No cyan value dot on multi charts — series colors are the score marks */
      svg += '<text x="' + hx + '" y="' + labelY + '" text-anchor="middle" font-size="11" fill="' + hlColor +
        '" font-weight="bold" pointer-events="none">' + esc(hlLabel) + '</text>';
      if (interactive) {
        svg += '<rect class="score-plan-hit" x="' + (hx - 18).toFixed(1) + '" y="' + padT +
          '" width="36" height="' + plotH + '" fill="' + hlColor + '" fill-opacity="0.001" stroke="none"/>';
      }
      svg += '</g>';
      svg += '<g class="score-plan-series-marks" aria-hidden="true">' + paintSeriesDots(hl, hx) + '</g>';
    } else if (interactive) {
      svg += '<g class="score-plan-cursor" aria-hidden="true"></g>';
      svg += '<g class="score-plan-series-marks" aria-hidden="true"></g>';
    }

    svg += '<text x="' + padL + '" y="' + (padT - 18) + '" font-size="10" fill="var(--ink3)" font-weight="600" pointer-events="none">' + esc(yLabel) + '</text>';

    svg += '</svg>';
    host.innerHTML = svg;

    if (interactive) {
      attachHighlightInteraction(host, {
        padL, padR, padT, plotW, plotH, W,
        tMin, tMax, xS, yS, valueAt, clamp,
        hlColor, hlLabel, nowMs: now,
        highlightMs: hlShown ? hl : null,
        snapMs: opts.snapMs,
        showValueDot: false,
        seriesAt: marksAt,
        onPreview: writeNowEl,
        onHighlightChange: opts.onHighlightChange
      });
    }

    const tieNow = countTiedScores(now);
    const tiePlan = hlShown ? countTiedScores(hl) : 0;
    const tieN = Math.max(tieNow, tiePlan);

    if (metaEl) {
      metaEl.innerHTML =
        '<span><i style="background:' + CHART.now + '"></i> Now</span>' +
        (hlShown || interactive
          ? '<span><i style="background:' + hlColor + '"></i> ' + esc(hlLabel) +
            (interactive ? ' · drag / tap chart' : '') + '</span>'
          : '') +
        seriesIn.map((s, i) =>
          '<span><i style="background:' + s.color + '"></i> #' + (i + 1) + ' ' + esc(s.name) + '</span>'
        ).join('') +
        '<span>' + esc(fmtDayTime(new Date(tMin))) + ' → ' + esc(fmtDayTime(new Date(tMax))) + '</span>' +
        (tieN
          ? '<span>Nested rings = matching scores at cursor (exact values, not spread)</span>'
          : '<span>Dots sit on exact scores at NOW/PLAN</span>');
    }
    if (noteEl) {
      const clarify = ' Cursor dots use exact scores — no nudge. Matching scores share one point (nested color rings).';
      const base = opts.note || '';
      noteEl.textContent = base + (base && !/exact scores/i.test(base) ? clarify : (!base ? clarify.trim() : ''));
      noteEl.hidden = !noteEl.textContent;
    }
  }

  global.BoatForecastCharts = {
    renderScoreChart,
    renderMultiScoreChart,
    findPeaks,
    MULTI_SERIES_COLORS
  };
})(typeof window !== 'undefined' ? window : globalThis);
