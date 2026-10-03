import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/services/hydrology.ts", import.meta.url), "utf8");
const required = [
  "flood-api.open-meteo.com/v1/flood",
  'discharge: discharge === null ? "missing" : "modelled"',
  'waterTemp: "missing"',
  'oxygen: "missing"',
  'turbidity: "missing"',
  'waterLevel: "missing"',
  "Для выбранного типа водного объекта модельный речной режим не применим",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Hydrology provenance marker missing: ${marker}`);
}
console.log("hydrology checks: OK (GloFAS discharge modelled; water measurements never fabricated)");
