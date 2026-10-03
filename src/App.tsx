import React, { useState, useEffect, useMemo } from "react";
import {
  Fish as FishIcon,
  Cloud,
  CloudRain,
  CloudSun,
  Sun,
  Compass,
  Waves,
  Moon as MoonIcon,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Filter,
  Info,
  BookOpen,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Search,
  Copy,
  ChevronRight,
  X,
  PlusCircle,
  Sliders,
  ThermometerSnowflake,
  Activity,
  Share2
} from "lucide-react";
import {
  fishSpecies,
  spawningRules,
  fishingKnots,
  weatherChecklists,
  FishSpecies as FishType
} from "./data/fishingData";
import { useTelegram } from "./hooks/useTelegram";
import { algorithmLegalNotice, calculateFishForecast } from "./algorithm/forecastEngine";

interface LocationType {
  id: string;
  name: string;
  nameGenitive: string;
  coords: { lat: number; lon: number };
  description: string;
  type: "river" | "lake" | "reservoir";
  avgDepth: string;
}

const EMPTY_LOCATION: LocationType = {
  id: "",
  name: "",
  nameGenitive: "",
  coords: { lat: 0, lon: 0 },
  description: "",
  type: "river",
  avgDepth: "—",
};

// Type definitions
interface WeatherState {
  temp: number;
  pressure: number;
  pressureTrend: "stable" | "falling" | "rising";
  humidity: number;
  wind: number;
  dir: string;
  deg: number;
  desc: string;
  icon: string;
  rain: boolean;
  cloudiness: string; // "Ясно" | "Облачно" | "Пасмурно" | "Дождь" | "Гроза" | "Снег"
  month: number; // 1 to 12
  pressureDelta3h?: number;
  cloudCover?: number;
  dewPoint?: number;
  uvIndex?: number;
  sourceQuality?: number;
  forecastDate?: string;
}

interface WeatherSnapshot extends WeatherState {
  date: string;
  label: string;
  minTemp: number;
  maxTemp: number;
  precipitation: number;
}

interface CatchEntry {
  id: string;
  species: string;
  weight: number; // kg
  length?: number; // cm
  location: string;
  bait: string;
  date: string;
  notes: string;
  weatherDetails?: string;
}

export default function App() {
  const { user: tmaUser, hapticSelection } = useTelegram();
  const profileId = tmaUser ? String(tmaUser.id) : "guest";
  const storagePrefix = `fishmeteoplan:${profileId}`;
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [profileHydrated, setProfileHydrated] = useState(false);

  // Navigation tabs: "forecast" | "fish" | "spots" | "log" | "guide"
  const [activeTab, setActiveTab] = useState<string>("forecast");

  const handleTabChange = (tab: string) => { hapticSelection(); setActiveTab(tab); };

  // Core Location State
  const [savedLocation, setSavedLocation] = useState<LocationType | null>(null);
  const [citySearch, setCitySearch] = useState<string>("");
  const [cityResults, setCityResults] = useState<Array<{ id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string }>>([]);
  const [isCitySearching, setIsCitySearching] = useState<boolean>(false);
  const selectedLocation = savedLocation || EMPTY_LOCATION;
  const hasLocation = Boolean(savedLocation);

  // Sandbox Mode State
  const [sandboxMode, setSandboxMode] = useState<boolean>(false);

  // Weather State
  const [isApiLoading, setIsApiLoading] = useState<boolean>(false);
  const [apiSuccess, setApiSuccess] = useState<boolean>(false);
  const [realWeather, setRealWeather] = useState<WeatherState | null>(null);
  const [weatherSnapshots, setWeatherSnapshots] = useState<WeatherSnapshot[]>([]);
  const [weatherMode, setWeatherMode] = useState<string>("Сейчас");
  const [sandboxWeather, setSandboxWeather] = useState<WeatherState>({
    temp: 18,
    pressure: 755,
    pressureTrend: "stable",
    humidity: 70,
    wind: 3.5,
    dir: "ЮЗ",
    deg: 225,
    desc: "Переменная облачность",
    icon: "CloudSun",
    rain: false,
    cloudiness: "Облачно",
    month: new Date().getMonth() + 1,
  });

  // Fish Species Filters
  const [fishSearch, setFishSearch] = useState<string>("");
  const [fishFilter, setFishFilter] = useState<"all" | "predator" | "peaceful">("all");
  const [selectedFish, setSelectedFish] = useState<FishType | null>(null);

  // Forecast Views
  const [forecastView, setForecastView] = useState<"table" | "cards">("cards");
  const [forecastDay, setForecastDay] = useState<"today" | "tomorrow">("today");
  const [selectedFishBreakdown, setSelectedFishBreakdown] = useState<string | null>(null);

  // Spots search & filters
  const [spotTackleFilter, setSpotTackleFilter] = useState<string>("all");
  const [spotFishFilter, setSpotFishFilter] = useState<string>("all");
  const [copiedSpotId, setCopiedSpotId] = useState<string | null>(null);
  const [forecastAction, setForecastAction] = useState<"idle" | "copied" | "shared">("idle");

  // Catch Log State
  const [catchLog, setCatchLog] = useState<CatchEntry[]>([]);
  const [isAddCatchOpen, setIsAddCatchOpen] = useState<boolean>(false);
  const [newCatch, setNewCatch] = useState<Partial<CatchEntry>>({
    species: "Лещ",
    weight: 1.2,
    length: 35,
    location: "Место по GPS/описанию",
    bait: "Червь + Опарыш",
    date: new Date().toISOString().split("T")[0],
    notes: "Поклёвка уверенная, ловил на бровке.",
  });

  // Safety & Tools states
  const [iceThickness, setIceThickness] = useState<number>(8);
  const [iceQuality, setIceQuality] = useState<"monolith" | "porous" | "slush">("monolith");
  const [selectedKnotIndex, setSelectedKnotIndex] = useState<number>(0);

  // Per-user profile: Telegram ID when available, browser-local guest profile otherwise.
  useEffect(() => {
    setProfileHydrated(false);
    try {
      const savedTheme = localStorage.getItem(`${storagePrefix}:theme`);
      const savedCity = localStorage.getItem(`${storagePrefix}:city`);
      const savedCatchLog = localStorage.getItem(`${storagePrefix}:catch-log`);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      if (savedCity) {
        const city = JSON.parse(savedCity);
        const storedLocation = city.location ?? city.customLocation ?? null;
        setSavedLocation(storedLocation);
        setCitySearch(storedLocation?.name || "");
      } else {
        setSavedLocation(null);
        setCitySearch("");
      }
      if (savedCatchLog) {
        setCatchLog(JSON.parse(savedCatchLog));
      } else {
        setCatchLog([]);
      }
    } catch (error) {
      console.warn("Не удалось загрузить профиль пользователя", error);
    } finally {
      setProfileHydrated(true);
    }
  }, [storagePrefix]);

  useEffect(() => {
    if (!profileHydrated) return;
    localStorage.setItem(`${storagePrefix}:theme`, theme);
  }, [profileHydrated, storagePrefix, theme]);

  useEffect(() => {
    if (!profileHydrated) return;
    localStorage.setItem(`${storagePrefix}:city`, JSON.stringify({ location: savedLocation }));
  }, [profileHydrated, storagePrefix, savedLocation]);

  useEffect(() => {
    if (!profileHydrated) return;
    localStorage.setItem(`${storagePrefix}:catch-log`, JSON.stringify(catchLog));
  }, [profileHydrated, storagePrefix, catchLog]);

  // Open-Meteo: current conditions, yesterday, today, tomorrow and 7-day forecast.
  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      if (!savedLocation) {
        setIsApiLoading(false);
        setApiSuccess(false);
        setRealWeather(null);
        setWeatherSnapshots([]);
        return;
      }
      setIsApiLoading(true);
      setApiSuccess(false);
      setRealWeather(null);
      setWeatherSnapshots([]);
      setWeatherMode("Сейчас");
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.coords.lat}&longitude=${selectedLocation.coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,dew_point_2m,uv_index&hourly=pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&past_days=1&forecast_days=7&wind_speed_unit=ms&timezone=auto`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Open-Meteo request failed");
        const data = await response.json();
        if (cancelled) return;
        const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
        const describe = (code: number) => {
          if (code === 0) return { cloudiness: "Ясно", desc: "Ясно, солнечно", icon: "Sun", rain: false };
          if ([1, 2].includes(code)) return { cloudiness: "Облачно", desc: "Переменная облачность", icon: "CloudSun", rain: false };
          if ([3, 45, 48].includes(code)) return { cloudiness: "Пасмурно", desc: code === 3 ? "Пасмурно" : "Туман", icon: "Cloud", rain: false };
          if ([71, 73, 75, 77, 85, 86].includes(code)) return { cloudiness: "Снег", desc: "Снегопад", icon: "CloudSnow", rain: true };
          return { cloudiness: "Дождь", desc: code >= 95 ? "Гроза" : "Дождь", icon: "CloudRain", rain: true };
        };
        const current = data.current;
        const currentCode = Number(current.weather_code ?? 0);
        const currentDesc = describe(currentCode);
        const currentPressure = Math.round(Number(current.pressure_msl) * 0.750062);
        const currentHourIndex = (data.hourly?.time || []).findIndex((time: string) => time.startsWith(String(current.time).slice(0, 13)));
        const pressureDelta3h = currentHourIndex >= 3 ? Number(current.pressure_msl) - Number(data.hourly.pressure_msl[currentHourIndex - 3]) : 0;
        const currentState: WeatherState = {
          temp: Math.round(Number(current.temperature_2m)),
          pressure: currentPressure,
          pressureTrend: "stable",
          humidity: Math.round(Number(current.relative_humidity_2m)),
          wind: Number(Number(current.wind_speed_10m || 0).toFixed(1)),
          dir: dirs[Math.round(Number(current.wind_direction_10m || 0) / 45) % 8],
          deg: Number(current.wind_direction_10m || 0),
          desc: currentDesc.desc,
          icon: currentDesc.icon,
          rain: currentDesc.rain,
          cloudiness: currentDesc.cloudiness,
          month: new Date().getMonth() + 1,
          pressureDelta3h,
          cloudCover: Number(current.cloud_cover ?? 50),
          dewPoint: Number(current.dew_point_2m ?? current.temperature_2m),
          uvIndex: Number(current.uv_index ?? 0),
          sourceQuality: 1,
          forecastDate: String(current.time || new Date().toISOString()).slice(0, 10),
        };
        const daily = data.daily;
        const snapshots: WeatherSnapshot[] = [{
          ...currentState,
          date: current.time?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          label: "Сейчас",
          minTemp: currentState.temp,
          maxTemp: currentState.temp,
          precipitation: 0,
        }];
        (daily.time || []).forEach((date: string, index: number) => {
          const code = Number(daily.weather_code?.[index] ?? 0);
          const info = describe(code);
          const dayTemp = Math.round((Number(daily.temperature_2m_max?.[index]) + Number(daily.temperature_2m_min?.[index])) / 2);
          const dayState: WeatherState = {
            ...currentState,
            temp: dayTemp,
            pressure: currentPressure,
            desc: info.desc,
            icon: info.icon,
            rain: info.rain,
            cloudiness: info.cloudiness,
            month: new Date(`${date}T12:00:00`).getMonth() + 1,
            forecastDate: date,
          };
          const offset = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${current.time}Z`).getTime()) / 86400000);
          const label = offset === -1 ? "Вчера" : offset === 0 ? "Сегодня" : offset === 1 ? "Завтра" : new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
          snapshots.push({
            ...dayState,
            date,
            label,
            minTemp: Math.round(Number(daily.temperature_2m_min?.[index] ?? dayTemp)),
            maxTemp: Math.round(Number(daily.temperature_2m_max?.[index] ?? dayTemp)),
            precipitation: Math.round(Number(daily.precipitation_probability_max?.[index] ?? 0)),
          });
        });
        setWeatherSnapshots(snapshots);
        setWeatherMode("Сейчас");
        setRealWeather(currentState);
        setSandboxWeather(currentState);
        setApiSuccess(true);
      } catch (error) {
        console.warn("Open-Meteo unavailable, using seasonal fallback", error);
        if (!cancelled) {
          const generated = getSeasonalFallback(selectedLocation.id);
          setRealWeather(generated);
          setSandboxWeather(generated);
          setWeatherSnapshots([]);
          setApiSuccess(false);
        }
      } finally {
        if (!cancelled) setIsApiLoading(false);
      }
    }
    fetchWeather();
    return () => { cancelled = true; };
  }, [savedLocation]);

  // Open-Meteo Geocoding API powers city search without a server or API key.
  useEffect(() => {
    const query = citySearch.trim();
    if (query.length < 2 || (savedLocation && query === savedLocation.name)) { setCityResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsCitySearching(true);
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=ru&format=json`, { signal: controller.signal });
        const data = await response.json();
        setCityResults(data.results || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.warn("City search failed", error);
      } finally { setIsCitySearching(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [citySearch, savedLocation]);

  // Catch log writes are scoped by the Telegram user ID/profile above.
  const saveCatches = (logs: CatchEntry[]) => {
    setCatchLog(logs);
  };

  // Get seasonal offline default weather
  function getSeasonalFallback(_locId: string): WeatherState {
    const month = new Date().getMonth() + 1; // 1-12
    let temp = 15;
    let desc = "Переменная облачность";
    let icon = "CloudSun";
    let cloud = "Облачно";
    let pressure = 754;
    let humidity = 70;
    let wind = 3.2;

    if (month >= 11 || month <= 2) {
      // Winter
      temp = month === 12 || month === 1 ? -10 : -5;
      desc = "Снегопад, морозно";
      icon = "CloudSnow";
      cloud = "Снег";
      pressure = 763;
      humidity = 88;
      wind = 4.5;
    } else if (month >= 3 && month <= 5) {
      // Spring
      temp = month === 3 ? 1 : month === 4 ? 8 : 16;
      desc = "Переменная облачность, свежо";
      icon = "CloudSun";
      cloud = "Облачно";
      pressure = 757;
      humidity = 65;
      wind = 3.8;
    } else if (month >= 6 && month <= 8) {
      // Summer
      temp = month === 7 ? 24 : 21;
      desc = "Ясно, тепло";
      icon = "Sun";
      cloud = "Ясно";
      pressure = 750;
      humidity = 60;
      wind = 2.5;
    } else {
      // Autumn
      temp = month === 9 ? 12 : 5;
      desc = "Пасмурно, моросящие дожди";
      icon = "CloudRain";
      cloud = "Дождь";
      pressure = 758;
      humidity = 82;
      wind = 4.0;
    }

    return {
      temp,
      pressure,
      pressureTrend: "stable",
      humidity,
      wind,
      dir: "ЮЗ",
      deg: 225,
      desc,
      icon,
      rain: cloud === "Дождь",
      cloudiness: cloud,
      month
    };
  }

  // Select the weather period that drives the fishing calculation.
  const selectedSnapshot = useMemo(() => weatherSnapshots.find((item) => item.label === weatherMode) || weatherSnapshots.find((item) => item.date === weatherMode), [weatherSnapshots, weatherMode]);
  const activeWeather = sandboxMode ? sandboxWeather : (selectedSnapshot || realWeather || getSeasonalFallback(selectedLocation.id));

  // Calculates Moon Phase from active date
  const moonInfo = useMemo(() => {
    const now = new Date();
    if (forecastDay === "tomorrow") {
      now.setDate(now.getDate() + 1);
    }
    // New moon epoch (Jan 29, 2025)
    const newMoon = new Date(2025, 0, 29, 12, 0);
    const cycle = 29.530588853 * 24 * 60 * 60 * 1000;
    const diff = now.getTime() - newMoon.getTime();
    
    // Exact day of cycle (1-29.5)
    let cycleDayFloat = ((diff % cycle) / (1000 * 60 * 60 * 24));
    if (cycleDayFloat < 0) cycleDayFloat += 29.53;
    const day = Math.floor(cycleDayFloat) + 1;

    // Visual percentage lit (0% is new moon, 100% is full moon)
    // 0 -> 14.7 -> 29.5
    let phase = 0;
    if (day <= 14.8) {
      phase = (day / 14.8) * 100;
    } else {
      phase = 100 - ((day - 14.8) / 14.8) * 100;
    }
    phase = Math.max(0, Math.min(100, phase));

    // Times rise & set calculations (simulation)
    const riseHour = (day * 48) % 1440;
    const riseStr = `${Math.floor(riseHour / 60).toString().padStart(2, "0")}:${Math.floor(riseHour % 60).toString().padStart(2, "0")}`;
    const setHour = ((day + 14) * 48) % 1440;
    const setStr = `${Math.floor(setHour / 60).toString().padStart(2, "0")}:${Math.floor(setHour % 60).toString().padStart(2, "0")}`;

    // Textual description of phase
    let description = "Растущая луна";
    if (day === 1) description = "Новолуние";
    else if (day > 1 && day < 7) description = "Молодая луна";
    else if (day >= 7 && day <= 9) description = "Первая четверть";
    else if (day > 9 && day < 14) description = "Прибывающая луна";
    else if (day === 14 || day === 15) description = "Полнолуние";
    else if (day > 15 && day < 22) description = "Убывающая луна";
    else if (day >= 22 && day <= 24) description = "Последняя четверть";
    else description = "Старая луна";

    return { day, phase, rise: riseStr, set: setStr, description };
  }, [forecastDay]);

  // Calculates estimated water temperature
  const waterTemp = useMemo(() => {
    const air = activeWeather.temp;
    const month = activeWeather.month;

    // In deep winter (Nov-Mar), rivers maintain 0.5-3°C, lakes can freeze
    if (month >= 11 || month <= 3) {
      // Water stays near freezing in winter
      const winterTemp = Math.max(0.5, Math.min(3.5, air * 0.1 + 2));
      return Math.round(winterTemp * 10) / 10;
    }

    // Transition months — rivers have thermal inertia, water changes slower than air
    let baseDiff = 4;
    if (month >= 6 && month <= 8) baseDiff = 1.5;   // Summer: water closely tracks air
    else if (month === 5 || month === 9) baseDiff = 3.0; // Late spring / early autumn
    else if (month === 4 || month === 10) baseDiff = 4.5; // Mid spring / mid autumn

    // Wind cooling & evaporation correction
    const correction = (50 - activeWeather.humidity) * 0.02 + (activeWeather.wind > 5 ? -0.7 : 0);
    const calculated = air - baseDiff + correction;

    return Math.max(0.5, Math.round(calculated * 10) / 10);
  }, [activeWeather]);

  // ===== NORMALIZED, TRACEABLE BITE FORECAST ENGINE =====
  const biteForecast = useMemo(() => {
    const weather = {
      temp: activeWeather.temp,
      pressure: activeWeather.pressure,
      pressureTrend: activeWeather.pressureTrend,
      pressureDelta3h: activeWeather.pressureDelta3h,
      humidity: activeWeather.humidity,
      wind: activeWeather.wind,
      dir: activeWeather.dir,
      cloudiness: activeWeather.cloudiness,
      rain: activeWeather.rain,
      cloudCover: activeWeather.cloudCover,
      uvIndex: activeWeather.uvIndex,
      dewPoint: activeWeather.dewPoint,
      sourceQuality: activeWeather.sourceQuality ?? (apiSuccess ? 1 : .55),
    } as const;
    const targetDate = activeWeather.forecastDate ? new Date(`${activeWeather.forecastDate}T12:00:00`) : new Date();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const isLegalClosure = month >= 4 && (month > 4 || day >= 15) && (month < 6 || day <= 1);
    const legalNotice = isLegalClosure ? `${spawningRules.region}: действует период нерестовых ограничений ${spawningRules.dates}. Прогноз клёва заблокирован до проверки официальных правил.` : algorithmLegalNotice;
    const waterLevelTrend = activeWeather.rain ? "rising" : activeWeather.temp > 25 && activeWeather.wind < 3 ? "falling" : "stable";
    const oxygen = Math.max(0, Math.min(1, 0.30 + activeWeather.wind * .06 + activeWeather.humidity * .004 - (activeWeather.temp > 25 ? .15 : 0)));
    const turbidity = activeWeather.rain ? .80 : activeWeather.wind > 6 ? .50 : .20;
    const moonPhase = moonInfo.phase / 100;
    const result: Record<string, any> = {};
    fishSpecies.forEach((fish) => {
      const engine = calculateFishForecast(fish, weather, {
        waterTemp,
        waterLevelTrend,
        turbidity,
        oxygen,
        waterBody: selectedLocation.type,
        latitude: selectedLocation.coords.lat,
        longitude: selectedLocation.coords.lon,
        month,
        moonPhase,
        isLegalClosure,
        legalNotice,
      });
      result[fish.id] = {
        fish,
        periods: engine.periods,
        factors: {
          base: Math.round(engine.score * 100),
          moon: engine.factors.moon,
          water: engine.factors.waterTemp,
          pressure: engine.factors.pressure,
          wind: engine.factors.wind,
          season: engine.factors.season,
          habitat: engine.factors.habitat,
          precip: activeWeather.rain ? (fish.type === "predator" ? 60 : 35) : 50,
          oxygen: engine.factors.oxygen,
          magnetic: 50,
          turbidity: engine.factors.turbidity,
          waterLevel: engine.factors.waterLevel,
          visibility: engine.factors.light,
          preyActivity: engine.factors.prey,
        },
        recommendations: engine.recommendations,
        confidence: engine.confidence,
        confidenceBreakdown: engine.confidenceBreakdown,
        heuristicsApplied: engine.heuristicsApplied,
        reasoning: engine.reasoning,
        legalNotice: engine.legalNotice,
      };
    });
    return result;
  }, [activeWeather, apiSuccess, moonInfo, waterTemp, selectedLocation]);

  // Weather state visual badge colors helper
  const getBiteBadgeDetails = (score: number) => {
    if (score >= 75) {
      return {
        bg: "bg-emerald-500 text-white",
        textColor: "text-emerald-600",
        label: "Отличный клёв",
        border: "border-emerald-200",
        emoji: "🔥"
      };
    }
    if (score >= 55) {
      return {
        bg: "bg-lime-500 text-slate-900",
        textColor: "text-lime-600",
        label: "Хороший клёв",
        border: "border-lime-200",
        emoji: "👍"
      };
    }
    if (score >= 40) {
      return {
        bg: "bg-amber-400 text-slate-900",
        textColor: "text-amber-600",
        label: "Средний клёв",
        border: "border-amber-200",
        emoji: "😐"
      };
    }
    if (score >= 25) {
      return {
        bg: "bg-orange-400 text-white",
        textColor: "text-orange-600",
        label: "Слабый клёв",
        border: "border-orange-200",
        emoji: "🎣"
      };
    }
    return {
      bg: "bg-rose-500 text-white",
      textColor: "text-rose-600",
      label: "Клёва нет",
      border: "border-rose-200",
      emoji: "❌"
    };
  };

  // Filtered Fish Encyclopedia
  const filteredSpecies = useMemo(() => {
    return fishSpecies.filter((fish) => {
      const matchSearch = fish.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
        fish.bait.some((b) => b.toLowerCase().includes(fishSearch.toLowerCase()));

      const isPredator = ["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(fish.name);
      if (fishFilter === "predator") return matchSearch && isPredator;
      if (fishFilter === "peaceful") return matchSearch && !isPredator;
      return matchSearch;
    });
  }, [fishSearch, fishFilter]);

  // The verified-place view is intentionally empty until a searched city has a dedicated catalogue entry.
  const filteredSpots: Array<{
    id: string;
    name: string;
    locationId: string;
    coords: string;
    depth: string;
    bottom: string;
    fish: string[];
    tackle: string;
    tips: string;
  }> = [];

  // Handle adding new catch to log
  const handleAddCatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatch.species || !newCatch.weight || !newCatch.location) return;

    const entry: CatchEntry = {
      id: Date.now().toString(),
      species: newCatch.species,
      weight: Number(newCatch.weight),
      length: newCatch.length ? Number(newCatch.length) : undefined,
      location: newCatch.location,
      bait: newCatch.bait || "Наживка не указана",
      date: newCatch.date || new Date().toISOString().split("T")[0],
      notes: newCatch.notes || "",
      weatherDetails: `${activeWeather.cloudiness}, ${activeWeather.temp}°C, ветер ${activeWeather.dir} ${activeWeather.wind} м/с`
    };

    const updated = [entry, ...catchLog];
    saveCatches(updated);
    setIsAddCatchOpen(false);
    // Reset form
    setNewCatch({
      species: "Лещ",
      weight: 1.2,
      length: 35,
      location: selectedLocation.name,
      bait: "Червь + Опарыш",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  // Handle deleting catch from log
  const handleDeleteCatch = (id: string) => {
    if (window.confirm("Вы уверены, что хотите удалить эту запись из дневника уловов?")) {
      const updated = catchLog.filter((item) => item.id !== id);
      saveCatches(updated);
    }
  };

  // Catch log calculations
  const logStats = useMemo(() => {
    if (catchLog.length === 0) return { count: 0, totalWeight: 0, maxWeight: 0, bestFish: "-" };
    let total = 0;
    let max = 0;
    let bestFish = "";
    
    catchLog.forEach((item) => {
      total += item.weight;
      if (item.weight > max) {
        max = item.weight;
        bestFish = item.species;
      }
    });

    return {
      count: catchLog.length,
      totalWeight: Number(total.toFixed(2)),
      maxWeight: max,
      bestFish
    };
  }, [catchLog]);

  // Copy coordinates to clipboard
  const handleCopyCoords = (coords: string, spotId: string) => {
    navigator.clipboard.writeText(coords);
    setCopiedSpotId(spotId);
    setTimeout(() => setCopiedSpotId(null), 2000);
  };

  const forecastShareText = useMemo(() => {
    const rows = Object.values(biteForecast)
      .map((item: any) => ({ name: item.fish.name, score: Math.round((item.periods.morning + item.periods.day + item.periods.evening + item.periods.night) / 4) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => `${item.name}: ${item.score}%`)
      .join("\n");
    return `ФишМетеоПлан — прогноз клёва\n${selectedLocation.name} · ${forecastDay === "today" ? "сегодня" : "завтра"}\n\nТоп видов:\n${rows}\n\nПогода: ${activeWeather.temp}°C, ${activeWeather.desc}, ветер ${activeWeather.wind} м/с\n\nПрогноз рекомендательный и не заменяет правила рыболовства.`;
  }, [biteForecast, selectedLocation.name, forecastDay, activeWeather]);

  const handleCopyForecast = async () => {
    try {
      await navigator.clipboard.writeText(forecastShareText);
      setForecastAction("copied");
      window.setTimeout(() => setForecastAction("idle"), 2200);
    } catch (error) {
      console.warn("Forecast copy failed", error);
    }
  };

  const handleShareForecast = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "ФишМетеоПлан — прогноз клёва", text: forecastShareText });
        setForecastAction("shared");
      } else {
        await handleCopyForecast();
        return;
      }
      window.setTimeout(() => setForecastAction("idle"), 2200);
    } catch (error) {
      if ((error as Error).name !== "AbortError") console.warn("Forecast share failed", error);
    }
  };

  // Ice safety calculations
  const iceSafetyResult = useMemo(() => {
    // Basic thickness requirement base
    let monolithMultiplier = 1;
    if (iceQuality === "porous") monolithMultiplier = 0.5; // Porous is 2x weaker
    if (iceQuality === "slush") monolithMultiplier = 0.3; // Very dangerous

    const effectiveThickness = iceThickness * monolithMultiplier;

    let rating = "Смертельно опасно 🚨";
    let alertColor = "bg-rose-100 border-rose-300 text-rose-800";
    let detail = "Выходить на лед категорически запрещено! Лед хрупкий, высочайший риск провала.";

    if (effectiveThickness >= 25) {
      rating = "Абсолютно безопасно для любой техники и пешеходов 🚜";
      alertColor = "bg-emerald-100 border-emerald-300 text-emerald-800";
      detail = "Толщина льда позволяет передвигаться на снегоходах, мотособаках и находиться большими группами.";
    } else if (effectiveThickness >= 12) {
      rating = "Безопасно для групп пешеходов 👥";
      alertColor = "bg-green-100 border-green-300 text-green-800";
      detail = "Можно безопасно передвигаться группами людей. Однако выезжать на тяжелой технике не рекомендуется.";
    } else if (effectiveThickness >= 7) {
      rating = "Безопасно для одиночного рыболова 🧍";
      alertColor = "bg-yellow-100 border-yellow-300 text-yellow-800";
      detail = "Лед выдерживает вес одного взрослого человека. Держите дистанцию не менее 5-6 метров от других рыбаков.";
    }

    return { rating, alertColor, detail, effectiveThickness };
  }, [iceThickness, iceQuality]);

  // Check spawning ban alert active (Current month is April or May)
  const isSpawningBanActive = useMemo(() => {
    const month = new Date().getMonth() + 1; // 1-12
    const day = new Date().getDate();
    if (month === 5) return true;
    if (month === 4 && day >= 15) return true;
    if (month === 6 && day <= 1) return true;
    return false;
  }, []);

  return (
    <div className={`${theme === "light" ? "theme-light" : "theme-dark"} min-h-screen bg-slate-900 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-white`}>
      {/* Top Banner / Spawning Ban Warning */}
      {isSpawningBanActive && (
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-red-600 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2 animate-pulse shadow-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Внимание! Проверьте нерестовые ограничения для выбранного региона. Базовая памятка проекта: {spawningRules.dates}.</span>
        </div>
      )}

      {/* Main App Navigation & Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
                <FishIcon className="h-6 w-6 text-white animate-bounce-subtle" />
              </div>
              <div>
                <h1 className="font-montserrat text-lg font-extrabold tracking-tight text-white flex items-center gap-1 sm:text-xl">
                  ФишМетеоПлан
                </h1>
                <p className="hidden text-[10px] text-slate-400 sm:block">
                  Погодный прогноз клёва для городов России
                </p>
              </div>
            </div>

            {/* Weather status & TMA User indicator */}
            <div className="flex items-center gap-3">
              {tmaUser && (
                <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-cyan-500/30 text-xs text-cyan-300 font-bold shadow-md shadow-cyan-500/10">
                  <span>🎣 Привет, {tmaUser.first_name}!</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 flex items-center gap-2 border border-slate-700">
                  <span className={`inline-block h-2 w-2 rounded-full ${isApiLoading ? "bg-amber-400 animate-ping" : apiSuccess ? "bg-emerald-400" : "bg-sky-400"}`} />
                  <span>
                    {isApiLoading ? "Синхронизация..." : apiSuccess ? "Open-Meteo в сети" : hasLocation ? "Сезонный расчёт" : "Ожидание города"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-200">
                    {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Гео: {hasLocation ? selectedLocation.name : "город не выбран"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
                  title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                  onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-400 hover:text-white cursor-pointer"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-amber-300" /> : <MoonIcon className="h-4 w-4 text-cyan-300" />}
                  <span className="hidden xl:inline">{theme === "dark" ? "Светлая" : "Тёмная"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-6">
        
        {/* Geographic / Location Bar */}
        <section className="mb-6 rounded-2xl bg-gradient-to-r from-blue-950 to-slate-900 p-4 shadow-xl border border-blue-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-900/50 p-2 text-cyan-400 border border-blue-800">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-montserrat text-base font-bold text-white flex items-center gap-2">
                Выбранный город: <span className="text-cyan-300">{hasLocation ? selectedLocation.name : "не выбран"}</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                {hasLocation ? selectedLocation.description : "Найдите город через поиск, чтобы получить погодный прогноз и расчёт клёва."}
              </p>
            </div>
          </div>

          {/* City search backed by Open-Meteo Geocoding */}
          <div className="relative md:min-w-[300px]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
              <Search className="h-4 w-4 text-cyan-400" />
              <input value={citySearch} onChange={(e) => setCitySearch(e.target.value)} placeholder="Найти город" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
              {isCitySearching && <span className="text-[10px] text-slate-500">поиск…</span>}
            </div>
            {cityResults.length > 0 && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                {cityResults.map((city) => (
                  <button key={`${city.id}-${city.latitude}`} onClick={() => {
                    setSavedLocation({ id: `city-${city.id}`, name: city.name, nameGenitive: `в ${city.name}`, coords: { lat: city.latitude, lon: city.longitude }, description: `${city.country || ""}${city.admin1 ? `, ${city.admin1}` : ""}. Погода Open-Meteo.`, type: "river", avgDepth: "—" });
                    setCitySearch(city.name); setCityResults([]); setWeatherMode("Сейчас");
                  }} className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-cyan-500/20">
                    <span className="font-bold">{city.name}</span><span className="ml-2 text-slate-500">{city.admin1 || city.country || ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 md:max-w-[210px]">Введите город и выберите результат поиска. Приложение всегда использует сохранённый город пользователя.</div>
        </section>

        {!hasLocation && (
          <section className="mb-6 rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-950/20 p-8 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Найдите город для прогноза</h2>
            <p className="mt-2 text-sm text-slate-300">Выберите город в результатах поиска. После выбора он сохранится в вашем профиле и будет использоваться при следующем запуске.</p>
          </section>
        )}

        {/* Tab Selector - Visible only on large screens, mobile uses Bottom Navigation */}
        <div style={!hasLocation ? { display: "none" } : undefined} className="mb-6 hidden lg:flex overflow-x-auto rounded-xl bg-slate-800 p-1 border border-slate-700 scrollbar-none">
          <button
            onClick={() => handleTabChange("forecast")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "forecast" ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="h-4 w-4" />
            Прогноз клёва
          </button>
          <button
            onClick={() => handleTabChange("fish")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "fish" ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Справочник рыб
          </button>
          <button
            onClick={() => handleTabChange("spots")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "spots" ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Anchor className="h-4 w-4" />
            Проверенные места
          </button>
          <button
            onClick={() => handleTabChange("log")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold transition-all whitespace-nowrap cursor-pointer relative ${
              activeTab === "log" ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Дневник уловов
            </span>
            {catchLog.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-black text-slate-950">
                {catchLog.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("guide")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "guide" ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Calculator className="h-4 w-4" />
            Инструменты и правила
          </button>
        </div>

        {/* Tab Content Display */}
        <div className={`${!hasLocation ? "hidden" : ""} grid grid-cols-1 gap-6 lg:grid-cols-12`}>
          
          {/* ========================================================= */}
          {/* TAB 1: FORECAST PANEL */}
          {/* ========================================================= */}
          {activeTab === "forecast" && (
            <>
              {/* Left Column: Weather, Sandbox and Moon Controls */}
              <div className="space-y-6 lg:col-span-4">
                
                {/* Weather Dashboard Card */}
                <div className="relative overflow-hidden rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700/80">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-4">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                      <Cloud className="h-4 w-4 text-cyan-400" />
                      Погода {sandboxMode && <span className="text-[10px] bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded font-black">Симулятор</span>}
                    </h3>
                    
                    {/* Sandbox Mode Toggle */}
                    <button
                      onClick={() => setSandboxMode(!sandboxMode)}
                      className={`text-[11px] px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        sandboxMode 
                          ? "bg-amber-400 text-slate-950" 
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
                      }`}
                    >
                      <Sliders className="h-3 w-3" />
                      Симулятор
                    </button>
                  </div>

                  {/* Weather Core Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="rounded-xl bg-slate-900/60 p-3 text-cyan-300 border border-slate-700/50">
                        {activeWeather.icon === "Sun" && <Sun className="h-8 w-8 text-amber-400 animate-spin-slow" />}
                        {activeWeather.icon === "CloudSun" && <CloudSun className="h-8 w-8 text-amber-300" />}
                        {activeWeather.icon === "CloudRain" && <CloudRain className="h-8 w-8 text-sky-400" />}
                        {activeWeather.icon === "CloudSnow" && <ThermometerSnowflake className="h-8 w-8 text-teal-300" />}
                        {activeWeather.icon === "Cloud" && <Cloud className="h-8 w-8 text-slate-400" />}
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{activeWeather.temp}°C</div>
                        <div className="text-[10px] text-slate-400 capitalize">{activeWeather.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-900/60 p-3 text-cyan-300 border border-slate-700/50">
                        <Waves className="h-8 w-8 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">{waterTemp}°C</div>
                        <div className="text-[10px] text-slate-400">Вода (расчётная)</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Weather Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-900/40 p-3 border border-slate-700/30 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Давление</span>
                      <strong className="text-xs text-white">{activeWeather.pressure} мм</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Влажность</span>
                      <strong className="text-xs text-white">{activeWeather.humidity}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Ветер ({activeWeather.dir})</span>
                      <strong className="text-xs text-white flex items-center justify-center gap-1">
                        <Compass className="h-3 w-3 text-cyan-400" style={{ transform: `rotate(${activeWeather.deg || 0}deg)` }} />
                        {activeWeather.wind} м/с
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Current + historical + forecast weather timeline */}
                <div className="rounded-2xl border border-slate-700/80 bg-slate-800 p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <div><h3 className="text-sm font-bold text-white">Погода по дням</h3><p className="text-[10px] text-slate-400">Open-Meteo · вчера, сегодня и завтра</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${apiSuccess ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{apiSuccess ? "онлайн" : "fallback"}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {weatherSnapshots.filter((item) => ["Вчера", "Сегодня", "Завтра"].includes(item.label)).map((item) => { const active = (weatherMode === item.date || weatherMode === item.label); return (
                      <button key={`${item.date}-${item.label}`} onClick={() => { setWeatherMode(item.label); if (item.label === "Сегодня") setForecastDay("today"); if (item.label === "Завтра") setForecastDay("tomorrow"); }} className={`min-w-[92px] rounded-xl border p-2 text-left transition ${active ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}>
                        <div className="text-[10px] font-bold text-cyan-300">{item.label}</div><div className="mt-1 text-sm font-black text-white">{item.minTemp}° / {item.maxTemp}°</div><div className="text-[10px] text-slate-400">{item.precipitation}% осадков</div>
                      </button>
                    ); })}
                  </div>
                </div>

                {/* Sandbox Weather Customization Sliders */}
                {sandboxMode && (
                  <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-amber-500/30 space-y-4 relative">
                    <div className="absolute top-0 right-12 h-1 w-20 bg-amber-400 rounded-b" />
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5" />
                        Параметры симулятора
                      </h4>
                      <button
                        onClick={() => {
                          setSandboxWeather(realWeather || getSeasonalFallback(selectedLocation.id));
                        }}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Сбросить
                      </button>
                    </div>

                    {/* Temp slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Температура воздуха:</span>
                        <strong className="text-white">{sandboxWeather.temp}°C</strong>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="38"
                        value={sandboxWeather.temp}
                        onChange={(e) => setSandboxWeather({ ...sandboxWeather, temp: parseInt(e.target.value) })}
                        className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
                      />
                    </div>

                    {/* Pressure slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Давление ртутного столба:</span>
                        <strong className="text-white">{sandboxWeather.pressure} мм рт. ст.</strong>
                      </div>
                      <input
                        type="range"
                        min="710"
                        max="790"
                        value={sandboxWeather.pressure}
                        onChange={(e) => setSandboxWeather({ ...sandboxWeather, pressure: parseInt(e.target.value) })}
                        className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
                      />
                    </div>

                    {/* Wind Speed slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Скорость ветра:</span>
                        <strong className="text-white">{sandboxWeather.wind} м/с</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="18"
                        step="0.5"
                        value={sandboxWeather.wind}
                        onChange={(e) => setSandboxWeather({ ...sandboxWeather, wind: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
                      />
                    </div>

                    {/* Wind Direction Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block">Направление ветра:</label>
                      <div className="grid grid-cols-8 gap-1">
                        {["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"].map((d, idx) => (
                          <button
                            key={d}
                            onClick={() => setSandboxWeather({ ...sandboxWeather, dir: d, deg: idx * 45 })}
                            className={`py-1 text-[10px] font-bold rounded cursor-pointer ${
                              sandboxWeather.dir === d ? "bg-cyan-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cloudiness / Rain / Snow */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block">Состояние неба:</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { val: "Ясно", icon: "Sun" },
                          { val: "Облачно", icon: "CloudSun" },
                          { val: "Пасмурно", icon: "Cloud" },
                          { val: "Дождь", icon: "CloudRain" },
                        ].map((item) => (
                          <button
                            key={item.val}
                            onClick={() =>
                              setSandboxWeather({
                                ...sandboxWeather,
                                cloudiness: item.val,
                                desc: item.val === "Ясно" ? "Ясно" : item.val === "Облачно" ? "Переменная облачность" : item.val === "Пасмурно" ? "Сплошная облачность" : "Непрерывный дождь",
                                icon: item.icon,
                                rain: item.val === "Дождь",
                              })
                            }
                            className={`py-1 text-[10px] font-bold rounded cursor-pointer ${
                              sandboxWeather.cloudiness === item.val ? "bg-cyan-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {item.val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Simulated Month Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block">Месяц года (сезонный фактор):</label>
                      <div className="grid grid-cols-6 gap-1">
                        {[
                          { m: 1, label: "Янв" },
                          { m: 3, label: "Мар" },
                          { m: 5, label: "Май" },
                          { m: 7, label: "Июл" },
                          { m: 9, label: "Сен" },
                          { m: 11, label: "Ноя" },
                        ].map((item) => (
                          <button
                            key={item.m}
                            onClick={() => setSandboxWeather({ ...sandboxWeather, month: item.m })}
                            className={`py-1 text-[10px] font-bold rounded cursor-pointer ${
                              sandboxWeather.month === item.m ? "bg-cyan-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lunar Calendar Card */}
                <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700/80">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-slate-700/50 pb-3 mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <MoonIcon className="h-4 w-4 text-amber-300" />
                    Лунный календарь
                  </h3>

                  <div className="flex items-center gap-5">
                    {/* Visual Moon Rendering */}
                    <div className="relative h-16 w-16 shrink-0 rounded-full bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-700 shadow-inner">
                      {/* Left glowing crescent or right waxing */}
                      <div
                        className="absolute h-full bg-amber-100 shadow-[0_0_12px_rgba(253,244,195,0.7)]"
                        style={{
                          width: `${moonInfo.phase}%`,
                          left: 0,
                          borderRadius: "50%",
                          transition: "width 0.4s ease"
                        }}
                      />
                      {/* Ambient stars */}
                      <div className="absolute inset-0 bg-stars opacity-40 pointer-events-none" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-bold text-amber-200">{moonInfo.description}</div>
                      <div className="text-sm font-black text-white">{moonInfo.day}-й лунный день</div>
                      <div className="text-[10px] text-slate-400">
                        Освещенность: {Math.round(moonInfo.phase)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-900/40 p-2 border border-slate-700/30">
                      <span className="text-[9px] text-slate-400 block mb-0.5">Восход Луны</span>
                      <strong className="text-white">{moonInfo.rise}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-900/40 p-2 border border-slate-700/30">
                      <span className="text-[9px] text-slate-400 block mb-0.5">Заход Луны</span>
                      <strong className="text-white">{moonInfo.set}</strong>
                    </div>
                  </div>
                </div>

                {/* Hydro-state & Water conditions card */}
                <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700/80">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-slate-700/50 pb-3 mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <Waves className="h-4 w-4 text-cyan-400" />
                    Состояние гидрорежима
                  </h3>
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>Прозрачность воды:</span>
                      <strong className={activeWeather.wind > 5 ? "text-amber-400" : "text-emerald-400"}>
                        {activeWeather.wind > 5 ? "Мутная (волнение)" : "Высокая (отличная)"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Волновое волнение:</span>
                      <strong className={activeWeather.wind > 4 ? "text-amber-400" : "text-emerald-400"}>
                        {activeWeather.wind > 4 ? "Прибойное, есть волна" : "Штиль / слабое"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Термоклин (слой):</span>
                      <strong className={activeWeather.temp > 22 ? "text-amber-400" : "text-slate-400"}>
                        {activeWeather.temp > 22 ? "Вероятен на глубине" : "Отсутствует"}
                      </strong>
                    </div>
                    <div className="pt-2 border-t border-slate-700/50 text-[10px] text-slate-400">
                      * Рассчитывается на основе текущей температуры воздуха, интенсивности ветра и испарения.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Main Bite Table / Card Forecast */}
              <div className="space-y-6 lg:col-span-8">
                
                {/* Header Controls for Forecast */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      onClick={() => { setForecastDay("today"); setWeatherMode("Сегодня"); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        forecastDay === "today" ? "bg-cyan-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Сегодня
                    </button>
                    <button
                      onClick={() => { setForecastDay("tomorrow"); setWeatherMode("Завтра"); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        forecastDay === "tomorrow" ? "bg-cyan-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Завтра
                    </button>
                  </div>

                  {/* Filter of species & view toggle */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* All/Predators/Peaceful */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                      <button
                        onClick={() => setFishFilter("all")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          fishFilter === "all" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        Все
                      </button>
                      <button
                        onClick={() => setFishFilter("predator")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          fishFilter === "predator" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        Хищники
                      </button>
                      <button
                        onClick={() => setFishFilter("peaceful")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          fishFilter === "peaceful" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        Мирная
                      </button>
                    </div>

                    {/* Cards vs Table View Toggle */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
                      <button
                        onClick={() => setForecastView("cards")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          forecastView === "cards" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        Карточки
                      </button>
                      <button
                        onClick={() => setForecastView("table")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          forecastView === "table" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        Таблица
                      </button>
                    </div>
                  </div>
                </div>

                {/* Displaying Forecast Grid/List */}
                {forecastView === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(biteForecast)
                      .filter((item) => {
                        const isPred = ["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(item.fish.name);
                        if (fishFilter === "predator") return isPred;
                        if (fishFilter === "peaceful") return !isPred;
                        return true;
                      })
                      .map(({ fish, periods, factors, recommendations, confidence, confidenceBreakdown, reasoning, heuristicsApplied, legalNotice }) => {
                        // Average score of the fish for the day
                        const avgScore = Math.round(
                          (periods.morning + periods.day + periods.evening + periods.night) / 4
                        );
                        const badge = getBiteBadgeDetails(avgScore);
                        const isExpanded = selectedFishBreakdown === fish.id;

                        return (
                          <div
                            key={fish.id}
                            className={`rounded-2xl bg-slate-800 border transition-all hover:border-slate-600 ${
                              isExpanded ? "border-cyan-500/50 shadow-md shadow-cyan-500/5" : "border-slate-700/80"
                            }`}
                          >
                            {/* Card Top */}
                            <div className="p-4 flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span className="text-4xl">{fish.icon}</span>
                                <div>
                                  <h4 className="font-montserrat text-lg font-bold text-white flex items-center gap-2">
                                    {fish.name}
                                    <span className="text-xs font-normal text-slate-400">
                                      {["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(fish.name) ? "Хищник" : "Мирная"}
                                    </span>
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {fish.bait.slice(0, 3).map((b: string) => (
                                      <span key={b} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Avg score circle */}
                              <div className="text-center">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black text-sm tracking-tight shadow-md ${badge.bg}`}>
                                  {avgScore}%
                                </div>
                                <span className="text-[9px] text-slate-400 block mt-1 uppercase font-bold">{badge.emoji} {badge.label}</span>
                              </div>
                            </div>

                            {/* Card Forecast Periods */}
                            <div className="mx-4 mb-4 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-900/60 p-2 border border-slate-700/30 text-center">
                              <div>
                                <span className="text-[9px] text-slate-400 block">Утро</span>
                                <strong className={`text-xs block mt-0.5 ${getBiteBadgeDetails(periods.morning).textColor}`}>
                                  {periods.morning}%
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">День</span>
                                <strong className={`text-xs block mt-0.5 ${getBiteBadgeDetails(periods.day).textColor}`}>
                                  {periods.day}%
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">Вечер</span>
                                <strong className={`text-xs block mt-0.5 ${getBiteBadgeDetails(periods.evening).textColor}`}>
                                  {periods.evening}%
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">Ночь</span>
                                <strong className={`text-xs block mt-0.5 ${getBiteBadgeDetails(periods.night).textColor}`}>
                                  {periods.night}%
                                </strong>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="border-t border-slate-700/40 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Info className="h-3 w-3 text-cyan-400" />
                                Оптимальная Т воды: {fish.temp[0]}-{fish.temp[1]}°C
                              </span>
                              <button
                                onClick={() => setSelectedFishBreakdown(isExpanded ? null : fish.id)}
                                className="text-cyan-400 hover:text-white font-semibold flex items-center gap-0.5 transition-all cursor-pointer"
                              >
                                {isExpanded ? "Свернуть" : "Анализ факторов"}
                                <ChevronRight className={`h-3 w-3 transform transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            </div>

                            {/* Expanded Analytical Breakdown + Recommendations */}
                            {isExpanded && (
                              <div className="bg-slate-900/80 p-4 border-t border-slate-700/60 text-xs rounded-b-2xl space-y-4">
                                
                                {/* Comfort Index Bar */}
                                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Индекс комфорта клёва</span>
                                    <strong className={`text-sm font-black ${
                                      recommendations.comfortIndex >= 70 ? "text-emerald-400" :
                                      recommendations.comfortIndex >= 40 ? "text-amber-400" : "text-rose-400"
                                    }`}>
                                      {recommendations.comfortIndex}%
                                    </strong>
                                  </div>
                                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        recommendations.comfortIndex >= 70 ? "bg-emerald-500" :
                                        recommendations.comfortIndex >= 40 ? "bg-amber-500" : "bg-rose-500"
                                      }`}
                                      style={{ width: `${recommendations.comfortIndex}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Confidence and traceable reasoning */}
                                <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">Доверие к расчёту</span>
                                    <strong className="text-sm font-black text-white">{Math.round((confidence ?? 0) * 100)}%</strong>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 sm:grid-cols-4">
                                    <span>Данные: {Math.round((confidenceBreakdown?.dataCompleteness ?? 0) * 100)}%</span>
                                    <span>Тренд: {Math.round((confidenceBreakdown?.trendStability ?? 0) * 100)}%</span>
                                    <span>История: {Math.round((confidenceBreakdown?.historicalMatch ?? 0) * 100)}%</span>
                                    <span>API: {Math.round((confidenceBreakdown?.apiResponseQuality ?? 0) * 100)}%</span>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-slate-300">{reasoning}</p>
                                  {heuristicsApplied?.length > 0 && <p className="text-[10px] text-amber-300">Эвристики: {heuristicsApplied.map((item: { name: string; shift: number }) => `${item.name} (${item.shift > 0 ? "+" : ""}${item.shift.toFixed(2)})`).join(", ")}</p>}
                                  {legalNotice && <p className="text-[10px] text-amber-200">{legalNotice}</p>}
                                </div>

                                {/* Recommendations Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                  <div className="bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-900/30">
                                    <span className="text-[9px] text-cyan-400 font-bold block mb-1">🎯 Глубина</span>
                                    <p className="text-[11px] text-slate-200 leading-tight">{recommendations.depthAdvice}</p>
                                  </div>
                                  <div className="bg-amber-950/30 p-2.5 rounded-lg border border-amber-900/30">
                                    <span className="text-[9px] text-amber-400 font-bold block mb-1">🪱 Наживка</span>
                                    <p className="text-[11px] text-slate-200 leading-tight">{recommendations.baitAdvice}</p>
                                  </div>
                                  <div className="bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/30">
                                    <span className="text-[9px] text-rose-400 font-bold block mb-1">🎨 Цвет приманки</span>
                                    <p className="text-[11px] text-slate-200 leading-tight">{recommendations.colorAdvice}</p>
                                  </div>
                                  <div className="bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/30">
                                    <span className="text-[9px] text-emerald-400 font-bold block mb-1">📋 Стратегия</span>
                                    <p className="text-[11px] text-slate-200 leading-tight">{recommendations.strategyAdvice}</p>
                                  </div>
                                </div>

                                {/* Factor Analysis */}
                                <div>
                                  <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] mb-2 text-cyan-300">
                                    🔬 Детальный разбор факторов:
                                  </h5>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-slate-300">
                                    {[
                                      { label: "Давление", value: factors.pressure, icon: "🌡️" },
                                      { label: "Темп. воды", value: factors.water, icon: "💧" },
                                      { label: "Ветер", value: factors.wind, icon: "🌬️" },
                                      { label: "Луна", value: factors.moon, icon: "🌙" },
                                      { label: "Сезон", value: factors.season, icon: "🍂" },
                                      { label: "Водоём", value: factors.habitat, icon: "🏞️" },
                                      { label: "Освещённость", value: factors.visibility, icon: "☀️" },
                                      { label: "Кислород", value: factors.oxygen, icon: "🫧" },
                                      { label: "Мутность", value: factors.turbidity, icon: "🌫️" },
                                      { label: "Уровень воды", value: factors.waterLevel, icon: "📈" },
                                      { label: "Магнитные бури", value: factors.magnetic, icon: "🧲" },
                                      { label: "Актив. корма", value: factors.preyActivity, icon: "🐟" },
                                    ].map((f) => (
                                      <div key={f.label} className="flex justify-between items-center bg-slate-800/40 p-1.5 rounded">
                                        <span className="text-[10px]">{f.icon} {f.label}:</span>
                                        <strong className={`text-[10px] ${f.value >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {f.value >= 0 ? `+${f.value}` : f.value}
                                        </strong>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Habitat note */}
                                <div className="text-[10px] text-slate-400 bg-slate-800/20 p-2 rounded italic border border-slate-700/30">
                                  * Модель: 12-факторный весовой алгоритм с дифференциацией по типу рыбы (мирная/хищник). 
                                  Клёв на {forecastDay === "today" ? "сегодня" : "завтра"} | {selectedLocation.name}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  /* Compact Tabular View */
                  <div className="overflow-x-auto rounded-2xl bg-slate-800 border border-slate-700 shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-700 text-xs text-slate-300 font-bold">
                          <th className="p-4 text-center">Вид рыбы</th>
                          <th className="p-4 text-center">Утро (4-10)</th>
                          <th className="p-4 text-center">День (10-16)</th>
                          <th className="p-4 text-center">Вечер (16-22)</th>
                          <th className="p-4 text-center">Ночь (22-4)</th>
                          <th className="p-4">Насадки & приманки</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50 text-xs sm:text-sm">
                        {Object.values(biteForecast)
                          .filter((item) => {
                            const isPred = ["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(item.fish.name);
                            if (fishFilter === "predator") return isPred;
                            if (fishFilter === "peaceful") return !isPred;
                            return true;
                          })
                          .map(({ fish, periods }) => {
                            return (
                              <tr key={fish.id} className="hover:bg-slate-750/55 transition-colors">
                                <td className="p-3 font-bold text-white flex items-center gap-2">
                                  <span className="text-2xl">{fish.icon}</span>
                                  <span>{fish.name}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <div className={`mx-auto flex h-9 w-12 items-center justify-center rounded-lg font-bold text-xs ${getBiteBadgeDetails(periods.morning).bg}`}>
                                    {periods.morning}%
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className={`mx-auto flex h-9 w-12 items-center justify-center rounded-lg font-bold text-xs ${getBiteBadgeDetails(periods.day).bg}`}>
                                    {periods.day}%
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className={`mx-auto flex h-9 w-12 items-center justify-center rounded-lg font-bold text-xs ${getBiteBadgeDetails(periods.evening).bg}`}>
                                    {periods.evening}%
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className={`mx-auto flex h-9 w-12 items-center justify-center rounded-lg font-bold text-xs ${getBiteBadgeDetails(periods.night).bg}`}>
                                    {periods.night}%
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {fish.bait.map((b: string) => (
                                      <span key={b} className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Поделиться прогнозом</h3>
                    <p className="text-[10px] text-slate-400">{selectedLocation.name} · {forecastDay === "today" ? "сегодня" : "завтра"} · топ-3 вида рыбы</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleShareForecast} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition cursor-pointer">
                      <Share2 className="h-3.5 w-3.5" />
                      {forecastAction === "shared" ? "Готово" : "Поделиться"}
                    </button>
                    <button onClick={handleCopyForecast} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-cyan-400 hover:text-white transition cursor-pointer">
                      <Copy className="h-3.5 w-3.5" />
                      {forecastAction === "copied" ? "Скопировано" : "Скопировать"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: FISH ENCYCLOPEDIA */}
          {/* ========================================================= */}
          {activeTab === "fish" && (
            <div className="lg:col-span-12 space-y-6">
              
              {/* Fish Filters */}
              <div className="flex flex-col md:flex-row gap-4 justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fishSearch}
                    onChange={(e) => setFishSearch(e.target.value)}
                    placeholder="Поиск по названию или наживке (например, 'Карась' или 'Опарыш')..."
                    className="w-full bg-slate-900 pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto text-xs font-bold">
                  <span className="text-slate-400 hidden sm:inline">Категория:</span>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      onClick={() => setFishFilter("all")}
                      className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                        fishFilter === "all" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                      }`}
                    >
                      Все рыбы
                    </button>
                    <button
                      onClick={() => setFishFilter("predator")}
                      className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                        fishFilter === "predator" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                      }`}
                    >
                      Хищные
                    </button>
                    <button
                      onClick={() => setFishFilter("peaceful")}
                      className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                        fishFilter === "peaceful" ? "bg-slate-800 text-cyan-300" : "text-slate-400"
                      }`}
                    >
                      Мирные
                    </button>
                  </div>
                </div>
              </div>

              {/* Fish Species List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSpecies.map((fish) => {
                  const isPredator = ["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(fish.name);
                  return (
                    <div
                      key={fish.id}
                      className="rounded-2xl bg-slate-800 border border-slate-700 shadow-md flex flex-col justify-between overflow-hidden hover:border-slate-500 transition-all cursor-pointer"
                      onClick={() => setSelectedFish(fish)}
                    >
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{fish.icon}</span>
                            <div>
                              <h4 className="font-montserrat text-lg font-bold text-white">{fish.name}</h4>
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${isPredator ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                                {isPredator ? "Хищная" : "Мирная"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                          {fish.description}
                        </p>

                        <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
                          <div className="text-xs flex flex-wrap gap-1">
                            <span className="text-slate-400 mr-1 block">Наживки:</span>
                            {fish.bait.map((b: string) => (
                              <span key={b} className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer specs */}
                      <div className="bg-slate-900/60 border-t border-slate-700/50 px-5 py-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Мин. размер: <strong>{fish.legalSize}</strong></span>
                        <span className="text-cyan-400 font-semibold flex items-center gap-0.5">
                          Подробнее <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Individual Fish Detailed Modal Overlay */}
              {selectedFish && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                  <div className="relative w-full max-w-2xl rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
                    {/* Close button */}
                    <button
                      onClick={() => setSelectedFish(null)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    {/* Fish Info */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-6xl">{selectedFish.icon}</span>
                      <div>
                        <h3 className="font-montserrat text-2xl font-black text-white">{selectedFish.name}</h3>
                        <p className="text-xs text-cyan-400 font-semibold">
                          {["Щука", "Окунь", "Судак", "Сом", "Налим"].includes(selectedFish.name) ? "Хищная рыба" : "Мирная рыба"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs sm:text-sm">
                      <div>
                        <h5 className="font-bold text-slate-300 mb-1 border-b border-slate-700/50 pb-1">Описание поведения</h5>
                        <p className="text-slate-300 leading-relaxed">{selectedFish.description}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                          <h6 className="font-bold text-cyan-400">Оптимальные Условия</h6>
                          <ul className="space-y-1.5 text-xs">
                            <li className="flex justify-between">
                              <span className="text-slate-400">Температура воды:</span>
                              <strong className="text-white">{selectedFish.temp[0]} - {selectedFish.temp[1]} °C</strong>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-slate-400">Атмосферное давление:</span>
                              <strong className="text-white">{selectedFish.pressure[0]} - {selectedFish.pressure[1]} мм</strong>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-slate-400">Макс. скорость ветра:</span>
                              <strong className="text-white">{selectedFish.wind} м/с</strong>
                            </li>
                          </ul>
                        </div>

                        <div className="space-y-2 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                          <h6 className="font-bold text-cyan-400">Правила базового региона</h6>
                          <ul className="space-y-1.5 text-xs">
                            <li className="flex justify-between">
                              <span className="text-slate-400">Минимальный размер по закону:</span>
                              <strong className="text-rose-400 font-bold">{selectedFish.legalSize}</strong>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-slate-400">Суточная норма вылова:</span>
                              <strong className="text-emerald-400 font-bold">{selectedFish.dailyLimit}</strong>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/50 pb-1">Любимые лакомства</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedFish.bait.map((b: string) => (
                              <span key={b} className="bg-slate-900 border border-slate-750 px-2.5 py-1 rounded-lg text-xs text-white">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5 className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/50 pb-1">Рекомендуемые снасти</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedFish.tackle.map((t) => (
                              <span key={t} className="bg-slate-900/80 text-cyan-300 border border-cyan-900/40 px-2.5 py-1 rounded-lg text-xs">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-300 mb-1 border-b border-slate-700/50 pb-1">Обитание в регионе</h5>
                        <p className="text-slate-300 text-xs">
                          Чаще всего встречается на водоемах: <strong>{selectedFish.habitats.join(", ")}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700/60 flex justify-end">
                      <button
                        onClick={() => setSelectedFish(null)}
                        className="bg-cyan-500 text-slate-950 px-5 py-2 rounded-xl font-bold hover:bg-cyan-400 transition-all cursor-pointer text-xs"
                      >
                        Понятно
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: FISHING SPOTS */}
          {/* ========================================================= */}
          {activeTab === "spots" && (
            <div className="lg:col-span-12 space-y-6">
              <div className="space-y-6">
                {/* Filters for verified spots */}
                <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700">
                  {/* Spots Filters */}
                  <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-700/50 pb-3 uppercase tracking-wide flex items-center gap-1.5">
                      <Filter className="h-4 w-4 text-cyan-400" />
                      Фильтр локаций
                    </h4>

                    {/* Tackle Filter */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block">Метод ловли:</label>
                      <select
                        value={spotTackleFilter}
                        onChange={(e) => setSpotTackleFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="all">Все снасти</option>
                        <option value="фидер">Фидер / донка</option>
                        <option value="спиннинг">Спиннинг</option>
                        <option value="поплавоч">Поплавочная удочка</option>
                        <option value="джиг">Джиг</option>
                      </select>
                    </div>

                    {/* Fish Filter */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block">Желаемая рыба:</label>
                      <select
                        value={spotFishFilter}
                        onChange={(e) => setSpotFishFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="all">Любая рыба</option>
                        {fishSpecies.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                {/* Verified spots listings for the selected built-in city */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3 text-xs text-slate-300">Каталог проверенных мест подключается отдельно для выбранного города после проверки источников.</div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-montserrat text-lg font-bold text-white flex items-center gap-2">
                      <span>Проверенные места: {selectedLocation.name} ({filteredSpots.length})</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      Локация: {selectedLocation.name}
                    </span>
                  </div>

                  {filteredSpots.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400 space-y-3">
                      <Anchor className="h-10 w-10 mx-auto text-slate-500 animate-pulse" />
                      <p className="text-sm">По вашему запросу мест в этом районе не найдено.</p>
                      <button
                        onClick={() => {
                          setSpotTackleFilter("all");
                          setSpotFishFilter("all");
                        }}
                        className="text-xs text-cyan-400 underline font-semibold cursor-pointer"
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-md flex flex-col justify-between hover:border-slate-500 transition-all"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h4 className="font-montserrat text-base font-bold text-white leading-tight">
                                {spot.name}
                              </h4>
                              {/* Copy coords */}
                              <button
                                onClick={() => handleCopyCoords(spot.coords, spot.id)}
                                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                  copiedSpotId === spot.id
                                    ? "bg-emerald-500 text-slate-950 border-emerald-400"
                                    : "bg-slate-900 text-slate-400 border-slate-750 hover:bg-slate-750"
                                }`}
                                title="Скопировать GPS координаты"
                              >
                                {copiedSpotId === spot.id ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>ОК</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span className="text-[10px]">Коорд.</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed italic">
                              {spot.tips}
                            </p>

                            <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                              <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-750">
                                <span className="text-slate-400 block mb-0.5">Глубина:</span>
                                <strong className="text-slate-200">{spot.depth}</strong>
                              </div>
                              <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-750">
                                <span className="text-slate-400 block mb-0.5">Характер дна:</span>
                                <strong className="text-slate-200 capitalize">{spot.bottom}</strong>
                              </div>
                            </div>

                            <div className="text-xs space-y-1">
                              <span className="text-slate-400">Рекомендуемая снасть:</span>
                              <div className="text-slate-200 bg-slate-900/40 p-1.5 rounded border border-slate-750 text-[11px] font-medium">
                                {spot.tackle}
                              </div>
                            </div>
                          </div>

                          {/* Spot Targets */}
                          <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 mr-1 font-bold">Обитатели:</span>
                            {spot.fish.map((f) => (
                              <span key={f} className="text-[10px] font-bold bg-cyan-900/30 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800/20">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: MY CATCH LOG */}
          {/* ========================================================= */}
          {activeTab === "log" && (
            <div className="lg:col-span-12 space-y-6">
              
              {/* Log statistics banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-slate-700/70 text-center shadow-lg">
                  <span className="text-slate-400 text-xs block mb-1">Всего выездов</span>
                  <strong className="text-2xl font-black text-cyan-400">{logStats.count}</strong>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-slate-700/70 text-center shadow-lg">
                  <span className="text-slate-400 text-xs block mb-1">Общий улов (кг)</span>
                  <strong className="text-2xl font-black text-emerald-400">{logStats.totalWeight}</strong>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-slate-700/70 text-center shadow-lg">
                  <span className="text-slate-400 text-xs block mb-1">Трофей (кг)</span>
                  <strong className="text-2xl font-black text-amber-400">{logStats.maxWeight}</strong>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-slate-700/70 text-center shadow-lg">
                  <span className="text-slate-400 text-xs block mb-1">Главная рыба</span>
                  <strong className="text-lg font-black text-rose-400 flex justify-center items-center h-8 leading-none">
                    {logStats.bestFish}
                  </strong>
                </div>
              </div>

              {/* Log List Header with Add Catch Trigger */}
              <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 className="font-montserrat text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Мой личный рыболовный дневник</span>
                </h3>
                <button
                  onClick={() => setIsAddCatchOpen(true)}
                  className="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="h-4.5 w-4.5" />
                  <span>Записать улов</span>
                </button>
              </div>

              {/* Log catch input form wrapper */}
              {isAddCatchOpen && (
                <div className="rounded-2xl bg-slate-800 p-5 sm:p-6 border-2 border-cyan-500/40 shadow-xl space-y-4 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-2">
                    <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                      <Plus className="h-4.5 w-4.5" />
                      Записать новую поимку
                    </h4>
                    <button
                      onClick={() => setIsAddCatchOpen(false)}
                      className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-1 rounded-full cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddCatch} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Species select */}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 block">Вид пойманной рыбы:</label>
                      <select
                        value={newCatch.species}
                        onChange={(e) => setNewCatch({ ...newCatch, species: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        {fishSpecies.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Weight & Length */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block">Вес (кг):</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="0.01"
                          value={newCatch.weight || ""}
                          onChange={(e) => setNewCatch({ ...newCatch, weight: parseFloat(e.target.value) })}
                          placeholder="Например, 1.2"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block">Длина (см):</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={newCatch.length || ""}
                          onChange={(e) => setNewCatch({ ...newCatch, length: parseInt(e.target.value) })}
                          placeholder="Например, 45"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Fishing Spot selection */}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 block">Место ловли:</label>
                      <select
                        value={newCatch.location}
                        onChange={(e) => setNewCatch({ ...newCatch, location: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        {filteredSpots.map((spot) => (
                          <option key={spot.id} value={spot.name}>
                            {spot.name}
                          </option>
                        ))}
                        <option value="Секретное место Волги">Секретное место</option>
                      </select>
                    </div>

                    {/* Bait Used */}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 block">Наживка / Приманка:</label>
                      <input
                        type="text"
                        value={newCatch.bait || ""}
                        onChange={(e) => setNewCatch({ ...newCatch, bait: e.target.value })}
                        placeholder="Например, Виброхвост 3 дюйма"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 block">Дата поимки:</label>
                      <input
                        type="date"
                        value={newCatch.date}
                        onChange={(e) => setNewCatch({ ...newCatch, date: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Note details */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs text-slate-300 block">Детали / Заметка:</label>
                      <textarea
                        value={newCatch.notes}
                        onChange={(e) => setNewCatch({ ...newCatch, notes: e.target.value })}
                        placeholder="Опишите особенности поимки, характер поклевки, погоду..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-20"
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddCatchOpen(false)}
                        className="bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-650 transition-all cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="bg-cyan-500 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold hover:bg-cyan-400 transition-all cursor-pointer"
                      >
                        Добавить в лог
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Log List View */}
              {catchLog.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-750 p-12 text-center text-slate-400 space-y-3">
                  <Calendar className="h-10 w-10 mx-auto text-slate-500" />
                  <p className="text-sm">Ваш дневник пока пуст. Запишите свой первый улов!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {catchLog.map((item) => {
                    // Match emoji from species
                    const fishInfoObj = fishSpecies.find((f) => f.name === item.species);
                    const icon = fishInfoObj?.icon || "🐟";

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-sm flex flex-col sm:flex-row justify-between gap-4"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <span className="text-4xl sm:text-5xl shrink-0 p-2 rounded-xl bg-slate-900/50 border border-slate-750">
                            {icon}
                          </span>
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <h4 className="font-montserrat text-lg font-bold text-white">
                                {item.species} — <span className="text-cyan-400">{item.weight} кг</span>
                              </h4>
                              {item.length && (
                                <span className="text-xs bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-750">
                                  {item.length} см
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 ml-auto bg-slate-900 px-2 py-0.5 rounded border border-slate-750">
                                {new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-rose-400" />
                              <span>{item.location}</span>
                            </p>

                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                              Наживка/Приманка: <strong className="text-slate-100">{item.bait}</strong>
                            </p>

                            <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/30 p-2.5 rounded-lg border border-slate-750/50 mt-1">
                              {item.notes}
                            </p>

                            {item.weatherDetails && (
                              <div className="text-[9px] text-slate-400 flex items-center gap-1 pt-1.5">
                                <Cloud className="h-3 w-3 text-cyan-400" />
                                <span>Погодные параметры: {item.weatherDetails}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="sm:self-center flex sm:flex-col items-center justify-end">
                          <button
                            onClick={() => handleDeleteCatch(item.id)}
                            className="bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white p-2 rounded-xl transition-all border border-rose-500/20 hover:border-transparent cursor-pointer"
                            title="Удалить поимку"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: TOOLS & REGULATIONS */}
          {/* ========================================================= */}
          {activeTab === "guide" && (
            <div className="lg:col-span-12 space-y-6">
              
              {/* Spawning Ban Guide */}
              <div className="rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-800 to-slate-800 p-5 shadow-lg border border-rose-500/20">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-rose-900/40 p-3 text-rose-400 border border-rose-800/50 shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-montserrat text-lg font-bold text-white flex items-center gap-2">
                      Нерестовые ограничения: базовая памятка Ярославской области
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Каждый добросовестный рыбак обязан соблюдать природоохранное законодательство. 
                      Период ограничений: <strong className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-black">{spawningRules.dates}</strong>.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {spawningRules.restrictions.map((rule, idx) => (
                        <div key={idx} className="flex gap-2.5 bg-slate-900/40 p-3 rounded-xl border border-slate-750 text-xs">
                          <ChevronRight className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <p className="text-slate-300 leading-relaxed">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Ice thickness safety calculator */}
                <div className="md:col-span-6 space-y-4">
                  <div className="rounded-2xl bg-slate-800 p-5 shadow-md border border-slate-700 space-y-4">
                    <h4 className="font-montserrat text-base font-bold text-white flex items-center gap-1.5 border-b border-slate-700 pb-3">
                      <Calculator className="h-4.5 w-4.5 text-cyan-400" />
                      Калькулятор безопасности льда
                    </h4>

                    <div className="space-y-4">
                      {/* Ice thickness slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300">Измеренная толщина льда (см):</span>
                          <strong className="text-white text-sm">{iceThickness} см</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="40"
                          value={iceThickness}
                          onChange={(e) => setIceThickness(parseInt(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
                        />
                      </div>

                      {/* Ice quality select */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 block">Структура и цвет льда:</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setIceQuality("monolith")}
                            className={`py-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                              iceQuality === "monolith"
                                ? "bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold"
                                : "bg-slate-900 text-slate-400 border-slate-750 hover:bg-slate-700"
                            }`}
                          >
                            Прозрачный монолит
                          </button>
                          <button
                            onClick={() => setIceQuality("porous")}
                            className={`py-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                              iceQuality === "porous"
                                ? "bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold"
                                : "bg-slate-900 text-slate-400 border-slate-750 hover:bg-slate-700"
                            }`}
                          >
                            Пористый белый
                          </button>
                          <button
                            onClick={() => setIceQuality("slush")}
                            className={`py-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                              iceQuality === "slush"
                                ? "bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold"
                                : "bg-slate-900 text-slate-400 border-slate-750 hover:bg-slate-700"
                            }`}
                          >
                            Талая каша со снегом
                          </button>
                        </div>
                      </div>

                      {/* Display calculations results */}
                      <div className={`p-4 rounded-xl border text-xs space-y-1.5 transition-all ${iceSafetyResult.alertColor}`}>
                        <div className="font-bold flex items-center gap-1.5 text-sm">
                          <Info className="h-4 w-4 shrink-0" />
                          <span>Вердикт: {iceSafetyResult.rating}</span>
                        </div>
                        <p className="leading-relaxed font-medium">
                          {iceSafetyResult.detail}
                        </p>
                        <div className="text-[10px] opacity-80 pt-1.5 border-t border-black/10">
                          * Эффективная прочность льда с учетом качества: {iceSafetyResult.effectiveThickness} см. Однородный синеватый лед прочнее белого в 2 раза!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Knots Directory */}
                <div className="md:col-span-6 space-y-4">
                  <div className="rounded-2xl bg-slate-800 p-5 shadow-md border border-slate-700 space-y-4">
                    <h4 className="font-montserrat text-base font-bold text-white flex items-center gap-1.5 border-b border-slate-700 pb-3">
                      <Anchor className="h-4.5 w-4.5 text-cyan-400" />
                      Инструкция по рыболовным узлам
                    </h4>

                    {/* Knot tabs */}
                    <div className="flex gap-1 bg-slate-900 p-1 rounded-xl text-[10px] sm:text-xs">
                      {fishingKnots.map((knot, idx) => (
                        <button
                          key={knot.name}
                          onClick={() => setSelectedKnotIndex(idx)}
                          className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            selectedKnotIndex === idx ? "bg-cyan-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {knot.name.split(" (")[0]}
                        </button>
                      ))}
                    </div>

                    {/* Active Knot info */}
                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <strong className="text-white">{fishingKnots[selectedKnotIndex].name}</strong>
                          <span className="text-cyan-400">{fishingKnots[selectedKnotIndex].rating}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Применение: {fishingKnots[selectedKnotIndex].purpose}
                        </p>
                      </div>

                      {/* Steps list */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {fishingKnots[selectedKnotIndex].steps.map((step, idx) => (
                          <div key={idx} className="flex gap-2.5 items-start">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-900/40 border border-cyan-800 text-[10px] font-bold text-cyan-300">
                              {idx + 1}
                            </span>
                            <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feeding, bait and tackle guide */}
              <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700/80">
                <div className="flex items-center gap-2 border-b border-slate-700/50 pb-3 mb-4">
                  <BookOpen className="h-5 w-5 text-cyan-400" />
                  <div>
                    <h4 className="font-montserrat text-base font-bold text-white">Прикорм, наживка и снасти</h4>
                    <p className="text-[10px] text-slate-400">Короткая памятка для выбора тактики по погоде и виду рыбы</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
                    <h5 className="font-bold text-amber-300 mb-2">Прикорм</h5>
                    <ul className="space-y-1.5 text-slate-300">
                      <li>• Мирная рыба: базовая смесь, грунт и мелкая фракция без перекорма.</li>
                      <li>• Холодная вода: животный компонент — мотыль, опарыш, червь.</li>
                      <li>• Течение: утяжелите смесь и используйте кормушку, соответствующую силе струи.</li>
                      <li>• Начните с 3–5 стартовых кормушек и затем докармливайте малыми порциями.</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
                    <h5 className="font-bold text-rose-300 mb-2">Наживка и приманка</h5>
                    <ul className="space-y-1.5 text-slate-300">
                      <li>• Лещ, плотва, карась: опарыш, червь, перловка, кукуруза.</li>
                      <li>• Щука и судак: живец, джиг, воблер или колеблющаяся блесна.</li>
                      <li>• Окунь: червь, твистер и небольшие вращающиеся приманки.</li>
                      <li>• При слабом клёве меняйте размер/подачу, а не только ароматизатор.</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3">
                    <h5 className="font-bold text-cyan-300 mb-2">Снасти</h5>
                    <ul className="space-y-1.5 text-slate-300">
                      <li>• Фидер — бровки, ямы и течение; подберите вес кормушки под реку.</li>
                      <li>• Поплавок — тихая вода, камыш и прибрежная растительность.</li>
                      <li>• Спиннинг — активный поиск хищника у укрытий, перекатов и свалов.</li>
                      <li>• Зимой проверяйте лёд, используйте жерлицы, мормышки и балансиры по сезону.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Weather-based Packing Checklist Card */}
              <div className="rounded-2xl bg-slate-800 p-5 shadow-lg border border-slate-700/80">
                <div className="flex items-center gap-2 border-b border-slate-700/50 pb-3 mb-4">
                  <div className="rounded-xl bg-cyan-900/30 p-2 text-cyan-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-montserrat text-base font-bold text-white leading-none">
                      Умный список вещей (Экипировка)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Формируется автоматически на основе текущей погоды в выбранном районе
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Rain checks */}
                  {activeWeather.cloudiness === "Дождь" && (
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-sky-500/20 space-y-2">
                      <h5 className="text-xs font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1">
                        ☔ Дождевые опции:
                      </h5>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        {weatherChecklists.rainy.map((item, idx) => (
                          <li key={idx} className="flex gap-1.5 items-start">
                            <span className="text-sky-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summer hot checks */}
                  {activeWeather.temp >= 20 && (
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-amber-500/20 space-y-2">
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                        ☀️ Солнечная экипировка:
                      </h5>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        {weatherChecklists.summerHot.map((item, idx) => (
                          <li key={idx} className="flex gap-1.5 items-start">
                            <span className="text-amber-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cold/winter checks */}
                  {activeWeather.temp <= 0 && (
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-blue-500/20 space-y-2">
                      <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1">
                        ❄️ Зимнее снаряжение:
                      </h5>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        {weatherChecklists.winterCold.map((item, idx) => (
                          <li key={idx} className="flex gap-1.5 items-start">
                            <span className="text-blue-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Autumn / Spring cool checks */}
                  {activeWeather.temp > 0 && activeWeather.temp < 15 && (
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-emerald-500/20 space-y-2">
                      <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                        🍁 Межсезонье:
                      </h5>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        {weatherChecklists.autumnSpringCold.map((item, idx) => (
                          <li key={idx} className="flex gap-1.5 items-start">
                            <span className="text-emerald-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Universal tackle checklist */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/60 space-y-2">
                    <h5 className="text-xs font-bold text-cyan-400 uppercase tracking-wide">
                      🔧 Базовый комплект:
                    </h5>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      <li className="flex gap-1.5 items-start">
                        <span>•</span>
                        <span>Рыболовный билет, документы в защитном чехле</span>
                      </li>
                      <li className="flex gap-1.5 items-start">
                        <span>•</span>
                        <span>Мультитул, кусачки для лески и плоскогубцы</span>
                      </li>
                      <li className="flex gap-1.5 items-start">
                        <span>•</span>
                        <span>Аптечка (бинт, дезинфектор, пластырь)</span>
                      </li>
                      <li className="flex gap-1.5 items-start">
                        <span>•</span>
                        <span>Запасные крючки, грузила, поводки</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav style={!hasLocation ? { display: "none" } : undefined} className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { id: "forecast", label: "Прогноз", icon: Activity },
            { id: "fish", label: "Рыбы", icon: FishIcon },
            { id: "spots", label: "Места", icon: MapPin },
            { id: "log", label: "Дневник", icon: Calendar, badge: catchLog.length },
            { id: "guide", label: "Инструм.", icon: Calculator },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center min-w-[56px] py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "text-cyan-400 bg-cyan-500/10"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-[2]"}`} />
                <span className={`text-[9px] mt-0.5 font-bold ${isActive ? "text-cyan-400" : ""}`}>
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[8px] font-black text-slate-950">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute -bottom-2 w-6 h-0.5 bg-cyan-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer copyright */}
      <footer className="mt-12 border-t border-slate-800 bg-slate-950 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-400 space-y-2.5">
          <p className="flex items-center justify-center gap-1 font-montserrat font-bold text-white text-sm">
                      <span>ФишМетеоПлан</span>
            <span className="text-cyan-400">•</span>
            <span>2026</span>
          </p>
          <p className="max-w-md mx-auto leading-relaxed">
            Разработано на основе погодных, лунных и ихтиологических факторов; результат носит рекомендательный характер.
          </p>
          <p className="text-[10px] opacity-60">
            * Данные клёва носят рекомендательный характер. Настоящий улов зависит от мастерства и упорства рыболова!
          </p>
        </div>
      </footer>
    </div>
  );
}
