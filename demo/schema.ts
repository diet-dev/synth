// Описание всех параметров пресета для редактора. def — значение, которое
// рендер подставляет, когда поля нет (сверено с src/render.ts и src/classic.ts);
// у обязательных полей (required) def — стартовое значение.

export type NumField = {
  kind: "num";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Логарифмическая шкала ползунка — для частот и длительностей. */
  log?: boolean;
  unit?: string;
  def: number;
  /** Поле можно выключить галочкой: выключенное в пресет не попадает. */
  optional?: boolean;
  /** Поле обязательно по типу — не выбрасывается при сжатии пресета. */
  required?: boolean;
};
export type SelectField = { kind: "select"; key: string; label: string; options: readonly string[]; def: string };
export type BoolField = { kind: "bool"; key: string; label: string; def: boolean };
export type Field = NumField | SelectField | BoolField;
/** key "" — поля самого голоса/пресета; иначе имя вложенного объекта. */
export type Block = { key: string; label: string; optional: boolean; fields: Field[] };

type NumOpts = Partial<Pick<NumField, "log" | "unit" | "optional" | "required">>;
const num = (key: string, label: string, min: number, max: number, step: number, def: number, o: NumOpts = {}): NumField => ({
  kind: "num", key, label, min, max, step, def, ...o,
});
const HZ = { log: true, unit: "Гц" } as const;
const MS = { unit: "мс" } as const;

export const PRESET_SCHEMA: Block[] = [
  {
    key: "",
    label: "Звук",
    optional: false,
    fields: [
      num("ms", "Длина", 10, 5000, 1, 300, { ...MS, log: true, required: true }),
      num("peak", "Пик", 0.05, 1, 0.01, 0.8, { optional: true }),
      num("lp", "ФНЧ", 50, 20000, 1, 2000, { ...HZ, optional: true }),
      num("lpPasses", "Проходов ФНЧ", 1, 4, 1, 1),
    ],
  },
  {
    key: "fade",
    label: "Вход и выход",
    optional: true,
    fields: [num("in", "Вход", 0, 500, 1, 20, { ...MS, required: true }), num("out", "Выход", 0, 500, 1, 20, { ...MS, required: true })],
  },
];

export const TONAL_SCHEMA: Block[] = [
  {
    key: "",
    label: "Генератор",
    optional: false,
    fields: [
      { kind: "select", key: "wave", label: "Волна", options: ["sine", "saw", "square", "triangle", "noise"], def: "sine" },
      num("hz", "Частота", 20, 12000, 1, 440, HZ),
      num("toHz", "К концу", 20, 12000, 1, 440, { ...HZ, optional: true }),
      num("duty", "Скважность", 0.05, 0.95, 0.01, 0.5),
      num("noise", "Шум", 0, 2, 0.01, 0),
      num("gain", "Громкость", 0, 2, 0.01, 1),
      num("lp", "ФНЧ", 50, 20000, 1, 3000, { ...HZ, optional: true }),
      num("hp", "ФВЧ", 20, 10000, 1, 200, { ...HZ, optional: true }),
    ],
  },
  {
    key: "env",
    label: "Огибающая",
    optional: true,
    fields: [
      num("a", "Атака", 0, 2000, 1, 0, MS),
      num("h", "Удержание", 0, 3000, 1, 0, { ...MS, optional: true }),
      num("d", "Спад", 0, 5000, 1, 0, MS),
      { kind: "bool", key: "exp", label: "Экспонента", def: false },
    ],
  },
  {
    key: "pulses",
    label: "Толчки",
    optional: true,
    fields: [
      num("rate", "Частота", 0, 100, 0.1, 20, { unit: "/с", required: true }),
      num("jitter", "Разброс интервала", 0, 1, 0.01, 0),
      num("ampJitter", "Разброс громкости", 0, 1, 0.01, 0),
      num("decay", "Спад толчка", 1, 200, 0.5, 15, { ...MS, required: true }),
      num("len", "Длина толчка", 1, 500, 1, 90, { ...MS, optional: true }),
    ],
  },
  {
    key: "am",
    label: "Модуляция громкости",
    optional: true,
    fields: [num("hz", "Частота", 0.1, 50, 0.1, 5, { ...HZ, required: true }), num("depth", "Глубина", 0, 1, 0.01, 0.5, { required: true })],
  },
  {
    key: "fm",
    label: "Модуляция тона",
    optional: true,
    fields: [num("hz", "Частота", 0.1, 50, 0.1, 5, { ...HZ, required: true }), num("depth", "Глубина", 0, 1, 0.01, 0.1, { required: true })],
  },
];

export const CLASSIC_SCHEMA: Block[] = [
  {
    key: "",
    label: "Генератор",
    optional: false,
    fields: [
      { kind: "select", key: "wave", label: "Волна", options: ["square", "saw", "sine", "noise"], def: "square" },
      num("hz", "Частота", 20, 12000, 1, 440, { ...HZ, required: true }),
      num("slide", "Сдвиг тона", -60, 60, 0.01, 0, { unit: "окт/с" }),
      num("accel", "Ускорение", -60, 60, 0.01, 0, { unit: "окт/с²" }),
      num("minHz", "Нижний предел", 10, 2000, 1, 50, { ...HZ, optional: true }),
      { kind: "bool", key: "stopAtMin", label: "Обрыв на пределе", def: false },
      num("repeat", "Повтор", 10, 2000, 1, 200, { ...MS, optional: true }),
      num("duty", "Скважность", 0, 0.5, 0.01, 0.5),
      num("dutySlide", "Сдвиг скважности", -2, 2, 0.01, 0, { unit: "/с" }),
      num("gain", "Громкость", 0, 1, 0.01, 1),
    ],
  },
  {
    key: "env",
    label: "Огибающая",
    optional: false,
    fields: [
      num("a", "Атака", 0, 3000, 1, 0, { ...MS, required: true }),
      num("h", "Удержание", 0, 3000, 1, 100, { ...MS, required: true }),
      num("d", "Спад", 0, 5000, 1, 200, { ...MS, required: true }),
      num("punch", "Удар", 0, 1, 0.01, 0),
    ],
  },
  {
    key: "vib",
    label: "Вибрато",
    optional: true,
    fields: [num("hz", "Частота", 0.5, 60, 0.1, 10, { ...HZ, required: true }), num("depth", "Глубина", 0, 0.5, 0.01, 0.1, { required: true })],
  },
  {
    key: "jump",
    label: "Скачок тона",
    optional: true,
    fields: [
      num("ms", "Через", 0, 2000, 1, 100, { ...MS, required: true }),
      num("ratio", "Во сколько раз", 0.25, 4, 0.01, 1.5, { log: true, required: true }),
    ],
  },
  {
    key: "lp",
    label: "ФНЧ",
    optional: true,
    fields: [
      num("hz", "Срез", 20, 20000, 1, 3000, { ...HZ, required: true }),
      num("slide", "Сдвиг", -30, 30, 0.01, 0, { unit: "окт/с" }),
      num("res", "Резонанс", 0, 1, 0.01, 0),
    ],
  },
  {
    key: "hp",
    label: "ФВЧ",
    optional: true,
    fields: [num("hz", "Срез", 1, 10000, 1, 100, { ...HZ, required: true }), num("slide", "Сдвиг", -30, 30, 0.01, 0, { unit: "окт/с" })],
  },
  {
    key: "phaser",
    label: "Фазер",
    optional: true,
    fields: [num("ms", "Задержка", -10, 10, 0.01, 1, { ...MS, required: true }), num("slide", "Сдвиг", -5, 5, 0.01, 0, { unit: "мс/с" })],
  },
];
