import { useCallback, useMemo, useRef, useState } from "react";
import { exportSVG } from "./export/svg";
import { GENERATORS } from "./catalog";
import { randomSeed } from "./generators/random";
import { hasFileSystemAccess, openText, rereadText, saveText, type OpenedFile } from "./io/files";
import { LIMITS, MAX_SEED, type Settings } from "./settings";
import { buildPuzzle } from "./spec/build";
import { formatSpec, parseSpec } from "./spec/file";
import type { PuzzleSpec } from "./spec/types";
import { Field } from "./ui/Field";
import { PUZZLE_FILE, SVG_FILE } from "./ui/fileTypes";
import { Viewer } from "./viewer/Viewer";
import type { ViewMode } from "./viewer/scene";

const MODES: [ViewMode, string][] = [["built", "Зібраний"], ["exploded", "Розібраний"], ["steps", "По кроках"]];

interface Props {
  initial: PuzzleSpec;
  slug: string;
  file?: OpenedFile;
  settings: Settings;
  onSettings: (s: Settings) => void;
}

const fmt = (v: number, d: number) => v.toFixed(d).replace(".", ",");

export function PuzzlePage({ initial, slug, file, settings, onSettings }: Props) {
  const [spec, setSpec] = useState(initial);
  const [mode, setMode] = useState<ViewMode>("built");
  const [step, setStep] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState(file?.name ?? "");
  const fileHandle = useRef(file?.handle);

  const model = useMemo(() => buildPuzzle(spec, { t: settings.t, scale: settings.scale }), [spec, settings.t, settings.scale]);
  const sheet = useMemo(() => exportSVG(model, { kerf: settings.kerf, sheetW: settings.sheetW }), [model, settings.kerf, settings.sheetW]);
  const preview = useMemo(() => sheet.svg.replace(/width="[^"]+mm" height="[^"]+mm" /, ""), [sheet]);

  const set = (key: keyof Settings) => (v: number) => onSettings({ ...settings, [key]: v });
  const onUnsupported = useCallback(() => setWebgl(false), []);
  const pickMode = (m: ViewMode) => { setMode(m); setStep(0); };
  // A different puzzle is no longer the file on disk, and may have fewer assembly steps.
  const show = (next: PuzzleSpec, file?: OpenedFile) => {
    setSpec(next); setStep(0);
    fileHandle.current = file?.handle; setFileName(file?.name ?? "");
  };
  const generator = spec.generator && GENERATORS[spec.generator.name];
  const seed = spec.generator?.seed;
  const generate = (next: number) => { if (generator) { show(generator(next)); setNote(""); } };
  const baseName = seed ? `${slug}_${seed}` : slug;

  // File dialogs can fail for reasons outside our control (permissions, disk); report instead of throwing.
  const io = async (action: () => Promise<string | null>) => {
    try { const msg = await action(); if (msg) setNote(msg); }
    catch (e) { setNote(e instanceof Error ? e.message : "Не вдалося виконати операцію з файлом."); }
  };
  const openPuzzle = () => io(async () => {
    const f = await openText(PUZZLE_FILE);
    if (!f) return null;
    show(parseSpec(f.text), f);
    return "Відкрито: " + f.name;
  });
  const rereadPuzzle = () => io(async () => {
    const f = await rereadText(fileHandle.current!);
    show(parseSpec(f.text), f);
    return "Перечитано: " + f.name;
  });
  const savePuzzle = (asNew: boolean) => io(async () => {
    const f = await saveText(formatSpec(spec) + "\n", baseName + ".json", PUZZLE_FILE, asNew ? undefined : fileHandle.current);
    if (!f) return null;
    fileHandle.current = f.handle; setFileName(f.name);
    return "Збережено: " + f.name;
  });
  const saveSvg = () => io(async () => {
    const name = `${baseName}_${fmt(settings.t, 1)}mm_kerf${fmt(settings.kerf, 2)}.svg`;
    const f = await saveText(sheet.svg, name, SVG_FILE);
    return f && "Збережено: " + f.name;
  });

  const steps = model.steps;
  const count = model.parts.filter(p => p.basis).length;
  const about = webgl
    ? `${spec.description ?? "Шип-паз, збирається без клею."} Деталей: ${count}. Крути модель мишею.`
    : "Цей браузер не підтримує WebGL, тож 3D-перегляд недоступний. Шаблон для різки працює.";
  return (
    <div className="app">
      <div className="stage">
        <Viewer model={model} mode={mode} step={step} onUnsupported={onUnsupported} />
        <div className="title">
          <a className="back" href="#">← Галерея</a>
          <h1>{model.name}</h1>
          <p>{about}</p>
        </div>
        <div className="modes">
          <div className="seg" role="group" aria-label="Вигляд">
            {MODES.map(([m, label]) => (
              <button key={m} aria-pressed={mode === m} onClick={() => pickMode(m)}>{label}</button>
            ))}
          </div>
          {mode === "steps" && (
            <div className="steps">
              <span><b>{step + 1}/{steps.length}</b>{steps[step].text}</span>
              <button className="iconbtn" aria-label="Попередній крок" disabled={step === 0} onClick={() => setStep(step - 1)}>‹</button>
              <button className="iconbtn" aria-label="Наступний крок" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>›</button>
            </div>
          )}
        </div>
      </div>
      <aside>
        {/* on narrow screens the description moves here so it does not cover the model */}
        <p className="about">{about}</p>
        {generator && (
          <section>
            <h2>Варіації</h2>
            <div className="seed">
              <label htmlFor="seed">Зерно</label>
              <input
                type="number" id="seed" inputMode="numeric" min={0} max={MAX_SEED} value={seed}
                onChange={e => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= MAX_SEED) generate(v); }}
              />
              <button className="btn primary" onClick={() => generate(randomSeed())}>Випадковий</button>
              <button className="btn" disabled={spec === initial} onClick={() => { show(initial, file); setNote(""); }}>Початковий</button>
            </div>
            <p className="note">Кожне зерно дає свій варіант, і те саме зерно завжди той самий. Варіант можна зберегти як файл.</p>
          </section>
        )}
        <section>
          <h2>Під твою фанеру</h2>
          <Field id="t" label="Товщина фанери" value={settings.t} limits={LIMITS.t} output={fmt(settings.t, 1) + " мм"} onChange={set("t")}
            hint="Міряй штангенциркулем: «3 мм» часто виявляються 2,8 або 3,2." />
          <Field id="k" label="Керф лазера" value={settings.kerf} limits={LIMITS.kerf} output={fmt(settings.kerf, 2) + " мм"} onChange={set("kerf")}
            hint="Ширина пропалу. Контури зсуваються на половину керфа, щоб пази вийшли точно в розмір." />
          <Field id="s" label="Розмір" value={settings.scale} limits={LIMITS.scale} onChange={set("scale")}
            output={Math.round(settings.scale * 100) + " %"} />
          <Field id="sw" label="Ширина робочого поля" value={settings.sheetW} limits={LIMITS.sheetW} output={settings.sheetW + " мм"} onChange={set("sheetW")} />
        </section>
        <section>
          <h2>Шаблон для різки</h2>
          {/* preview is our own generated SVG, not user input */}
          <div className="sheet" dangerouslySetInnerHTML={{ __html: preview }} />
          <div className="meta"><span>{Math.ceil(sheet.w)} × {Math.ceil(sheet.h)} мм</span><span>SVG, міліметри</span></div>
          <div className="legend">
            <span><i style={{ color: "var(--cut)" }} />Різати</span>
            <span><i style={{ color: "var(--engrave)" }} />Гравіювати лінією</span>
          </div>
          <button className="dl" onClick={saveSvg}>Зберегти SVG</button>
          <p className="note">Файл відкривається в LightBurn, Inkscape або RDWorks.</p>
        </section>
        <section>
          <h2>Файл моделі</h2>
          <div className="row">
            <button className="btn" onClick={openPuzzle}>Відкрити…</button>
            <button className="btn" onClick={() => savePuzzle(false)}>Зберегти</button>
            {hasFileSystemAccess && <button className="btn" onClick={() => savePuzzle(true)}>Зберегти як…</button>}
            {hasFileSystemAccess && fileName && <button className="btn" onClick={rereadPuzzle}>Перечитати</button>}
          </div>
          <p className="note" role="status">
            {note || (fileName ? "Файл: " + fileName : "Модель це JSON: параметри, деталі, шипи, отвори. Його можна правити руками й відкривати знову.")}
            {!hasFileSystemAccess && " У цьому браузері файли зберігаються через «Завантаження»."}
          </p>
        </section>
        <section>
          <h2>Деталі</h2>
          <ol className="parts">
            {model.parts.map(p => <li key={p.id}><b>{p.id}</b>{p.name}</li>)}
          </ol>
        </section>
        <section>
          <h2>Перед різкою</h2>
          <ol className="tips">
            <li>Спершу виріж гребінку 8. Встав обрізок фанери в кожен паз і знайди той, де сидить щільно. Якщо це «+.1», додай 0,1 мм до товщини.</li>
            <li>Порядок у файлі вже правильний: гравіювання, потім внутрішні отвори, потім зовнішні контури. Так деталь не зсунеться, поки вирізаються вікна.</li>
            <li>Вмикай витяжку. Клей у фанері горить їдким димом.</li>
          </ol>
        </section>
      </aside>
    </div>
  );
}
