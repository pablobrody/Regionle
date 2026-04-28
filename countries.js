/**
 * countries.js — Regionle
 *
 * Aby dodać nowy kraj:
 * 1. Dodaj plik  data/countries/<id>.geojson  (per-kraj, bez innych państw)
 * 2. Dopisz obiekt poniżej
 *
 * Pola:
 *   id           – ISO 3166-1 alpha-2 (małe litery), = nazwa pliku bez rozszerzenia
 *   isoA3        – ISO 3166-1 alpha-3 (wielkie), potrzebne do skryptu split_geojson.py
 *   name         – angielska nazwa (autocomplete)
 *   flag         – emoji flagi
 *   capital      – [lat, lng] stolicy (do obliczania odległości)
 *   nameProperty – klucz właściwości z nazwą regionu w GeoJSON (zazwyczaj "name")
 *   geojson      – ścieżka do pliku GeoJSON
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
