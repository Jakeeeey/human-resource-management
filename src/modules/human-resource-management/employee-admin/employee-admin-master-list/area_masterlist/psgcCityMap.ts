/**
 * psgcCityMap.ts
 *
 * Bridges the Spring Boot `city` field (Title-Case, free-text) to a Philippine
 * Standard Geographic Code (PSGC) so we can fetch the correct GeoJSON boundary
 * file from the faeldon/philippines-json-maps CDN.
 *
 * Data source: area_masterlist/cityData.json  (PSGC code → canonical ALL-CAPS name)
 * GeoJSON CDN: https://github.com/faeldon/philippines-json-maps (2023, low-res)
 */

// cityData.json is already in the project — 43 KB, every PH city/municipality
import cityDataRaw from "./cityData.json";
import provinceDataRaw from "./provinceData.json";

const cityData = cityDataRaw as Record<string, string>;
const provinceData = provinceDataRaw as Record<string, string>;

// ─── GeoJSON URL builder ───────────────────────────────────────────────────────
// 2019 dataset uses barangays-municity-ph{CODE}000.0.001.json naming,
// which maps directly to the 6-digit PSGC codes in cityData.json.
// The "barangays-municity" files contain the barangay polygons that together
// make up the city/municipality boundary — perfect for choropleth by city.
const GEOJSON_BASE =
  "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2019/geojson/barangays/lowres";

/**
 * Returns the CDN URL for a per-city boundary GeoJSON file (low-res barangay polygons).
 * File pattern: barangays-municity-ph{PSGC6}000.0.001.json
 */
export function getCityGeoJsonUrl(psgcCode: string): string {
  return `${GEOJSON_BASE}/barangays-municity-ph${psgcCode}000.0.001.json`;
}

// ─── Reverse-lookup index: normalised name → PSGC 6-digit code ────────────────
// Since cities can share names across provinces (e.g., San Jose), we index by province prefix too.
function buildCityIndex(): Record<string, string[]> {
  const index: Record<string, string[]> = {};

  const add = (name: string, psgc: string) => {
    if (!index[name]) index[name] = [];
    index[name].push(psgc);
  };

  for (const [psgc, rawName] of Object.entries(cityData)) {
    const name = rawName.toUpperCase().trim();

    // 1. Store as-is (e.g. "DAGUPAN CITY")
    add(name, psgc);

    // 2. Strip trailing parentheticals → "LINGAYEN (CAPITAL)" → "LINGAYEN"
    const stripped = name.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (stripped && stripped !== name) {
      add(stripped, psgc);
    }

    // 3. "CITY OF X" ↔ "X CITY"  (e.g. "CITY OF URDANETA" ↔ "URDANETA CITY")
    if (name.startsWith("CITY OF ")) {
      const bare = name.slice("CITY OF ".length).trim();
      add(`${bare} CITY`, psgc);
    } else if (name.endsWith(" CITY") && !name.startsWith("CITY OF ")) {
      const bare = name.slice(0, -" CITY".length).trim();
      add(`CITY OF ${bare}`, psgc);
    }

    // 4. "MUNICIPALITY" permutations
    // If the canonical name does not include CITY or MUNICIPALITY, assume it's a municipality
    // and generate common user typed variations.
    if (!name.includes("CITY") && !name.includes("MUNICIPALITY")) {
      add(`${name} MUNICIPALITY`, psgc);
      add(`MUNICIPALITY OF ${name}`, psgc);
    }
  }

  return index;
}

const CITY_INDEX = buildCityIndex();

function buildProvinceIndex(): Record<string, string> {
  const index: Record<string, string> = {};
  for (const [prefix, rawName] of Object.entries(provinceData)) {
    index[rawName.toUpperCase().trim()] = prefix;
  }
  return index;
}

const PROV_INDEX = buildProvinceIndex();

// ─── Placeholder strings stored in DB when a form was never filled ────────────
const PLACEHOLDER_FRAGMENTS = [
  "select a",
  "select city",
  "select municipality",
  "select barangay",
  "unknown",
];

/**
 * Resolve a DB `city` string (any case, possibly with placeholders) to its
 * PSGC 6-digit code, constrained by the `province` name.
 * Returns `null` when the city is unrecognised or a placeholder.
 */
export function getPsgcCode(cityName: string | null | undefined, provinceName: string | null | undefined): string | null {
  if (!cityName) return null;

  const lower = cityName.toLowerCase().trim();
  if (!lower) return null;

  // Guard: skip placeholder dropdown values
  for (const frag of PLACEHOLDER_FRAGMENTS) {
    if (lower.includes(frag)) return null;
  }

  const upperCity = cityName.toUpperCase().trim();
  const upperProv = provinceName ? provinceName.toUpperCase().trim() : "";
  // 1. Resolve province prefix fuzzily
  const provPrefix = upperProv ? getProvincePrefixByName(upperProv) : null;

  const findBestCode = (candidates: string[] | undefined): string | null => {
    if (!candidates || candidates.length === 0) return null;
    // If a province prefix is specified and matched, enforce it.
    if (provPrefix) {
      const match = candidates.find((code) => code.startsWith(provPrefix));
      if (match) return match;
    }
    // If no province constraint or mismatch (bad user data), return the first match.
    return candidates[0];
  };

  // 1. Exact match
  let code = findBestCode(CITY_INDEX[upperCity]);
  if (code) return code;

  // 2. Match after stripping parentheticals
  const stripped = upperCity.replace(/\s*\([^)]*\)\s*/g, "").trim();
  if (stripped !== upperCity) {
    code = findBestCode(CITY_INDEX[stripped]);
    if (code) return code;
  }

  // 3. Try the "CITY OF X" ↔ "X CITY" swap
  if (upperCity.startsWith("CITY OF ")) {
    const bare = upperCity.slice("CITY OF ".length).trim();
    code = findBestCode(CITY_INDEX[`${bare} CITY`]);
    if (code) return code;
  } else if (upperCity.endsWith(" CITY")) {
    const bare = upperCity.slice(0, -" CITY".length).trim();
    code = findBestCode(CITY_INDEX[`CITY OF ${bare}`]);
    if (code) return code;
  }

  // 4. Advanced Fuzzy Fallback Match (Iterate all cities and find best inclusion match)
  const normCity = cityName.toLowerCase().replace(/[^a-z0-9]/g, "");
  let bestFuzzyMatch: string | null = null;
  let bestScore = 0;

  for (const [name, codes] of Object.entries(CITY_INDEX)) {
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normName === normCity || normName.includes(normCity) || normCity.includes(normName)) {
      
      let validCode = codes[0];
      if (provPrefix) {
         const provBoundCode = codes.find(c => c.startsWith(provPrefix));
         if (!provBoundCode) continue; // skip if doesn't match the strictly resolved province
         validCode = provBoundCode;
      }

      // We want the closest match in length
      const score = 100 - Math.abs(normName.length - normCity.length);
      if (score > bestScore) {
        bestScore = score;
        bestFuzzyMatch = validCode;
      }
    }
  }

  if (bestFuzzyMatch) return bestFuzzyMatch;

  return null;
}

/**
 * Derive a 4-character province prefix from a 6-digit PSGC code.
 * E.g. "015518" (Dagupan City) → "0155" (Pangasinan)
 */
export function getProvincePrefix(psgcCode: string): string {
  return psgcCode.substring(0, 4);
}

/**
 * Get a 4-character province prefix from the database `province` string using fuzzy matching.
 */
export function getProvincePrefixByName(provinceName: string | null | undefined): string | null {
  if (!provinceName) return null;
  const upperProv = provinceName.toUpperCase().trim();
  
  // 1. Try Exact match
  if (PROV_INDEX[upperProv]) return PROV_INDEX[upperProv];

  // 2. Try Fuzzy match
  const normTarget = provinceName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normTarget) return null;

  for (const [name, prefix] of Object.entries(PROV_INDEX)) {
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normName === normTarget || normName.includes(normTarget) || normTarget.includes(normName)) {
      return prefix;
    }
  }

  return null;
}

// ─── Province centroid map (for low-zoom bubble view) ─────────────────────────
// Keys are the 4-digit PSGC province prefix.
export const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
  // Region I – Ilocos
  "0128": [17.5936, 120.613],  // Abra
  "0129": [18.1667, 120.75],   // Ilocos Norte
  "0130": [17.1667, 120.5],    // Ilocos Sur
  "0133": [16.6, 120.3167],    // La Union
  "0155": [15.9167, 120.3333], // Pangasinan
  // Region II – Cagayan Valley
  "0202": [18.1565, 121.7582], // Cagayan
  "0231": [17.0, 121.9167],    // Isabela
  "0250": [16.2833, 121.4667], // Quirino
  // CAR
  "1401": [18.253, 121.1441],  // Apayao
  "1402": [16.4809, 120.6186], // Benguet
  "1411": [16.4023, 120.596],  // Benguet (Baguio)
  "1413": [16.85, 121.1333],   // Ifugao
  "1414": [17.4167, 121.1667], // Kalinga
  "1415": [17.0833, 121.0],    // Mountain Province
  // Region III – Central Luzon
  "0308": [14.6196, 120.4431], // Bataan
  "0303": [14.8529, 120.892],  // Bulacan
  "0349": [15.5833, 121.0833], // Nueva Ecija
  "0354": [15.0167, 120.6167], // Pampanga
  "0355": [15.9167, 120.3333], // Pangasinan (backup)
  "0358": [15.5, 120.5],       // Tarlac
  "0369": [15.5, 120.5],       // Tarlac
  "0371": [15.4167, 120.1667], // Zambales
  // Region IV-A – CALABARZON
  "0410": [13.7565, 121.0583], // Batangas
  "0421": [14.2883, 120.8921], // Cavite
  "0434": [14.1667, 121.3333], // Laguna
  "0456": [14.1667, 121.8333], // Quezon
  "0458": [14.6167, 121.25],   // Rizal
  // NCR
  "1339": [14.5995, 120.9842], // Manila
  "1375": [14.5476, 121.0198], // NCR 4th District
  "1376": [14.5476, 121.0198], // NCR 4th District (alt)
  "1377": [14.5476, 121.0198], // NCR 4th District (alt)
  // Region V – Bicol
  "0517": [13.4862, 123.5186], // Camarines Sur
  // Region VI – Western Visayas
  "0643": [10.3157, 122.9],    // Iloilo
  // Region VII – Central Visayas
  "0722": [10.3157, 123.8854], // Cebu
  // Region X – Northern Mindanao
  "1042": [8.75, 124.8667],    // Misamis Oriental
  // Region XI – Davao
  "1120": [7.1908, 125.4553],  // Davao del Sur
  // Region XII – SOCCSKSARGEN
  "1245": [6.7, 124.85],       // South Cotabato
};
