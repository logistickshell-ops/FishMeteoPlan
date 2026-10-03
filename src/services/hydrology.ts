export type HydrologyEvidence = "measured" | "modelled" | "missing";

export interface HydrologySnapshot {
  dischargeM3s: number | null;
  dischargeDate: string | null;
  dischargeForecast: Array<{ date: string; value: number }>;
  evidence: {
    discharge: HydrologyEvidence;
    waterTemp: HydrologyEvidence;
    oxygen: HydrologyEvidence;
    turbidity: HydrologyEvidence;
    waterLevel: HydrologyEvidence;
  };
  source: string;
  sourceLabel: string;
  requestedCoordinates: { lat: number; lon: number };
  returnedCoordinates?: { lat: number; lon: number };
  note: string;
  error?: string;
}

const FLOOD_ENDPOINT = "https://flood-api.open-meteo.com/v1/flood";

export async function fetchHydrologySnapshot(
  location: { lat: number; lon: number; type: "river" | "lake" | "reservoir" },
): Promise<HydrologySnapshot> {
  const requestedCoordinates = { lat: location.lat, lon: location.lon };
  const missingBase = {
    dischargeM3s: null,
    dischargeDate: null,
    dischargeForecast: [] as Array<{ date: string; value: number }>,
    evidence: {
      discharge: "missing" as const,
      waterTemp: "missing" as const,
      oxygen: "missing" as const,
      turbidity: "missing" as const,
      waterLevel: "missing" as const,
    },
    source: FLOOD_ENDPOINT,
    sourceLabel: "Open-Meteo Flood / GloFAS",
    requestedCoordinates,
  };

  // GloFAS returns the nearest major river within a coarse grid. Showing it
  // for a lake as if it were a lake measurement would create false precision.
  if (location.type === "lake") {
    return {
      ...missingBase,
      note: "Для озера ближайший речной расход не подменяет измерения в озере.",
    };
  }

  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    daily: "river_discharge",
    past_days: "7",
    forecast_days: "7",
    timezone: "auto",
  });

  try {
    const response = await fetch(`${FLOOD_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Flood API HTTP ${response.status}`);
    const data = await response.json();
    const dates: string[] = data.daily?.time ?? [];
    const values: Array<number | null> = data.daily?.river_discharge ?? [];
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone || "UTC" }).format(new Date());
    const latestIndex = [...values]
      .map((value, index) => ({ value, index }))
      .reverse()
      .find(({ value, index }) => Number.isFinite(value) && dates[index] <= today)?.index;
    const discharge = latestIndex === undefined ? null : Number(values[latestIndex]);
    const forecast = dates
      .map((date, index) => ({ date, value: values[index] }))
      .filter(({ date, value }) => date >= today && Number.isFinite(value))
      .slice(0, 4)
      .map(({ date, value }) => ({ date, value: Number(value) }));

    return {
      ...missingBase,
      dischargeM3s: discharge,
      dischargeDate: latestIndex === undefined ? null : dates[latestIndex] ?? null,
      dischargeForecast: forecast,
      evidence: {
        ...missingBase.evidence,
        discharge: discharge === null ? "missing" : "modelled",
      },
      returnedCoordinates: Number.isFinite(data.latitude) && Number.isFinite(data.longitude)
        ? { lat: Number(data.latitude), lon: Number(data.longitude) }
        : undefined,
      note: "Расход — модельный GloFAS, ближайшая речная ячейка около 5 км; это не измерение уровня или расхода на гидропосту.",
    };
  } catch (error) {
    return {
      ...missingBase,
      note: "Источник расхода временно недоступен; гидрологические измерения не подменяются погодой.",
      error: error instanceof Error ? error.message : "Неизвестная ошибка Flood API",
    };
  }
}
