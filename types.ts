
export type Language = 'fi' | 'en';

export type ThresholdMethod = 'fixed' | 'baseline' | 'dmax';

export type TestType = 'threshold' | 'speed' | 'jump' | 'strength' | 'endurance' | 'growth' | 'mart' | 'vbt';

export interface User {
    id: string;
    email: string;
    name: string;
    plan: 'single' | 'pro' | 'coach' | null;
    credits: number; // 0 if no plan/used up, Infinity if Pro
}

export interface InputRow {
  id: string;
  min: string;
  sec: string;
  hr: string;
  lac: string;
}

export interface ProcessedPoint {
  paceDecimal: number; // min/km in decimal (e.g., 5.5 for 5:30)
  hr: number;
  lac: number;
}

export interface ThresholdResult {
  paceDecimal: number;
  hr: number;
  lac: number; // The lactate value at this threshold (e.g., 2.0, 4.0, or calculated)
}

export interface PreviousResultData {
    date: string;
    aerobic: {
        paceDecimal: number;
        hr: number;
    };
    anaerobic: {
        paceDecimal: number;
        hr: number;
    };
}

export interface TestResult {
  athleteName: string;
  testDate: string;
  method: ThresholdMethod;
  points: ProcessedPoint[];
  aerobic: ThresholdResult;
  anaerobic: ThresholdResult;
  minHr: number;
  maxHr: number;
  maxLac: number;
  previous?: PreviousResultData;
}

export interface InputCacheData {
    name: string;
    date: string;
    rows: InputRow[];
    method: ThresholdMethod;
    frequency: number;
    prevData?: PreviousResultData;
}