import { useEffect, useMemo, useState } from "react";
import { GALLERY } from "./catalog";
import { buildPuzzle } from "./spec/build";
import { renderThumbnails } from "./viewer/thumbnails";

interface Props { onOpenFile: () => void; note: string }

export function Gallery({ onOpenFile, note }: Props) {
  const models = useMemo(() => GALLERY.map(g => buildPuzzle(g.spec, { t: 3, scale: 1 })), []);
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => setThumbs(renderThumbnails(models)), [models]);

  return (
    <main className="gallery">
      <header>
        <h1>Іграшки з фанери</h1>
        <p>Обери модель, підлаштуй під свою фанеру й лазер, завантаж SVG і ріж. Усе збирається на шип-паз, без клею.</p>
      </header>
      <ul className="cards">
        {GALLERY.map((g, i) => (
          <li key={g.slug}>
            <a className="card" href={"#" + g.slug}>
              <div className="thumb">{thumbs[i] && <img src={thumbs[i]} alt="" />}</div>
              <h2>{g.spec.name}</h2>
              <p>{g.spec.description}</p>
              <span className="count">Деталей: {models[i].parts.filter(p => p.basis).length}</span>
            </a>
          </li>
        ))}
        <li>
          <button className="card open" onClick={onOpenFile}>
            <div className="thumb"><span aria-hidden="true">＋</span></div>
            <h2>Свій файл</h2>
            <p>Відкрий опис моделі з диска: збережений варіант або власний JSON.</p>
          </button>
        </li>
      </ul>
      {note && <p className="note" role="status">{note}</p>}
    </main>
  );
}
