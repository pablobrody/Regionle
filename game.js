/**
 * game.js  –  RegionGuesser core logic
 * ─────────────────────────────────────────────────────────────
 * Dependencies (loaded before this file in index.html):
 *   • D3.js v7
 *   • countries.js  (window.COUNTRIES, window.ALL_COUNTRY_NAMES)
 */

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & STATE
════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS_KM = 6371;

/** Game state — reset on each new round */
let state = {
  country: null,           // current country object from COUNTRIES
  geojsonData: null,       // full GeoJSON FeatureCollection
  regionOrder: [],         // shuffled indices into geojsonData.features
  revealed: 0,             // how many regions shown so far
  guesses: [],             // [{name, flag, distKm, bearing, correct}]
  won: false,
  over: false,
};

/** Persistent stats stored in localStorage */
let stats = loadStats();

/** D3 internals */
let svg, projection, path, g;
let showLabels = false;

/* ═══════════════════════════════════════════════════════════════
   DOM REFS
════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const els = {
  mapSvg:          $("mapSvg"),
  mapContainer:    $("mapContainer"),
  mapOverlay:      $("mapOverlay"),
  regionsRevealed: $("regionsRevealed"),
  guessInput:      $("guessInput"),
  autocompleteList:$("autocompleteList"),
  btnGuess:        $("btnGuess"),
  guessesList:     $("guessesList"),
  toggleLabels:    $("toggleLabels"),
  btnHow:          $("btnHow"),
  // result modal
  resultBackdrop:  $("resultBackdrop"),
  resultModal:     $("resultModal"),
  modalIcon:       $("modalIcon"),
  modalTitle:      $("modalTitle"),
  modalBody:       $("modalBody"),
  modalFlag:       $("modalFlag"),
  btnNext:         $("btnNext"),
  modalClose:      $("modalClose"),
  // how modal
  howBackdrop:     $("howBackdrop"),
  howClose:        $("howClose"),
  // stats
  statPlayed:      $("statPlayed"),
  statWon:         $("statWon"),
  statStreak:      $("statStreak"),
  statAvg:         $("statAvg"),
};

/* ═══════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  setupSvg();
  bindEvents();
  renderStats();
  startNewRound();
});

function setupSvg() {
  svg = d3.select(els.mapSvg);
  g   = svg.append("g").attr("class", "map-g");

  // Zoom & pan
  const zoom = d3.zoom()
    .scaleExtent([0.5, 12])
    .on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoom);
}

function bindEvents() {
  els.btnGuess.addEventListener("click", submitGuess);
  els.guessInput.addEventListener("keydown", e => {
    if (e.key === "Enter") submitGuess();
    else if (e.key === "ArrowDown") moveAutocomplete(1);
    else if (e.key === "ArrowUp")   moveAutocomplete(-1);
    else if (e.key === "Escape")    closeAutocomplete();
  });
  els.guessInput.addEventListener("input", handleInput);
  els.guessInput.addEventListener("blur", () => setTimeout(closeAutocomplete, 150));

  els.toggleLabels.addEventListener("change", () => {
    showLabels = els.toggleLabels.checked;
    g.selectAll(".region-label").classed("show", showLabels);
  });

  els.btnHow.addEventListener("click",  () => openModal(els.howBackdrop));
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
   ROUND MANAGEMENT
════════════════════════════════════════════════════════════════ */

async function startNewRound() {
  // pick random country
  const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];

  state = {
    country,
    geojsonData: null,
    regionOrder: [],
    revealed: 0,
    guesses: [],
    won: false,
    over: false,
  };

  // reset UI
  els.guessesList.innerHTML = '<div class="empty-state">No guesses yet — give it a shot!</div>';
  els.guessInput.value = "";
  els.guessInput.disabled = false;
  els.btnGuess.disabled = false;
  els.regionsRevealed.textContent = "— regions revealed";
  showOverlay("Loading map data…");
  g.selectAll("*").remove();

  // load GeoJSON
  try {
    const data = await d3.json(country.geojson);
    state.geojsonData = data;
    state.regionOrder = shuffle(Array.from({length: data.features.length}, (_, i) => i));
    hideOverlay();
    fitProjection(data);
    renderAllRegions(data);
    revealNextRegion();
  } catch (err) {
    console.error(err);
    showOverlay("⚠ Could not load map data.\nCheck that the GeoJSON file exists.");
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAP RENDERING
════════════════════════════════════════════════════════════════ */

function fitProjection(data) {
  const W = els.mapContainer.clientWidth;
  const H = els.mapContainer.clientHeight;

  projection = d3.geoMercator()
    .fitExtent([[24, 24], [W - 24, H - 24]], data);

  path = d3.geoPath().projection(projection);

  svg.attr("viewBox", `0 0 ${W} ${H}`);
}

function renderAllRegions(data) {
  const features = data.features;

  // draw all paths (invisible initially)
  g.selectAll(".region-path")
    .data(features)
    .enter()
    .append("path")
    .attr("class", "region-path")
    .attr("d", path)
    .attr("data-index", (_, i) => i);

  // draw all labels (invisible initially)
  features.forEach((feat, i) => {
    const centroid = path.centroid(feat);
    if (isNaN(centroid[0])) return;
    const name = feat.properties[state.country.nameProperty] || "";
    g.append("text")
      .attr("class", "region-label")
      .attr("x", centroid[0])
      .attr("y", centroid[1])
      .attr("data-index", i)
      .text(name)
      .classed("show", showLabels);
  });
}

function revealNextRegion() {
  if (state.revealed >= state.regionOrder.length) return;

  const idx = state.regionOrder[state.revealed];
  state.revealed++;

  g.selectAll(".region-path")
    .filter(function() { return +this.getAttribute("data-index") === idx; })
    .classed("visible", true);

  // update label visibility for the newly revealed region only
  g.selectAll(".region-label")
    .filter(function() { return +this.getAttribute("data-index") === idx; })
    .classed("show", showLabels);

  const total = state.geojsonData.features.length;
  els.regionsRevealed.textContent =
    `${state.revealed} / ${total} region${total !== 1 ? "s" : ""} revealed`;
}

function revealAll(won) {
  g.selectAll(".region-path")
    .classed("visible", true)
    .classed("won", won);
  g.selectAll(".region-label").classed("show", true);
  els.regionsRevealed.textContent =
    `All ${state.geojsonData.features.length} regions revealed`;
}

/* ═══════════════════════════════════════════════════════════════
   GUESSING
════════════════════════════════════════════════════════════════ */

function submitGuess() {
  if (state.over || state.won) return;

  const raw   = els.guessInput.value.trim();
  const guess = COUNTRIES.find(c => c.name.toLowerCase() === raw.toLowerCase());
  closeAutocomplete();

  if (!guess) {
    shakeInput();
    return;
  }

  const correct = guess.id === state.country.id;
  const distKm  = haversineKm(guess.capital, state.country.capital);
  const bearing = calcBearing(guess.capital, state.country.capital);

  const entry = {
    name: guess.name,
    flag: guess.flag,
    distKm,
    bearing,
    correct,
  };

  state.guesses.push(entry);
  renderGuessRow(entry);

  els.guessInput.value = "";

  if (correct) {
    state.won = true;
    state.over = true;
    revealAll(true);
    finishRound(true);
  } else {
    revealNextRegion();
  }
}

function renderGuessRow(entry) {
  // Remove empty state if present
  const empty = els.guessesList.querySelector(".empty-state");
  if (empty) empty.remove();

  const distClass = entry.distKm < 1500 ? "dist-hot"
                  : entry.distKm < 4000 ? "dist-warm"
                  : "dist-cold";

  const arrow = entry.correct ? "✓" : bearingToArrow(entry.bearing);

  const row = document.createElement("div");
  row.className = "guess-row" + (entry.correct ? " correct" : "");
  row.innerHTML = `
    <span class="guess-flag">${entry.flag}</span>
    <span class="guess-name">${entry.name}</span>
    <span class="guess-dist ${distClass}">${entry.correct ? "✓" : fmtKm(entry.distKm)}</span>
    <span class="guess-arrow">${arrow}</span>
  `;
  els.guessesList.prepend(row);
}

/* ═══════════════════════════════════════════════════════════════
   FINISH ROUND
════════════════════════════════════════════════════════════════ */

function finishRound(won) {
  const guessCount = state.guesses.length;

  // update stats
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    stats.totalGuessesOnWin += guessCount;
  } else {
    stats.streak = 0;
  }
  saveStats();
  renderStats();

  // show modal after short delay
  setTimeout(() => {
    els.modalIcon.textContent  = won ? "🎉" : "💀";
    els.modalTitle.textContent = won ? "Correct!" : "Game over";
    els.modalFlag.textContent  = state.country.flag;
    els.modalBody.textContent  = won
      ? `You found ${state.country.name} in ${guessCount} guess${guessCount !== 1 ? "es" : ""}!`
      : `The country was ${state.country.name}.`;
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

  const matches = COUNTRIES
    .filter(c => c.name.toLowerCase().includes(val))
    .slice(0, 8);

  if (!matches.length) { closeAutocomplete(); return; }

  acIndex = -1;
  els.autocompleteList.innerHTML = matches.map((c, i) =>
    `<div class="autocomplete-item" data-index="${i}" data-name="${c.name}">
       ${c.flag} ${c.name}
     </div>`
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
   STATS
════════════════════════════════════════════════════════════════ */

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem("rg_stats")) || defaultStats();
  } catch { return defaultStats(); }
}
function defaultStats() {
  return { played: 0, won: 0, streak: 0, totalGuessesOnWin: 0 };
}
function saveStats() {
  localStorage.setItem("rg_stats", JSON.stringify(stats));
}
function renderStats() {
  els.statPlayed.textContent = stats.played;
  els.statWon.textContent    = stats.won;
  els.statStreak.textContent = stats.streak;
  els.statAvg.textContent    = stats.won
    ? (stats.totalGuessesOnWin / stats.won).toFixed(1)
    : "—";
}

/* ═══════════════════════════════════════════════════════════════
   MODALS
════════════════════════════════════════════════════════════════ */

function openModal(el)  { el.classList.add("open"); }
function closeModal(el) { el.classList.remove("open"); }

/* ═══════════════════════════════════════════════════════════════
   OVERLAY
════════════════════════════════════════════════════════════════ */

function showOverlay(msg) {
  els.mapOverlay.querySelector("p").textContent = msg;
  els.mapOverlay.classList.remove("hidden");
}
function hideOverlay() {
  els.mapOverlay.classList.add("hidden");
}

/* ═══════════════════════════════════════════════════════════════
   SHAKE ANIMATION
════════════════════════════════════════════════════════════════ */

function shakeInput() {
  els.guessInput.style.borderColor = "var(--danger)";
  els.guessInput.animate([
    {transform: "translateX(0)"},
    {transform: "translateX(-6px)"},
    {transform: "translateX(6px)"},
    {transform: "translateX(-4px)"},
    {transform: "translateX(4px)"},
    {transform: "translateX(0)"},
  ], {duration: 300, easing: "ease-in-out"}).onfinish = () => {
    els.guessInput.style.borderColor = "";
  };
}

/* ═══════════════════════════════════════════════════════════════
   GEO MATH
════════════════════════════════════════════════════════════════ */

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = EARTH_RADIUS_KM;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing([lat1, lon1], [lat2, lon2]) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
          - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingToArrow(deg) {
  const dirs = ["↑","↗","→","↘","↓","↙","←","↖"];
  return dirs[Math.round(deg / 45) % 8];
}

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

function fmtKm(km) {
  return km >= 1000
    ? (km / 1000).toFixed(1) + " Mm"
    : Math.round(km) + " km";
}

/* ═══════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════ */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
