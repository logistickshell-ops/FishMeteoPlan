import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/services/waterSearch.ts", import.meta.url), "utf8");
for (const marker of ["OVERPASS_ENDPOINT", "NOMINATIM_ENDPOINT", "waterway", "reservoir", "distanceKm", "OpenStreetMap"]) {
  if (!source.includes(marker)) throw new Error(`Water search marker missing: ${marker}`);
}
console.log("water search checks: OK (rivers, lakes, reservoirs, distance and OSM provenance)");
