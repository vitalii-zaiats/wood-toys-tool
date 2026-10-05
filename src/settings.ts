// Material and machine settings. They belong to the workshop, not to a puzzle,
// so they are not stored in puzzle files but remembered in this browser.
export interface Settings {
  t: number;
  kerf: number;
  scale: number;
  sheetW: number;
}

export const LIMITS = {
  t: { min: 2, max: 6, step: 0.1 },
  kerf: { min: 0, max: 0.4, step: 0.01 },
  scale: { min: 0.7, max: 1.8, step: 0.05 },
  sheetW: { min: 200, max: 600, step: 10 },
} as const;

export const DEFAULTS: Settings = { t: 3, kerf: 0.15, scale: 1, sheetW: 300 };

export const MAX_SEED = 999999;

const KEY = "wood-toys-tool:settings";

export function loadSettings(): Settings {
  const out = { ...DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    for (const key of Object.keys(LIMITS) as (keyof Settings)[]) {
      const v = raw[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, v));
    }
  } catch { /* private mode or corrupted entry: fall back to defaults */ }
  return out;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
