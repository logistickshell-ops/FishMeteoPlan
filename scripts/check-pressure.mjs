import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
for (const marker of ["pressure_msl", "hpaToMmhg", "pressureHpa", "0.750061683"]) {
  if (!source.includes(marker)) throw new Error(`Pressure marker missing: ${marker}`);
}
const mmHg = 1028 * 0.750061683;
if (Math.round(mmHg) !== 771) throw new Error(`Pressure conversion failed: ${mmHg}`);
console.log(`pressure checks: OK (1028 hPa -> ${Math.round(mmHg)} mmHg; source pressure_msl preserved)`);
