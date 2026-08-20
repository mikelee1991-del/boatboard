/**
 * BoatBoard Fishing Effort — VesselTracker heat parity (filters + 150 ft AIS clusters).
 * Data: mikelee1991-del.github.io/vesseltracker/data/
 */
(function (global) {
  'use strict';

  const VT_DATA = 'https://mikelee1991-del.github.io/vesseltracker/data/';
  const SPECIES_GROUPS_STORAGE_KEY = 'vesseltracker.species_groups.v1';

  let effortMap = null;
  let _metricOverride = null;
  let deps = { $: (id) => document.getElementById(id), store: null, esc: (s) => String(s ?? ''), fmtCoord: (n) => String(n) };
  const vtState = {
    meta: null,
    locations: [],
    spotsDates: [],
    speciesCatalog: [],
    unknownSpeciesVisits: 0,
    speciesGroupsDefault: null,
    speciesGroups: null,
    heatLayer: null,
    heatMarkerLayer: null,
    renderTimer: null,
    loaded: false,
    loading: null,
    hasFittedBounds: false,
  };

  const el = (id) => deps.$(id);
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d));

  function dateAt(dates, idx) {
    if (!dates.length) return null;
    return dates[Math.max(0, Math.min(dates.length - 1, idx))];
  }

  function syncDualRange(prefix) {
    const startEl = el(prefix + 'DateStart');
    const endEl = el(prefix + 'DateEnd');
    if (!startEl || !endEl) return { start: null, end: null };
    let a = Number(startEl.value);
    let b = Number(endEl.value);
    if (a > b) {
      if (startEl === document.activeElement) b = a;
      else a = b;
      startEl.value = a;
      endEl.value = b;
    }
    const max = Number(startEl.max) || 1;
    const fill = el(prefix + 'TrackFill');
    if (fill) {
      fill.style.left = (a / max * 100) + '%';
      fill.style.width = ((b - a) / max * 100) + '%';
    }
    const dates = vtState.spotsDates;
    const sl = el(prefix + 'DateStartLabel');
    const elbl = el(prefix + 'DateEndLabel');
    if (sl) sl.textContent = dateAt(dates, a) || '—';
    if (elbl) elbl.textContent = dateAt(dates, b) || '—';
    return { start: dateAt(dates, a), end: dateAt(dates, b) };
  }

  function setupDualRange(prefix, dates, onChange) {
    const startEl = el(prefix + 'DateStart');
    const endEl = el(prefix + 'DateEnd');
    if (!startEl || !endEl || !dates.length) return;
    const max = Math.max(0, dates.length - 1);
    startEl.min = 0; endEl.min = 0;
    startEl.max = max; endEl.max = max;
    startEl.value = 0;
    endEl.value = max;
    syncDualRange(prefix);
    const handler = () => { syncDualRange(prefix); if (onChange) onChange(); };
    startEl.oninput = handler;
    endEl.oninput = handler;
  }

  function vtClearHeat(map) {
    map = map || effortMap;
    if (!map) return;
    if (map._vtHeatLayer) {
      try { map.removeLayer(map._vtHeatLayer); } catch (_) {}
      map._vtHeatLayer = null;
    }
    if (map._vtHeatMarkers) {
      try { map.removeLayer(map._vtHeatMarkers); } catch (_) {}
      map._vtHeatMarkers = null;
    }
    vtState.heatLayer = null;
    vtState.heatMarkerLayer = null;
  }


const UNKNOWN_FISH = "Unknown fish";
    const SPECIES_GROUP_PREFIX = "group:";
    const SPECIES_ALIASES = {
      "Vermillion Rockfish": "Vermilion Rockfish",
    };

    function normalizeSpecies(name, aliasExtra) {
      const raw = (name || "").trim();
      if (!raw) return UNKNOWN_FISH;
      const aliasMap = {
        ...SPECIES_ALIASES,
        ...((vtState.speciesGroups && vtState.speciesGroups.aliases) || {}),
        ...(aliasExtra || {}),
      };
      return aliasMap[raw] || raw;
    }

    function selectedValues(selectEl) {
      if (!selectEl) return [];
      return [...selectEl.selectedOptions].map((o) => o.value).filter((v) => v !== "");
    }

    function clearMultiSelect(selectEl) {
      if (!selectEl) return;
      [...selectEl.options].forEach((o) => { o.selected = false; });
    }

    function isSpeciesGroupKey(key) {
      return String(key || "").startsWith(SPECIES_GROUP_PREFIX);
    }

    function speciesGroupId(key) {
      return String(key || "").slice(SPECIES_GROUP_PREFIX.length);
    }

    function speciesGroupKey(id) {
      return `${SPECIES_GROUP_PREFIX}${id}`;
    }

    function cloneSpeciesGroups(payload) {
      return JSON.parse(JSON.stringify(payload || { version: 1, aliases: {}, groups: [] }));
    }

    function normalizeGroupPayload(payload) {
      const out = cloneSpeciesGroups(payload);
      out.version = Number(out.version) || 1;
      out.aliases = out.aliases && typeof out.aliases === "object" ? out.aliases : {};
      out.groups = Array.isArray(out.groups) ? out.groups : [];
      out.groups = out.groups.map((g, i) => ({
        id: String(g.id || `group_${i + 1}`).trim() || `group_${i + 1}`,
        label: String(g.label || g.id || `Group ${i + 1}`).trim(),
        kind: g.kind === "habitat" ? "habitat" : "type",
        notes: g.notes || "",
        members: [...new Set((g.members || []).map((m) => normalizeSpecies(m, out.aliases)).filter((m) => m && m !== UNKNOWN_FISH))],
      }));
      return out;
    }

    function findSpeciesGroup(id) {
      return (vtState.speciesGroups?.groups || []).find((g) => g.id === id) || null;
    }

    function labelForSpeciesKey(key) {
      if (!key) return "";
      if (key === UNKNOWN_FISH) return UNKNOWN_FISH;
      if (isSpeciesGroupKey(key)) {
        const g = findSpeciesGroup(speciesGroupId(key));
        return g ? g.label : speciesGroupId(key);
      }
      return key;
    }

    function expandSpeciesKeys(speciesKeyOrKeys) {
      const keys = asSpeciesKeys(speciesKeyOrKeys);
      if (!keys.length) return [];
      const out = new Set();
      for (const key of keys) {
        if (isSpeciesGroupKey(key)) {
          const g = findSpeciesGroup(speciesGroupId(key));
          if (g) g.members.forEach((m) => out.add(normalizeSpecies(m)));
          continue;
        }
        out.add(key === UNKNOWN_FISH ? UNKNOWN_FISH : normalizeSpecies(key));
      }
      return [...out];
    }

    function selectionSummary(values, emptyLabel = "all") {
      if (!values.length) return emptyLabel;
      const labels = values.map(labelForSpeciesKey);
      if (labels.length === 1) return labels[0];
      if (labels.length === 2) return labels.join(", ");
      return `${labels[0]} +${labels.length - 1}`;
    }

    function syncMultiSummary(selectId, summaryId) {
      const summary = el(summaryId);
      if (!summary) return;
      summary.textContent = selectionSummary(selectedValues(el(selectId)));
    }

    function syncAllMultiSummaries() {
      syncMultiSummary("boatFilter", "boatFilterSummary");
      syncMultiSummary("speciesFilter", "speciesFilterSummary");
      syncMultiSummary("courseBoatFilter", "courseBoatFilterSummary");
      syncMultiSummary("heatBoatFilter", "heatBoatFilterSummary");
      syncMultiSummary("heatSpeciesFilter", "heatSpeciesFilterSummary");
    }

    function visitHasSpeciesBreakdown(v) {
      return Array.isArray(v.species) && v.species.length > 0;
    }

    function visitSpeciesCounts(v) {
      const counts = {};
      if (!visitHasSpeciesBreakdown(v)) {
        const n = Number(v.attributed_fish ?? v.total_fish_kept ?? 0) || 0;
        counts[UNKNOWN_FISH] = n;
        return counts;
      }
      for (const s of v.species) {
        const name = normalizeSpecies(s.species);
        counts[name] = (counts[name] || 0) + (Number(s.count) || 0);
      }
      return counts;
    }

    function mergeSpeciesCounts(into, from) {
      for (const [k, v] of Object.entries(from || {})) {
        into[k] = (into[k] || 0) + v;
      }
      return into;
    }

    function asSpeciesKeys(speciesKeyOrKeys) {
      if (Array.isArray(speciesKeyOrKeys)) return speciesKeyOrKeys.filter(Boolean);
      if (speciesKeyOrKeys) return [speciesKeyOrKeys];
      return [];
    }

    function visitMatchesSpeciesKeys(v, speciesKeys) {
      const keys = asSpeciesKeys(speciesKeys);
      if (!keys.length) return true;
      const wantsUnknown = keys.includes(UNKNOWN_FISH);
      const expanded = expandSpeciesKeys(keys.filter((k) => k !== UNKNOWN_FISH));
      if (!expanded.length) return !visitHasSpeciesBreakdown(v);
      if (wantsUnknown && !visitHasSpeciesBreakdown(v)) return true;
      const counts = visitSpeciesCounts(v);
      return expanded.some((k) => (counts[k] || 0) > 0 || Object.prototype.hasOwnProperty.call(counts, k));
    }

    function speciesFishForLoc(loc, speciesKeyOrKeys) {
      const counts = loc.species_counts || {};
      const keys = asSpeciesKeys(speciesKeyOrKeys);
      if (!keys.length) {
        return Object.values(counts).reduce((a, b) => a + b, 0);
      }
      const expanded = expandSpeciesKeys(keys);
      return expanded.reduce((sum, k) => sum + (counts[k] || 0), 0);
    }

    function speciesFilterLabel(speciesKeys) {
      const keys = asSpeciesKeys(speciesKeys);
      if (!keys.length) return "";
      return ` · ${selectionSummary(keys)}`;
    }

    function speciesFilterHtml(speciesNames, unknownVisits) {
      const groups = vtState.speciesGroups?.groups || [];
      const typeGroups = groups.filter((g) => g.kind === "type");
      const habitatGroups = groups.filter((g) => g.kind === "habitat");
      const parts = [];
      parts.push(`<option value="${UNKNOWN_FISH}">${UNKNOWN_FISH}${unknownVisits ? ` (${unknownVisits} visits)` : ""}</option>`);
      if (typeGroups.length) {
        parts.push('<optgroup label="By type">');
        for (const g of typeGroups) {
          parts.push(
            `<option value="${speciesGroupKey(g.id)}">${g.label} (${g.members.length})</option>`
          );
        }
        parts.push("</optgroup>");
      }
      if (habitatGroups.length) {
        parts.push('<optgroup label="By habitat">');
        for (const g of habitatGroups) {
          parts.push(
            `<option value="${speciesGroupKey(g.id)}">${g.label} (${g.members.length})</option>`
          );
        }
        parts.push("</optgroup>");
      }
      parts.push('<optgroup label="Individual species">');
      for (const s of speciesNames) {
        parts.push(`<option value="${s}">${s}</option>`);
      }
      parts.push("</optgroup>");
      return parts.join("");
    }

    function refreshSpeciesFilterOptions() {
      const names = vtState.speciesCatalog || [];
      const unknownVisits = vtState.unknownSpeciesVisits || 0;
      const html = speciesFilterHtml(names, unknownVisits);
      const sel = el("fishEffortSpeciesFilter");
      if (!sel) return;
      const keepHeat = selectedValues(sel);
      sel.innerHTML = html;
      const heatSet = new Set([...sel.options].map((o) => o.value));
      [...sel.options].forEach((o) => { o.selected = keepHeat.includes(o.value) && heatSet.has(o.value); });
      syncMultiSummary("fishEffortBoatFilter", "fishEffortBoatSummary");
      syncMultiSummary("fishEffortSpeciesFilter", "fishEffortSpeciesSummary");
    }

    function slugifyGroupId(label) {
      return String(label || "group")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "group";
    }

    function uniqueGroupId(base, existing) {
      let id = base || "group";
      let n = 2;
      while (existing.has(id)) {
        id = `${base}_${n}`;
        n += 1;
      }
      existing.add(id);
      return id;
    }

    function readGroupsFromEditor() {
      const cards = [...el("speciesGroupsEditor").querySelectorAll(".group-card")];
      const used = new Set();
      const groups = cards.map((card, i) => {
        const label = (card.querySelector(".group-label")?.value || "").trim() || `Group ${i + 1}`;
        const kind = card.querySelector(".group-kind")?.value === "habitat" ? "habitat" : "type";
        const notes = (card.querySelector(".group-notes")?.value || "").trim();
        const membersRaw = card.querySelector(".group-members")?.value || "";
        const members = [...new Set(
          membersRaw
            .split(/[\n,]+/)
            .map((m) => normalizeSpecies(m, vtState.speciesGroups?.aliases))
            .filter((m) => m && m !== UNKNOWN_FISH)
        )];
        const preferred = (card.dataset.groupId || slugifyGroupId(label)).trim();
        const id = uniqueGroupId(preferred || slugifyGroupId(label), used);
        return { id, label, kind, notes, members };
      });
      return normalizeGroupPayload({
        ...(vtState.speciesGroups || {}),
        groups,
      });
    }

    function renderSpeciesGroupsEditor() {
      const host = el("speciesGroupsEditor");
      const groups = vtState.speciesGroups?.groups || [];
      const catalogHint = (vtState.speciesCatalog || []).slice(0, 12).join(", ");
      host.innerHTML = groups.map((g) => `
        <article class="group-card" data-group-id="${g.id}">
          <div class="row2">
            <div>
              <label>Label</label>
              <input class="group-label" type="text" value="${g.label.replace(/"/g, "&quot;")}" />
            </div>
            <div>
              <label>Kind</label>
              <select class="group-kind">
                <option value="type" ${g.kind === "type" ? "selected" : ""}>Type (e.g. Rockfish)</option>
                <option value="habitat" ${g.kind === "habitat" ? "selected" : ""}>Habitat (e.g. Bottom fish)</option>
              </select>
            </div>
          </div>
          <div style="margin-top:0.45rem">
            <label>Members (comma or newline)</label>
            <textarea class="group-members">${(g.members || []).join(", ")}</textarea>
            <p class="meta">Known species include: ${catalogHint}${vtState.speciesCatalog.length > 12 ? "…" : ""}</p>
          </div>
          <div style="margin-top:0.45rem">
            <label>Notes</label>
            <input class="group-notes" type="text" value="${(g.notes || "").replace(/"/g, "&quot;")}" />
          </div>
          <div class="modal-actions" style="margin:0.5rem 0 0">
            <button type="button" class="secondary group-remove">Remove group</button>
          </div>
        </article>
      `).join("") || "<p class='status'>No groups yet — add a type or habitat group.</p>";

      host.querySelectorAll(".group-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.closest(".group-card")?.remove();
          el("speciesGroupsStatus").textContent = "Removed locally — Save in browser to keep, or Close to discard unsaved editor edits after reload.";
        });
      });
    }

    function setSpeciesGroups(payload, { persist = false, source = "", silent = false } = {}) {
      vtState.speciesGroups = normalizeGroupPayload(payload);
      if (persist) {
        try {
          localStorage.setItem(SPECIES_GROUPS_STORAGE_KEY, JSON.stringify(vtState.speciesGroups));
        } catch (err) {
          console.warn("Could not save species groups", err);
        }
      }
      refreshSpeciesFilterOptions();
      if (el("speciesGroupsStatus")) {
        const nType = vtState.speciesGroups.groups.filter((g) => g.kind === "type").length;
        const nHab = vtState.speciesGroups.groups.filter((g) => g.kind === "habitat").length;
        el("speciesGroupsStatus").textContent =
          `${vtState.speciesGroups.groups.length} groups (${nType} type · ${nHab} habitat)` +
          (source ? ` · ${source}` : "");
      }
      if (!silent) scheduleFishEffortRender();
    }

    function openSpeciesGroupsModal() {
      el("speciesGroupsModal").hidden = false;
      renderSpeciesGroupsEditor();
      const nType = (vtState.speciesGroups?.groups || []).filter((g) => g.kind === "type").length;
      const nHab = (vtState.speciesGroups?.groups || []).filter((g) => g.kind === "habitat").length;
      el("speciesGroupsStatus").textContent =
        `${(vtState.speciesGroups?.groups || []).length} groups (${nType} type · ${nHab} habitat) · edit & save to override defaults in this browser`;
    }

    function closeSpeciesGroupsModal() {
      el("speciesGroupsModal").hidden = true;
    }

    function addSpeciesGroup(kind) {
      const draft = readGroupsFromEditor();
      const used = new Set(draft.groups.map((g) => g.id));
      const label = kind === "habitat" ? "New habitat group" : "New type group";
      draft.groups.push({
        id: uniqueGroupId(slugifyGroupId(label), used),
        label,
        kind,
        notes: "",
        members: [],
      });
      vtState.speciesGroups = draft;
      renderSpeciesGroupsEditor();
      el("speciesGroupsStatus").textContent = `Added ${kind} group — fill members, then Save in browser`;
    }

    async function loadSpeciesGroups() {
      let shipped = { version: 1, aliases: {}, groups: [] };
      try {
        shipped = await (await fetch(VT_DATA + "species_groups.json")).json();
      } catch (err) {
        console.warn("species_groups.json missing", err);
      }
      vtState.speciesGroupsDefault = normalizeGroupPayload(shipped);
      let local = null;
      try {
        const raw = localStorage.getItem(SPECIES_GROUPS_STORAGE_KEY);
        if (raw) local = JSON.parse(raw);
      } catch (err) {
        console.warn("Bad local species groups", err);
      }
      if (local) {
        setSpeciesGroups(local, { source: "browser override", silent: true });
      } else {
        setSpeciesGroups(vtState.speciesGroupsDefault, { source: "shipped defaults", silent: true });
      }
    }

    function topSpeciesLabel(loc, limit = 3) {
      const entries = Object.entries(loc.species_counts || {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      if (!entries.length) {
        return loc.has_unknown_fish ? UNKNOWN_FISH : "No species listed";
      }
      return entries.slice(0, limit)
        .map(([name, n]) => `${fmt(n, 0)} ${name}`)
        .join(" · ");
    }

    function percentile(sorted, p) {
      if (!sorted.length) return 0;
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
      return sorted[idx];
    }

    function meanDwellShare(visits) {
      const shares = (visits || []).map((v) => v.dwell_share).filter((x) => x != null);
      return shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
    }

    /** Spot-choice metrics (computed client-side so filters still apply). */
    const PRIMARY_DWELL_SHARE = 0.25;
    const SHRINK_PRIOR_N0 = 10;
    /** Half-width of the seasonal calendar window (±X days around today's month/day). */
    const SEASONAL_HALF_WINDOW_DAYS = 30;

    function addDaysIso(iso, deltaDays) {
      if (!iso) return null;
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isNaN(d.getTime())) return null;
      d.setUTCDate(d.getUTCDate() + deltaDays);
      return d.toISOString().slice(0, 10);
    }

    function todayIsoPacific() {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch (_) {
        return new Date().toISOString().slice(0, 10);
      }
    }

    function parseIsoParts(iso) {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      const [y, m, d] = iso.split("-").map(Number);
      return { y, m, d };
    }

    function daysInMonth(year, month) {
      return new Date(Date.UTC(year, month, 0)).getUTCDate();
    }

    function isoFromYmd(year, month, day) {
      const dim = daysInMonth(year, month);
      const d = Math.min(Math.max(1, day), dim);
      return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    function clipDateWindow(start, end, rangeStart, rangeEnd) {
      let a = start;
      let b = end;
      if (!a || !b) return null;
      if (rangeStart && a < rangeStart) a = rangeStart;
      if (rangeEnd && b > rangeEnd) b = rangeEnd;
      if (a > b) return null;
      return { start: a, end: b };
    }

    /**
     * Same-season windows inside the date slider:
     * - current year: trailing X days from today (no future)
     * - prior years: ±X days around today's month/day
     */
    function seasonalWindows({ today, halfDays = SEASONAL_HALF_WINDOW_DAYS, rangeStart, rangeEnd } = {}) {
      const todayParts = parseIsoParts(today);
      if (!todayParts) return [];
      const { y: ty, m: tm, d: td } = todayParts;
      const y0 = rangeStart ? (parseIsoParts(rangeStart)?.y ?? ty) : ty;
      const y1 = rangeEnd ? (parseIsoParts(rangeEnd)?.y ?? ty) : ty;
      const windows = [];
      for (let y = y0; y <= y1; y++) {
        if (y > ty) continue;
        if (y === ty) {
          const start = addDaysIso(today, -halfDays);
          const w = clipDateWindow(start, today, rangeStart, rangeEnd);
          if (w) windows.push({ ...w, kind: "trailing", year: y });
        } else {
          const center = isoFromYmd(y, tm, td);
          const start = addDaysIso(center, -halfDays);
          const end = addDaysIso(center, halfDays);
          const w = clipDateWindow(start, end, rangeStart, rangeEnd);
          if (w) windows.push({ ...w, kind: "prior", year: y });
        }
      }
      return windows;
    }

    function dateInWindows(date, windows) {
      if (!date || !windows?.length) return false;
      return windows.some((w) => date >= w.start && date <= w.end);
    }

    function formatSeasonWindows(windows, { max = 4 } = {}) {
      if (!windows?.length) return "none in slider";
      const shown = windows.slice(-max).map((w) => `${w.start}→${w.end}`);
      const more = windows.length > max ? ` (+${windows.length - max} earlier)` : "";
      return shown.join("; ") + more;
    }

    function visitAnglerDwellHours(v) {
      if (v?.attributed_angler_dwell_hours != null) {
        return Number(v.attributed_angler_dwell_hours);
      }
      const dm = Number(v?.duration_min) || 0;
      const anglers = Number(v?.anglers) || 0;
      return dm > 0 && anglers > 0 ? anglers * (dm / 60) : 0;
    }

    function visitStoppedFph(v) {
      const hours = visitAnglerDwellHours(v);
      if (!(hours > 0)) return null;
      return (Number(v.attributed_fish) || 0) / hours;
    }

    function tripStoppedFphFromVisit(v) {
      if (v?.fish_per_person_stopped_hour != null) {
        return Number(v.fish_per_person_stopped_hour);
      }
      const fpp = v?.fish_per_person;
      const dwell = Number(v?.trip_offshore_dwell_min);
      if (fpp == null || !(dwell > 0)) return null;
      return fpp / (dwell / 60);
    }

    function rateFromVisitsStopped(visits) {
      let fish = 0;
      let hours = 0;
      for (const v of visits || []) {
        fish += Number(v.attributed_fish) || 0;
        hours += visitAnglerDwellHours(v);
      }
      return hours > 0 ? fish / hours : null;
    }

    function visitAttrFph(v) {
      const hours = Number(v?.attributed_angler_hours) || 0;
      if (!(hours > 0)) return null;
      return (Number(v.attributed_fish) || 0) / hours;
    }

    function rateFromVisits(visits) {
      let fish = 0;
      let hours = 0;
      for (const v of visits || []) {
        fish += Number(v.attributed_fish) || 0;
        hours += Number(v.attributed_angler_hours) || 0;
      }
      return hours > 0 ? fish / hours : null;
    }

    function asOfFromVisits(visits, preferred) {
      if (preferred) return preferred;
      let max = null;
      for (const v of visits || []) {
        if (v.date && (!max || v.date > max)) max = v.date;
      }
      return max;
    }

    function applyShrunkRate(locs, rateField, outField, n0 = SHRINK_PRIOR_N0) {
      const rates = locs
        .map((l) => l[rateField])
        .filter((x) => x != null && Number.isFinite(x));
      const prior = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
      for (const loc of locs) {
        const r = loc[rateField];
        const n = loc.n_boat_days || 0;
        if (r == null || !(n > 0)) {
          loc[outField] = null;
        } else {
          loc[outField] = (n / (n + n0)) * r + (n0 / (n + n0)) * prior;
        }
      }
      return prior;
    }

    function applyShrunkFph(locs, n0 = SHRINK_PRIOR_N0) {
      applyShrunkRate(locs, "dwell_attributed_fph", "shrunk_dwell_fph", n0);
      applyShrunkRate(locs, "stopped_attributed_fph", "shrunk_stopped_fph", n0);
      return locs;
    }

    function aggregateFromVisits(base, visits, opts = {}) {
      const fpp = visits.map((v) => v.fish_per_person).filter((x) => x != null);
      const fph = visits.map((v) => v.fish_per_person_hour).filter((x) => x != null);
      const stoppedTripFph = visits.map(tripStoppedFphFromVisit).filter((x) => x != null);
      const fishSum = visits.reduce((a, v) => a + (v.attributed_fish || 0), 0);
      const hoursSum = visits.reduce((a, v) => a + (v.attributed_angler_hours || 0), 0);
      const dwellHoursSum = visits.reduce((a, v) => a + visitAnglerDwellHours(v), 0);
      const boats = [...new Set(visits.map((v) => v.boat_name))].sort();
      const species_counts = {};
      let has_unknown_fish = false;
      for (const v of visits) {
        if (!visitHasSpeciesBreakdown(v)) has_unknown_fish = true;
        mergeSpeciesCounts(species_counts, visitSpeciesCounts(v));
      }

      const primaryVisits = visits.filter((v) => (Number(v.dwell_share) || 0) >= PRIMARY_DWELL_SHARE);
      const visitRates = visits.map(visitAttrFph).filter((x) => x != null).sort((a, b) => a - b);
      const visitStoppedRates = visits.map(visitStoppedFph).filter((x) => x != null).sort((a, b) => a - b);
      const today = opts.today || todayIsoPacific();
      const seasonWindows = seasonalWindows({
        today,
        halfDays: SEASONAL_HALF_WINDOW_DAYS,
        rangeStart: opts.rangeStart || null,
        rangeEnd: opts.rangeEnd || null,
      });
      const seasonVisits = visits.filter((v) => dateInWindows(v.date, seasonWindows));

      return {
        ...base,
        visits,
        n_stops: visits.length,
        n_boat_days: visits.length,
        n_boats: boats.length,
        n_days: new Set(visits.map((v) => v.date)).size,
        boats,
        total_dwell_min: visits.reduce((a, v) => a + (v.duration_min || 0), 0),
        mean_trip_fpp: fpp.length ? fpp.reduce((a, b) => a + b, 0) / fpp.length : null,
        mean_trip_fph: fph.length ? fph.reduce((a, b) => a + b, 0) / fph.length : null,
        mean_trip_stopped_fph: stoppedTripFph.length
          ? stoppedTripFph.reduce((a, b) => a + b, 0) / stoppedTripFph.length
          : null,
        mean_dwell_share: meanDwellShare(visits),
        dwell_attributed_fph: hoursSum > 0 ? fishSum / hoursSum : null,
        stopped_attributed_fph: dwellHoursSum > 0 ? fishSum / dwellHoursSum : null,
        primary_dwell_fph: rateFromVisits(primaryVisits),
        primary_stopped_fph: rateFromVisitsStopped(primaryVisits),
        primary_n_boat_days: primaryVisits.length,
        visit_fph_median: visitRates.length ? percentile(visitRates, 0.5) : null,
        visit_fph_p25: visitRates.length ? percentile(visitRates, 0.25) : null,
        visit_stopped_fph_p25: visitStoppedRates.length ? percentile(visitStoppedRates, 0.25) : null,
        season_dwell_fph: rateFromVisits(seasonVisits),
        season_stopped_fph: rateFromVisitsStopped(seasonVisits),
        season_n_boat_days: seasonVisits.length,
        season_as_of: today,
        season_windows: seasonWindows,
        species_counts,
        has_unknown_fish,
      };
    }

    function fishEffortDateBounds() {
      return syncDualRange("fishEffort");
    }

    function vtHeatIntensity(loc, metric, speciesKeys) {
      if (metric === "dwell") return loc.total_dwell_min || 0;
      if (metric === "visits") return loc.n_boat_days || 0;
      if (metric === "fish") {
        if (asSpeciesKeys(speciesKeys).length) return speciesFishForLoc(loc, speciesKeys);
        const fromVisits = (loc.visits || []).reduce((a, v) => a + (Number(v.attributed_fish) || 0), 0);
        if (fromVisits > 0) return fromVisits;
        return Object.values(loc.species_counts || {}).reduce((a, b) => a + b, 0);
      }
      if (metric === "dwell_fph") return loc.dwell_attributed_fph || 0;
      if (metric === "stopped_fph") return loc.stopped_attributed_fph || 0;
      if (metric === "shrunk_fph") return loc.shrunk_dwell_fph || 0;
      if (metric === "shrunk_stopped_fph") return loc.shrunk_stopped_fph || 0;
      if (metric === "primary_fph") return loc.primary_dwell_fph || 0;
      if (metric === "primary_stopped_fph") return loc.primary_stopped_fph || 0;
      if (metric === "trip_stopped_fph") return loc.mean_trip_stopped_fph || 0;
      if (metric === "consistent_fph") return loc.visit_fph_p25 || 0;
      if (metric === "season_fph") return loc.season_dwell_fph || 0;
      if (metric === "fpp") return loc.mean_trip_fpp || 0;
      return 0;
    }

    function metricSortValue(loc, key, speciesKeys) {
      if (key === "visits") return loc.n_boat_days || 0;
      if (key === "fpp") return loc.mean_trip_fpp;
      if (key === "fph") return loc.mean_trip_fph;
      if (key === "dwell_share") return loc.mean_dwell_share;
      if (key === "species_fish") return speciesFishForLoc(loc, speciesKeys);
      if (key === "dwell_fph") return loc.dwell_attributed_fph;
      if (key === "stopped_fph") return loc.stopped_attributed_fph;
      if (key === "shrunk_fph") return loc.shrunk_dwell_fph;
      if (key === "shrunk_stopped_fph") return loc.shrunk_stopped_fph;
      if (key === "primary_fph") return loc.primary_dwell_fph;
      if (key === "primary_stopped_fph") return loc.primary_stopped_fph;
      if (key === "trip_stopped_fph") return loc.mean_trip_stopped_fph;
      if (key === "consistent_fph") return loc.visit_fph_p25;
      if (key === "season_fph") return loc.season_dwell_fph;
      if (key === "dwell") return loc.total_dwell_min || 0;
      return loc.total_dwell_min || 0;
    }

    function vtLocationsForHeat() {
      const boats = selectedValues(el("fishEffortBoatFilter"));
      const speciesKeys = selectedValues(el("fishEffortSpeciesFilter"));
      const { start, end } = fishEffortDateBounds();

      const locs = vtState.locations
        .map((loc) => {
          if (start && loc.last_visit_date && loc.last_visit_date < start) return null;
          if (end && loc.first_visit_date && loc.first_visit_date > end) return null;
          let visits = loc.visits || [];
          if (start || end) {
            visits = visits.filter((v) => (!start || v.date >= start) && (!end || v.date <= end));
          }
          if (boats.length) visits = visits.filter((v) => boats.includes(v.boat_name));
          if (speciesKeys.length) visits = visits.filter((v) => visitMatchesSpeciesKeys(v, speciesKeys));
          if (!visits.length) return null;
          return aggregateFromVisits(loc, visits, { rangeStart: start || null, rangeEnd: end || null });
        })
        .filter(Boolean);
      applyShrunkFph(locs);
      return locs;
    }


    /** Ceiling for the current filtered heat sample (auto-rescales with boat/species/date). */
    function heatDataMax(sortedIntensities) {
      if (!sortedIntensities.length) return 1;
      const hi = sortedIntensities[sortedIntensities.length - 1];
      if (!(hi > 0)) return 1e-9;
      // Small selections: stretch to the true max so one boat/species still hits full hot.
      if (sortedIntensities.length <= 8) return hi;
      const p95 = percentile(sortedIntensities, 0.95) || hi;
      // Ignore a few extreme parks so the rest of the filter still has color range.
      return Math.max(p95, hi * 0.12, 1e-9);
    }

    function syncHeatMaxLabel(hotThreshold, dataMax, metric) {
      const node = el("fishEffortMaxVal");
      if (!node) return;
      const decimals = metric === "visits" || metric === "dwell" ? 0 : 2;
      node.textContent = `${Number(hotThreshold).toFixed(2)} · auto max ${fmt(dataMax, decimals)}`;
    }

    const HEAT_RADIUS_MIN = 4;
    const HEAT_BLUR_MIN = 3;

    /** Tighten heat kernels when zoomed in or spots are well separated (higher effective resolution). */
    function heatKernelPx(baseRadius, baseBlur, points) {
      const radiusEl = el("fishEffortRadius");
      const blurEl = el("fishEffortBlur");
      const radiusFloor = Math.max(HEAT_RADIUS_MIN, Number(radiusEl && radiusEl.min) || HEAT_RADIUS_MIN);
      const blurFloor = Math.max(HEAT_BLUR_MIN, Number(blurEl && blurEl.min) || HEAT_BLUR_MIN);
      const radiusAtMin = baseRadius <= radiusFloor;
      const blurAtMin = baseBlur <= blurFloor;
      // At the minimum setting, keep that axis exact so the map shows min radius/blur.
      if (radiusAtMin && blurAtMin) {
        return { radius: radiusFloor, blur: blurFloor };
      }
      if (!effortMap || typeof effortMap.getZoom !== "function") {
        return {
          radius: Math.max(radiusFloor, Math.round(baseRadius)),
          blur: Math.max(blurFloor, Math.round(baseBlur)),
        };
      }

      const zoom = effortMap && effortMap.getZoom ? effortMap.getZoom() : 10;
      // Prefer sharper kernels as zoom rises (leaflet.heat radius is screen pixels).
      const zoomT = Math.max(0, Math.min(1, (zoom - 10) / 5));
      let radius = radiusAtMin ? radiusFloor : baseRadius * (1 - 0.35 * zoomT);
      let blur = blurAtMin ? blurFloor : baseBlur * (1 - 0.4 * zoomT);

      // If median nearest-neighbor gap on screen ≫ kernel, shrink further so blobs don't smear.
      if ((!radiusAtMin || !blurAtMin) && points.length >= 8) {
        const sample = points.length > 120
          ? points.filter((_, i) => i % Math.ceil(points.length / 120) === 0)
          : points;
        const gaps = [];
        for (let i = 0; i < sample.length; i++) {
          let best = Infinity;
          const a = effortMap.latLngToLayerPoint([sample[i][0], sample[i][1]]);
          for (let j = 0; j < sample.length; j++) {
            if (i === j) continue;
            const b = effortMap.latLngToLayerPoint([sample[j][0], sample[j][1]]);
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < best) best = d;
          }
          if (Number.isFinite(best)) gaps.push(best);
        }
        gaps.sort((a, b) => a - b);
        const medianGap = gaps[Math.floor(gaps.length / 2)] || 0;
        if (medianGap > 2.5 * baseRadius) {
          const room = Math.min(0.45, (medianGap / baseRadius - 2.5) / 8);
          if (!radiusAtMin) radius *= 1 - room;
          if (!blurAtMin) blur *= 1 - room;
        }
      }

      return {
        radius: Math.max(radiusFloor, Math.round(radius)),
        blur: Math.max(blurFloor, Math.round(blur)),
      };
    }

    function formatHeatKernelLabel(base, effective, floor) {
      const atMin = base <= floor;
      if (effective != null && effective !== base) {
        return `${base} → ${effective} px${atMin ? " (min)" : ""}`;
      }
      return atMin ? `${base} px (min)` : `${base} px`;
    }

    function syncHeatKernelLabels(baseRadius, baseBlur, effective) {
      const rEl = el("fishEffortRadiusVal");
      const bEl = el("fishEffortBlurVal");
      if (rEl) {
        rEl.textContent = formatHeatKernelLabel(
          baseRadius,
          effective ? effective.radius : null,
          HEAT_RADIUS_MIN
        );
      }
      if (bEl) {
        bEl.textContent = formatHeatKernelLabel(
          baseBlur,
          effective ? effective.blur : null,
          HEAT_BLUR_MIN
        );
      }
    }

    function intensityIsRate(metric) {
      return metric !== "visits" && metric !== "dwell" && metric !== "fish";
    }

    function intensityStatLabel(metric) {
      if (metric === "dwell") return "Dwell min";
      if (metric === "visits") return "Boat-days";
      if (metric === "fish") return "Fish";
      if (metric === "fpp") return "Mean FPP";
      return "Mean FPH";
    }

    function vtRenderHeatCore(opts) {
      opts = opts || {};
      const updateUi = opts.updateUi !== false;
      if (!effortMap) return;
      vtClearHeat(effortMap);
      const locs = vtLocationsForHeat();
      const metric = _metricOverride || (el("fishEffortMetric") && el("fishEffortMetric").value) || 'shrunk_fph';
      const speciesKeys = selectedValues(el("fishEffortSpeciesFilter"));
      const boats = selectedValues(el("fishEffortBoatFilter"));
      const baseRadius = Number(el("fishEffortRadius")?.value) || HEAT_RADIUS_MIN;
      const baseBlur = Number(el("fishEffortBlur")?.value) || HEAT_BLUR_MIN;
      const hotThreshold = Number(el("fishEffortMax")?.value) || 0.6;
      const heatOpacityPct = Math.max(15, Math.min(100, Number(el("fishEffortOpacity")?.value) || 80));
      const minOpacity = heatOpacityPct / 100;
      const showMarkers = !!(el("fishEffortShowMarkers") && el("fishEffortShowMarkers").checked);
      if (el("fishEffortOpacityVal")) el("fishEffortOpacityVal").textContent = `${heatOpacityPct}%`;

      const scored = locs.map((loc) => {
        const intensity = vtHeatIntensity(loc, metric, speciesKeys);
        return { loc, intensity };
      }).filter((x) => x.intensity > 0 && x.loc.lat != null && x.loc.lon != null);

      const intensities = scored.map((x) => x.intensity).sort((a, b) => a - b);
      const dataMax = heatDataMax(intensities);
      // Normalize to the current filter so boat/species subselects re-stretch the temperature scale.
      const points = scored.map(({ loc, intensity }) => [
        loc.lat,
        loc.lon,
        Math.min(intensity / dataMax, 4),
      ]);
      const { radius, blur } = heatKernelPx(baseRadius, baseBlur, points);
      syncHeatKernelLabels(baseRadius, baseBlur, { radius, blur });
      syncHeatMaxLabel(hotThreshold, dataMax, metric);

      if (points.length && typeof L.heatLayer === "function") {
        vtState.heatLayer = L.heatLayer(points, {
          radius,
          blur,
          maxZoom: 18,
          minOpacity,
          max: Math.max(0.05, hotThreshold),
          gradient: {
            0.0: "#0b3d4a",
            0.35: "#17687a",
            0.55: "#c4a574",
            0.75: "#c47a3a",
            1.0: "#b54a2a",
          },
        }).addTo(effortMap);
        effortMap._vtHeatLayer = vtState.heatLayer;
      }

      if (showMarkers && scored.length && !_metricOverride) {
        vtState.heatMarkerLayer = L.featureGroup().addTo(effortMap);
        effortMap._vtHeatMarkers = vtState.heatMarkerLayer;
        scored.forEach(({ loc, intensity }) => {
          L.circleMarker([loc.lat, loc.lon], {
            radius: 4,
            color: "#0b3d4a",
            weight: 1,
            fillColor: "#c4a574",
            fillOpacity: 0.22,
            opacity: 0.35,
          }).bindPopup(
            `<strong>${loc.lat.toFixed(3)}°, ${loc.lon.toFixed(3)}°</strong><br>
             Intensity ${fmt(intensity, metric === "visits" || metric === "dwell" ? 0 : 2)}
             <span class="meta">(${fmt(100 * intensity / dataMax, 0)}% of filter max)</span>`
          ).addTo(vtState.heatMarkerLayer);
        });
      }

      if (updateUi) {
      const intensitySum = scored.reduce((a, x) => a + x.intensity, 0);
      const intensityMean = scored.length ? intensitySum / scored.length : null;
      const boatSet = new Set();
      scored.forEach(({ loc }) => (loc.boats || []).forEach((b) => boatSet.add(b)));

      if (el("fishEffortStatSpots")) el("fishEffortStatSpots").textContent = String(scored.length);
      const kEl = el("fishEffortStatIntensityK");
      if (kEl) kEl.textContent = intensityStatLabel(metric);
      if (el("fishEffortStatIntensity")) {
        if (!scored.length) el("fishEffortStatIntensity").textContent = "—";
        else if (intensityIsRate(metric)) el("fishEffortStatIntensity").textContent = fmt(intensityMean, 2);
        else el("fishEffortStatIntensity").textContent = fmt(intensitySum, 0);
      }
      if (el("fishEffortStatBoats")) el("fishEffortStatBoats").textContent = String(boatSet.size);

      const top = [...scored].sort((a, b) => b.intensity - a.intensity).slice(0, 40);
      const metricShort = intensityStatLabel(metric).replace(/^Mean /, "");
      const listEl = el("fishEffortList"); if (listEl) listEl.innerHTML = top.map(({ loc, intensity }) => `
        <article class="heat" data-lat="${loc.lat}" data-lon="${loc.lon}">
          <h3>${loc.lat.toFixed(3)}°, ${loc.lon.toFixed(3)}°</h3>
          <div class="meta">${loc.n_boat_days || 0} boat-days · ${fmt(loc.total_dwell_min, 0)} min dwell · ${loc.n_boats || 0} boat(s)</div>
          <div><span class="fpp">${fmt(intensity, intensityIsRate(metric) ? 2 : 0)}</span>
            <span class="meta"> ${metricShort} · ${fmt(100 * intensity / dataMax, 0)}% of filter max</span></div>
        </article>`).join("") || "<p class='status'>No heat points for this filter.</p>";

      listEl && listEl.querySelectorAll(".heat").forEach((node) => {
        node.addEventListener("click", () => {
          const lat = Number(node.dataset.lat);
          const lon = Number(node.dataset.lon);
          effortMap.setView([lat, lon], Math.max(effortMap.getZoom(), 12));
        });
      });

      const { start, end } = fishEffortDateBounds();
      syncMultiSummary("fishEffortBoatFilter", "fishEffortBoatSummary"); syncMultiSummary("fishEffortSpeciesFilter", "fishEffortSpeciesSummary");
      const boatLabel = boats.length ? ` · ${selectionSummary(boats)}` : "";
      const decimals = intensityIsRate(metric) ? 2 : 0;
      if (el("fishEffortStatus")) el("fishEffortStatus").textContent =
        `${start || "?"} → ${end || "?"}${boatLabel}${speciesFilterLabel(speciesKeys)} · ${scored.length} AIS cluster(s) · ${metric}` +
        (scored.length ? ` · color max ${fmt(dataMax, decimals)}` : "") +
        (typeof L.heatLayer !== "function" ? " · heat plugin missing" : "");
      }
    }

    const HEAT_METRIC_NOTES = {
      shrunk_fph: 'Evidence-weighted dwell FPH — best default for choosing where to fish.',
      dwell_fph: 'Trip catch split by AIS dwell share, ÷ nominal angler-hours.',
      stopped_fph: 'Attributed fish ÷ AIS dwell hours at the spot.',
      shrunk_stopped_fph: 'Evidence-weighted stopped FPH.',
      primary_fph: 'Dwell FPH using only primary hangs (dwell share ≥ 25%).',
      primary_stopped_fph: 'Stopped FPH from primary hangs only.',
      consistent_fph: '25th percentile of per-visit FPH — usually decent, not boom/bust.',
      season_fph: 'Same calendar season across years in the date slider (±30d).',
      trip_stopped_fph: 'Mean trip fish/person ÷ total offshore dwell hours.',
      dwell: 'Sum of AIS stop minutes at filtered spots.',
      visits: 'Boat-days (distinct boat × calendar day).',
      fish: 'Dwell-attributed kept fish (species filter applies).',
      fpp: 'Mean trip fish kept per person.',
    };

    function updateFishEffortMetricNote() {
      const node = el('fishEffortMetricNote');
      const sel = el('fishEffortMetric');
      if (!node || !sel) return;
      node.textContent = HEAT_METRIC_NOTES[sel.value] || '';
    }

  async function loadFishEffortVT() {
    if (vtState.loaded) return vtState;
    if (vtState.loading) return vtState.loading;
    vtState.loading = (async () => {
      try {
      const meta = await (await fetch(VT_DATA + 'meta.json')).json();
      vtState.meta = meta;
      const cacheBust = encodeURIComponent(meta.ais_window?.end || '') + '-' + (meta.stats?.n_trips || '');
      const locData = await (await fetch(VT_DATA + 'locations.json?v=' + cacheBust)).json();
      vtState.locations = locData.locations || [];
      const speciesSet = new Set();
      let unknownVisits = 0;
      for (const loc of vtState.locations) {
        for (const v of loc.visits || []) {
          if (!visitHasSpeciesBreakdown(v)) { unknownVisits += 1; continue; }
          for (const s of v.species) speciesSet.add(normalizeSpecies(s.species));
        }
      }
      vtState.speciesCatalog = [...speciesSet].sort((a, b) => a.localeCompare(b));
      vtState.unknownSpeciesVisits = unknownVisits;
      await loadSpeciesGroups();
      const aisStart = meta.ais_window?.start || '2015-01-01';
      const aisEnd = meta.ais_window?.end || '2025-12-31';
      vtState.spotsDates = (meta.dates || []).filter((d) => d >= aisStart && d <= aisEnd);
      if (vtState.spotsDates.length < 2) vtState.spotsDates = [aisStart, aisEnd];
      populateBoatSpeciesFilters(meta);
      vtState.loaded = true;
      syncFishEffortUiFromStore();
      return vtState;
      } catch (err) {
        vtState.loading = null;
        throw err;
      }
    })();
    return vtState.loading;
  }

  function populateBoatSpeciesFilters(meta) {
    const boatHtml = (meta.boats || []).map((b) => '<option value="' + deps.esc(b) + '">' + deps.esc(b) + '</option>').join('');
    const bf = el('fishEffortBoatFilter');
    if (bf) bf.innerHTML = boatHtml;
    refreshSpeciesFilterOptions();
  }

  function syncFishEffortUiFromStore() {
    if (!deps.store) return;
    const p = fishEffortVtPrefs();
    const metric = el('fishEffortMetric');
    if (metric) metric.value = p.metric;
    ['fishEffortRadius','fishEffortBlur','fishEffortOpacity','fishEffortMax'].forEach((id, i) => {
      const node = el(id);
      const vals = [p.radius, p.blur, p.opacity, p.hotMax];
      if (node) node.value = String(vals[i]);
    });
    const sm = el('fishEffortShowMarkers');
    if (sm) sm.checked = p.showMarkers;
    if (vtState.spotsDates.length > 1) {
      setupDualRange('fishEffort', vtState.spotsDates, () => scheduleFishEffortRender());
      const startEl = el('fishEffortDateStart');
      const endEl = el('fishEffortDateEnd');
      const max = Math.max(0, vtState.spotsDates.length - 1);
      const startIdx = p.dateStartIdx;
      const endIdx = p.dateEndIdx;
      /* 0→0 is the HTML default and also a leftover from the uninitialized slider bug. */
      const collapsedDefault = startIdx === 0 && endIdx === 0 && max > 0;
      const savedValid = startIdx != null && endIdx != null
        && startIdx >= 0 && endIdx <= max && endIdx >= startIdx
        && !collapsedDefault;
      if (startEl && endEl && savedValid) {
        startEl.value = startIdx;
        endEl.value = endIdx;
      }
      syncDualRange('fishEffort');
    }
    updateFishEffortMetricNote();
    syncMultiSummary('fishEffortBoatFilter', 'fishEffortBoatSummary');
    syncMultiSummary('fishEffortSpeciesFilter', 'fishEffortSpeciesSummary');
  }

  function defaultFishEffortVtPrefs() {
    return { metric: 'shrunk_fph', radius: 4, blur: 3, opacity: 80, hotMax: 0.6, showMarkers: false, dateStartIdx: null, dateEndIdx: null, planHeat: 'off' };
  }

  function fishEffortVtPrefs() {
    const d = defaultFishEffortVtPrefs();
    if (!deps.store) return d;
    const m = deps.store.get('fishEffortVtMetric');
    if (m) d.metric = m;
    const r = parseInt(deps.store.get('fishEffortVtRadius'), 10);
    if (r >= 4 && r <= 40) d.radius = r;
    const b = parseInt(deps.store.get('fishEffortVtBlur'), 10);
    if (b >= 3 && b <= 35) d.blur = b;
    const o = parseInt(deps.store.get('fishEffortVtOpacity'), 10);
    if (o >= 15 && o <= 100) d.opacity = o;
    const h = parseFloat(deps.store.get('fishEffortVtHotMax'));
    if (h >= 0.2 && h <= 1) d.hotMax = h;
    d.showMarkers = deps.store.get('fishEffortVtShowMarkers') === '1';
    const ds = parseInt(deps.store.get('fishEffortVtDateStart'), 10);
    const de = parseInt(deps.store.get('fishEffortVtDateEnd'), 10);
    if (Number.isFinite(ds)) d.dateStartIdx = ds;
    if (Number.isFinite(de)) d.dateEndIdx = de;
    const ph = deps.store.get('fishPlanHeat');
    if (ph === 'off' || ph === 'hours' || ph === 'vessels') d.planHeat = ph;
    return d;
  }

  function saveFishEffortVtPrefs(p) {
    if (!deps.store) return;
    p = p || fishEffortVtPrefs();
    deps.store.set('fishEffortVtMetric', p.metric);
    deps.store.set('fishEffortVtRadius', String(p.radius));
    deps.store.set('fishEffortVtBlur', String(p.blur));
    deps.store.set('fishEffortVtOpacity', String(p.opacity));
    deps.store.set('fishEffortVtHotMax', String(p.hotMax));
    deps.store.set('fishEffortVtShowMarkers', p.showMarkers ? '1' : '0');
    if (p.dateStartIdx != null) deps.store.set('fishEffortVtDateStart', String(p.dateStartIdx));
    if (p.dateEndIdx != null) deps.store.set('fishEffortVtDateEnd', String(p.dateEndIdx));
    deps.store.set('fishPlanHeat', p.planHeat || 'off');
  }

  function scheduleFishEffortRender(delay) {
    if (vtState.renderTimer) clearTimeout(vtState.renderTimer);
    vtState.renderTimer = setTimeout(() => {
      if (effortMap) renderFishEffortOnMap(effortMap);
    }, delay == null ? 80 : delay);
  }

  function renderFishEffortOnMap(map) {
    if (!map || typeof L === 'undefined') return;
    effortMap = map;
    if (!vtState.loaded) {
      const st = el('fishEffortStatus');
      if (st) st.textContent = 'Loading VesselTracker effort data…';
      loadFishEffortVT().then(() => renderFishEffortOnMap(map)).catch((e) => {
        if (st) st.textContent = 'Failed: ' + (e && e.message ? e.message : e);
      });
      return;
    }
    if (typeof L.heatLayer !== 'function') {
      const st = el('fishEffortStatus');
      if (st) st.textContent = 'Heat plugin missing — reload the page, then open Effort again.';
    }
    vtRenderHeatCore();
    const meta = el('fishEffortMeta');
    if (meta && vtState.meta) {
      const ft = vtState.meta.feature_cluster_radius_ft || 150;
      const aw = vtState.meta.ais_window || {};
      meta.textContent = ft + ' ft AIS clusters · ' + (aw.start || '?') + ' → ' + (aw.end || '?') +
        ' · ' + (vtState.locations.length || 0) + ' AIS clusters · VesselTracker pipeline (dock totals + Cadastre AIS)';
    }
    const leg = el('fishEffortMapLegend');
    if (leg) {
      leg.innerHTML = '<div class="fish-effort-scale" aria-hidden="true">' +
        '<i style="background:#0b3d4a"></i><i style="background:#17687a"></i><i style="background:#c4a574"></i><i style="background:#c47a3a"></i><i style="background:#b54a2a"></i></div>' +
        '<span>Cool → hot AIS hang · # = Plan ranks · dots = other nearby pins · 150 ft clusters</span>';
    }
  }

  function paintPlanHeat(map, planHeatMode) {
    if (!map || planHeatMode === 'off') {
      if (map) vtClearHeat(map);
      return;
    }
    if (!vtState.loaded) {
      loadFishEffortVT().then(() => paintPlanHeat(map, planHeatMode));
      return;
    }
    const prev = effortMap;
    effortMap = map;
    _metricOverride = planHeatMode === 'vessels' ? 'visits' : 'dwell';
    try {
      vtRenderHeatCore({ updateUi: false });
    } finally {
      _metricOverride = null;
      effortMap = prev;
    }
  }

  function bindFishEffortVtEvents() {
    const onChange = () => {
      const p = fishEffortVtPrefs();
      p.metric = el('fishEffortMetric')?.value || p.metric;
      p.radius = Number(el('fishEffortRadius')?.value) || p.radius;
      p.blur = Number(el('fishEffortBlur')?.value) || p.blur;
      p.opacity = Number(el('fishEffortOpacity')?.value) || p.opacity;
      p.hotMax = Number(el('fishEffortMax')?.value) || p.hotMax;
      p.showMarkers = !!el('fishEffortShowMarkers')?.checked;
      p.dateStartIdx = Number(el('fishEffortDateStart')?.value);
      p.dateEndIdx = Number(el('fishEffortDateEnd')?.value);
      saveFishEffortVtPrefs(p);
      scheduleFishEffortRender();
    };
    el('fishEffortMetric')?.addEventListener('change', () => { updateFishEffortMetricNote(); onChange(); });
    ['fishEffortRadius','fishEffortBlur','fishEffortOpacity','fishEffortMax'].forEach((id) => {
      el(id)?.addEventListener('input', onChange);
    });
    el('fishEffortShowMarkers')?.addEventListener('change', onChange);
    el('fishEffortBoatFilter')?.addEventListener('change', () => {
      syncMultiSummary('fishEffortBoatFilter', 'fishEffortBoatSummary');
      onChange();
    });
    el('fishEffortSpeciesFilter')?.addEventListener('change', () => {
      syncMultiSummary('fishEffortSpeciesFilter', 'fishEffortSpeciesSummary');
      onChange();
    });
    el('fishEffortBoatClear')?.addEventListener('click', () => {
      clearMultiSelect(el('fishEffortBoatFilter'));
      el('fishEffortBoatFilter')?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    el('fishEffortSpeciesClear')?.addEventListener('click', () => {
      clearMultiSelect(el('fishEffortSpeciesFilter'));
      el('fishEffortSpeciesFilter')?.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function initFishEffortVT(opts) {
    deps = Object.assign(deps, opts || {});
    bindFishEffortVtEvents();
  }

  global.FishEffortVT = {
    init: initFishEffortVT,
    load: loadFishEffortVT,
    render: renderFishEffortOnMap,
    paintPlanHeat,
    syncUi: syncFishEffortUiFromStore,
    prefs: fishEffortVtPrefs,
    savePrefs: saveFishEffortVtPrefs,
    scheduleRender: scheduleFishEffortRender,
    isLoaded: () => vtState.loaded,
  };
})(typeof window !== 'undefined' ? window : globalThis);
