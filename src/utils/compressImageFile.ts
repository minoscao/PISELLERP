/** 将图片文件压成 JPEG data URL，限制长边，控制体积（持久化走 IndexedDB 仍建议压缩） */
export async function compressImageFileToJpegDataUrl(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 2400;
  const quality = opts.quality ?? 0.82;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode"));
    i.src = dataUrl;
  });
  let { width, height } = img;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
