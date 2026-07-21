/**
 * 将用户图片压成 JPEG data URL，避免撑爆 localStorage。
 */
export async function compressImageFileToJpegDataUrl(
  file: File,
  maxEdgePx: number,
  quality: number,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image file");
  }
  const bmp = await createImageBitmap(file);
  try {
    const maxDim = Math.max(bmp.width, bmp.height);
    const scale = maxDim > 0 ? Math.min(1, maxEdgePx / maxDim) : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bmp.close?.();
  }
}
