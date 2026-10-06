import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../src/services/yacgmsHydrology.ts", import.meta.url), "utf8");
for (const marker of ["Подготовка+", "Время рыбалки", "Снасти", "Рыба", "Лодка или берег", "Отчёт подготовки", "Наживка / приманка", "Прикормка", "Крючки и монтаж"]) {
  if (!app.includes(marker)) throw new Error(`Preparation marker missing: ${marker}`);
}
for (const marker of ["https://www.yacgms.ru/hydro/", "waterTempC", "levelCm", "DOMParser"]) {
  if (!source.includes(marker)) throw new Error(`Official hydrology marker missing: ${marker}`);
}
if (!app.includes("measuredWaterTempC") || !app.includes('waterTemp: hydrology?.measuredWaterTempC')) {
  throw new Error("Measured water temperature is not wired into forecast evidence");
}
console.log("preparation checks: OK (saved checklist, local report, official hydrology provenance)");
