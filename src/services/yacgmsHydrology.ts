export interface OfficialWaterObservation {
  station: string;
  riverOrWater: string;
  measuredAt: string;
  levelCm: number | null;
  waterTempC: number | null;
  sourceUrl: string;
  sourceLabel: string;
}

const SOURCE_URL = "https://www.yacgms.ru/hydro/";

const aliases: Array<{ match: RegExp; station: RegExp }> = [
  { match: /которосл/i, station: /гаврилов\s*ям/i },
  { match: /сить/i, station: /правдино/i },
  { match: /соть/i, station: /верхний\s*жар/i },
  { match: /юхоть/i, station: /большое\s*село/i },
  { match: /ухра/i, station: /клочково/i },
  { match: /переслав|плещеево|трубеж/i, station: /петровское|переслав/i },
  { match: /рыбин|рыбинское|шексна/i, station: /переборы|рыбинск/i },
  { match: /углич/i, station: /углич/i },
];

function cellText(cell: Element | undefined) {
  return (cell?.textContent || "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: string) {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export async function fetchOfficialWaterObservation(waterName: string): Promise<OfficialWaterObservation | null> {
  const alias = aliases.find((item) => item.match.test(waterName));
  if (!alias) return null;
  const response = await fetch(SOURCE_URL, { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`ЯЦГМС HTTP ${response.status}`);
  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(document.querySelectorAll("tr"));
  const row = rows.find((candidate) => alias.station.test(cellText(candidate)));
  if (!row) return null;
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 7) return null;
  const station = cellText(cells[0]);
  const level = cellText(cells[5]);
  const waterTemp = cellText(cells[6]);
  return {
    station,
    riverOrWater: waterName,
    measuredAt: "Данные страницы ЯЦГМС: 21:00 МСК",
    levelCm: parseNumber(level),
    waterTempC: parseNumber(waterTemp),
    sourceUrl: SOURCE_URL,
    sourceLabel: "Ярославский ЦГМС · официальная гидрологическая сводка",
  };
}
