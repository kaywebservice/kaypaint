async function loadOpenCVFromCDN(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("OpenCV only available in browser");
  }

  if ((window as any).cv) {
    return (window as any).cv;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.onload = () => {
      const cv = (window as any).cv;
      if (cv) resolve(cv);
      else reject(new Error("OpenCV failed to load"));
    };
    script.onerror = () => reject(new Error("Could not load OpenCV from CDN"));
    document.head.appendChild(script);
  });
}

export async function removeBackground(
  dataUrl: string,
  tolerance: number = 40
): Promise<string> {
  const cv = await loadOpenCVFromCDN();

  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load image"));
  });

  const src = cv.imread(image);
  const gray = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  const corner = gray.ucharPtr(0, 0)[0];

  const mask = new cv.Mat();
  cv.absdiff(gray, new cv.Scalar(corner), mask);

  cv.threshold(mask, mask, tolerance, 255, cv.THRESH_BINARY);

  const kernel = cv.getStructuringElement(
    cv.MORPH_ELLIPSE,
    new cv.Size(3, 3)
  );

  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

  const rows = src.rows;
  const cols = src.cols;

  for (let y = 0; y < rows; y++) {
    const maskPtr = mask.ucharPtr(y, 0);
    const srcPtr = src.ucharPtr(y, 0);

    for (let x = 0; x < cols; x++) {
      if (maskPtr[x] === 0) {
        srcPtr[4 * x + 3] = 0;
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;

  cv.imshow(canvas, src);

  const result = canvas.toDataURL("image/png");

  src.delete();
  gray.delete();
  mask.delete();
  kernel.delete();

  return result;
}