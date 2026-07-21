import type { AssociationRow } from "../types";
import { DEFAULT_MAP_COLOR, MAP_COLOR_PRESETS } from "../theme/mapColorPresets";

export { DEFAULT_MAP_COLOR, MAP_COLOR_PRESETS };

function normHex6(hex: string): string {
  const raw = hex.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9a-f]{8}$/.test(raw)) return `#${raw.slice(0, 6)}`;
  return DEFAULT_MAP_COLOR;
}

/**
 * 同一设备分类（hardwareName）下：优先使用尚未被其它行占用的预设色；
 * 色盘定义见 theme/mapColorPresets.ts。
 */
export function nextDistinctMapColor(
  categoryTrimmed: string,
  rows: readonly AssociationRow[],
  selfId: string | null,
): string {
  const cat = categoryTrimmed.trim();
  const presets = MAP_COLOR_PRESETS as readonly string[];
  if (!cat) return DEFAULT_MAP_COLOR;

  const used = new Set<string>();
  let sameCount = 0;
  for (const r of rows) {
    if (r.id === selfId) continue;
    if (r.hardwareName.trim() !== cat) continue;
    sameCount += 1;
    used.add(normHex6(r.color));
  }

  for (const p of presets) {
    if (!used.has(normHex6(p))) return p;
  }
  return presets[sameCount % presets.length] ?? DEFAULT_MAP_COLOR;
}
