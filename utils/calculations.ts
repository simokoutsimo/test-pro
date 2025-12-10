
import { InputRow, ProcessedPoint, ThresholdResult, TestResult, ThresholdMethod, PreviousResultData } from '../types';

export const formatPace = (decimalPace: number): string => {
  const mins = Math.floor(decimalPace);
  const secs = Math.round((decimalPace - mins) * 60);
  if (secs === 60) return `${mins + 1}:00`;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const parseInputData = (rows: InputRow[]): ProcessedPoint[] => {
  const points: ProcessedPoint[] = [];
  
  rows.forEach(row => {
    const minStr = row.min.replace(',', '.');
    const secStr = row.sec.replace(',', '.');
    const hrStr = row.hr.replace(',', '.');
    const lacStr = row.lac.replace(',', '.');

    const m = parseFloat(minStr);
    const s = parseFloat(secStr) || 0;
    const h = parseInt(hrStr);
    const l = parseFloat(lacStr);

    if (!isNaN(m) && !isNaN(h) && !isNaN(l)) {
      const paceDecimal = m + (s / 60);
      points.push({
        paceDecimal,
        hr: h,
        lac: l
      });
    }
  });

  // Sort by Pace Descending (Slower -> Faster)
  return points.sort((a, b) => b.paceDecimal - a.paceDecimal);
};

// --- MATH HELPERS FOR DMAX ---

// Gaussian elimination to solve linear system Ax = B
const solveGaussian = (A: number[][], B: number[]): number[] => {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  // Solve equation Ax=B for an upper triangular matrix A
  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
};

// 3rd Degree Polynomial Fit (Least Squares)
// Returns coefficients [d, c, b, a] for y = ax^3 + bx^2 + cx + d
const polyfit = (xVals: number[], yVals: number[], degree: number): number[] => {
  const n = degree + 1;
  const X = new Array(n).fill(0).map(() => new Array(n).fill(0));
  const Y = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < xVals.length; k++) {
        sum += Math.pow(xVals[k], i + j);
      }
      X[i][j] = sum;
    }
    let sumY = 0;
    for (let k = 0; k < xVals.length; k++) {
      sumY += yVals[k] * Math.pow(xVals[k], i);
    }
    Y[i] = sumY;
  }

  return solveGaussian(X, Y);
};

// Evaluate polynomial
const polyEval = (coeffs: number[], x: number): number => {
  let result = 0;
  for (let i = 0; i < coeffs.length; i++) {
    result += coeffs[i] * Math.pow(x, i);
  }
  return result;
};

// --- INTERPOLATION LOGIC ---

const interpolateThreshold = (data: ProcessedPoint[], targetLac: number): ThresholdResult => {
  // Linear Interpolation
  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];

    if (p1.lac <= targetLac && p2.lac >= targetLac) {
      const range = p2.lac - p1.lac;
      if (range === 0) return { paceDecimal: p1.paceDecimal, hr: p1.hr, lac: targetLac };

      const fraction = (targetLac - p1.lac) / range;
      const v = p1.paceDecimal + (p2.paceDecimal - p1.paceDecimal) * fraction;
      const h = p1.hr + (p2.hr - p1.hr) * fraction;
      
      return { paceDecimal: v, hr: Math.round(h), lac: targetLac };
    }
  }
  
  if (data[data.length - 1].lac < targetLac) {
      return { paceDecimal: data[data.length - 1].paceDecimal, hr: data[data.length - 1].hr, lac: data[data.length - 1].lac };
  }
  return { paceDecimal: data[0].paceDecimal, hr: data[0].hr, lac: data[0].lac };
};

const interpolateHrAtPace = (data: ProcessedPoint[], targetPace: number): number => {
    // Data is sorted Desc (Slower -> Faster)
    // We want to find the segment surrounding targetPace
    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i + 1];
        // p1.pace is larger (slower), p2.pace is smaller (faster)
        if (targetPace <= p1.paceDecimal && targetPace >= p2.paceDecimal) {
             const range = p1.paceDecimal - p2.paceDecimal;
             const fraction = (p1.paceDecimal - targetPace) / range;
             const h = p1.hr + (p2.hr - p1.hr) * fraction;
             return Math.round(h);
        }
    }
    return data[data.length-1].hr;
}


// --- METHOD SPECIFIC FUNCTIONS ---

const getFixedThresholds = (points: ProcessedPoint[]) => {
    return {
        aerobic: interpolateThreshold(points, 2.0),
        anaerobic: interpolateThreshold(points, 4.0)
    };
};

const getBaselineThresholds = (points: ProcessedPoint[]) => {
    const minLac = Math.min(...points.map(p => p.lac));
    const aerLac = minLac + 0.5;
    const anaLac = minLac + 1.5;

    return {
        aerobic: interpolateThreshold(points, aerLac),
        anaerobic: interpolateThreshold(points, anaLac)
    };
};

const getDmaxThresholds = (points: ProcessedPoint[]) => {
    // Dmax Logic:
    // 1. Fit 3rd degree polynomial to Pace vs Lactate
    // 2. Line connecting Start and End points
    // 3. Find point on curve with max distance to line
    
    // Sort points by Pace Ascending for Math (Fast -> Slow is how we stored, but Math usually likes X ascending)
    // Actually, usually in Lactate curves: X = Speed/Power (Ascending). 
    // Our paceDecimal is Min/km (Descending speed).
    // To make the math 'normal' (standard Dmax curve shape), let's convert Pace to Speed (km/h) or just invert scale.
    // However, Dmax works geometrically regardless of unit direction as long as line connects start/end.
    // Let's use the raw paceDecimal (Descending).
    
    // Note: Reversing to Ascending X for polyfit is safer for implementation stability
    const x = points.map(p => p.paceDecimal).reverse(); // Ascending Pace (Fast -> Slow)
    const y = points.map(p => p.lac).reverse();
    
    const coeffs = polyfit(x, y, 3);
    
    // Line endpoints
    const startX = x[0];
    const startY = y[0];
    const endX = x[x.length - 1];
    const endY = y[x.length - 1];
    
    // Line vector
    const dx = endX - startX;
    const dy = endY - startY;
    
    // Iterate 500 points to find max distance
    let maxDist = 0;
    let bestX = startX;
    let bestY = startY;
    
    const steps = 500;
    const stepSize = dx / steps;
    
    for (let i = 0; i <= steps; i++) {
        const currX = startX + i * stepSize;
        const currY = polyEval(coeffs, currX);
        
        // Perpendicular distance from point to line defined by two points
        // |(y2-y1)x0 - (x2-x1)y0 + x2y1 - y2x1| / sqrt((y2-y1)^2 + (x2-x1)^2)
        const numerator = Math.abs(dy * currX - dx * currY + endX * startY - endY * startX);
        const denominator = Math.sqrt(dy * dy + dx * dx);
        const dist = numerator / denominator;
        
        if (dist > maxDist) {
            maxDist = dist;
            bestX = currX;
            bestY = currY;
        }
    }

    const anaPace = bestX;
    const anaLac = bestY;
    const anaHr = interpolateHrAtPace(points, anaPace);

    // Dmax defines Anaerobic. For Aerobic, we default to Baseline + 0.5 for a "Individualized" set.
    const minLac = Math.min(...points.map(p => p.lac));
    const aerLac = minLac + 0.5;
    
    return {
        aerobic: interpolateThreshold(points, aerLac),
        anaerobic: { paceDecimal: anaPace, hr: anaHr, lac: parseFloat(anaLac.toFixed(2)) }
    };
};


export const calculateTestResults = (
    name: string, 
    date: string, 
    rows: InputRow[], 
    method: ThresholdMethod = 'fixed',
    prevData?: PreviousResultData
): TestResult => {
  const points = parseInputData(rows);

  if (points.length < 2) {
    throw new Error("Insufficient data. Please enter at least 2 complete rows with valid numbers (Min, HR, Lac).");
  }

  let thresholds;
  
  switch (method) {
      case 'baseline':
          thresholds = getBaselineThresholds(points);
          break;
      case 'dmax':
          thresholds = getDmaxThresholds(points);
          break;
      case 'fixed':
      default:
          thresholds = getFixedThresholds(points);
          break;
  }

  const hrs = points.map(p => p.hr);
  const lacs = points.map(p => p.lac);

  return {
    athleteName: name,
    testDate: date,
    method: method,
    points,
    aerobic: thresholds.aerobic,
    anaerobic: thresholds.anaerobic,
    minHr: Math.min(...hrs),
    maxHr: Math.max(...hrs),
    maxLac: Math.max(...lacs),
    previous: prevData
  };
};
