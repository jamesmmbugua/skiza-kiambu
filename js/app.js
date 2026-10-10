/* Kabete Campaign Map: map, dashboards and community needs mapping.
   Plain JavaScript, Leaflet and Chart.js. No build step. */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const HOME = CFG.homeConstituency || "Kabete";
  const STORE_KEY = "kcm_needs_v1";
  // Brand colours (DCP: green, lime, brown)
  const GREEN = "#0f6b34", LIME = "#8cc63f", BROWN = "#6b4423";
  const fmt = (n) => (n == null || isNaN(n) ? "n/a" : Number(n).toLocaleString("en-KE"));
  const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Sequential green ramp, light to dark
  const RAMP = ["#eef6e6", "#d3eabf", "#b2d993", "#8cc263", "#5fa43f", "#3b8430", "#1d5e22"];
  const CAT_COLORS = ["#0f6b34", "#8cc63f", "#2a8a7c", "#c2410c", "#2563eb", "#be185d", "#4d7c0f", "#7c3aed", "#0e7490", "#b91c1c", "#92400e", "#6b7280"];

  let DATA = {}, needs = [], remoteNeeds = [];
  let map, pickMap, wardLayer, constLayer, countyLayer, needsLayer, labelLayer, pickMarker;
  let scope = "kabete", indicator = "voters_2022", mapFitted = false, pickFitted = false;
  const charts = {};

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
    const initials = (C.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    ["#brandAvatar", "#heroAvatar"].forEach((sel) => {
      const el = $(sel); el.textContent = initials;
      if (C.photo) {
        const img = new Image();
        img.alt = C.name || "";
        img.onload = () => { el.textContent = ""; el.appendChild(img); };
        img.src = C.photo;
      }
    });
    if (C.partyLogo) {
      const lg = $("#partyLogo");
      lg.onload = () => (lg.hidden = false);
      lg.alt = C.party || ""; lg.src = C.partyLogo;
    }
    $("#brandTitle").textContent = C.name || "";
    $("#brandSub").textContent = "Kiambu County Woman Rep aspirant" + (C.party ? " · DCP" : "");
    $("#heroName").textContent = C.name || "";
    $("#heroRole").textContent = C.role || "";
    $("#heroParty").textContent = C.party || "";
    $("#heroSlogan").textContent = C.slogan || "";
    $("#heroTag").textContent = C.tagline || "";
    $("#heroBio").textContent = C.bio || "";
    document.title = (C.name || "Campaign") + " | " + (C.slogan || "Kiambu");
    $("#priorities").innerHTML = (C.priorities || []).map((p, i) =>
      `<div class="card prio-card"><div class="num">${i + 1}</div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join("");
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
  }

  // Kiambu ward silhouette for the home page, Kabete in lime
  function drawHeroMap() {
    const feats = DATA.wards.features;
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    const rings = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]);
    feats.forEach((f) => rings(f).forEach((r) => r.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })));
    const W = 400, k = W / (x1 - x0), H = (y1 - y0) * k;
    const path = (f) => rings(f).map((r) => "M" + r.map(([x, y]) => `${((x - x0) * k).toFixed(1)},${((y1 - y) * k).toFixed(1)}`).join("L") + "Z").join("");
    const svg = $("#heroMap");
    svg.setAttribute("viewBox", `-4 -4 ${W + 8} ${H + 8}`);
    svg.innerHTML = feats.map((f) => {
      const home = f.properties.constituency === HOME;
      return `<path d="${path(f)}" fill="${home ? LIME : "rgba(255,255,255,.10)"}" stroke="${home ? "#0a4a24" : "rgba(255,255,255,.45)"}" stroke-width="${home ? 1.2 : 0.7}"><title>${esc(f.properties.name)}</title></path>`;
    }).join("");
  }

  function renderHomeKpis() {
    const n = allNeeds();
    const cat = {}; n.forEach((x) => (cat[x.category] = (cat[x.category] || 0) + 1));
    const top = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
    $("#homeKpis").innerHTML = [
      [fmt(n.length), "Needs reported"],
      [fmt(new Set(n.map((x) => x.wardCode)).size) + " / 60", "Wards heard from"],
      [top ? esc(top[0]) : "None yet", "Top concern"],
      [fmt(n.filter((x) => x.urgency === 3).length), "Marked urgent"]
    ].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
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
      if (b.dataset.view === "dash") renderDashboard();
      history.replaceState(null, "", "#" + b.dataset.view);
    }));
    const h = location.hash.replace("#", "");
    const btn = $(`#tabs button[data-view="${h}"]`);
    if (btn) btn.click();
  }

  // ---------- map ----------
  function baseLayer() {
    return L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    });
  }

  function initMap() {
    map = L.map("map", { zoomControl: true }).setView([-1.22, 36.7], 12);
    const base = baseLayer().addTo(map);
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagery &copy; Esri" });
    L.control.layers({ "Light map": base, "Satellite": sat }, null, { position: "topleft" }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    countyLayer = L.geoJSON(DATA.county, {
      style: (f) => f.properties.name === "Kiambu"
        ? { color: "#1e2a1a", weight: 3, fill: false }
        : { color: "#9aa394", weight: 1, dashArray: "4 4", fillColor: "#9aa394", fillOpacity: 0.06 },
      interactive: false
    }).addTo(map);
    wardLayer = L.geoJSON(DATA.wards, { style: wardStyle, onEachFeature: (f, l) => {
      l.on({ click: () => showWard(f, l), mouseover: () => l.setStyle({ weight: 3, color: "#8cc63f" }), mouseout: () => wardLayer.resetStyle(l) });
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
    baseLayer().addTo(pickMap);
    L.geoJSON(DATA.wards, { style: (f) => ({ color: "#0f6b34", weight: f.properties.constituency === HOME ? 1.5 : 0.6, fillOpacity: f.properties.constituency === HOME ? 0.08 : 0.02 }), interactive: false }).addTo(pickMap);
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

  // ---------- dashboard ----------
  function renderDashboard() {
    if (typeof Chart === "undefined") return;
    const S = DATA.stats, C = S.county, K = S.kabete;
    const kab = DATA.cons.features.find((f) => f.properties.name === HOME).properties;
    const n = allNeeds();
    $("#kpis").innerHTML = [
      [fmt(C.voters_2022), "Registered voters in Kiambu (2022)"],
      [fmt(kab.voters_2022), `${HOME} voters, ${pct(kab.voters_2022, C.voters_2022)} of county`],
      [fmt(C.pop_2019), "Kiambu population (2019 census)"],
      [pct(C.female_2019, C.pop_2019), `Female share of Kiambu (${fmt(C.female_2019)})`],
      [fmt(K.pop_2019), `${HOME} population (2019 census)`],
      [fmt(n.length), "Community needs reported"]
    ].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join("");

    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = "#5f6b5a";
    const grid = { color: "#e9efe4" };

    const cons = DATA.cons.features.map((f) => f.properties).sort((a, b) => b.voters_2022 - a.voters_2022);
    mk("chConst", { type: "bar",
      data: { labels: cons.map((c) => c.name), datasets: [{ data: cons.map((c) => c.voters_2022), backgroundColor: cons.map((c) => c.name === HOME ? BROWN : "#3f9a4f"), borderRadius: 4 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) + " voters" } } }, scales: { x: { grid }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });

    const kw = DATA.wards.features.filter((f) => f.properties.constituency === HOME).map((f) => f.properties).sort((a, b) => b.voters_2022 - a.voters_2022);
    mk("chKabete", { type: "bar",
      data: { labels: kw.map((w) => w.name), datasets: [
        { label: "Registered voters 2022", data: kw.map((w) => w.voters_2022), backgroundColor: "#0f6b34", borderRadius: 4 },
        { label: "Population 2019 (est.)", data: kw.map((w) => w.pop_2019_est), backgroundColor: "#b9dca0", borderRadius: 4 }] },
      options: { plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.raw)}` } } }, scales: { y: { grid }, x: { grid: { display: false } } } } });

    const sc = S.subcounties.slice().sort((a, b) => b[2] - a[2]);
    mk("chGrowth", { type: "bar",
      data: { labels: sc.map((s) => s[0]), datasets: [
        { label: "2009", data: sc.map((s) => s[1]), backgroundColor: "#b9dca0", borderRadius: 3 },
        { label: "2019", data: sc.map((s) => s[2]), backgroundColor: sc.map((s) => s[0] === HOME ? BROWN : GREEN), borderRadius: 3 }] },
      options: { plugins: { tooltip: { callbacks: { afterBody: (items) => { const s = sc[items[0].dataIndex]; return `Growth: ${(((s[2] - s[1]) / s[1]) * 100).toFixed(0)}%`; } } } },
        scales: { y: { grid }, x: { grid: { display: false }, ticks: { maxRotation: 60, minRotation: 45 } } } } });

    const ages = Object.entries(C.age_2019);
    mk("chAge", { type: "bar",
      data: { labels: ages.map((a) => a[0]), datasets: [{ data: ages.map((a) => a[1]), backgroundColor: ages.map((a) => ["20-29", "30-39", "40-49"].includes(a[0]) ? "#0f6b34" : "#b9dca0"), borderRadius: 4 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) + " people" } } }, scales: { y: { grid }, x: { grid: { display: false } } } } });

    const byCat = {}; n.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + 1));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    mk("chNeeds", { type: "bar",
      data: { labels: cats.map((c) => c[0]), datasets: [{ data: cats.map((c) => c[1]), backgroundColor: BROWN, borderRadius: 4 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { grid, ticks: { precision: 0 } }, y: { grid: { display: false } } } } });
    $("#needsNote").textContent = n.length ? "" : "No reports yet. Use the Community needs tab to add the first one.";

    const byWard = {}; n.forEach((x) => (byWard[x.ward] = (byWard[x.ward] || 0) + 1));
    const wards = Object.entries(byWard).sort((a, b) => b[1] - a[1]).slice(0, 12);
    mk("chNeedsWard", { type: "bar",
      data: { labels: wards.map((w) => w[0]), datasets: [{ data: wards.map((w) => w[1]), backgroundColor: "#3f9a4f", borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { grid, ticks: { precision: 0 } }, x: { grid: { display: false } } } } });

    renderWardTable();
  }
  function mk(id, cfg) {
    if (charts[id]) charts[id].destroy();
    cfg.data.datasets.forEach((d) => (d.maxBarThickness = 34));
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: true, aspectRatio: 1.5 }, cfg.options);
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  let sortKey = "voters_2022", sortDir = -1;
  function wardRows() {
    const nc = needCountByWard();
    return DATA.wards.features.map((f) => {
      const p = f.properties;
      const cons = DATA.cons.features.find((c) => c.properties.name === p.constituency).properties;
      return { name: p.name, constituency: p.constituency, voters_2022: p.voters_2022, share: +(p.voters_2022 / DATA.stats.county.voters_2022 * 100).toFixed(2),
        cons_share: +(p.voters_2022 / cons.voters_2022 * 100).toFixed(1), area_km2: p.area_km2, voter_density: p.voter_density, needs: nc[p.code] || 0 };
    });
  }
  function renderWardTable() {
    const cols = [["name", "Ward"], ["constituency", "Constituency"], ["voters_2022", "Voters 2022", 1], ["share", "% of county", 1], ["cons_share", "% of constituency", 1], ["area_km2", "Area km²", 1], ["voter_density", "Voters/km²", 1], ["needs", "Needs", 1]];
    const rows = wardRows().sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * sortDir);
    const max = Math.max(...rows.map((r) => r.voters_2022));
    $("#wardTable").innerHTML = `<thead><tr>${cols.map(([k, l, num]) => `<th data-k="${k}" class="${num ? "num" : ""}">${l}${sortKey === k ? (sortDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr class="${r.constituency === HOME ? "home" : ""}">${cols.map(([k, , num]) => `<td class="${num ? "num" : ""}">${k === "voters_2022" ? fmt(r[k]) + `<span class="bar-cell" style="width:${Math.round(r[k] / max * 50)}px"></span>` : num ? fmt(r[k]) : esc(r[k])}</td>`).join("")}</tr>`).join("") + "</tbody>";
    $$("#wardTable th").forEach((th) => th.addEventListener("click", () => {
      if (sortKey === th.dataset.k) sortDir *= -1; else { sortKey = th.dataset.k; sortDir = -1; }
      renderWardTable();
    }));
    $("#exportWards").onclick = () => download("kiambu_wards.csv", toCSV(wardRows(), ["name", "constituency", "voters_2022", "share", "cons_share", "area_km2", "voter_density", "needs"]), "text/csv");
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
