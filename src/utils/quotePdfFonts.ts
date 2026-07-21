import type { jsPDF } from "jspdf";

/** jsPDF 注册名（Regular / Bold 同一系列） */
export const QUOTE_PDF_FONT = "QuoteSans";

/** 打包进产物：TrueType（可变字体），避免 OTF + CDN fetch 导致的 TTFFont metadata.Unicode 报错 */
import notoSansScVfUrl from "../assets/fonts/NotoSansSC-VF.ttf?url";

const VFS_FONT = "NotoSansSC-VF.ttf";

let cachedFontBin: string | null = null;

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return binary;
}

/**
 * 嵌入中日韩字形；失败则保留 Helvetica（中文会变成乱码，但不阻断导出）。
 */
export async function ensurePdfUnicodeFont(pdf: jsPDF): Promise<void> {
  try {
    if (!cachedFontBin) {
      const res = await fetch(notoSansScVfUrl);
      if (!res.ok) throw new Error(`font fetch ${res.status}`);
      cachedFontBin = arrayBufferToBinaryString(await res.arrayBuffer());
    }
    pdf.addFileToVFS(VFS_FONT, cachedFontBin);
    pdf.addFont(VFS_FONT, QUOTE_PDF_FONT, "normal");
    pdf.addFont(VFS_FONT, QUOTE_PDF_FONT, "bold");
    pdf.setFont(QUOTE_PDF_FONT, "normal");
  } catch {
    pdf.setFont("helvetica", "normal");
  }
}

export function setQuotePdfFont(pdf: jsPDF, weight: "normal" | "bold" = "normal"): void {
  try {
    pdf.setFont(QUOTE_PDF_FONT, weight);
  } catch {
    pdf.setFont("helvetica", weight);
  }
}
