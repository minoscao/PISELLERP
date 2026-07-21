import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { MaterialImageKind, MaterialPage } from "../types";
import { autoMaterialDisplayName, fileExtFromUploadName } from "./materialKinds";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

function uid() {
  return crypto.randomUUID();
}

async function fileToImageDataUrl(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("图片无法解码"));
    img.src = dataUrl;
  });
  return { dataUrl, w: width, h: height };
}

/** 将 PDF 渲染为 JPEG data URL 页序列（方案排版 / 素材共用） */
export async function splitPdfToJpegPages(
  file: File,
): Promise<Array<{ dataUrl: string; widthPx: number; heightPx: number; sourcePage: number }>> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out: Array<{ dataUrl: string; widthPx: number; heightPx: number; sourcePage: number }> = [];
  const scale = 2;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    out.push({
      dataUrl,
      widthPx: canvas.width,
      heightPx: canvas.height,
      sourcePage: i - 1,
    });
  }
  return out;
}

/**
 * 拆成素材页；fileName 按类型与流水自动命名（与原始文件名无关）。
 * @param startSerial 该类型已有素材数量 +1 作为本批起始流水，保证全局递增感
 */
export async function splitFileToMaterialPages(
  file: File,
  defaultCategory: string,
  imageKind: MaterialImageKind,
  startSerial: number,
): Promise<MaterialPage[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const slices = await splitPdfToJpegPages(file);
    const t = Date.now();
    return slices.map((s, i) => ({
      id: uid(),
      dataUrl: s.dataUrl,
      widthPx: s.widthPx,
      heightPx: s.heightPx,
      fileName: `${autoMaterialDisplayName(imageKind, startSerial + i, s.sourcePage)}.jpg`,
      sourcePage: s.sourcePage,
      category: defaultCategory,
      imageKind,
      createdAt: t + i,
    }));
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) {
    const { dataUrl, w, h } = await fileToImageDataUrl(file);
    const ext = fileExtFromUploadName(file.name);
    return [
      {
        id: uid(),
        dataUrl,
        widthPx: w,
        heightPx: h,
        fileName: `${autoMaterialDisplayName(imageKind, startSerial, 0)}${ext}`,
        sourcePage: 0,
        category: defaultCategory,
        imageKind,
        createdAt: Date.now(),
      },
    ];
  }

  throw new Error("仅支持 JPG / PNG / WEBP / PDF");
}
