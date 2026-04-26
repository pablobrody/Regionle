/**
 * game.js — Regionle
 * Loads ONE file per country (data/countries/xx.geojson).
 * Shows ONLY that country's regions, centered and zoomed tightly.
 * Reveals regions one-by-one on wrong guesses.
 */

/* ═══════════════════════════════════════════════════════════════
   PER-COUNTRY BBOX CONFIG
   Clips overseas territories so the map stays focused.
   Format: [minLon, minLat, maxLon, maxLat]
   null = use full extent of the file (fine for compact countries)
════════════════════════════════════════════════════════════════ */
const COUNTRY_CONFIG = {
  pl: { bbox: null },
  de: { bbox: null },
  it: { bbox: [6, 36, 19, 48] },
  jp: { bbox: [122, 24, 154, 46] },
  au: { bbox: [112, -44, 154, -10] },
  br: { bbox: null },
  us: { bbox: [-130, 24, -65, 50] },   // contiguous 48 states + clips territories
  fr: { bbox: [-5, 41, 10, 52] },      // metropolitan France only
};

/* ═══════════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════════════ */
let state = {
  country:     null,
  features:    [],
  regionOrder: [],
  revealed:    0,
  guesses:     [],
  won:         false,
  over:        false,
};

let stats      = loadStats();
let svg, gMap, projection, pathGen;
let showLabels = false;

/* ═══════════════════════════════════════════════════════════════
   DOM
════════════════════════════════════════════════════════════════ */
const $   = id => document.getElementById(id);
const els = {
  mapSvg:           $("mapSvg"),
  mapContainer:     $("mapContainer"),
  mapOverlay:       $("mapOverlay"),
  regionsRevealed:  $("regionsRevealed"),
  guessInput:       $("guessInput"),
  autocompleteList: $("autocompleteList"),
  btnGuess:         $("btnGuess"),
  guessesList:      $("guessesList"),
  toggleLabels:     $("toggleLabels"),
  btnHow:           $("btnHow"),
  resultBackdrop:   $("resultBackdrop"),
  modalIcon:        $("modalIcon"),
  modalTitle:       $("modalTitle"),
  modalBody:        $("modalBody"),
  modalFlag:        $("modalFlag"),
  btnNext:          $("btnNext"),
  modalClose:       $("modalClose"),
  howBackdrop:      $("howBackdrop"),
  howClose:         $("howClose"),
  statPlayed:       $("statPlayed"),
  statWon:          $("statWon"),
  statStreak:       $("statStreak"),
  statAvg:          $("statAvg"),
};

/* ═══════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  svg  = d3.select(els.mapSvg);
  gMap = svg.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.3, 20])
    .on("zoom", e => gMap.attr("transform", e.transform));
  svg.call(zoom);

  bindEvents();
  renderStats();
  startNewRound();
});

/* ═══════════════════════════════════════════════════════════════
   NEW ROUND
════════════════════════════════════════════════════════════════ */
async function startNewRound() {
  const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];

  state = {
    country,
    features:    [],
    regionOrder: [],
    revealed:    0,
    guesses:     [],
    won:         false,
    over:        false,
  };

  els.guessesList.innerHTML       = '<div class="empty-state">No guesses yet — give it a shot!</div>';
  els.guessInput.value            = "";
  els.guessInput.disabled         = false;
  els.btnGuess.disabled           = false;
  els.regionsRevealed.textContent = "— regions revealed";
  gMap.selectAll("*").remove();
  showOverlay("Loading map…");

  try {
    const raw  = await d3.json(country.geojson);
    const cfg  = COUNTRY_CONFIG[country.id] || { bbox: null };
    let feats  = raw.features || [];

    // ── Filter by country if the file is world-wide ──────────
    // Natural Earth admin-1 files have adm0_a3 / iso_a2 properties.
    // Per-country files won't have them, so we keep everything.
    const firstProps = feats[0]?.properties || {};
    const isWorldFile = !!(firstProps.adm0_a3 || firstProps.iso_a2 || firstProps.ADM0_A3);

    if (isWorldFile) {
      feats = feats.filter(f => {
        const p   = f.properties || {};
        const iso2 = (p.iso_a2  || p.ISO_A2  || "").toUpperCase();
        const iso3 = (p.adm0_a3 || p.ADM0_A3 || "").toUpperCase();
        return iso2 === country.id.toUpperCase() ||
               iso3 === (country.isoA3 || "").toUpperCase();
      });
    }

    // ── Clip by bbox (removes overseas territories) ───────────
    if (cfg.bbox) {
      const [minLon, minLat, maxLon, maxLat] = cfg.bbox;
      feats = feats.filter(f => {
        const c = roughCentroid(f);
        return c && c[0] >= minLon && c[0] <= maxLon &&
                    c[1] >= minLat && c[1] <= maxLat;
      });
    }

    if (!feats.length) {
      showOverlay("⚠ No regions found in this file.\nCheck countries.js and the GeoJSON.");
      return;
    }

    state.features    = feats;
    state.regionOrder = shuffle(feats.map((_, i) => i));

    hideOverlay();
    buildMap();
    revealNext();

  } catch (e) {
    console.error(e);
    showOverlay("⚠ Could not load map data.\nMake sure the .geojson file exists.");
  }
}

/* ═══════════════════════════════════════════════════════════════
   BUILD MAP
   Projects ONLY this country's regions, fitting them to the canvas.
════════════════════════════════════════════════════════════════ */
function buildMap() {
  const W = els.mapContainer.clientWidth  || 800;
  const H = els.mapContainer.clientHeight || 500;
  svg.attr("viewBox", `0 0 ${W} ${H}`);

  const fc = { type: "FeatureCollection", features: state.features };

  projection = d3.geoMercator()
    .fitExtent([[40, 40], [W - 40, H - 40]], fc);

  pathGen = d3.geoPath().projection(projection);

  // All paths — invisible until revealed
  state.features.forEach((feat, i) => {
    gMap.append("path")
      .datum(feat)
      .attr("class", "region-path")
      .attr("d", pathGen)
      .attr("data-i", i);
  });

  // All labels — invisible until revealed (and only if toggle is on)
  state.features.forEach((feat, i) => {
    const c    = pathGen.centroid(feat);
    if (isNaN(c[0])) return;
    const name = pickName(feat, state.country);
    gMap.append("text")
      .attr("class", "region-label")
      .attr("x", c[0])
      .attr("y", c[1])
      .attr("data-i", i)
      .text(name);
  });
}

/* ═══════════════════════════════════════════════════════════════
   REVEAL
════════════════════════════════════════════════════════════════ */
function revealNext() {
  if (state.revealed >= state.regionOrder.length) return;
  const idx = state.regionOrder[state.revealed];
  state.revealed++;

  gMap.selectAll(".region-path")
    .filter(function() { return +this.getAttribute("data-i") === idx; })
    .classed("visible", true);

  if (showLabels) {
    gMap.selectAll(".region-label")
      .filter(function() { return +this.getAttribute("data-i") === idx; })
      .classed("show", true);
  }

  const total = state.features.length;
  els.regionsRevealed.textContent =
    `${state.revealed} / ${total} region${total !== 1 ? "s" : ""} revealed`;
}

function revealAll(won) {
  gMap.selectAll(".region-path")
    .classed("visible", true)
    .classed("won", won);
  gMap.selectAll(".region-label").classed("show", true);
  els.regionsRevealed.textContent = `All ${state.features.length} regions revealed`;
}

/* ═══════════════════════════════════════════════════════════════
   GUESS
════════════════════════════════════════════════════════════════ */
function submitGuess() {
  if (state.over || state.won) return;
  const raw   = els.guessInput.value.trim();
  const guess = COUNTRIES.find(c => c.name.toLowerCase() === raw.toLowerCase());
  closeAutocomplete();

  if (!guess) { shakeInput(); return; }

  const correct = guess.id === state.country.id;
  const distKm  = haversineKm(guess.capital, state.country.capital);
  const bearing = calcBearing(guess.capital, state.country.capital);

  state.guesses.push({ name: guess.name, flag: guess.flag, distKm, bearing, correct });
  renderGuessRow({ name: guess.name, flag: guess.flag, distKm, bearing, correct });
  els.guessInput.value = "";

  if (correct) {
    state.won  = true;
    state.over = true;
    revealAll(true);
    finishRound(true);
  } else {
    revealNext();
  }
}

function renderGuessRow(e) {
  const empty = els.guessesList.querySelector(".empty-state");
  if (empty) empty.remove();

  const dc  = e.distKm < 1500 ? "dist-hot" : e.distKm < 4000 ? "dist-warm" : "dist-cold";
  const arr = e.correct ? "✓" : bearingToArrow(e.bearing);

  const row = document.createElement("div");
  row.className = "guess-row" + (e.correct ? " correct" : "");
  row.innerHTML = `
    <span class="guess-flag">${e.flag}</span>
    <span class="guess-name">${e.name}</span>
    <span class="guess-dist ${dc}">${e.correct ? "✓" : fmtKm(e.distKm)}</span>
    <span class="guess-arrow">${arr}</span>
  `;
  els.guessesList.prepend(row);
}

/* ═══════════════════════════════════════════════════════════════
   FINISH ROUND
════════════════════════════════════════════════════════════════ */
function finishRound(won) {
  const n = state.guesses.length;
  stats.played++;
  if (won) { stats.won++; stats.streak++; stats.totalGuessesOnWin += n; }
  else      { stats.streak = 0; }
  saveStats(); renderStats();

  setTimeout(() => {
    els.modalIcon.textContent  = won ? "🎉" : "💀";
    els.modalTitle.textContent = won ? "Correct!" : "Game over";
    els.modalFlag.textContent  = state.country.flag;
    els.modalBody.textContent  = won
      ? `You found ${state.country.name} in ${n} guess${n !== 1 ? "es" : ""}!`
      : `The answer was ${state.country.name}.`;
    openModal(els.resultBackdrop);
  }, 600);
}

/* ═══════════════════════════════════════════════════════════════
   AUTOCOMPLETE
════════════════════════════════════════════════════════════════ */
let acIndex = -1;

function handleInput() {
  const val = els.guessInput.value.trim().toLowerCase();
  if (!val) { closeAutocomplete(); return; }

  const matches = COUNTRIES.filter(c => c.name.toLowerCase().includes(val)).slice(0, 8);
  if (!matches.length) { closeAutocomplete(); return; }

  acIndex = -1;
  els.autocompleteList.innerHTML = matches.map((c, i) =>
    `<div class="autocomplete-item" data-index="${i}" data-name="${c.name}">${c.flag} ${c.name}</div>`
  ).join("");

  els.autocompleteList.querySelectorAll(".autocomplete-item").forEach(item => {
    item.addEventListener("mousedown", () => {
      els.guessInput.value = item.dataset.name;
      closeAutocomplete();
    });
  });
  els.autocompleteList.classList.add("open");
}

function moveAutocomplete(dir) {
  const items = els.autocompleteList.querySelectorAll(".autocomplete-item");
  if (!items.length) return;
  items[acIndex]?.classList.remove("active");
  acIndex = Math.max(0, Math.min(items.length - 1, acIndex + dir));
  items[acIndex].classList.add("active");
  els.guessInput.value = items[acIndex].dataset.name;
}

function closeAutocomplete() {
  els.autocompleteList.classList.remove("open");
  acIndex = -1;
}

/* ═══════════════════════════════════════════════════════════════
   EVENTS
════════════════════════════════════════════════════════════════ */
function bindEvents() {
  els.btnGuess.addEventListener("click", submitGuess);
  els.guessInput.addEventListener("keydown", e => {
    if      (e.key === "Enter")     submitGuess();
    else if (e.key === "ArrowDown") moveAutocomplete(1);
    else if (e.key === "ArrowUp")   moveAutocomplete(-1);
    else if (e.key === "Escape")    closeAutocomplete();
  });
  els.guessInput.addEventListener("input", handleInput);
  els.guessInput.addEventListener("blur", () => setTimeout(closeAutocomplete, 150));

  els.toggleLabels.addEventListener("change", () => {
    showLabels = els.toggleLabels.checked;
    const revealedSet = new Set(state.regionOrder.slice(0, state.revealed));
    gMap.selectAll(".region-label").each(function() {
      const i = +this.getAttribute("data-i");
      d3.select(this).classed("show", showLabels && revealedSet.has(i));
    });
  });

  els.btnHow.addEventListener("click",   () => openModal(els.howBackdrop));
  els.howClose.addEventListener("click", () => closeModal(els.howBackdrop));
  els.howBackdrop.addEventListener("click", e => {
    if (e.target === els.howBackdrop) closeModal(els.howBackdrop);
  });
  els.btnNext.addEventListener("click", () => { closeModal(els.resultBackdrop); startNewRound(); });
  els.modalClose.addEventListener("click", () => closeModal(els.resultBackdrop));
  els.resultBackdrop.addEventListener("click", e => {
    if (e.target === els.resultBackdrop) closeModal(els.resultBackdrop);
  });
}

/* ═══════════════════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════════════════════ */
function loadStats() {
  try { return JSON.parse(localStorage.getItem("regionle_stats")) || defaultStats(); }
  catch { return defaultStats(); }
}
function defaultStats() { return { played:0, won:0, streak:0, totalGuessesOnWin:0 }; }
function saveStats()    { localStorage.setItem("regionle_stats", JSON.stringify(stats)); }
function renderStats()  {
  els.statPlayed.textContent = stats.played;
  els.statWon.textContent    = stats.won;
  els.statStreak.textContent = stats.streak;
  els.statAvg.textContent    = stats.won
    ? (stats.totalGuessesOnWin / stats.won).toFixed(1) : "—";
}

/* ═══════════════════════════════════════════════════════════════
   MODAL HELPERS
════════════════════════════════════════════════════════════════ */
function openModal(el)  { el.classList.add("open"); }
function closeModal(el) { el.classList.remove("open"); }

function showOverlay(msg) {
  els.mapOverlay.querySelector("p").textContent = msg;
  els.mapOverlay.classList.remove("hidden");
}
function hideOverlay() { els.mapOverlay.classList.add("hidden"); }

/* ═══════════════════════════════════════════════════════════════
   GEO UTILS
════════════════════════════════════════════════════════════════ */
function roughCentroid(feature) {
  try {
    const b = d3.geoBounds(feature);
    if (!b || isNaN(b[0][0])) return null;
    return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
  } catch { return null; }
}

function pickName(feat, country) {
  const p    = feat.properties || {};
  const keys = [
    country.nameProperty,
    "name", "NAME", "name_en", "Name",
    "admin", "gn_name", "region_nam", "state_name",
    "shapeName", "shapeISO",
  ];
  for (const k of keys) { if (p[k]) return p[k]; }
  return "";
}

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2-lat1)*r, dLon = (lon2-lon1)*r;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcBearing([lat1, lon1], [lat2, lon2]) {
  const r    = Math.PI/180;
  const dLon = (lon2-lon1)*r;
  const y    = Math.sin(dLon)*Math.cos(lat2*r);
  const x    = Math.cos(lat1*r)*Math.sin(lat2*r) -
               Math.sin(lat1*r)*Math.cos(lat2*r)*Math.cos(dLon);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

function bearingToArrow(deg) {
  return ["↑","↗","→","↘","↓","↙","←","↖"][Math.round(deg/45)%8];
}

function fmtKm(km) {
  return km >= 1000 ? (km/1000).toFixed(1)+" Mm" : Math.round(km)+" km";
}

function shakeInput() {
  els.guessInput.style.borderColor = "var(--danger)";
  els.guessInput.animate([
    {transform:"translateX(0)"},{transform:"translateX(-6px)"},
    {transform:"translateX(6px)"},{transform:"translateX(-4px)"},
    {transform:"translateX(4px)"},{transform:"translateX(0)"},
  ], {duration:300}).onfinish = () => { els.guessInput.style.borderColor = ""; };
}

function shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
