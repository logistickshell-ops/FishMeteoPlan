import { readFileSync } from "node:fs";

const spots = readFileSync(new URL("../src/data/fishingSpots.ts", import.meta.url), "utf8");
const data = readFileSync(new URL("../src/data/fishingData.ts", import.meta.url), "utf8");

const requiredCities = ["ярославль", "рыбинск", "ростов великий", "переславль-залесский", "углич", "брейтово", "пошехонье", "тутаев"];
for (const city of requiredCities) {
  if (!spots.includes(`"${city}"`)) throw new Error(`Missing city catalogue: ${city}`);
}
const records = (spots.match(/\{ id: /g) || []).length;
if (records < 32) throw new Error(`Expected at least 32 spot records, got ${records}`);
const sources = (spots.match(/https?:\/\//g) || []).length;
if (sources < 32) throw new Error(`Expected sources for spot records, got ${sources}`);
if (spots.includes("coords:")) throw new Error("Spot catalogue must not invent coordinates");
if (!data.includes("isSpawningRestrictionActive") || !data.includes("getActiveSpawningRestrictions")) {
  throw new Error("Seasonal restriction helpers are missing");
}
if (!data.includes("export const tackleGuide") || !data.includes("export const fishingAdvice")) {
  throw new Error("Tackle/advice data is missing");
}
console.log(`fishing data checks: OK (${records} places, ${sources} sources)`);
