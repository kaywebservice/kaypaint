export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rgbaToHex(r: number, g: number, b: number) {
  const to = (v: number) =>
    v.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getPixelColor(
  canvas: any,
  clientX: number,
  clientY: number
): string | null {
  const el = canvas.lowerCanvasEl as HTMLCanvasElement;
  const rect = el.getBoundingClientRect();

  const ratio = el.width / rect.width;

  const x = Math.round((clientX - rect.left) * ratio);
  const y = Math.round((clientY - rect.top) * ratio);

  if (x < 0 || y < 0 || x >= el.width || y >= el.height) {
    return null;
  }

  const ctx = el.getContext?.("2d");
  if (!ctx) return null;

  try {
    const data = ctx.getImageData(x, y, 1, 1).data;
    if (data[3] === 0) return null;
    return rgbaToHex(data[0], data[1], data[2]);
  } catch {
    return null;
  }
}

export function downloadDataURL(dataURL: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function nextObjectId() {
  return `object-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

export function loadJSONFile(
  file: File,
  onLoaded: (data: any) => void,
  onError?: (err: any) => void
) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      onLoaded(JSON.parse(String(reader.result)));
    } catch (error) {
      onError?.(error);
    }
  };

  reader.onerror = () =>
    onError?.(reader.error);

  reader.readAsText(file);
}