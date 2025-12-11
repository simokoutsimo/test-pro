export interface TrackingPoint {
  x: number;
  y: number;
  confidence: number;
}

export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ColorRange {
  hMin: number;
  hMax: number;
  sMin: number;
  sMax: number;
  vMin: number;
  vMax: number;
}

export const COLOR_PRESETS = {
  white: { hMin: 0, hMax: 180, sMin: 0, sMax: 40, vMin: 180, vMax: 255 },
  green: { hMin: 35, hMax: 85, sMin: 60, sMax: 255, vMin: 60, vMax: 255 },
  orange: { hMin: 5, hMax: 25, sMin: 100, sMax: 255, vMin: 100, vMax: 255 }
};

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = max === 0 ? 0 : delta / max;
  let v = max;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return [h * 180, s * 255, v * 255];
}

export function trackByColor(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  colorRange: ColorRange,
  minBlobSize: number = 50
): TrackingPoint | null {
  const imgData = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  const data = imgData.data;
  const width = imgData.width;

  let totalX = 0;
  let totalY = 0;
  let matchCount = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, v] = rgbToHsv(r, g, b);

    const hMatch = (h >= colorRange.hMin && h <= colorRange.hMax);
    const sMatch = (s >= colorRange.sMin && s <= colorRange.sMax);
    const vMatch = (v >= colorRange.vMin && v <= colorRange.vMax);

    if (hMatch && sMatch && vMatch) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      totalX += x;
      totalY += y;
      matchCount++;
    }
  }

  if (matchCount < minBlobSize) {
    return null;
  }

  const centroidX = roi.x + (totalX / matchCount);
  const centroidY = roi.y + (totalY / matchCount);

  const confidence = Math.min(matchCount / 500, 1.0);

  return {
    x: centroidX / ctx.canvas.width,
    y: centroidY / ctx.canvas.height,
    confidence
  };
}

export function trackBrightestPoint(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  channel: 'r' | 'g' | 'b' | 'brightness' = 'brightness',
  threshold: number = 200
): TrackingPoint | null {
  const imgData = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  const data = imgData.data;
  const width = imgData.width;

  let totalX = 0;
  let totalY = 0;
  let matchCount = 0;

  for (let i = 0; i < data.length; i += 16) {
    let value = 0;

    if (channel === 'brightness') {
      value = (data[i] + data[i + 1] + data[i + 2]) / 3;
    } else if (channel === 'r') {
      value = data[i];
    } else if (channel === 'g') {
      value = data[i + 1];
    } else if (channel === 'b') {
      value = data[i + 2];
    }

    if (value > threshold) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      totalX += x;
      totalY += y;
      matchCount++;
    }
  }

  if (matchCount < 10) {
    return null;
  }

  const centroidX = roi.x + (totalX / matchCount);
  const centroidY = roi.y + (totalY / matchCount);

  const confidence = Math.min(matchCount / 200, 1.0);

  return {
    x: centroidX / ctx.canvas.width,
    y: centroidY / ctx.canvas.height,
    confidence
  };
}

export function createMask(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  colorRange: ColorRange
): ImageData {
  const imgData = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  const data = imgData.data;
  const maskData = new ImageData(imgData.width, imgData.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, v] = rgbToHsv(r, g, b);

    const match =
      (h >= colorRange.hMin && h <= colorRange.hMax) &&
      (s >= colorRange.sMin && s <= colorRange.sMax) &&
      (v >= colorRange.vMin && v <= colorRange.vMax);

    if (match) {
      maskData.data[i] = 255;
      maskData.data[i + 1] = 255;
      maskData.data[i + 2] = 255;
      maskData.data[i + 3] = 255;
    } else {
      maskData.data[i] = 0;
      maskData.data[i + 1] = 0;
      maskData.data[i + 2] = 0;
      maskData.data[i + 3] = 255;
    }
  }

  return maskData;
}

export function detectCircle(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  edgeThreshold: number = 50
): TrackingPoint | null {
  const imgData = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  const gray = new Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    gray[idx] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  let totalX = 0;
  let totalY = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const gx =
        -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1] +
        gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];

      const gy =
        -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
        gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > edgeThreshold) {
        totalX += x;
        totalY += y;
        edgeCount++;
      }
    }
  }

  if (edgeCount < 30) {
    return null;
  }

  const centroidX = roi.x + (totalX / edgeCount);
  const centroidY = roi.y + (totalY / edgeCount);

  const confidence = Math.min(edgeCount / 200, 1.0);

  return {
    x: centroidX / ctx.canvas.width,
    y: centroidY / ctx.canvas.height,
    confidence
  };
}

export function calibrateColorFromClick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sampleRadius: number = 10
): ColorRange {
  const imgData = ctx.getImageData(
    Math.max(0, x - sampleRadius),
    Math.max(0, y - sampleRadius),
    sampleRadius * 2,
    sampleRadius * 2
  );

  const data = imgData.data;
  const hsvValues: [number, number, number][] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    hsvValues.push(rgbToHsv(r, g, b));
  }

  const avgH = hsvValues.reduce((sum, [h]) => sum + h, 0) / hsvValues.length;
  const avgS = hsvValues.reduce((sum, [, s]) => sum + s, 0) / hsvValues.length;
  const avgV = hsvValues.reduce((sum, [, , v]) => sum + v, 0) / hsvValues.length;

  const hTolerance = 15;
  const sTolerance = 60;
  const vTolerance = 60;

  return {
    hMin: Math.max(0, avgH - hTolerance),
    hMax: Math.min(180, avgH + hTolerance),
    sMin: Math.max(0, avgS - sTolerance),
    sMax: Math.min(255, avgS + sTolerance),
    vMin: Math.max(0, avgV - vTolerance),
    vMax: Math.min(255, avgV + vTolerance)
  };
}

export function trackMotion(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  previousFrame: ImageData | null
): TrackingPoint | null {
  const currentFrame = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  if (!previousFrame ||
      previousFrame.width !== currentFrame.width ||
      previousFrame.height !== currentFrame.height) {
    return null;
  }

  const curr = currentFrame.data;
  const prev = previousFrame.data;
  const width = currentFrame.width;

  let totalX = 0;
  let totalY = 0;
  let motionCount = 0;
  const threshold = 25;

  for (let i = 0; i < curr.length; i += 16) {
    const rDiff = Math.abs(curr[i] - prev[i]);
    const gDiff = Math.abs(curr[i + 1] - prev[i + 1]);
    const bDiff = Math.abs(curr[i + 2] - prev[i + 2]);
    const diff = (rDiff + gDiff + bDiff) / 3;

    if (diff > threshold) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      totalX += x;
      totalY += y;
      motionCount++;
    }
  }

  if (motionCount < 30) {
    return null;
  }

  const centroidX = roi.x + (totalX / motionCount);
  const centroidY = roi.y + (totalY / motionCount);

  const confidence = Math.min(motionCount / 300, 1.0);

  return {
    x: centroidX / ctx.canvas.width,
    y: centroidY / ctx.canvas.height,
    confidence
  };
}

export function trackLowestPoint(
  ctx: CanvasRenderingContext2D,
  roi: ROI,
  previousFrame: ImageData | null,
  motionThreshold: number = 20
): TrackingPoint | null {
  const currentFrame = ctx.getImageData(
    Math.floor(roi.x),
    Math.floor(roi.y),
    Math.floor(roi.w),
    Math.floor(roi.h)
  );

  if (!previousFrame ||
      previousFrame.width !== currentFrame.width ||
      previousFrame.height !== currentFrame.height) {
    return null;
  }

  const curr = currentFrame.data;
  const prev = previousFrame.data;
  const width = currentFrame.width;
  const height = currentFrame.height;

  const motionMap: boolean[] = new Array(width * height).fill(false);

  for (let i = 0; i < curr.length; i += 8) {
    const rDiff = Math.abs(curr[i] - prev[i]);
    const gDiff = Math.abs(curr[i + 1] - prev[i + 1]);
    const bDiff = Math.abs(curr[i + 2] - prev[i + 2]);
    const diff = (rDiff + gDiff + bDiff) / 3;

    if (diff > motionThreshold) {
      const pixelIndex = i / 4;
      motionMap[pixelIndex] = true;
    }
  }

  let lowestY = -1;
  let lowestYCount = 0;
  let lowestYX = 0;

  for (let y = height - 1; y >= 0; y--) {
    let rowMotionCount = 0;
    let rowX = 0;

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (motionMap[idx]) {
        rowMotionCount++;
        rowX += x;
      }
    }

    if (rowMotionCount > 10) {
      lowestY = y;
      lowestYCount = rowMotionCount;
      lowestYX = rowX / rowMotionCount;
      break;
    }
  }

  if (lowestY === -1) {
    return null;
  }

  const centroidX = roi.x + lowestYX;
  const centroidY = roi.y + lowestY;

  const confidence = Math.min(lowestYCount / 100, 1.0);

  return {
    x: centroidX / ctx.canvas.width,
    y: centroidY / ctx.canvas.height,
    confidence
  };
}
