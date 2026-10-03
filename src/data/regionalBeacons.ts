export type BeaconSourceType = "measured" | "official" | "modelled" | "missing";
export type RegionalWaterType = "river" | "reservoir" | "lake";

export interface RegionalBeacon {
  id: string;
  title: string;
  aliases: string[];
  type: RegionalWaterType;
  evidenceLevel: "confirmed" | "partial";
  evidence: string[];
  signals: Array<{
    id: string;
    title: string;
    requiredInputs: string[];
    appliesWhen: string;
    output: string;
    sourceType: BeaconSourceType;
    effect: "gate" | "context" | "candidate";
  }>;
  knownFish: string[];
  legalWarnings: string[];
  missing: string[];
  sources: string[];
}

const officialRules = "https://fish.gov.ru/";
const roswater = "https://voda.gov.ru/";

export const yaroslavlRegionalBeacons: RegionalBeacon[] = [
  {
    id: "volga-yaroslavl",
    title: "Волга / Горьковское водохранилище у Ярославля",
    aliases: ["ярославль", "волга", "горьковское водохранилище"],
    type: "reservoir",
    evidenceLevel: "confirmed",
    evidence: [
      "Гидрологический контекст подтверждён для участка Волги, относимого к Горьковскому водохранилищу.",
      "Оперативные уровень и температура воды допустимы только с постом, временем и флагом качества.",
      "Региональный список рыб не доказывает присутствие вида в конкретной точке и не является меткой улова."
    ],
    signals: [
      { id: "legal-gate", title: "Правовой шлюз", requiredInputs: ["дата", "точка", "берег/лодка", "снасть", "число крючков", "целевой вид"], appliesWhen: "Всегда до прогноза", output: "разрешено / ограничено / нужна проверка", sourceType: "official", effect: "gate" },
      { id: "level-trend", title: "Уровень и его тренд", requiredInputs: ["уровень у релевантного поста", "1/3/7 суток", "время", "QC"], appliesWhen: "Только при гидравлической сопоставимости поста и точки", output: "рост / стабильно / спад / неизвестно", sourceType: "missing", effect: "context" },
      { id: "water-column", title: "Водная колонка", requiredInputs: ["температура воды", "глубина", "метод", "время"], appliesWhen: "Только измерение в точке или валидной близкой станции", output: "измеренный вход, без подстановки воздуха", sourceType: "missing", effect: "candidate" }
    ],
    knownFish: ["лещ", "плотва", "щука", "судак", "окунь", "чехонь", "густера"],
    legalWarnings: ["Сезонные ограничения и нерестовые участки проверять по актуальной редакции правил; календарь сам по себе не заменяет геопроверку.", "Охраняемые виды не должны становиться целью прогноза."],
    missing: ["точный сегмент и глубина", "измеренная температура воды и DO", "расход/скорость течения", "локальная мутность", "стандартизированные выезды с нулями"],
    sources: [officialRules, roswater]
  },
  {
    id: "kotorosl",
    title: "Которосль",
    aliases: ["которосль", "которость", "котороть"],
    type: "river",
    evidenceLevel: "confirmed",
    evidence: [
      "Государственный водный реестр подтверждает Которосль как реку Верхневолжского бассейна, впадающую в Горьковское водохранилище.",
      "Публичный мониторинг качества воды относится к названным створам, а не к любой береговой точке.",
      "Отдельные пользовательские фотоотчёты имеют низкую доказательность и не обучают модель улову."
    ],
    signals: [
      { id: "legal-gate", title: "Правовой шлюз", requiredInputs: ["точка по руслу", "дата", "снасть", "вид"], appliesWhen: "Всегда", output: "статус законности", sourceType: "official", effect: "gate" },
      { id: "water-quality", title: "Сопоставимый створ", requiredInputs: ["створ", "дата пробы", "показатель", "единица", "расстояние"], appliesWhen: "Только для гидравлически сопоставимого участка", output: "измерено / устарело / отсутствует", sourceType: "missing", effect: "context" },
      { id: "river-dynamics", title: "Речная динамика", requiredInputs: ["уровень", "расход", "температура воды", "ледовая фаза"], appliesWhen: "Только при датированных наблюдениях", output: "состояние сегмента, не процент клёва", sourceType: "missing", effect: "candidate" }
    ],
    knownFish: ["голавль", "подуст", "щука"],
    legalWarnings: ["Для нижних участков и притоков применимость ограничений зависит от точного положения и актуальной редакции правил.", "Предполагаемая видовая идентификация из отчётов не считается подтверждённой."],
    missing: ["сегмент и координата", "глубина/дно/течение", "свежая прозрачность и DO", "стандартизированные нулевые выезды"],
    sources: ["https://voda.gov.ru/", "https://cugms.ru/gidrologiya/nablyudeniya-na-rekah-i-vodoemah/", officialRules]
  },
  {
    id: "rybinsk-reservoir",
    title: "Рыбинское водохранилище — ярославская часть",
    aliases: ["рыбинское водохранилище", "рыбинка", "рыбинск"],
    type: "reservoir",
    evidenceLevel: "confirmed",
    evidence: [
      "Это крупное регулируемое водохранилище с существенно меняющейся площадью зеркала при разных уровнях.",
      "Научные данные подтверждают важность температуры воды и ледовой фазы, но не дают прогноза по конкретной точке.",
      "Исторический пользовательский отчёт является только примером формата журнала, а не доказательством снасти."
    ],
    signals: [
      { id: "regime", title: "Режим водохранилища", requiredInputs: ["уровень", "приток", "сброс", "изменение 1/3/7 суток"], appliesWhen: "При наличии датированного официального ряда", output: "гидрологический контекст", sourceType: "missing", effect: "context" },
      { id: "vertical-profile", title: "Вертикальный профиль", requiredInputs: ["температура по глубине", "DO по глубине", "точка", "время"], appliesWhen: "Свежие измерения в том же плёсе/сегменте", output: "измеренный профиль или неизвестно", sourceType: "missing", effect: "candidate" },
      { id: "legal-gate", title: "Ограничения вида и метода", requiredInputs: ["дата", "точка", "вид", "метод", "ледовая фаза"], appliesWhen: "Всегда", output: "разрешено / ограничено / нужна проверка", sourceType: "official", effect: "gate" }
    ],
    knownFish: ["щука", "окунь", "лещ", "судак", "плотва", "линь"],
    legalWarnings: ["Для ярославской части отдельно проверять запреты на троллинг, судака, зимовальные ямы и нерестовые участки.", "Нельзя переносить ограничения на всю акваторию без определения административной части."],
    missing: ["точная ярославская точка", "уровень/приток/сброс", "профиль воды", "батиметрия и грунт", "данные усилие—улов"],
    sources: [roswater, officialRules, "https://www.vniro.ru/"]
  },
  {
    id: "uglich-reservoir",
    title: "Угличское водохранилище — ярославская часть",
    aliases: ["угличское водохранилище", "углич"],
    type: "reservoir",
    evidenceLevel: "confirmed",
    evidence: [
      "Подтверждён тип равнинного руслового регулируемого водохранилища на Волге.",
      "Режим гидроузла связан с притоком, уровнем и диспетчерским графиком; календарь недостаточен.",
      "Исследования показывают пространственную и межгодовую неоднородность температуры и кислорода."
    ],
    signals: [
      { id: "hydro-regime", title: "Гидрологический режим", requiredInputs: ["приток", "уровень", "сброс", "время"], appliesWhen: "Только при официальном датированном источнике", output: "фаза режима / неизвестно", sourceType: "missing", effect: "context" },
      { id: "profile", title: "Измерения по глубине", requiredInputs: ["температура", "DO", "глубина", "плёс", "время"], appliesWhen: "Не переносить на другой плёс или другой год", output: "измерено / отсутствует", sourceType: "missing", effect: "candidate" },
      { id: "legal-gate", title: "Правовой шлюз", requiredInputs: ["точка", "дата", "вид", "снасть", "ледовая фаза"], appliesWhen: "Всегда", output: "статус законности", sourceType: "official", effect: "gate" }
    ],
    knownFish: ["лещ", "судак", "щука"],
    legalWarnings: ["Требуется сверка актуальной редакции правил и официальных полигонов ограничений.", "Гидрологический порог половодья — контекст режима, не сигнал клёва."],
    missing: ["точка и административная часть", "оперативные уровень/приток/сброс", "глубина/дно/течение", "локальные журналы уловов"],
    sources: [roswater, officialRules, "https://www.vniro.ru/"]
  },
  {
    id: "pleshcheyevo",
    title: "Плещеево озеро",
    aliases: ["плещеево озеро", "плещеево", "переславль-залесский", "переславль"],
    type: "lake",
    evidenceLevel: "confirmed",
    evidence: [
      "Подтверждено, что это проточное пресноводное озеро в границах национального парка.",
      "Национальный парк публикует список видов и ведёт температурно-кислородный мониторинг, но это не текущая точка ловли.",
      "Ряпушка Плещеева озера имеет отдельный охранный правовой статус и не должна быть целью вылова."
    ],
    signals: [
      { id: "park-legal-gate", title: "Режим национального парка", requiredInputs: ["зона", "дата", "действующий приказ", "способ ловли", "вид"], appliesWhen: "Всегда до прогноза", output: "разрешено / запрещено / нужна проверка", sourceType: "official", effect: "gate" },
      { id: "local-column", title: "Локальная водная колонка", requiredInputs: ["глубина", "температура по слоям", "DO по слоям", "время"], appliesWhen: "Особенно подо льдом и на глубине", output: "измеренный профиль / неизвестно", sourceType: "missing", effect: "candidate" },
      { id: "inflow-context", title: "Устье Трубежа / сток", requiredInputs: ["расход", "мутность", "осадки", "дистанция до устья", "время"], appliesWhen: "Только при измерении или проверенном источнике", output: "контекст притока, без направления эффекта", sourceType: "missing", effect: "context" }
    ],
    knownFish: ["лещ", "линь", "язь", "плотва", "налим", "окунь", "щука"],
    legalWarnings: ["Перед выходом проверять действующий приказ национального парка и федеральные правила.", "Ряпушка Плещеева озера — не цель вылова; при неопределённой зоне прогноз блокируется."],
    missing: ["действующий режим НП", "точка/зона и разрешение", "батиметрия", "свежие профили температуры и DO", "ледовая безопасность", "данные усилие—улов"],
    sources: ["https://plesheevo-lake.ru/", officialRules, "https://www.ras.ru/"]
  }
];

export function getRegionalBeacon(locationName: string): RegionalBeacon | null {
  const normalized = locationName.trim().toLowerCase();
  return yaroslavlRegionalBeacons.find((beacon) => beacon.aliases.some((alias) => normalized.includes(alias))) ?? null;
}
