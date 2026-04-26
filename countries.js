/**
 * countries.js — Regionle
 * ─────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW COUNTRY:
 *  1. Get a GeoJSON with Admin-1 regions for that country.
 *     Best source: Natural Earth → mapshaper.org (filter by adm0_a3)
 *     Or per-country files from geoBoundaries.
 *  2. Save as  data/countries/<id>.geojson
 *  3. Add one entry below.
 *  4. If the country has overseas territories that distort the map,
 *     add a bbox entry in COUNTRY_CONFIG inside game.js.
 *
 * FIELDS:
 *   id           – ISO 3166-1 alpha-2 lowercase  (used in geojson path)
 *   isoA3        – ISO 3166-1 alpha-3 uppercase  (used to filter Natural Earth files)
 *   name         – English name shown in autocomplete
 *   flag         – emoji flag
 *   capital      – [lat, lng] used for distance calculation
 *   nameProperty – GeoJSON property key for region name (usually "name")
 *   geojson      – path to the GeoJSON file
 */

window.COUNTRIES = [
  {
    id: "pl", isoA3: "POL",
    name: "Poland", flag: "🇵🇱",
    capital: [52.2297, 21.0122],
    nameProperty: "name",
    geojson: "data/countries/pl.geojson"
  },
  {
    id: "us", isoA3: "USA",
    name: "United States", flag: "🇺🇸",
    capital: [38.9072, -77.0369],
    nameProperty: "name",
    geojson: "data/countries/us.geojson"
  },
  {
    id: "de", isoA3: "DEU",
    name: "Germany", flag: "🇩🇪",
    capital: [52.5200, 13.4050],
    nameProperty: "name",
    geojson: "data/countries/de.geojson"
  },
  {
    id: "fr", isoA3: "FRA",
    name: "France", flag: "🇫🇷",
    capital: [48.8566, 2.3522],
    nameProperty: "name",
    geojson: "data/countries/fr.geojson"
  },
  {
    id: "it", isoA3: "ITA",
    name: "Italy", flag: "🇮🇹",
    capital: [41.9028, 12.4964],
    nameProperty: "name",
    geojson: "data/countries/it.geojson"
  },
  {
    id: "br", isoA3: "BRA",
    name: "Brazil", flag: "🇧🇷",
    capital: [-15.7797, -47.9297],
    nameProperty: "name",
    geojson: "data/countries/br.geojson"
  },
  {
    id: "jp", isoA3: "JPN",
    name: "Japan", flag: "🇯🇵",
    capital: [35.6762, 139.6503],
    nameProperty: "name",
    geojson: "data/countries/jp.geojson"
  },
  {
    id: "au", isoA3: "AUS",
    name: "Australia", flag: "🇦🇺",
    capital: [-35.2809, 149.1300],
    nameProperty: "name",
    geojson: "data/countries/au.geojson"
  }
];
