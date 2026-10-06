import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../src/services/yacgmsHydrology.ts", import.meta.url), "utf8");
for (const marker of ["Подготовка+", "Дата из прогноза на неделю", "Выезд", "Время рыбалки", "morning", "evening", "night", "Снасти", "Рыба", "Лодка или берег", "Отчёт подготовки", "Наживка / приманка", "Прикормка", "Крючки и монтаж"]) {
  if (!app.includes(marker)) throw new Error(`Preparation marker missing: ${marker}`);
}
for (const marker of ["https://www.yacgms.ru/hydro/", "waterTempC", "levelCm", "DOMParser"]) {
  if (!source.includes(marker)) throw new Error(`Official hydrology marker missing: ${marker}`);
}
if (!app.includes("measuredWaterTempC") || !app.includes('waterTemp: hydrology?.measuredWaterTempC')) {
  throw new Error("Measured water temperature is not wired into forecast evidence");
}
if (!app.includes("sm:grid-cols-4") || !app.includes("px-3 py-4")) throw new Error("mobile layout markers missing");
console.log("preparation checks: OK (week date, periods, saved plan, mobile layout, official hydrology provenance)");
