// Редактор пресета: строится по схеме. Во время перетаскивания — onInput
// (только волна), по отпусканию и прочим правкам — onCommit (звук, адрес).
import type { Preset } from "../src/index.ts";
import { addVoice, duplicateVoice, getValue, removeVoice, schemaOf, setBlock, setValue } from "./ops.ts";
import type { Block, Field, NumField } from "./schema.ts";

type Opts = { get(): Preset; onInput(p: Preset): void; onCommit(p: Preset): void };

const SLIDER = 1000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

// Ползунок 0..SLIDER ↔ значение: линейно или по логарифму
const toSlider = (f: NumField, v: number): number =>
  f.log && f.min > 0 ? (Math.log(v / f.min) / Math.log(f.max / f.min)) * SLIDER : ((v - f.min) / (f.max - f.min)) * SLIDER;
function fromSlider(f: NumField, t: number): number {
  const v = f.log && f.min > 0 ? f.min * (f.max / f.min) ** (t / SLIDER) : f.min + ((f.max - f.min) * t) / SLIDER;
  const snapped = Math.round(v / f.step) * f.step;
  return Number(Math.min(f.max, Math.max(f.min, snapped)).toPrecision(6));
}
const show = (v: number): string => String(Number(v.toPrecision(5)));

export function mountEditor(root: HTMLElement, opts: Opts): { refresh(): void } {
  let voice = 0;

  const commit = (p: Preset, rebuild = false): void => {
    opts.onCommit(p);
    if (rebuild) refresh();
  };

  function numRow(f: NumField, at: number | null, block: string): HTMLElement {
    const cur = getValue(opts.get(), at, block, f.key);
    // Обязательное по смыслу поле без значения — это значение по умолчанию, оно активно
    const on = typeof cur === "number" || !f.optional;
    const value = typeof cur === "number" ? cur : f.def;
    const range = el("input", { type: "range", min: "0", max: String(SLIDER), step: "any", value: String(toSlider(f, value)), disabled: !on });
    const box = el("input", { type: "number", step: String(f.step), value: show(value), disabled: !on });
    const row = el("div", { className: "row" + (on ? "" : " disabled") });

    let check: HTMLElement = el("span");
    if (f.optional) {
      const box = el("input", { type: "checkbox", checked: on, title: "Включить поле" });
      box.onchange = () => commit(setValue(opts.get(), at, block, f.key, box.checked ? f.def : undefined), true);
      check = box;
    }
    range.oninput = () => {
      const v = fromSlider(f, Number(range.value));
      box.value = show(v);
      opts.onInput(setValue(opts.get(), at, block, f.key, v));
    };
    range.onchange = () => commit(setValue(opts.get(), at, block, f.key, fromSlider(f, Number(range.value))));
    box.onchange = () => {
      const raw = Number(box.value);
      if (!Number.isFinite(raw)) return void (box.value = show(value));
      const v = Math.min(f.max, Math.max(f.min, raw));
      box.value = show(v);
      range.value = String(toSlider(f, v));
      commit(setValue(opts.get(), at, block, f.key, v));
    };
    row.append(check, el("span", { className: "label", title: f.label }, f.label), range, el("span", { className: "num" }, box, el("span", { className: "unit" }, f.unit ?? "")));
    return row;
  }

  function fieldRow(f: Field, at: number | null, block: string): HTMLElement {
    if (f.kind === "num") return numRow(f, at, block);
    const cur = getValue(opts.get(), at, block, f.key);
    if (f.kind === "select") {
      const sel = el("select", { onchange: () => commit(setValue(opts.get(), at, block, f.key, sel.value), true) });
      for (const o of f.options) sel.append(el("option", { value: o, selected: (cur ?? f.def) === o }, o));
      return el("div", { className: "row" }, el("span"), el("span", { className: "label" }, f.label), sel);
    }
    const box = el("input", { type: "checkbox", checked: cur === true });
    box.onchange = () => commit(setValue(opts.get(), at, block, f.key, box.checked ? true : undefined));
    return el("label", { className: "row bool" }, box, el("span", { className: "label" }, f.label));
  }

  function blockCard(b: Block, at: number | null): HTMLElement {
    const p = opts.get();
    const on = !b.optional || (b.key ? getValue(p, at, "", b.key) !== undefined : true);
    const card = el("div", { className: "panel block" + (on ? "" : " off") });
    const head = el("label", { className: "block-head" });
    if (b.optional) {
      const box = el("input", { type: "checkbox", checked: on });
      box.onchange = () => commit(setBlock(opts.get(), at, b.key, box.checked), true);
      head.append(box);
    }
    head.append(b.label);
    card.append(head, el("div", { className: "rows" }, ...b.fields.map((f) => fieldRow(f, at, b.key))));
    return card;
  }

  function voiceBar(p: Preset): HTMLElement {
    const bar = el("div", { className: "voices-bar" });
    p.voices.forEach((v, i) => {
      const kind = "kind" in v ? "классический" : "тональный";
      bar.append(el("button", { className: "tab" + (i === voice ? " active" : ""), onclick: () => ((voice = i), refresh()) }, `Голос ${i + 1}`, el("small", {}, `${kind} · ${v.wave}`)));
    });
    bar.append(el("span", { className: "spacer" }));
    const add = (kind: "tonal" | "classic"): void => {
      const n = addVoice(opts.get(), kind);
      voice = n.voices.length - 1;
      commit(n, true);
    };
    bar.append(
      el("button", { className: "btn small", onclick: () => add("tonal") }, "+ тональный"),
      el("button", { className: "btn small", onclick: () => add("classic") }, "+ классический"),
      el("button", { className: "btn small", title: "Дублировать голос", onclick: () => ((voice += 1), commit(duplicateVoice(opts.get(), voice - 1), true)) }, "⧉"),
    );
    if (p.voices.length > 1)
      bar.append(
        el("button", {
          className: "btn small",
          title: "Удалить голос",
          onclick: () => {
            const n = removeVoice(opts.get(), voice);
            voice = Math.min(voice, n.voices.length - 1);
            commit(n, true);
          },
        }, "✕"),
      );
    return bar;
  }

  function refresh(): void {
    const p = opts.get();
    voice = Math.min(voice, p.voices.length - 1);
    root.replaceChildren(
      el("div", { className: "blocks" }, ...schemaOf(p, null).map((b) => blockCard(b, null))),
      voiceBar(p),
      el("div", { className: "blocks" }, ...schemaOf(p, voice).map((b) => blockCard(b, voice))),
    );
  }

  refresh();
  return { refresh };
}
