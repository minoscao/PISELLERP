/** 报价参考号格式：`Pisell` + `YYYYMMDD` + 3 位当日流水，如 `Pisell20260429001` */

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function readSeq(storageKey: string): number {
  try {
    const v = globalThis.localStorage?.getItem(storageKey);
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeSeq(storageKey: string, n: number): void {
  try {
    globalThis.localStorage?.setItem(storageKey, String(n));
  } catch {
    /* ignore quota / private mode */
  }
}

/** 生成新号并递增当日 localStorage 计数（仅在首次分配报价号时调用，避免预览反复刷号） */
export function allocateNextPisellQuotationRef(now = new Date()): string {
  const dk = dateKey(now);
  const storageKey = `pisell-quote-seq-${dk}`;
  const next = readSeq(storageKey) + 1;
  writeSeq(storageKey, next);
  return `Pisell${dk}${String(next).padStart(3, "0")}`;
}
