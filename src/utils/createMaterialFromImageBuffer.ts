import type { MaterialImageKind, MaterialPage } from "../types";

function extToMime(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "image/jpeg";
}

function loadNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("decode"));
    img.src = dataUrl;
  });
}

function readPngDimensions(u8: Uint8Array): { width: number; height: number } | null {
  if (u8.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) return null;
  const width = (u8[16] << 24) | (u8[17] << 16) | (u8[18] << 8) | u8[19];
  const height = (u8[20] << 24) | (u8[21] << 16) | (u8[22] << 8) | u8[23];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function readJpegDimensions(u8: Uint8Array): { width: number; height: number } | null {
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  let i = 2;
  while (i < u8.length - 9) {
    if (u8[i] !== 0xff) {
      i++;
      continue;
    }
    let m = u8[i + 1];
    while (m === 0xff && i + 2 < u8.length) {
      i++;
      m = u8[i + 1];
    }
    if (m === 0xd9) break;
    if (m === 0xd8) {
      i += 2;
      continue;
    }
    const len = (u8[i + 2] << 8) | u8[i + 3];
    if (len < 2 || i + 2 + len > u8.length) return null;
    if (m >= 0xc0 && m <= 0xc3) {
      const height = (u8[i + 5] << 8) | u8[i + 6];
      const width = (u8[i + 7] << 8) | u8[i + 8];
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
      return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function readGifDimensions(u8: Uint8Array): { width: number; height: number } | null {
  if (u8.length < 10 || u8[0] !== 0x47 || u8[1] !== 0x49 || u8[2] !== 0x46) return null;
  const width = u8[6] | (u8[7] << 8);
  const height = u8[8] | (u8[9] << 8);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function inferDimensionsFromBuffer(mime: string, buffer: ArrayBuffer): { width: number; height: number } {
  const u8 = new Uint8Array(buffer);
  if (mime === "image/png") {
    const d = readPngDimensions(u8);
    if (d) return d;
  }
  if (mime === "image/jpeg") {
    const d = readJpegDimensions(u8);
    if (d) return d;
  }
  if (mime === "image/gif") {
    const d = readGifDimensions(u8);
    if (d) return d;
  }
  return { width: 1, height: 1 };
}

function arrayBufferToDataUrlNode(mime: string, buffer: ArrayBuffer): string {
  const g = globalThis as typeof globalThis & { Buffer?: { from(data: Uint8Array): { toString(enc: string): string } } };
  if (!g.Buffer) throw new Error("Buffer is not available (expected Node.js)");
  const b64 = g.Buffer.from(new Uint8Array(buffer)).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** 将图片二进制写入素材库可用的 MaterialPage（product 图） */
export async function createMaterialPageFromImageBuffer(input: {
  buffer: ArrayBuffer;
  extension: string;
  fileName: string;
  category: string;
  imageKind?: MaterialImageKind;
}): Promise<MaterialPage> {
  const mime = extToMime(input.extension);
  const useDom = typeof FileReader !== "undefined" && typeof Image !== "undefined";

  let dataUrl: string;
  let width: number;
  let height: number;

  if (useDom) {
    const blob = new Blob([input.buffer], { type: mime });
    dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(blob);
    });
    const wh = await loadNaturalSize(dataUrl);
    width = wh.width;
    height = wh.height;
  } else {
    dataUrl = arrayBufferToDataUrlNode(mime, input.buffer);
    const wh = inferDimensionsFromBuffer(mime, input.buffer);
    width = wh.width;
    height = wh.height;
  }
  return {
    id: crypto.randomUUID(),
    dataUrl,
    widthPx: width || 1,
    heightPx: height || 1,
    fileName: input.fileName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120),
    sourcePage: 0,
    category: input.category.trim() || "未分类",
    imageKind: input.imageKind ?? "product",
    createdAt: Date.now(),
  };
}
