import type { FishSpecies } from "../data/fishingData";

export type Period = "morning" | "day" | "evening" | "night";
export type ForecastStatus = "good" | "moderate" | "low" | "blocked";

export interface EngineWeather {
  temp: number;
  pressure: number;
  pressureTrend: "stable" | "falling" | "rising";
  pressureDelta3h?: number;
  humidity: number;
  wind: number;
  dir: string;
  cloudiness: string;
  rain: boolean;
  cloudCover?: number;
  uvIndex?: number;
  dewPoint?: number;
  sourceQuality?: number;
}

export interface EngineContext {
  waterTemp: number;
  waterLevelTrend: "rising" | "stable" | "falling";
  turbidity: number;
  oxygen: number;
  waterBody: "river" | "lake" | "reservoir";
  latitude: number;
  longitude: number;
  month: number;
  moonPhase: number;
  isLegalClosure: boolean;
  legalNotice: string;
}

export interface HeuristicApplication {
  name: string;
  shift: number;
  confidence: number;
  reason: string;
}

export interface ConfidenceBreakdown {
  dataCompleteness: number;
  trendStability: number;
  historicalMatch: number;
  apiResponseQuality: number;
}

export interface EngineResult {
  score: number;
  confidence: number;
  status: ForecastStatus;
  periods: Record<Period, number>;
  factors: Record<string, number>;
  heuristicsApplied: HeuristicApplication[];
  confidenceBreakdown: ConfidenceBreakdown;
  reasoning: string;
  legalNotice: string;
  recommendations: {
    comfortIndex: number;
    depthAdvice: string;
    baitAdvice: string;
    colorAdvice: string;
    strategyAdvice: string;
  };
}

const PERIODS: Period[] = ["morning", "day", "evening", "night"];
const clamp = (value: number, min = 0, max = 1) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0.5;
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const gaussian = (value: number, center: number, sigma: number) => Math.exp(-0.5 * ((value - center) / Math.max(sigma, 0.1)) ** 2);
const rangeComfort = (value: number, min: number, max: number) => {
  const center = (min + max) / 2;
  const sigma = Math.max((max - min) / 2, 0.5);
  return clamp(gaussian(value, center, sigma));
};

const WEIGHTS = {
  peaceful: { waterTemp: .18, pressure: .14, pressureTrend: .13, wind: .08, light: .08, oxygen: .10, turbidity: .05, waterLevel: .08, habitat: .07, moon: .04, season: .03, prey: .02 },
  predator: { waterTemp: .17, pressure: .14, pressureTrend: .12, wind: .10, light: .12, oxygen: .05, turbidity: .07, waterLevel: .05, habitat: .07, moon: .05, season: .03, prey: .03 },
} as const;

function pressureDelta(weather: EngineWeather) {
  if (Number.isFinite(weather.pressureDelta3h)) return weather.pressureDelta3h as number;
  if (weather.pressureTrend === "falling") return -2;
  if (weather.pressureTrend === "rising") return 2;
  return 0;
}

function seasonFactor(fish: FishSpecies, month: number, waterTemp: number) {
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
  let value = 0.55;
  if (["carp", "tench"].includes(fish.id)) value = season === "summer" ? .95 : season === "spring" ? .75 : season === "autumn" ? .60 : .25;
  else if (fish.id === "burbot") value = season === "winter" ? .95 : season === "autumn" ? .80 : .25;
  else if (fish.id === "catfish") value = season === "summer" && waterTemp > 20 ? .95 : season === "spring" ? .70 : .35;
  else if (["pike", "perch"].includes(fish.id)) value = season === "autumn" ? .90 : season === "spring" ? .80 : season === "summer" ? .65 : .45;
  else value = season === "spring" ? .80 : season === "summer" ? .75 : season === "autumn" ? .65 : .40;
  return value;
}

function habitatFactor(fish: FishSpecies, waterBody: EngineContext["waterBody"]) {
  const text = fish.habitats.join(" ").toLowerCase();
  const still = /оз\.|карьер|пруд|озеро/.test(text);
  const river = /р\.|волга|которосль|течение/.test(text);
  if (waterBody === "river") return river ? .9 : still ? .35 : .6;
  if (waterBody === "lake") return still ? .9 : river ? .45 : .65;
  return still || river ? .8 : .6;
}

function lightFactor(fish: FishSpecies, weather: EngineWeather) {
  const cloudy = weather.cloudiness === "Пасмурно" || weather.cloudiness === "Дождь" || (weather.cloudCover ?? 50) >= 70;
  if (fish.visibility === "low") return cloudy ? .9 : .25;
  if (fish.visibility === "high") return cloudy ? .45 : .85;
  return cloudy ? .75 : .60;
}

function windFactor(fish: FishSpecies, weather: EngineWeather) {
  if (weather.wind > fish.wind * 1.35) return .10;
  const speed = weather.wind <= 1 ? .42 : weather.wind <= 4 ? .88 : weather.wind <= fish.wind ? .72 : .38;
  const warm = ["Ю", "ЮЗ", "ЮВ"].includes(weather.dir);
  const direction = fish.windPreference === "windward" && warm ? .12 : fish.windPreference === "leeward" && !warm ? .06 : 0;
  return clamp(speed + direction);
}

function status(score: number, blocked: boolean): ForecastStatus {
  if (blocked) return "blocked";
  if (score >= .70) return "good";
  if (score >= .45) return "moderate";
  return "low";
}

function buildHeuristics(fish: FishSpecies, weather: EngineWeather, base: number): HeuristicApplication[] {
  if (base < .40 || base > .60) return [];
  const result: HeuristicApplication[] = [];
  if (weather.pressureTrend === "falling" && fish.type === "predator") result.push({ name: "falling_pressure_predator_window", shift: .04, confidence: .30, reason: "Эвристическое краткое окно перед ухудшением погоды" });
  if ((weather.cloudiness === "Пасмурно" || weather.cloudiness === "Дождь") && weather.wind >= 2 && weather.wind <= 5) result.push({ name: "cloudy_moderate_wind", shift: fish.type === "predator" ? .04 : .02, confidence: .30, reason: "Сочетание облачности и умеренного ветра" });
  const total = result.reduce((sum, item) => sum + item.shift, 0);
  if (Math.abs(total) > .12) result[result.length - 1].shift += total > 0 ? .12 - total : -.12 - total;
  return result;
}

export function calculateFishForecast(fish: FishSpecies, weather: EngineWeather, context: EngineContext): EngineResult {
  const predator = fish.type === "predator";
  const weights = predator ? WEIGHTS.predator : WEIGHTS.peaceful;
  const delta = pressureDelta(weather);
  const trendStability = clamp(1 - Math.abs(delta) / 3);
  const pressure = rangeComfort(weather.pressure, fish.pressure[0], fish.pressure[1]);
  const pressureTrend = trendStability;
  const waterTemp = rangeComfort(context.waterTemp, fish.temp[0], fish.temp[1]);
  const wind = windFactor(fish, weather);
  const light = lightFactor(fish, weather);
  const oxygen = clamp(context.oxygen);
  const turbidity = predator && fish.id !== "pike" ? clamp(1 - Math.abs(context.turbidity - .55) / .55) : clamp(1 - context.turbidity);
  const waterLevel = context.waterLevelTrend === "rising" ? (predator ? .85 : .78) : context.waterLevelTrend === "falling" ? .35 : .60;
  const habitat = habitatFactor(fish, context.waterBody);
  const moon = clamp(1 - 2 * Math.abs(context.moonPhase - .5));
  const season = seasonFactor(fish, context.month, context.waterTemp);
  const prey = predator ? clamp(.45 + (context.waterTemp > 15 && context.waterTemp < 25 ? .25 : 0) + (weather.wind > 1 && weather.wind < 6 ? .18 : 0) + (weather.rain ? .05 : 0)) : .55;
  const factors = { waterTemp, pressure, pressureTrend, wind, light, oxygen, turbidity, waterLevel, habitat, moon, season, prey };
  const weighted = Object.entries(factors).reduce((sum, [key, value]) => sum + weights[key as keyof typeof weights] * clamp(value), 0);
  const seasonMultiplier = .90 + season * .20;
  const regionalCalibration = context.latitude < 60 ? 1 : .98;
  const baseScore = clamp(weighted * seasonMultiplier * regionalCalibration);
  const heuristicsApplied = buildHeuristics(fish, weather, baseScore);
  const heuristicShift = Math.max(-.12, Math.min(.12, heuristicsApplied.reduce((sum, item) => sum + item.shift, 0)));
  const score = clamp(baseScore + heuristicShift);
  const completenessFields = [weather.temp, weather.pressure, weather.humidity, weather.wind, weather.cloudiness, context.waterTemp, context.oxygen, context.turbidity, context.waterBody, context.month, context.moonPhase];
  const dataCompleteness = completenessFields.filter((value) => value !== undefined && value !== null && value !== "").length / completenessFields.length;
  const apiResponseQuality = clamp(weather.sourceQuality ?? .85);
  const confidenceBreakdown = { dataCompleteness, trendStability, historicalMatch: .60, apiResponseQuality };
  const confidence = clamp(dataCompleteness * .35 + trendStability * .25 + .60 * .20 + apiResponseQuality * .20);
  const periods = {} as Record<Period, number>;
  for (const period of PERIODS) {
    const active = fish.active.includes(period);
    const lightWindow = period === "morning" || period === "evening" ? .06 : 0;
    const periodScore = clamp(score * (active ? .98 : .58) + lightWindow);
    periods[period] = context.isLegalClosure ? 0 : Math.round(periodScore * 100);
  }
  const finalScore = context.isLegalClosure ? 0 : score;
  const depthAdvice = context.waterTemp < 8 ? "Прогреваемые мелководья (1–3 м)" : predator && (weather.cloudiness === "Пасмурно" || weather.rain) ? "Косы и бровки (1–3 м)" : predator ? "Бровки и ямы (4–10 м)" : "Средняя глубина (3–5 м)";
  const baitAdvice = `Сезонные: ${fish.seasonalBait[context.month >= 3 && context.month <= 5 ? "spring" : context.month >= 6 && context.month <= 8 ? "summer" : context.month >= 9 && context.month <= 11 ? "autumn" : "winter"].slice(0, 2).join(", ")}`;
  const colorAdvice = context.turbidity > .6 ? "Яркие и контрастные цвета" : light < .5 ? "Контрастные тёмные тона" : "Естественные цвета";
  const strategyAdvice = context.waterLevelTrend === "rising" ? "Ищите затопленные участки и обратки" : predator ? "Активный поиск у границ течения и укрытий" : "Тихая ловля с точной подачей прикормки";
  const reasoning = context.isLegalClosure ? context.legalNotice : `Нормализованные факторы: вода ${Math.round(waterTemp * 100)}%, давление ${Math.round(pressure * 100)}%, тренд ${Math.round(pressureTrend * 100)}%, ветер ${Math.round(wind * 100)}%. Данные ${Math.round(dataCompleteness * 100)}%, доверие ${Math.round(confidence * 100)}%.`;
  return {
    score: finalScore,
    confidence,
    status: status(finalScore, context.isLegalClosure),
    periods,
    factors: Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, Math.round(clamp(value) * 100)])),
    heuristicsApplied,
    confidenceBreakdown,
    reasoning,
    legalNotice: context.legalNotice,
    recommendations: { comfortIndex: Math.round(finalScore * 100), depthAdvice, baitAdvice, colorAdvice, strategyAdvice },
  };
}

export function validateWeightSums() {
  return Object.values(WEIGHTS).map((weights) => round(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 6));
}

export const algorithmLegalNotice = "Прогноз вероятностный и не заменяет официальные правила рыболовства. В период нерестовых ограничений ловля блокируется; проверяйте актуальные правила региона.";
