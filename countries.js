/**
 * countries.js
 * ─────────────────────────────────────────────────────────────
 * Central registry of every country the game supports.
 *
 * HOW TO ADD A NEW COUNTRY:
 *  1. Find its GeoJSON on:  https://geojson-maps.kyd.au/
 *     or convert from Natural Earth via https://mapshaper.org
 *     Make sure it has Admin-1 level regions (states/provinces).
 *  2. Host the file in  data/countries/<iso>.geojson
 *     (or use a CDN / raw GitHub URL)
 *  3. Copy one of the entries below and fill in the fields.
 *
 * FIELDS:
 *   id        – ISO 3166-1 alpha-2 code (lowercase)
 *   name      – English name shown in autocomplete & guess list
 *   flag      – emoji flag
 *   capital   – used for distance reference point [lat, lng]
 *   geojson   – URL to the GeoJSON file with admin-1 regions
 *               The features must have a property containing the
 *               region name; set `nameProperty` to that key.
 *   nameProperty – GeoJSON feature property key for region name
 *                  (typically "name", "NAME", or "name_en")
 * ─────────────────────────────────────────────────────────────
 */

window.COUNTRIES = [
  {
    id: "pl",
    name: "Poland",
    flag: "🇵🇱",
    capital: [52.2297, 21.0122],
    nameProperty: "name",
    geojson: "data/countries/pl.geojson"
  },
  {
    id: "us",
    name: "United States",
    flag: "🇺🇸",
    capital: [38.9072, -77.0369],
    nameProperty: "name",
    geojson: "data/countries/us.geojson"
  },
  {
    id: "de",
    name: "Germany",
    flag: "🇩🇪",
    capital: [52.5200, 13.4050],
    nameProperty: "name",
    geojson: "data/countries/de.geojson"
  },
  {
    id: "fr",
    name: "France",
    flag: "🇫🇷",
    capital: [48.8566, 2.3522],
    nameProperty: "name",
    geojson: "data/countries/fr.geojson"
  },
  {
    id: "it",
    name: "Italy",
    flag: "🇮🇹",
    capital: [41.9028, 12.4964],
    nameProperty: "name",
    geojson: "data/countries/it.geojson"
  },
  {
    id: "br",
    name: "Brazil",
    flag: "🇧🇷",
    capital: [-15.7797, -47.9297],
    nameProperty: "name",
    geojson: "data/countries/br.geojson"
  },
  {
    id: "jp",
    name: "Japan",
    flag: "🇯🇵",
    capital: [35.6762, 139.6503],
    nameProperty: "name",
    geojson: "data/countries/jp.geojson"
  },
  {
    id: "au",
    name: "Australia",
    flag: "🇦🇺",
    capital: [-35.2809, 149.1300],
    nameProperty: "name",
    geojson: "data/countries/au.geojson"
  }
];

/**
 * All country names for the autocomplete list
 * (includes aliases / alternate spellings if needed)
 */
window.ALL_COUNTRY_NAMES = window.COUNTRIES.map(c => c.name);
