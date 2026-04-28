/**
 * game.js — Regionle
 *
 * Assumes per-country GeoJSON files in data/countries/<id>.geojson
 * Each file contains ONLY the regions of one country (already split by split_geojson.py).
 *
 * Key design decisions:
 * - No world-file filtering — each file is one country only
 * - Projection fitted to the exact bounding box of regions in that file
 * - Regions are invisible until revealed (fill:none, stroke:none)
 * - On reveal: solid fill + dark stroke between regions
 */

/* ─── per-country bounding box overrides ───────────────────────
   If a country's file still contains overseas territories that
   distort the map, list their exclusion bbox here.
   Format: [minLon, minLat, maxLon, maxLat]
   null = use whatever is in the file ─────────────────────────── */
const BBOX_OVERRIDE = {
  us: [-130, 24, -65, 50],
  fr: [-5, 41, 10, 52],
  it: [6, 36, 19, 48],
  jp: [122, 24, 154, 46],
  au: [112, -44, 154, -10],
};

/* ─── STATE ─────────────────────────────────────────────────── */
let state = {
  country: null,
  features: [],
  order: [],
  revealed: 0,
  guesses: [],
  won: false,
  over: false,
};
let stats = loadStats();
let showLabels = false;
let svgEl, gMap, proj, geoPath;

/* ─── DOM ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const el = {
  svg:       $("mapSvg"),
  container: $("mapContainer"),
  overlay:   $("mapOverlay"),
  overlayMsg:$("overlayMsg"),
  revealed:  $("regionsRevealed"),
  input:     $("guessInput"),
  acList:    $("autocompleteList"),
  btnGuess:  $("btnGuess"),
  gList:     $("guessesList"),
  toggleLbl: $("toggleLabels"),
  btnHow:    $("btnHow"),
  // result modal
  resultBg:  $("resultBackdrop"),
  mIcon:     $("modalIcon"),
  mTitle:    $("modalTitle"),
  mFlag:     $("modalFlag"),
  mBody:     $("modalBody"),
  btnNext:   $("btnNext"),
  mClose:    $("modalClose"),
  // how modal
  howBg:     $("howBackdrop"),
  howClose:  $("howClose"),
  howGot:    $("howGot"),
  // stats
  sPlayed:   $("statPlayed"),
  sWon:      $("statWon"),
  sStreak:   $("statStreak"),
  sAvg:      $("statAvg"),
};

/* ─── INIT ──────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  svgEl = d3.select(el.svg);
  gMap  = svgEl.append("g").attr("class", "map-g");

  // zoom + pan
  svgEl.call(
    d3.zoom().scaleExtent([.5, 15])
      .on("zoom", e => gMap.attr("transform", e.transform))
  );

  bindEvents();
  renderStats();
  newRound();
});

/* ─── NEW ROUND ─────────────────────────────────────────────── */
async function newRound() {
  const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];

  state = { country, features: [], order: [], revealed: 0,
            guesses: [], won: false, over: false };

  el.gList.innerHTML = '<p class="empty-msg">No guesses yet!</p>';
  el.input.value     = "";
  el.input.disabled  = false;
  el.btnGuess.disabled = false;
  el.revealed.textContent = "— regions revealed";
  gMap.selectAll("*").remove();
  showOverlay("Loading map…");

  try {
    const raw   = await d3.json(country.geojson);
    let feats   = (raw.features || []).filter(f => f.geometry);

    // Apply bbox override to drop overseas territories
    const bbox = BBOX_OVERRIDE[country.id];
    if (bbox) {
      feats = feats.filter(f => {
        const c = geoCentroid(f);
        return c && c[0] >= bbox[0] && c[0] <= bbox[2]
                 && c[1] >= bbox[1] && c[1] <= bbox[3];
      });
    }

    if (!feats.length) {
      showOverlay("⚠ No regions found.\nCheck the GeoJSON file.");
      return;
    }

    state.features = feats;
    state.order    = shuffle(feats.map((_, i) => i));

    hideOverlay();
    buildMap();
    revealNext();

  } catch (err) {
    console.error(err);
    showOverlay("⚠ Failed to load map.\nMake sure the GeoJSON file exists in data/countries/");
  }
}

/* ─── BUILD MAP ─────────────────────────────────────────────── */
function buildMap() {
  const W = el.container.clientWidth  || 800;
  const H = el.container.clientHeight || 500;
  svgEl.attr("viewBox", `0 0 ${W} ${H}`);

  // Fit projection tightly around just these features
  const fc = geoFC(state.features);
  proj    = d3.geoMercator().fitExtent([[24, 24], [W - 24, H - 24]], fc);
  geoPath = d3.geoPath().projection(proj);

  // Ocean background rect
  gMap.append("rect")
    .attr("class", "map-ocean")
    .attr("width", W).attr("height", H);

  // One path per region — hidden initially
  state.features.forEach((feat, i) => {
    const d = geoPath(feat);
    if (!d) return;
    gMap.append("path")
      .attr("class", "region-path")
      .attr("d", d)
      .attr("data-i", i);
  });

  // One label per region — hidden initially
  state.features.forEach((feat, i) => {
    const c = geoPath.centroid(feat);
    if (!c || isNaN(c[0]) || isNaN(c[1])) return;
    const name = regionName(feat, state.country);
    if (!name) return;
    gMap.append("text")
      .attr("class", "region-label")
      .attr("x", c[0]).attr("y", c[1])
      .attr("data-i", i)
      .text(name);
  });
}

/* ─── REVEAL ────────────────────────────────────────────────── */
function revealNext() {
  if (state.revealed >= state.order.length) return;
  const idx = state.order[state.revealed++];

  gMap.selectAll(".region-path")
    .filter(function() { return +this.getAttribute("data-i") === idx; })
    .classed("visible", true);

  if (showLabels) showLabelAt(idx);

  const total = state.features.length;
  el.revealed.textContent =
    `${state.revealed} / ${total} region${total !== 1 ? "s" : ""} revealed`;
}

function revealAll(won) {
  gMap.selectAll(".region-path")
    .classed("visible", won ? false : true)
    .classed("won", won);
  gMap.selectAll(".region-label").classed("show", true);
  el.revealed.textContent = `All ${state.features.length} regions revealed`;
}

function showLabelAt(idx) {
  gMap.selectAll(".region-label")
    .filter(function() { return +this.getAttribute("data-i") === idx; })
    .classed("show", true);
}

/* ─── GUESS ─────────────────────────────────────────────────── */
function submitGuess() {
  if (state.over) return;
  const raw = el.input.value.trim();
  const match = COUNTRIES.find(c => c.name.toLowerCase() === raw.toLowerCase());
  closeAC();
  if (!match) { shake(); return; }

  const correct = match.id === state.country.id;
  const distKm  = haversine(match.capital, state.country.capital);
  const bearing = calcBearing(match.capital, state.country.capital);

  state.guesses.push({ name: match.name, flag: match.flag, distKm, bearing, correct });
  addGuessRow({ name: match.name, flag: match.flag, distKm, bearing, correct });
  el.input.value = "";

  if (correct) {
    state.won = state.over = true;
    revealAll(true);
    endRound(true);
  } else {
    revealNext();
  }
}

function addGuessRow(g) {
  el.gList.querySelector(".empty-msg")?.remove();

  const dc = g.distKm < 1500 ? "dist-hot" : g.distKm < 5000 ? "dist-warm" : "";
  const arrow = g.correct ? "✓" : bearingArrow(g.bearing);
  const dist  = g.correct ? "" : fmtDist(g.distKm);

  const row = document.createElement("div");
  row.className = `guess-row${g.correct ? " correct" : ""}`;
  row.innerHTML = `
    <span class="g-flag">${g.flag}</span>
    <span class="g-name">${g.name}</span>
    <span class="g-dist ${dc}">${dist}</span>
    <span class="g-arrow">${arrow}</span>`;
  el.gList.prepend(row);
}

/* ─── END ROUND ─────────────────────────────────────────────── */
function endRound(won) {
  const n = state.guesses.length;
  stats.played++;
  if (won) { stats.won++; stats.streak++; stats.totalGuessesWon += n; }
  else      { stats.streak = 0; }
  saveStats(); renderStats();

  setTimeout(() => {
    el.mIcon.textContent  = won ? "🎉" : "💀";
    el.mTitle.textContent = won ? "Correct!" : "Game over";
    el.mFlag.textContent  = state.country.flag;
    el.mBody.textContent  = won
      ? `You found ${state.country.name} in ${n} guess${n !== 1 ? "es" : ""}!`
      : `The answer was ${state.country.name}.`;
    openModal(el.resultBg);
  }, 500);
}

/* ─── AUTOCOMPLETE ──────────────────────────────────────────── */
let acIdx = -1;

function handleInput() {
  const v = el.input.value.trim().toLowerCase();
  if (!v) { closeAC(); return; }
  const hits = COUNTRIES.filter(c => c.name.toLowerCase().includes(v)).slice(0, 8);
  if (!hits.length) { closeAC(); return; }

  acIdx = -1;
  el.acList.innerHTML = hits.map((c, i) =>
    `<div class="ac-item" data-i="${i}" data-name="${c.name}">${c.flag} ${c.name}</div>`
  ).join("");
  el.acList.querySelectorAll(".ac-item").forEach(item =>
    item.addEventListener("mousedown", () => { el.input.value = item.dataset.name; closeAC(); })
  );
  el.acList.classList.add("open");
}

function moveAC(dir) {
  const items = el.acList.querySelectorAll(".ac-item");
  if (!items.length) return;
  items[acIdx]?.classList.remove("active");
  acIdx = Math.max(0, Math.min(items.length - 1, acIdx + dir));
  items[acIdx].classList.add("active");
  el.input.value = items[acIdx].dataset.name;
}
function closeAC() { el.acList.classList.remove("open"); acIdx = -1; }

/* ─── EVENTS ────────────────────────────────────────────────── */
function bindEvents() {
  el.btnGuess.addEventListener("click", submitGuess);
  el.input.addEventListener("input", handleInput);
  el.input.addEventListener("blur", () => setTimeout(closeAC, 150));
  el.input.addEventListener("keydown", e => {
    if      (e.key === "Enter")     submitGuess();
    else if (e.key === "ArrowDown") moveAC(1);
    else if (e.key === "ArrowUp")   moveAC(-1);
    else if (e.key === "Escape")    closeAC();
  });

  el.toggleLbl.addEventListener("change", () => {
    showLabels = el.toggleLbl.checked;
    const revealed = new Set(state.order.slice(0, state.revealed));
    gMap.selectAll(".region-label").each(function() {
      d3.select(this).classed("show", showLabels && revealed.has(+this.getAttribute("data-i")));
    });
  });

  el.btnHow.addEventListener("click",   () => openModal(el.howBg));
  el.howClose.addEventListener("click", () => closeModal(el.howBg));
  el.howGot.addEventListener("click",   () => closeModal(el.howBg));
  el.howBg.addEventListener("click", e => { if (e.target === el.howBg) closeModal(el.howBg); });

  el.btnNext.addEventListener("click",  () => { closeModal(el.resultBg); newRound(); });
  el.mClose.addEventListener("click",   () => closeModal(el.resultBg));
  el.resultBg.addEventListener("click", e => { if (e.target === el.resultBg) closeModal(el.resultBg); });
}

/* ─── MODAL ─────────────────────────────────────────────────── */
function openModal(el)  { el.classList.add("open"); }
function closeModal(el) { el.classList.remove("open"); }

/* ─── OVERLAY ───────────────────────────────────────────────── */
function showOverlay(msg) {
  el.overlayMsg.textContent = msg;
  el.overlay.classList.remove("hidden");
}
function hideOverlay() { el.overlay.classList.add("hidden"); }

/* ─── STATS ─────────────────────────────────────────────────── */
function loadStats() {
  try { return JSON.parse(localStorage.getItem("regionle_v2")) || fresh(); }
  catch { return fresh(); }
}
function fresh() { return { played:0, won:0, streak:0, totalGuessesWon:0 }; }
function saveStats() { localStorage.setItem("regionle_v2", JSON.stringify(stats)); }
function renderStats() {
  el.sPlayed.textContent = stats.played;
  el.sWon.textContent    = stats.won;
  el.sStreak.textContent = stats.streak;
  el.sAvg.textContent    = stats.won
    ? (stats.totalGuessesWon / stats.won).toFixed(1) : "—";
}

/* ─── GEO HELPERS ───────────────────────────────────────────── */
function geoFC(features) {
  return { type: "FeatureCollection", features };
}

function geoCentroid(feature) {
  try {
    const b = d3.geoBounds(feature);
    if (!b || isNaN(b[0][0])) return null;
    return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
  } catch { return null; }
}

function regionName(feat, country) {
  const p = feat.properties || {};
  const keys = [
    country.nameProperty, "name", "NAME", "name_en",
    "admin", "region_nam", "state_name", "shapeName"
  ];
  for (const k of keys) { if (p[k] && typeof p[k] === "string") return p[k]; }
  return "";
}

function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*r) * Math.cos(lat2*r) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing([lat1, lon1], [lat2, lon2]) {
  const r = Math.PI / 180;
  const y = Math.sin((lon2-lon1)*r) * Math.cos(lat2*r);
  const x = Math.cos(lat1*r)*Math.sin(lat2*r) -
            Math.sin(lat1*r)*Math.cos(lat2*r)*Math.cos((lon2-lon1)*r);
  return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
}

function bearingArrow(deg) {
  return ["↑","↗","→","↘","↓","↙","←","↖"][Math.round(deg/45) % 8];
}

function fmtDist(km) {
  if (km < 100)   return Math.round(km) + " km";
  if (km < 1000)  return Math.round(km/10)*10 + " km";
  if (km < 10000) return (km/1000).toFixed(1) + " tys. km";
  return Math.round(km/1000) + " tys. km";
}

function shake() {
  el.input.style.borderColor = "var(--danger)";
  el.input.animate([
    {transform:"translateX(0)"},{transform:"translateX(-5px)"},
    {transform:"translateX(5px)"},{transform:"translateX(-3px)"},
    {transform:"translateX(3px)"},{transform:"translateX(0)"},
  ], {duration:280}).onfinish = () => { el.input.style.borderColor = ""; };
}

function shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
