import type { MaterialImageKind } from "../types";

export const MATERIAL_KIND_LABEL: Record<MaterialImageKind, string> = {
  product: "Product",
  quoteAd: "Marketing",
  technical: "Technical",
  softwareDoc: "Software doc",
};

export function isMaterialImageKind(v: unknown): v is MaterialImageKind {
  return v === "product" || v === "quoteAd" || v === "technical" || v === "softwareDoc";
}

/** 自动展示名：类型 + 流水号 + 页码（与源文件内容无关） */
export function autoMaterialDisplayName(
  kind: MaterialImageKind,
  serial: number,
  sourcePage: number,
): string {
  const lab = MATERIAL_KIND_LABEL[kind];
  return `${lab}-${String(serial).padStart(3, "0")}-P${sourcePage + 1}`;
}

export function fileExtFromUploadName(fileName: string): string {
  const m = fileName.match(/(\.[a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : ".jpg";
}
