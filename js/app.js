/* Kabete Campaign Map: map, dashboards and community needs mapping.
   Plain JavaScript, Leaflet and Chart.js. No build step. */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const HOME = CFG.homeConstituency || "Kabete";
  const STORE_KEY = "kcm_needs_v1";
  // Brand colours (DCP: green, lime, brown)
  const GREEN = "#025a2d", LIME = "#b4f03c", BROWN = "#9b441b";
  const fmt = (n) => (n == null || isNaN(n) ? "n/a" : Number(n).toLocaleString("en-KE"));
  const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Sequential green ramp, light to dark
  const RAMP = ["#eef6e6", "#d3eabf", "#b2d993", "#8cc263", "#5fa43f", "#3b8430", "#1d5e22"];
  const CAT_COLORS = ["#025a2d", "#b4f03c", "#2a8a7c", "#c2410c", "#2563eb", "#be185d", "#4d7c0f", "#7c3aed", "#0e7490", "#b91c1c", "#92400e", "#6b7280"];

  let DATA = {}, needs = [], remoteNeeds = [];
  let map, pickMap, wardLayer, constLayer, countyLayer, needsLayer, labelLayer, pickMarker;
  let scope = "kabete", indicator = "voters_2022", mapFitted = false, pickFitted = false;
  const charts = {};

  // Simple line icons (24x24, stroke = currentColor)
  const ICONS = {
    gavel: '<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-4 4 6 6 4-4M10 12l-7 7M4 21h9"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8 0 6 1.5 6 4.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/><path d="M6 6l9-3 1.5 3"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-4 3-7 7-7 0 4-3 7-7 7zM7 21h10"/>',
    chart: '<path d="M4 20V14M9 20V10M14 20V12M19 20V6M3 21h18M4 10l5-4 5 3 6-6"/>',
    road: '<path d="M8 3L4 21M16 3l4 18M12 4v3M12 10v4M12 17v3"/>',
    tap: '<path d="M4 8h9a3 3 0 013 3v2M8 8V5h4v3M16 11h4M18 17c0 1.7-1.3 3-3 3s-3-1.3-3-3c0-2 3-5 3-5s3 3 3 5z"/>',
    inclusion: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 8v6M4 21l2-7 2 7M18 8l-2 5h4l-2-5M17 13v8M19 13v8"/><circle cx="12" cy="17" r="3"/><path d="M12 9v5"/>',
    elders: '<circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><path d="M8 8v6l-2 7M8 14l2 7M16 8v13M16 12l3 2v7"/>'
  };
  const icon = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.people}</svg>`;

  // ---------- boot ----------
  renderCandidate();
  (CFG.extraIndicators || []).forEach((x) => {
    const o = document.createElement("option"); o.value = x.key; o.textContent = x.label; $("#indicator").appendChild(o);
  });
  $("#needForm [name=category]").innerHTML = (CFG.categories || ["Other"]).map((c) => `<option>${esc(c)}</option>`).join("");

  Promise.all(["county", "constituencies", "wards"].map((n) => fetch(`data/${n}.geojson`).then((r) => r.json())))
    .then(([county, cons, wards]) => fetch("data/stats.json").then((r) => r.json()).then((stats) => {
      DATA = { county, cons, wards, stats };
      needs = loadLocal();
      initMap();
      initTabs();
      initNeeds();
      renderAbout();
      drawHeroMap();
      refreshAll();
      loadRemote();
    }))
    .catch((e) => {
      const why = typeof L === "undefined" ? "The map library could not load. Check your internet connection." : "Could not load the data files. If you opened index.html directly from your computer, run a local server or use the GitHub Pages link.";
      document.body.insertAdjacentHTML("afterbegin", `<p style="padding:12px;background:#fde8e8">${why} (${esc(e.message)})</p>`);
    });

  function allNeeds() {
    const seen = new Set(needs.map((n) => n.id));
    return needs.concat(remoteNeeds.filter((n) => !seen.has(n.id)));
  }

  // ---------- candidate ----------
  function renderCandidate() {
    const C = CFG.candidate || {};
    const full = [C.title, C.name].filter(Boolean).join(" ");
    const initials = (C.name || "?").split(/\s+/).filter((w) => w).map((w) => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase();
    ["#brandAvatar", "#heroAvatar"].forEach((sel) => {
      const el = $(sel); el.textContent = initials;
      if (C.photo) {
        const img = new Image();
        img.alt = full;
        img.onload = () => { el.textContent = ""; el.appendChild(img); };
        img.src = C.photo;
      }
    });
    if (C.partyLogo) {
      const lg = $("#partyLogo");
      lg.onload = () => (lg.hidden = false);
      lg.alt = C.party || ""; lg.src = C.partyLogo;
    }
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v || ""; };
    set("#brandTitle", [C.title, C.shortName || C.name].filter(Boolean).join(" ") + (C.name && C.shortName ? " " + C.name.split(" ").slice(-1)[0] : ""));
    set("#brandSub", `MP aspirant, ${HOME}` + (C.party ? " · DCP" : ""));
    set("#heroTitle", C.title); set("#mfTitle", C.title);
    set("#heroName", C.name); set("#mfName", C.name);
    set("#heroRole", C.role);
    set("#heroParty", C.party); set("#heroSlogan", C.slogan);
    set("#heroTag", C.tagline);
    set("#heroBio", C.bio); set("#mfBio", C.bio);
    const q = C.quote || [];
    set("#quote1", q[0]); set("#quote2", q[1]); set("#mfQ1", q[0]); set("#mfQ2", q[1]);
    set("#campaignYear", C.campaign); set("#campaignMotto", C.motto);
    document.title = `${full} | ${C.campaign || HOME}`;

    $("#pillars").innerHTML = (C.pillars || []).map((p, i) =>
      `<div class="pillar"><span class="pill-ic ${i % 2 ? "brown" : ""}">${icon(p.icon)}</span><b>${esc(p.title)}</b></div>`).join("");

    $("#pledgeTrack").innerHTML = (C.pledges || []).map((p, i) => `
      <article class="slide pledge ${i % 2 ? "brown" : ""}">
        <div class="pledge-num"><span>${i + 1}</span>${icon(p.icon)}</div>
        <div class="pledge-body">
          <p class="pledge-text">${esc(p.text)}</p>
          <div class="pledge-meta" data-cat="${esc(p.category)}"></div>
          <button class="btn ghost" data-report="${esc(p.category)}">Report a need on this</button>
        </div>
      </article>`).join("");
    $("#actionTrack").innerHTML = (C.actions || []).map((a, i) => `
      <article class="slide action">
        <div class="action-num">${i + 1}</div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.text)}</p>
      </article>`).join("");

    const k = C.contact || {}, links = [];
    if (k.whatsapp) links.push(["WhatsApp", "https://wa.me/" + k.whatsapp.replace(/\D/g, "")]);
    if (k.phone) links.push(["Call", "tel:" + k.phone]);
    if (k.email) links.push(["Email", "mailto:" + k.email]);
    if (k.facebook) links.push(["Facebook", k.facebook]);
    if (k.x) links.push(["X", k.x]);
    if (k.tiktok) links.push(["TikTok", k.tiktok]);
    if (k.linkedin) links.push(["LinkedIn", k.linkedin]);
    $("#contacts").innerHTML = links.map(([l, u]) => `<a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join("");

    $$("[data-go]").forEach((b) => b.addEventListener("click", () => $(`#tabs button[data-view="${b.dataset.go}"]`).click()));
    $$('#view-manifesto a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault(); const t = $(a.getAttribute("href")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-report]").forEach((b) => b.addEventListener("click", () => {
      $('#tabs button[data-view="needs"]').click();
      $("#needForm [name=category]").value = b.dataset.report;
    }));
    $$(".slider").forEach(initSlider);
  }

  // Swipeable slider: scroll-snap track, arrows, dots, optional autoplay
  function initSlider(root) {
    const track = $(".track", root), slides = $$(".slide", track), dots = $(".dots", root);
    if (!slides.length) return;
    const perView = () => { const w = slides[0].getBoundingClientRect().width; return w ? Math.max(1, Math.round(track.clientWidth / w)) : 1; };
    const pages = () => Math.max(1, slides.length - perView() + 1);
    const current = () => { const w = slides[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0); return w ? Math.round(track.scrollLeft / w) : 0; };
    const go = (i) => {
      const n = pages(); i = ((i % n) + n) % n;
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: "smooth" });
    };
    const drawDots = () => {
      const n = pages(), c = Math.min(current(), n - 1);
      dots.innerHTML = Array.from({ length: n }, (_, i) => `<button aria-label="Slide ${i + 1}" class="${i === c ? "on" : ""}"></button>`).join("");
      $$("button", dots).forEach((d, i) => d.addEventListener("click", () => { stop(); go(i); }));
    };
    $(".prev", root).addEventListener("click", () => { stop(); go(current() - 1); });
    $(".next", root).addEventListener("click", () => { stop(); go(current() + 1); });
    let t; track.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(drawDots, 80); });
    window.addEventListener("resize", drawDots);
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    const ms = +root.dataset.autoplay;
    if (ms) {
      timer = setInterval(() => { if (root.offsetParent) go(current() + 1); }, ms);
      ["pointerdown", "touchstart", "wheel"].forEach((ev) => track.addEventListener(ev, stop, { passive: true }));
    }
    drawDots();
    root._redraw = drawDots;
  }

  // Kabete ward map for the home page card
  function drawHeroMap() {
    const feats = DATA.wards.features.filter((f) => f.properties.constituency === HOME);
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    const rings = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]);
    feats.forEach((f) => rings(f).forEach((r) => r.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })));
    const W = 400, k = W / (x1 - x0), H = (y1 - y0) * k;
    const P = ([x, y]) => [((x - x0) * k), ((y1 - y) * k)];
    const path = (f) => rings(f).map((r) => "M" + r.map((c) => P(c).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join("");
    const svg = $("#heroMap");
    svg.setAttribute("viewBox", `-6 -6 ${W + 12} ${H + 12}`);
    const nc = needCountByWard();
    svg.innerHTML = feats.map((f, i) => `<path class="mm-ward" data-code="${f.properties.code}" d="${path(f)}" fill="${["#025a2d", "#1f7a3e", "#3a8f4f", "#0b4a26", "#2c8446"][i % 5]}" stroke="#b4f03c" stroke-width="2"><title>${esc(f.properties.name)}: ${fmt(f.properties.voters_2022)} voters</title></path>`).join("") +
      feats.map((f) => {
        const lp = labelPoint(f) || [0, 0], [x, y] = P([lp[1], lp[0]]);
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="mm-label">${esc(f.properties.name)}</text><text x="${x.toFixed(1)}" y="${(y + 16).toFixed(1)}" text-anchor="middle" class="mm-sub">${nc[f.properties.code] || 0} needs</text>`;
      }).join("");
    $$(".mm-ward", svg).forEach((p) => p.addEventListener("click", () => {
      $('#tabs button[data-view="dash"]').click();
      setTimeout(() => select({ level: "ward", code: p.dataset.code }), 120);
    }));
  }

  function renderHomeKpis() {
    const n = allNeeds().filter((x) => x.constituency === HOME);
    const cat = {}; n.forEach((x) => (cat[x.category] = (cat[x.category] || 0) + 1));
    const top = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
    const kab = DATA.cons ? DATA.cons.features.find((c) => c.properties.name === HOME).properties : null;
    $("#homeKpis").innerHTML = [
      [kab ? fmt(kab.voters_2022) : "", "Registered voters (2022)"],
      [fmt(n.length), "Needs reported"],
      [fmt(new Set(n.map((x) => x.wardCode)).size) + " / 5", "Wards heard from"],
      [top ? esc(top[0]) : "None yet", "Top concern"]
    ].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    // live counts on pledge cards
    const all = allNeeds();
    $$(".pledge-meta").forEach((m) => {
      const c = all.filter((x) => x.category === m.dataset.cat).length;
      m.textContent = c ? `${c} report${c === 1 ? "" : "s"} from residents so far` : "No reports yet";
    });
    if ($("#heroMap") && DATA.wards) drawHeroMap();
  }


  // ---------- tabs ----------
  function initTabs() {
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => {
      $$("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
      if (b.dataset.view === "map") setTimeout(() => { map.invalidateSize(); if (!mapFitted) refreshMap(true); }, 50);
      if (b.dataset.view === "needs") setTimeout(() => {
        pickMap.invalidateSize();
        if (!pickFitted) { pickMap.fitBounds(L.geoJSON(DATA.cons.features.filter((f) => f.properties.name === HOME)).getBounds()); pickFitted = true; }
      }, 50);
      if (b.dataset.view === "manifesto") setTimeout(() => $$(".slider").forEach((s) => s._redraw && s._redraw()), 60);
      if (b.dataset.view === "dash") setTimeout(() => { initDash(); dashMap.invalidateSize(); if (!dashFitted) { dashFitted = true; dashFit(); } renderDashboard(); }, 50);
      history.replaceState(null, "", "#" + b.dataset.view);
    }));
    const h = location.hash.replace("#", "");
    const btn = $(`#tabs button[data-view="${h}"]`);
    if (btn) btn.click();
  }

  // ---------- map ----------
  // Free basemaps, no API key needed
  function baseLayers() {
    return {
      "Street map": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }),
      "Light grey": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 16, attribution: "Basemap &copy; Esri"
      }),
      "Satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, attribution: "Imagery &copy; Esri"
      })
    };
  }
  function addBase(m) {
    const b = baseLayers();
    b["Street map"].addTo(m);
    L.control.layers(b, null, { position: "topleft" }).addTo(m);
  }

  function initMap() {
    map = L.map("map", { zoomControl: true }).setView([-1.22, 36.7], 12);
    addBase(map);
    L.control.scale({ imperial: false }).addTo(map);

    countyLayer = L.geoJSON(DATA.county, {
      style: (f) => f.properties.name === "Kiambu"
        ? { color: "#1e2a1a", weight: 3, fill: false }
        : { color: "#9aa394", weight: 1, dashArray: "4 4", fillColor: "#9aa394", fillOpacity: 0.06 },
      interactive: false
    }).addTo(map);
    wardLayer = L.geoJSON(DATA.wards, { style: wardStyle, onEachFeature: (f, l) => {
      l.on({ click: () => showWard(f, l), mouseover: () => l.setStyle({ weight: 3, color: "#b4f03c" }), mouseout: () => wardLayer.resetStyle(l) });
    } }).addTo(map);
    constLayer = L.geoJSON(DATA.cons, {
      style: (f) => ({ color: f.properties.name === HOME ? BROWN : "#1e2a1a", weight: f.properties.name === HOME ? 4 : 1.4, fill: false }),
      interactive: false
    }).addTo(map);
    labelLayer = L.layerGroup().addTo(map);
    needsLayer = L.layerGroup().addTo(map);

    $$("#scopeSeg button").forEach((b) => b.addEventListener("click", () => {
      scope = b.dataset.scope;
      $$("#scopeSeg button").forEach((x) => x.classList.toggle("active", x === b));
      refreshMap(true);
    }));
    $("#indicator").addEventListener("change", (e) => { indicator = e.target.value; refreshMap(false); });
    $("#tglConst").addEventListener("change", (e) => e.target.checked ? constLayer.addTo(map) : map.removeLayer(constLayer));
    $("#tglNeeds").addEventListener("change", (e) => e.target.checked ? needsLayer.addTo(map) : map.removeLayer(needsLayer));
    $("#tglLabels").addEventListener("change", (e) => e.target.checked ? labelLayer.addTo(map) : map.removeLayer(labelLayer));
    $("#infoClose").addEventListener("click", () => ($("#info").hidden = true));
    map.on("zoomend", drawLabels);
  }

  function inScope(f) { return scope === "county" || f.properties.constituency === HOME; }

  function wardValue(f) {
    if (indicator === "needs") return needCountByWard()[f.properties.code] || 0;
    return f.properties[indicator];
  }

  let breaks = [];
  function computeBreaks() {
    const vals = DATA.wards.features.filter(inScope).map(wardValue).filter((v) => v != null && !isNaN(v)).sort((a, b) => a - b);
    const lo = vals[0] || 0, hi = vals[vals.length - 1] || 1;
    breaks = { lo, hi };
  }
  function colorFor(v) {
    if (v == null || isNaN(v)) return "#ddd";
    const { lo, hi } = breaks;
    const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
  }
  function wardStyle(f) {
    const active = inScope(f);
    return {
      color: "#ffffff", weight: active ? 1.2 : 0.6,
      fillColor: active ? colorFor(wardValue(f)) : "#cdd6c6",
      fillOpacity: active ? 0.78 : 0.25
    };
  }
  function drawLegend() {
    const label = $("#indicator").selectedOptions[0].textContent;
    $("#legend").innerHTML = `<div>${esc(label)}${scope === "kabete" ? ", Kabete wards" : ", all wards"}</div>
      <div class="bar">${RAMP.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ends"><span>${fmt(breaks.lo)}</span><span>${fmt(breaks.hi)}</span></div>`;
  }
  function drawLabels() {
    labelLayer.clearLayers();
    const z = map.getZoom();
    DATA.wards.features.forEach((f) => {
      if (!inScope(f)) return;
      if (scope === "county" && z < 11) return;
      const c = L.geoJSON(f).getBounds().getCenter();
      const pt = labelPoint(f) || [c.lat, c.lng];
      L.tooltip({ permanent: true, direction: "center", className: "ward-label", interactive: false })
        .setLatLng(pt).setContent(esc(f.properties.name)).addTo(labelLayer);
    });
  }
  // label at the vertex-average of the largest ring, nudged inside if needed
  function labelPoint(f) {
    const g = f.geometry;
    const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
    const ring = rings.sort((a, b) => b.length - a.length)[0];
    let x = 0, y = 0; ring.forEach((p) => { x += p[0]; y += p[1]; });
    x /= ring.length; y /= ring.length;
    return pointInFeature([x, y], f) ? [y, x] : null;
  }

  function refreshMap(fit) {
    computeBreaks();
    wardLayer.setStyle(wardStyle);
    drawLegend();
    drawLabels();
    drawNeedMarkers();
    if (fit && $("#view-map").classList.contains("active")) {
      mapFitted = true;
      const target = scope === "county"
        ? L.geoJSON(DATA.county.features.filter((f) => f.properties.name === "Kiambu")).getBounds()
        : L.geoJSON(DATA.cons.features.filter((f) => f.properties.name === HOME)).getBounds();
      const narrow = window.innerWidth <= 760, ph = $("#mapPanel").offsetHeight;
      document.documentElement.style.setProperty("--panel-h", ph + "px");
      map.fitBounds(target, narrow ? { paddingTopLeft: [10, 10], paddingBottomRight: [10, ph + 10] } : { paddingTopLeft: [20, 20], paddingBottomRight: [300, 20] });
    }
  }

  function showWard(f) {
    const p = f.properties;
    const nc = allNeeds().filter((n) => n.wardCode === p.code);
    const cons = DATA.cons.features.find((c) => c.properties.name === p.constituency).properties;
    const byCat = {};
    nc.forEach((n) => (byCat[n.category] = (byCat[n.category] || 0) + 1));
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    $("#infoBody").innerHTML = `
      <span class="tag">${esc(p.constituency)} constituency</span><span class="tag">Ward ${esc(p.code)}</span>
      <h3>${esc(p.name)} ward</h3>
      ${p.iebc_name ? `<div class="muted small">IEBC spelling: ${esc(p.iebc_name)}</div>` : ""}
      <div class="kv">
        <span>Registered voters (2022)</span><span>${fmt(p.voters_2022)}</span>
        <span>Share of constituency</span><span>${pct(p.voters_2022, cons.voters_2022)}</span>
        <span>Share of Kiambu</span><span>${pct(p.voters_2022, DATA.stats.county.voters_2022)}</span>
        <span>Area</span><span>${p.area_km2} km²</span>
        <span>Voters per km²</span><span>${fmt(p.voter_density)}</span>
        ${p.pop_2009 ? `<span>Population (2009 census)</span><span>${fmt(p.pop_2009)}</span>
        <span>Population 2019 (estimate)</span><span>${fmt(p.pop_2019_est)}</span>` : ""}
        <span>Needs reported</span><span>${nc.length}</span>
      </div>
      ${top.length ? `<div class="small"><b>Top needs:</b> ${top.map(([k, v]) => `${esc(k)} (${v})`).join(", ")}</div>` : ""}
      ${p.note ? `<p class="muted small">${esc(p.note)}</p>` : ""}
      <p><button class="btn ghost" id="reportHere">Report a need in this ward</button></p>`;
    $("#info").hidden = false;
    $("#reportHere").onclick = () => {
      $('#tabs button[data-view="needs"]').click();
      setTimeout(() => { pickFitted = true; pickMap.fitBounds(L.geoJSON(f).getBounds()); }, 120);
    };
  }

  function drawNeedMarkers() {
    needsLayer.clearLayers();
    const cats = CFG.categories || [];
    allNeeds().forEach((n) => {
      const col = CAT_COLORS[Math.max(0, cats.indexOf(n.category)) % CAT_COLORS.length];
      L.circleMarker([n.lat, n.lng], { radius: 4 + Number(n.urgency || 1) * 2, color: "#fff", weight: 1.5, fillColor: col, fillOpacity: 0.95 })
        .bindPopup(`<b>${esc(n.title)}</b><br><span class="tag">${esc(n.category)}</span><br>${esc(n.details || "")}<br>
          <small>${esc(n.ward || "")} · ${esc(n.source || "")} · ${new Date(n.date).toLocaleDateString("en-KE")}${n.affected ? " · ~" + fmt(n.affected) + " affected" : ""}</small>`)
        .addTo(needsLayer);
    });
  }

  // ---------- geometry helpers ----------
  function pointInRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function pointInFeature(pt, f) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polys.some((poly) => pointInRing(pt, poly[0]) && !poly.slice(1).some((h) => pointInRing(pt, h)));
  }
  function wardAt(lat, lng) { return DATA.wards.features.find((f) => pointInFeature([lng, lat], f)); }

  // ---------- needs (citizen science) ----------
  function loadLocal() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; } }
  function saveLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(needs)); } catch (e) { /* storage unavailable */ } }

  let picked = null;
  function initNeeds() {
    pickMap = L.map("pickMap");
    addBase(pickMap);
    L.geoJSON(DATA.wards, { style: (f) => ({ color: "#025a2d", weight: f.properties.constituency === HOME ? 1.5 : 0.6, fillOpacity: f.properties.constituency === HOME ? 0.08 : 0.02 }), interactive: false }).addTo(pickMap);
    pickMap.setView([-1.22, 36.7], 13);
    pickMap.on("click", (e) => setPick(e.latlng.lat, e.latlng.lng));

    $("#useLoc").addEventListener("click", () => {
      if (!navigator.geolocation) return ($("#pickStatus").textContent = "Location not supported on this device");
      $("#pickStatus").textContent = "Finding you...";
      navigator.geolocation.getCurrentPosition(
        (p) => { setPick(p.coords.latitude, p.coords.longitude); pickMap.setView([p.coords.latitude, p.coords.longitude], 15); },
        () => ($("#pickStatus").textContent = "Could not get location. Tap the map instead."),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    $("#needForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), msg = $("#formMsg");
      if (!picked) { msg.className = "small err"; msg.textContent = "Please set a location on the map first."; return; }
      const w = wardAt(picked.lat, picked.lng);
      if (!w) { msg.className = "small err"; msg.textContent = "That point is outside Kiambu County. Please pick a point inside a ward."; return; }
      const rec = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        date: new Date().toISOString(),
        lat: +picked.lat.toFixed(6), lng: +picked.lng.toFixed(6),
        ward: w.properties.name, wardCode: w.properties.code, constituency: w.properties.constituency,
        category: fd.get("category"), title: fd.get("title").trim(), details: fd.get("details").trim(),
        urgency: +fd.get("urgency"), affected: fd.get("affected") ? +fd.get("affected") : null, source: fd.get("source"),
        name: fd.get("name") || "", phone: fd.get("phone") || "", consent: !!fd.get("consent")
      };
      needs.push(rec); saveLocal();
      sendRemote(rec).then((ok) => {
        msg.className = "small ok";
        msg.textContent = ok ? "Thank you. Your report was saved and shared." : "Thank you. Your report was saved on this device.";
      });
      e.target.reset(); picked = null; if (pickMarker) pickMap.removeLayer(pickMarker);
      $("#pickStatus").textContent = "No location yet";
      refreshAll();
    });

    $("#expCsv").addEventListener("click", () => download("community_needs.csv", toCSV(allNeeds()), "text/csv"));
    $("#expGeo").addEventListener("click", () => download("community_needs.geojson", JSON.stringify(toGeoJSON(allNeeds()), null, 1), "application/geo+json"));
    $("#impGeo").addEventListener("change", (e) => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then((t) => {
        const gj = JSON.parse(t), ids = new Set(needs.map((n) => n.id));
        let added = 0;
        (gj.features || []).forEach((f) => {
          const p = Object.assign({}, f.properties, { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] });
          if (!p.id) p.id = Math.random().toString(36).slice(2);
          if (!p.wardCode) { const w = wardAt(p.lat, p.lng); if (w) Object.assign(p, { ward: w.properties.name, wardCode: w.properties.code, constituency: w.properties.constituency }); }
          if (!ids.has(p.id)) { needs.push(p); added++; }
        });
        saveLocal(); refreshAll();
        alert(`Imported ${added} reports.`);
      }).catch(() => alert("Could not read that file. Use a GeoJSON exported from this tool."));
      e.target.value = "";
    });
  }

  function setPick(lat, lng) {
    picked = { lat, lng };
    if (pickMarker) pickMarker.setLatLng([lat, lng]); else pickMarker = L.marker([lat, lng]).addTo(pickMap);
    const w = wardAt(lat, lng);
    $("#needForm [name=ward]").value = w ? `${w.properties.name} (${w.properties.constituency})` : "Outside Kiambu";
    $("#pickStatus").textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  function sendRemote(rec) {
    if (!CFG.submitEndpoint) return Promise.resolve(false);
    // text/plain avoids a CORS preflight, which Apps Script does not answer
    return fetch(CFG.submitEndpoint, { method: "POST", body: JSON.stringify(rec), headers: { "Content-Type": "text/plain;charset=utf-8" } })
      .then((r) => r.ok).catch(() => false);
  }
  function loadRemote() {
    if (!CFG.submitEndpoint) { $("#syncNote").textContent = "Reports are stored in this browser only. Export them, or connect a shared sheet (see README) to collect from everyone."; return; }
    fetch(CFG.submitEndpoint).then((r) => r.json()).then((rows) => {
      remoteNeeds = (rows || []).filter((r) => r.lat && r.lng);
      $("#syncNote").textContent = `Showing ${remoteNeeds.length} shared reports plus this device's reports.`;
      refreshAll();
    }).catch(() => ($("#syncNote").textContent = "Could not reach the shared report sheet. Showing this device's reports only."));
  }

  function needCountByWard() {
    const c = {}; allNeeds().forEach((n) => (c[n.wardCode] = (c[n.wardCode] || 0) + 1)); return c;
  }

  function renderNeedTable() {
    const rows = allNeeds().slice().sort((a, b) => (b.urgency - a.urgency) || (new Date(b.date) - new Date(a.date)));
    $("#needCount").textContent = rows.length;
    const local = new Set(needs.map((n) => n.id));
    $("#needTable").innerHTML = `<thead><tr><th>Date</th><th>Ward</th><th>Category</th><th>Title</th><th>Urgency</th><th class="num">Affected</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.map((n) => `<tr>
        <td>${new Date(n.date).toLocaleDateString("en-KE")}</td><td>${esc(n.ward)}</td><td>${esc(n.category)}</td>
        <td title="${esc(n.details)}">${esc(n.title)}</td>
        <td class="urg-${n.urgency}">${["", "Low", "Medium", "High"][n.urgency] || ""}</td>
        <td class="num">${n.affected ? fmt(n.affected) : ""}</td>
        <td>${local.has(n.id) ? `<button class="btn ghost" data-del="${esc(n.id)}">Delete</button>` : ""}</td></tr>`).join("")
        : `<tr><td colspan="7" class="muted">No reports yet. Submit the first one above.</td></tr>`) + "</tbody>";
    $$("#needTable [data-del]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this report from this device?")) return;
      needs = needs.filter((n) => n.id !== b.dataset.del); saveLocal(); refreshAll();
    }));
  }

  // ---------- export helpers ----------
  const PUBLIC_FIELDS = ["id", "date", "lat", "lng", "ward", "wardCode", "constituency", "category", "title", "details", "urgency", "affected", "source"];
  function toCSV(rows, fields = PUBLIC_FIELDS.concat(["name", "phone", "consent"])) {
    const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [fields.join(",")].concat(rows.map((r) => fields.map((f) => q(r[f])).join(","))).join("\n");
  }
  function toGeoJSON(rows) {
    return { type: "FeatureCollection", features: rows.map((r) => {
      const p = {}; PUBLIC_FIELDS.forEach((f) => { if (f !== "lat" && f !== "lng") p[f] = r[f]; });
      return { type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] }, properties: p };
    }) };
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- dashboard: map on the left, details on the right ----------
  // sel: { level: "county" } | { level: "cons", name } | { level: "ward", code }
  let dashMap, dashWards, dashCons, dashFitted = false, sel = { level: "cons", name: HOME };
  const consOf = (name) => DATA.cons.features.find((c) => c.properties.name === name);
  const wardOf = (code) => DATA.wards.features.find((w) => w.properties.code === code);

  function initDash() {
    if (dashMap) return;
    dashMap = L.map("dashMap", { zoomControl: true }).setView([-1.05, 36.85], 10);
    addBase(dashMap);
    const vals = DATA.wards.features.map((f) => f.properties.voters_2022);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const col = (v) => RAMP[Math.min(RAMP.length - 1, Math.floor(((v - lo) / (hi - lo)) * RAMP.length))];
    dashWards = L.geoJSON(DATA.wards, {
      style: (f) => ({ color: "#ffffff", weight: 0.8, fillColor: col(f.properties.voters_2022), fillOpacity: 0.75 }),
      onEachFeature: (f, l) => {
        l.bindTooltip(`<b>${esc(f.properties.name)}</b><br>${fmt(f.properties.voters_2022)} voters`, { sticky: true });
        l.on("click", () => select({ level: "ward", code: f.properties.code }, true));
      }
    }).addTo(dashMap);
    dashCons = L.geoJSON(DATA.cons, { style: consStyle, interactive: false }).addTo(dashMap);
    $("#dashLegend").innerHTML = `<div class="small">Registered voters per ward, 2022</div>
      <div class="bar">${RAMP.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ends"><span>${fmt(lo)}</span><span>${fmt(hi)}</span></div>`;

    // jump-to selector
    const groups = DATA.cons.features.map((c) => c.properties.name).sort();
    $("#dashSelect").innerHTML = `<option value="county">All of Kiambu County</option>` +
      groups.map((g) => `<optgroup label="${esc(g)}"><option value="cons:${esc(g)}">${esc(g)} constituency (all wards)</option>` +
        DATA.wards.features.filter((w) => w.properties.constituency === g).sort((a, b) => a.properties.name.localeCompare(b.properties.name))
          .map((w) => `<option value="ward:${w.properties.code}">${esc(w.properties.name)} ward</option>`).join("") + `</optgroup>`).join("");
    $("#dashSelect").addEventListener("change", (e) => {
      const v = e.target.value;
      if (v === "county") select({ level: "county" });
      else if (v.startsWith("cons:")) select({ level: "cons", name: v.slice(5) });
      else select({ level: "ward", code: v.slice(5) });
    });
  }

  function consStyle(f) {
    const n = f.properties.name;
    const active = (sel.level === "cons" && sel.name === n) || (sel.level === "ward" && wardOf(sel.code).properties.constituency === n);
    return { fill: false, color: active ? BROWN : (n === HOME ? BROWN : "#1e2a1a"), weight: active ? 4 : (n === HOME ? 2.5 : 1.2), dashArray: n === HOME && !active ? "6 4" : null };
  }

  function dashFit() {
    let b;
    if (sel.level === "ward") b = L.geoJSON(wardOf(sel.code)).getBounds();
    else if (sel.level === "cons") b = L.geoJSON(consOf(sel.name)).getBounds();
    else b = L.geoJSON(DATA.cons).getBounds();
    dashMap.flyToBounds(b, { padding: sel.level === "ward" ? [60, 60] : [24, 24], duration: 0.6, maxZoom: sel.level === "ward" ? 13 : 12 });
  }

  function select(s, fromMap) {
    sel = s;
    if (fromMap && window.innerWidth <= 760) setTimeout(() => $("#dashCrumbs").scrollIntoView({ behavior: "smooth", block: "start" }), 700);
    $("#dashSelect").value = s.level === "county" ? "county" : s.level === "cons" ? "cons:" + s.name : "ward:" + s.code;
    renderDashboard();
    dashFit();
  }

  function renderDashboard() {
    if (typeof Chart === "undefined" || !dashMap) return;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = "#5f6b5a";
    const S = DATA.stats, C = S.county, grid = { color: "#e9efe4" };

    // map highlight
    dashWards.setStyle((f) => {
      const p = f.properties, on = sel.level === "ward" && p.code === sel.code;
      return on ? { color: "#023419", weight: 4, fillOpacity: 0.9 } : { color: "#ffffff", weight: 0.8, fillOpacity: 0.75 };
    });
    dashWards.eachLayer((l) => { if (sel.level === "ward" && l.feature.properties.code === sel.code) l.bringToFront(); });
    dashCons.setStyle(consStyle);

    // what is selected
    const wardsAll = DATA.wards.features.map((f) => f.properties);
    let title, crumbs, kpis, compare, scopeNeeds, extra;
    const n = allNeeds();
    const crumb = (label, s) => `<a href="#" data-sel='${esc(JSON.stringify(s))}'>${esc(label)}</a>`;

    if (sel.level === "county") {
      title = "Kiambu County";
      crumbs = `<span>Kiambu</span>`;
      const kab = consOf(HOME).properties;
      kpis = [
        [fmt(C.voters_2022), "Registered voters, 2022"],
        [fmt(C.pop_2019), "Population, 2019 census"],
        [pct(C.female_2019, C.pop_2019), "Female share of population"],
        [`${C.constituencies} / ${C.wards}`, "Constituencies / wards"],
        [pct(kab.voters_2022, C.voters_2022), `${HOME}'s share of county voters`],
        [fmt(n.length), "Community needs reported"]
      ];
      const cons = DATA.cons.features.map((f) => f.properties).sort((a, b) => b.voters_2022 - a.voters_2022);
      compare = { title: "Registered voters by constituency", hint: "Tap a bar to open that constituency",
        labels: cons.map((c) => c.name), values: cons.map((c) => c.voters_2022),
        colors: cons.map((c) => (c.name === HOME ? BROWN : "#3f9a4f")),
        onPick: (i) => select({ level: "cons", name: cons[i].name }) };
      scopeNeeds = n;
      extra = "county";
    } else if (sel.level === "cons") {
      const c = consOf(sel.name).properties;
      const ws = wardsAll.filter((w) => w.constituency === c.name).sort((a, b) => b.voters_2022 - a.voters_2022);
      const sub = S.subcounties.find((x) => x[0] === c.name);
      const rank = DATA.cons.features.map((f) => f.properties.voters_2022).sort((a, b) => b - a).indexOf(c.voters_2022) + 1;
      title = `${c.name} constituency`;
      crumbs = `${crumb("Kiambu", { level: "county" })} › <span>${esc(c.name)}</span>`;
      scopeNeeds = n.filter((x) => x.constituency === c.name);
      kpis = [
        [fmt(c.voters_2022), "Registered voters, 2022"],
        [pct(c.voters_2022, C.voters_2022), "Share of Kiambu voters"],
        [`#${rank} of 12`, "Rank by voters"],
        [c.area_km2 + " km²", `${ws.length} wards, ${fmt(c.voter_density)} voters per km²`],
        sub ? [fmt(sub[2]), `Population 2019 (+${Math.round((sub[2] - sub[1]) / sub[1] * 100)}% since 2009)`] : [fmt(scopeNeeds.length), "Community needs reported"]
      ];
      if (sub) kpis.push([fmt(scopeNeeds.length), "Community needs reported"]);
      compare = { title: `Registered voters by ward in ${c.name}`, hint: "Tap a bar or a ward on the map for details",
        labels: ws.map((w) => w.name), values: ws.map((w) => w.voters_2022), colors: ws.map(() => GREEN),
        onPick: (i) => select({ level: "ward", code: ws[i].code }) };
      extra = "cons";
    } else {
      const w = wardOf(sel.code).properties, c = consOf(w.constituency).properties;
      const ws = wardsAll.filter((x) => x.constituency === w.constituency).sort((a, b) => b.voters_2022 - a.voters_2022);
      const rankV = wardsAll.slice().sort((a, b) => b.voters_2022 - a.voters_2022).findIndex((x) => x.code === w.code) + 1;
      title = `${w.name} ward`;
      crumbs = `${crumb("Kiambu", { level: "county" })} › ${crumb(w.constituency, { level: "cons", name: w.constituency })} › <span>${esc(w.name)}</span>`;
      scopeNeeds = n.filter((x) => x.wardCode === w.code);
      kpis = [
        [fmt(w.voters_2022), "Registered voters, 2022"],
        [pct(w.voters_2022, c.voters_2022), `Share of ${w.constituency} voters`],
        [`#${rankV} of 60`, "Rank among Kiambu wards"],
        [w.area_km2 + " km²", `${fmt(w.voter_density)} voters per km²`],
        w.pop_2019_est ? [fmt(w.pop_2019_est), `Population 2019 (est.), ${fmt(w.pop_2009)} in 2009`] : [pct(w.voters_2022, C.voters_2022), "Share of Kiambu voters"],
        [fmt(scopeNeeds.length), "Community needs reported"]
      ];
      compare = { title: `${w.name} compared with other wards in ${w.constituency}`, hint: "Tap a bar to switch ward",
        labels: ws.map((x) => x.name), values: ws.map((x) => x.voters_2022),
        colors: ws.map((x) => (x.code === w.code ? BROWN : "#b9dca0")),
        onPick: (i) => select({ level: "ward", code: ws[i].code }) };
      extra = "ward";
    }

    $("#dashCrumbs").innerHTML = crumbs;
    $("#dashTitle").textContent = title;
    $("#dashKpis").innerHTML = kpis.map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join("");
    $$("#dashCrumbs [data-sel]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); select(JSON.parse(a.dataset.sel)); }));

    // compare chart
    $("#cmpTitle").textContent = compare.title;
    $("#cmpHint").textContent = compare.hint;
    $("#cmpBox").style.height = Math.max(160, compare.labels.length * 30 + 40) + "px";
    mk("chCompare", { type: "bar",
      data: { labels: compare.labels, datasets: [{ data: compare.values, backgroundColor: compare.colors, borderRadius: 4 }] },
      options: { maintainAspectRatio: false, indexAxis: "y",
        onClick: (e, els) => { if (els.length) compare.onPick(els[0].index); },
        onHover: (e, els) => (e.native.target.style.cursor = els.length ? "pointer" : "default"),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) + " voters" } } },
        scales: { x: { grid }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });

    // needs for selection
    const byCat = {}; scopeNeeds.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + 1));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    $("#needsEmpty").hidden = cats.length > 0;
    $("#needsBox").hidden = cats.length === 0;
    $("#needsBox").style.height = Math.max(120, cats.length * 30 + 40) + "px";
    if (cats.length) mk("chNeeds", { type: "bar",
      data: { labels: cats.map((c) => c[0]), datasets: [{ data: cats.map((c) => c[1]), backgroundColor: BROWN, borderRadius: 4 }] },
      options: { maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { grid, ticks: { precision: 0 } }, y: { grid: { display: false } } } } });
    const recent = scopeNeeds.slice().sort((a, b) => (b.urgency - a.urgency) || (new Date(b.date) - new Date(a.date))).slice(0, 5);
    $("#needsList").innerHTML = recent.map((x) => `<li><span class="urg-${x.urgency}">●</span> <b>${esc(x.title)}</b> <span class="muted small">${esc(x.category)} · ${esc(x.ward)}${x.affected ? " · ~" + fmt(x.affected) + " affected" : ""}</span></li>`).join("");

    // context charts
    $("#ctxCounty").hidden = extra !== "county";
    if (extra === "county") {
      const sc = S.subcounties.slice().sort((a, b) => b[2] - a[2]);
      mk("chGrowth", { type: "bar",
        data: { labels: sc.map((s) => s[0]), datasets: [
          { label: "2009", data: sc.map((s) => s[1]), backgroundColor: "#b9dca0", borderRadius: 3 },
          { label: "2019", data: sc.map((s) => s[2]), backgroundColor: sc.map((s) => (s[0] === HOME ? BROWN : GREEN)), borderRadius: 3 }] },
        options: { plugins: { tooltip: { callbacks: { afterBody: (items) => { const s = sc[items[0].dataIndex]; return `Growth: ${(((s[2] - s[1]) / s[1]) * 100).toFixed(0)}%`; } } } },
          scales: { y: { grid }, x: { grid: { display: false }, ticks: { maxRotation: 60, minRotation: 45 } } } } });
      const ages = Object.entries(C.age_2019);
      mk("chAge", { type: "bar",
        data: { labels: ages.map((a) => a[0]), datasets: [{ data: ages.map((a) => a[1]), backgroundColor: ages.map((a) => (["20-29", "30-39", "40-49"].includes(a[0]) ? GREEN : "#b9dca0")), borderRadius: 4 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) + " people" } } }, scales: { y: { grid }, x: { grid: { display: false } } } } });
    }
    $("#reportBtn").onclick = () => {
      $('#tabs button[data-view="needs"]').click();
      if (sel.level !== "county") setTimeout(() => { pickFitted = true; pickMap.fitBounds(L.geoJSON(sel.level === "ward" ? wardOf(sel.code) : consOf(sel.name)).getBounds()); }, 150);
    };
  }
  function mk(id, cfg) {
    if (charts[id]) charts[id].destroy();
    cfg.data.datasets.forEach((d) => (d.maxBarThickness = 26));
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: true, aspectRatio: 1.5 }, cfg.options);
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  // ---------- about ----------
  function renderAbout() {
    $("#sources").innerHTML = DATA.stats.sources.map((s) => `<li>${esc(s.what)}: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a></li>`).join("");
  }

  function refreshAll() {
    refreshMap(!refreshAll.done); refreshAll.done = true;
    renderNeedTable();
    renderHomeKpis();
    if ($("#view-dash").classList.contains("active")) renderDashboard();
  }
})();
