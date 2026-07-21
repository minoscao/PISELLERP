import type { CustomPlanServiceLine, CustomPlanSoftwareLine, ServiceRow, SoftwareFeatureRow } from "../types";
import { mergeAddonQtyMap } from "./customPlanAddonQty";

/** 仅规格一行（购物车中与分行 Add-on 搭配） */
export function softwareLineSpecOptionPart(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "optionId">,
): string {
  const opt =
    f.options.find((o) => o.id === line.optionId) ?? (f.options.length ? f.options[0]! : null);
  if (opt?.label.trim()) return `${opt.label.trim()} ¥${opt.optionPrice.toFixed(0)}`;
  return "—";
}

/** 单行展示：已选规格 + Add-on 摘要（无标题前缀） */
export function softwareLineSpecSummaryText(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "optionId" | "addonIds" | "addonQtyById">,
): string {
  const parts: string[] = [];
  const opt =
    f.options.find((o) => o.id === line.optionId) ?? (f.options.length ? f.options[0]! : null);
  if (opt?.label.trim()) {
    parts.push(`${opt.label.trim()} ¥${opt.optionPrice.toFixed(0)}`);
  }
  const qtyMap = mergeAddonQtyMap(line);
  for (const ad of f.addons) {
    const q = qtyMap[ad.id];
    if (!q || q < 1 || !ad.label.trim()) continue;
    parts.push(
      q > 1
        ? `${ad.label.trim()} ×${q} +¥${(ad.price * q).toFixed(0)}`
        : `${ad.label.trim()} +¥${ad.price.toFixed(0)}`,
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function serviceLineSpecOptionPart(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "optionId">,
): string {
  const opt =
    s.options.find((o) => o.id === line.optionId) ?? (s.options.length ? s.options[0]! : null);
  if (opt?.label.trim()) return `${opt.label.trim()} ¥${opt.optionPrice.toFixed(0)}`;
  return "—";
}

export function serviceLineSpecSummaryText(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "optionId" | "addonIds" | "addonQtyById">,
): string {
  const parts: string[] = [];
  const opt =
    s.options.find((o) => o.id === line.optionId) ?? (s.options.length ? s.options[0]! : null);
  if (opt?.label.trim()) {
    parts.push(`${opt.label.trim()} ¥${opt.optionPrice.toFixed(0)}`);
  }
  const qtyMap = mergeAddonQtyMap(line);
  for (const ad of s.addons) {
    const q = qtyMap[ad.id];
    if (!q || q < 1 || !ad.label.trim()) continue;
    parts.push(
      q > 1
        ? `${ad.label.trim()} ×${q} +¥${(ad.price * q).toFixed(0)}`
        : `${ad.label.trim()} +¥${ad.price.toFixed(0)}`,
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

/** 需要弹窗配置：任意带标签规格、或有 Add-on */
export function catalogLineNeedsSpecConfigDialog(
  options: { label: string }[],
  addonsLength: number,
): boolean {
  const hasLabeledOption = options.some((o) => o.label.trim());
  return hasLabeledOption || addonsLength > 0;
}
