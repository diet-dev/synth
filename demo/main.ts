// Страница демки: категории и примеры слева, волна и редактор в центре,
// код пресета справа. Состояние — DemoState, оно же лежит в #hash.
import { renderVariants, rng, toWav, type Preset } from "../src/index.ts";
import { Player } from "./audio.ts";
import { presetCode } from "./code.ts";
import { mountEditor } from "./editor.ts";
import { EXAMPLES } from "./examples.ts";
import { CATEGORIES, DEFAULT_PERIOD, mutate } from "./generators.ts";
import { decodeState, encodeState } from "./hash.ts";
import { directBackend, Renderer, workerBackend, type Backend } from "./renderer.ts";
import type { DemoState, Group, Sound } from "./types.ts";
import { drawWave } from "./wave.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const LOOP_SEEDS = [1, 2, 3];
const GROUPS: [Group, string][] = [
  ["game", "Игра"],
  ["own", "Свои · цикл"],
  ["ui", "Интерфейс"],
];

const randomSeed = (): number => 1 + Math.floor(Math.random() * 1e6);
const guessGroup = (s: Sound): Group => (s.loop ? "own" : s.preset.ms <= 150 ? "ui" : "game");

let backend: Backend;
try {
  backend = workerBackend();
} catch {
  backend = directBackend;
}
const renderer = new Renderer(backend);
const player = new Player();

const initial = decodeState(location.hash.slice(1));
let state: DemoState = initial ?? { sound: structuredClone(EXAMPLES[0].sound), seed: 1, period: DEFAULT_PERIOD };
let group: Group = guessGroup(state.sound);
let active = initial ? "" : `ex:${EXAMPLES[0].id}`;
let last: Float32Array | null = null;

// ── Рендер и звук
// Режим (цикл или разовый звук) меняется сразу по клику, а рендер приходит
// позже: результат, заказанный в другом режиме, отбрасывается — его заменит
// рендер, заказанный при смене режима.
let loopWanted = false;

async function update(play: boolean): Promise<void> {
  const loop = loopWanted;
  let res: Float32Array[] | null;
  try {
    res = await renderer.request({ preset: state.sound.preset, seeds: loop ? LOOP_SEEDS : [state.seed] });
  } catch (e) {
    console.error("Рендер не удался", e);
    return;
  }
  if (!res || loop !== loopWanted) return;
  last = res[0];
  drawWave($("wave"), last);
  if (!loop) {
    if (play) player.playOnce(last);
  } else if (player.looping) player.setLoopVariants(res);
  else player.startLoop(res, state.period);
}

function startLoop(): void {
  loopWanted = true;
  syncTransport();
  void update(false);
}

function stopLoop(): void {
  loopWanted = false;
  player.stopLoop();
  syncTransport();
}

// ── Вывод: код, адрес, подписи
function highlight(code: string): string {
  const esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc
    .split("\n")
    .map((line) =>
      line.startsWith("//")
        ? `<span class="c">${line}</span>`
        : line
            .replace(/("[^"]*")/g, '<span class="s">$1</span>')
            .replace(/(^|[{,\s])([a-zA-Z]+)(?=: )/g, '$1<span class="k">$2</span>')
            .replace(/(?<![\w">])(-?\d+(?:\.\d+)?(?:e-?\d+)?)\b/g, '<span class="n">$1</span>'),
    )
    .join("\n");
}

function render(): void {
  $("code").innerHTML = highlight(presetCode(state.sound, state.period));
  $("sound-name").textContent = state.sound.name;
  const p = state.sound.preset;
  const voices = p.voices.length === 1 ? "1 голос" : p.voices.length < 5 ? `${p.voices.length} голоса` : `${p.voices.length} голосов`;
  $("sound-meta").textContent = `${Math.round(p.ms)} мс · ${voices}${state.sound.loop ? " · для цикла" : ""}`;
  $("seed").textContent = loopWanted ? "варианты 1–3" : `вариант ${state.seed}`;
  document.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => b.classList.toggle("active", b.dataset.key === active));
}

function save(): void {
  history.replaceState(null, "", "#" + encodeState(state));
}

function syncTransport(): void {
  const loop = $("loop");
  loop.classList.toggle("on", loopWanted);
  loop.textContent = loopWanted ? "■ Стоп" : "🔁 Цикл";
  ($("period") as HTMLInputElement).value = String(state.period);
  $("period-out").textContent = `${state.period} мс`;
  render();
}

// ── Загрузка звука: категория, пример, мутация
function load(sound: Sound, g: Group, key: string): void {
  state = { ...state, sound, seed: 1 };
  group = g;
  active = key;
  editor.refresh();
  render();
  save();
  if (sound.loop) startLoop();
  else {
    stopLoop();
    void update(true);
  }
}

const editor = mountEditor($("editor"), {
  get: () => state.sound.preset,
  onInput: (p: Preset) => {
    state.sound = { ...state.sound, preset: p };
    render();
    void update(false);
  },
  onCommit: (p: Preset) => {
    state.sound = { ...state.sound, preset: p };
    render();
    save();
    void update(true);
  },
});

// ── Левая колонка
const cats = $("categories");
for (const [g, title] of GROUPS) {
  const grid = document.createElement("div");
  grid.className = "cats";
  for (const c of CATEGORIES.filter((x) => x.group === g)) {
    const b = document.createElement("button");
    b.className = "btn cat";
    b.dataset.key = `cat:${c.id}`;
    b.innerHTML = `<span class="icon">${c.icon}</span>${c.label}`;
    b.onclick = () => load({ name: c.id.toUpperCase(), loop: c.loop, preset: c.make(rng(randomSeed())) }, c.group, `cat:${c.id}`);
    grid.append(b);
  }
  const h = document.createElement("h2");
  h.className = "group-title";
  h.textContent = title;
  cats.append(h, grid);
}

for (const e of EXAMPLES) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.dataset.key = `ex:${e.id}`;
  b.innerHTML = `<span class="tri">▶</span>${e.label}${e.sound.loop ? '<span class="tag">цикл</span>' : ""}`;
  b.onclick = () => load(structuredClone(e.sound), e.group, `ex:${e.id}`);
  li.append(b);
  $("examples").append(li);
}

$("mutate").onclick = () => {
  const preset = mutate(state.sound.preset, group, rng(randomSeed()));
  state.sound = { ...state.sound, preset };
  editor.refresh();
  render();
  save();
  void update(true);
};

// ── Центр
function play(): void {
  if (loopWanted) stopLoop();
  void update(true);
}
$("play").onclick = play;
$("wave").onclick = play;
$("variant").onclick = () => {
  if (loopWanted) return;
  state.seed += 1;
  render();
  save();
  void update(true);
};
$("loop").onclick = () => (loopWanted ? stopLoop() : startLoop());
const period = $("period") as HTMLInputElement;
period.oninput = () => {
  state.period = Number(period.value);
  player.setLoopPeriod(state.period);
  $("period-out").textContent = `${state.period} мс`;
  render();
};
period.onchange = save;

document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.code !== "Space" || e.repeat || t.closest("input, select, textarea")) return;
  e.preventDefault();
  play();
});

// ── Правая колонка
$("copy").onclick = async () => {
  const b = $("copy");
  try {
    await navigator.clipboard.writeText(presetCode(state.sound, state.period));
    b.textContent = "✓ Скопировано";
  } catch {
    b.textContent = "Нет доступа к буферу";
  }
  setTimeout(() => (b.textContent = "📋 Копировать"), 1500);
};
$("wav").onclick = () => {
  const [s] = renderVariants(state.sound.preset, [state.seed]);
  const a = document.createElement("a");
  a.href = toWav(s);
  a.download = `${state.sound.name.toLowerCase()}.wav`;
  a.click();
};

window.addEventListener("resize", () => last && drawWave($("wave"), last));

syncTransport();
save();
void update(false);
