const SEP = " · ";

/** 分类名中「大类」段：含「 · 」时取前半；否则归入「其他」 */
export function categoryParentKey(name: string): string {
  const i = name.indexOf(SEP);
  if (i === -1) return "其他";
  const p = name.slice(0, i).trim();
  return p || "其他";
}

/** 子类展示名（后半段；无分隔则返回整名） */
export function categoryLeafLabel(name: string): string {
  const i = name.indexOf(SEP);
  if (i === -1) return name;
  return name.slice(i + SEP.length).trim() || name;
}
