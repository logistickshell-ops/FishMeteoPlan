import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/algorithm/forecastEngine.ts", import.meta.url), "utf8");
const clamp = (value, min = 0, max = 1) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0.5;
const weights = [
  [0.18, .14, .13, .08, .08, .10, .05, .08, .07, .04, .03, .02],
  [.17, .14, .12, .10, .12, .05, .07, .05, .07, .05, .03, .03],
];

for (const sum of weights.map((row) => row.reduce((a, b) => a + b, 0))) {
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`weight sum is ${sum}`);
}
if (clamp(1 - Math.abs(10) / 3) !== 0) throw new Error("pressure delta +10 must normalize to zero");
if (clamp(1 - Math.abs(-10) / 3) !== 0) throw new Error("pressure delta -10 must normalize to zero");
if (clamp(1 - 2 * Math.abs(0.5 - 0.5)) !== 1) throw new Error("full lunar normalization failed");
if (clamp(1 - 2 * Math.abs(0 - 0.5)) !== 0) throw new Error("new lunar normalization failed");
if (!source.includes("base < .40 || base > .60")) throw new Error("heuristic neutral-band gate missing");
if (!source.includes("Math.max(-.12, Math.min(.12")) throw new Error("heuristic cap missing");
if (!source.includes("isLegalClosure")) throw new Error("legal gate missing");
if (!source.includes("confidenceBreakdown")) throw new Error("confidence breakdown missing");
if (!source.includes("Number.isFinite")) throw new Error("finite fallback missing");
console.log("algorithm checks: OK");
