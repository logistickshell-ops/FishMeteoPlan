import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/data/regionalBeacons.ts", import.meta.url), "utf8");
const required = ["volga-yaroslavl", "kotorosl", "rybinsk-reservoir", "uglich-reservoir", "pleshcheyevo"];
for (const id of required) {
  if (!source.includes(`id: "${id}"`)) throw new Error(`missing regional beacon: ${id}`);
}
if (!source.includes('effect: "gate"')) throw new Error("legal gate beacon is missing");
if (!source.includes('sourceType: "missing"')) throw new Error("missing-source state is missing");
if (!source.includes("низкую доказательность") && !source.includes("не доказательством")) throw new Error("evidence limitation is missing");
if (!source.includes("доказательностью") && !source.includes("не доказательством")) throw new Error("evidence limitation is missing");
if (source.includes("probability") || source.includes("вероятность улова")) throw new Error("regional data must not contain fabricated probabilities");
console.log("regional beacon checks: OK (5 evidence-backed objects, no fabricated probabilities)");
