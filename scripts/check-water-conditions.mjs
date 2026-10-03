import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
for (const marker of ["Условия на воде", "Практические погодные условия", "Состояние речного режима", "Измерения", "Вывод для рыбалки"]) {
  if (!source.includes(marker)) throw new Error(`Water conditions marker missing: ${marker}`);
}
for (const obsolete of ["Прогноз речного расхода", "Речной расход:"]) {
  if (source.includes(obsolete)) throw new Error(`Obsolete water UI marker remains: ${obsolete}`);
}
console.log("water conditions checks: OK (three-level practical block; no absolute discharge UI)");
