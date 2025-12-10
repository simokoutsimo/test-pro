
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import { ArrowLeft, Printer, Activity, Heart, Zap, Share2, Globe, Settings2, TrendingUp, TrendingDown, Minus, Target, Calendar, Pencil, Check, Mountain, Gauge, Flame, Lock } from 'lucide-react';
import { TestResult, Language, ThresholdMethod, InputCacheData } from '../types';
import { calculateTestResults, formatPace } from '../utils/calculations';
import { translations } from '../utils/translations';

interface ReportViewProps {
  initialResult: TestResult;
  inputData: InputCacheData;
  onBack: () => void;
  lang: Language;
  onToggleLang: () => void;
  onUpdateFrequency: (freq: number) => void;
  isLocked: boolean;
  onUnlock: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ 
  initialResult, 
  inputData, 
  onBack, 
  lang, 
  onToggleLang, 
  onUpdateFrequency,
  isLocked,
  onUnlock
}) => {
  const t = translations[lang];
  const [method, setMethod] = useState<ThresholdMethod>(initialResult.method || 'fixed');
  const frequency = inputData.frequency || 3;

  // Recalculate results if method changes
  const data = useMemo(() => {
     if (method === initialResult.method) return initialResult;
     try {
       return calculateTestResults(inputData.name, inputData.date, inputData.rows, method, inputData.prevData);
     } catch (e) {
       console.error("Calculation error during switch", e);
       return initialResult;
     }
  }, [method, initialResult, inputData]);

  // Content Editing State
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [customRecs, setCustomRecs] = useState({
    z1: { desc: '', workout: '' },
    z2: { desc: '', workout: '' },
    z3: { desc: '', workout: '' }
  });
  const [customSchedule, setCustomSchedule] = useState<{day: string, type: string, desc: string, color: string}[]>([]);

  // 1. DATA PREPARATION
  const chartData = data.points.map(p => ({
    pace: p.paceDecimal,
    hr: p.hr,
    lac: p.lac
  }));

  // 2. DOMAIN CALCULATION
  const allPaces = data.points.map(p => p.paceDecimal);
  const padding = 0.2;
  const minPace = Math.min(...allPaces) - padding;
  const maxPace = Math.max(...allPaces) + padding;

  // Initialize/Update Content based on data change
  useEffect(() => {
    // Generate Z1 Text
    const z1Desc = t.recDesc1;
    const z1Work = t.workout1
        .replace('{lowHr}', (data.aerobic.hr - 20).toString())
        .replace('{highHr}', (data.aerobic.hr - 10).toString())
        .replace('{pace}', formatPace(data.aerobic.paceDecimal + 0.75));

    // Generate Z2 Text
    const z2Desc = t.recDesc2;
    const z2Work = t.workout2
        .replace('{lowHr}', (data.anaerobic.hr - 8).toString())
        .replace('{highHr}', (data.anaerobic.hr - 3).toString())
        .replace('{pace}', formatPace(data.anaerobic.paceDecimal + 0.15));

    // Generate Z3 Text
    const z3Desc = t.recDesc3;
    const z3Work = t.workout3
        .replace('{pace}', formatPace(data.anaerobic.paceDecimal - 0.25))
        .replace('{lowHr}', (data.anaerobic.hr + 2).toString());

    setCustomRecs({
        z1: { desc: z1Desc, workout: z1Work },
        z2: { desc: z2Desc, workout: z2Work },
        z3: { desc: z3Desc, workout: z3Work }
    });

    // Generate Schedule
    const rest = { type: t.restDay, color: "bg-slate-100 text-slate-400", desc: "-" };
    const longRun = { 
        type: t.longRun, 
        color: "bg-emerald-100 text-emerald-800", 
        desc: `90min @ ${data.aerobic.hr - 20}-${data.aerobic.hr - 10} bpm`
    };
    const easyRun = { 
        type: t.easyRun, 
        color: "bg-emerald-50 text-emerald-700", 
        desc: `45-60min @ <${data.aerobic.hr - 10} bpm`
    };
    const recoveryRun = { 
        type: t.recoveryRun, 
        color: "bg-slate-50 text-slate-600", 
        desc: `30-40min @ <${data.aerobic.hr - 25} bpm`
    };
    const thresholdRun = { 
        type: t.thresholdRun, 
        color: "bg-blue-100 text-blue-800", 
        desc: `3x10min @ ${data.anaerobic.hr - 5} bpm`
    };
    const intervalRun = { 
        type: t.intervalRun, 
        color: "bg-red-100 text-red-800", 
        desc: `5x3min @ >${data.anaerobic.hr + 5} bpm`
    };

    let schedule = [];
    if (frequency === 3) {
        schedule = [rest, thresholdRun, rest, easyRun, rest, longRun, rest];
    } else if (frequency === 4) {
        schedule = [rest, thresholdRun, easyRun, rest, easyRun, longRun, rest];
    } else if (frequency === 5) {
        schedule = [rest, thresholdRun, easyRun, recoveryRun, intervalRun, longRun, rest];
    } else if (frequency === 6) {
         schedule = [recoveryRun, thresholdRun, easyRun, recoveryRun, intervalRun, longRun, rest];
    } else { // 7
         schedule = [recoveryRun, thresholdRun, easyRun, recoveryRun, intervalRun, longRun, recoveryRun];
    }

    const days = [t.mon, t.tue, t.wed, t.thu, t.fri, t.sat, t.sun];
    setCustomSchedule(schedule.map((workout, i) => ({ day: days[i], ...workout })));

  }, [data, frequency, lang]);

  const handleRecChange = (zone: 'z1'|'z2'|'z3', field: 'desc'|'workout', value: string) => {
      setCustomRecs(prev => ({
          ...prev,
          [zone]: { ...prev[zone], [field]: value }
      }));
  };

  const handleScheduleChange = (index: number, field: 'type'|'desc', value: string) => {
      const newSchedule = [...customSchedule];
      newSchedule[index] = { ...newSchedule[index], [field]: value };
      setCustomSchedule(newSchedule);
  };

  const handleShare = async () => {
    if (isLocked) {
        onUnlock();
        return;
    }
    const aerPace = formatPace(data.aerobic.paceDecimal);
    const anaPace = formatPace(data.anaerobic.paceDecimal);
    
    const text = t.shareText
      .replace('{name}', data.athleteName)
      .replace('{date}', new Date(data.testDate).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US'))
      .replace('{aerHr}', data.aerobic.hr.toString())
      .replace('{aerPace}', aerPace)
      .replace('{anaHr}', data.anaerobic.hr.toString())
      .replace('{anaPace}', anaPace);

    const shareData = {
      title: t.shareSubject.replace('{name}', data.athleteName),
      text: text,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      if (confirm(t.shareNotSupported)) {
        window.print();
      }
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur text-slate-900 p-3 border border-slate-200 shadow-xl rounded-lg text-xs font-mono z-50">
          <div className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 flex justify-between items-center">
             <span>{formatPace(label)} /km</span>
             <span className="text-[10px] uppercase text-slate-400 font-sans tracking-wide">Mitattu</span>
          </div>
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === 'lac' || entry.dataKey === 'hr') {
               return (
                <p key={index} style={{ color: entry.color }} className="font-semibold mb-1 flex justify-between gap-4">
                  <span>{entry.name === t.hr ? t.hr : t.lac}:</span>
                  <span>{entry.value} {entry.unit}</span>
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return null;
  };

  const renderThresholdLabel = (props: any, text: string, pace: number, hr: number, color: string) => {
    const { x, viewBox } = props;
    if (typeof x !== 'number' || !viewBox) return <g />;

    const boxWidth = 54;
    const boxHeight = 42;
    // Position safely above the bottom of the chart area
    const yPos = viewBox.y + viewBox.height - boxHeight - 2;

    return (
      <g>
        <rect 
          x={x - boxWidth / 2} 
          y={yPos} 
          width={boxWidth} 
          height={boxHeight} 
          fill="white" 
          stroke={color} 
          strokeWidth={1.5}
          rx={4}
          style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.15))' }}
        />
        <text 
          x={x} 
          y={yPos + 12} 
          textAnchor="middle" 
          fill={color} 
          fontSize={9} 
          fontWeight="900" 
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {text}
        </text>
        <text 
          x={x} 
          y={yPos + 24} 
          textAnchor="middle" 
          fill={color} 
          fontSize={10} 
          fontWeight="700"
          fontFamily="monospace"
        >
          {formatPace(pace)}
        </text>
        <text 
          x={x} 
          y={yPos + 35} 
          textAnchor="middle" 
          fill={color} 
          fontSize={9} 
          fontWeight="600"
        >
          {hr} bpm
        </text>
      </g>
    );
  };
  
  const renderComparison = (currentPace: number, prevPace: number) => {
      const diff = prevPace - currentPace;
      const percent = (diff / prevPace) * 100;
      const isFaster = percent > 0;
      const absPercent = Math.abs(percent).toFixed(1);
      
      if (Math.abs(percent) < 0.1) return <span className="text-slate-400 text-xs flex items-center gap-1"><Minus size={12}/> 0%</span>;

      return (
          <span className={`text-xs font-bold flex items-center gap-1 ${isFaster ? 'text-green-600' : 'text-red-500'}`}>
              {isFaster ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {absPercent}%
          </span>
      );
  };

  // Helper to get card styles based on schedule string color content
  const getScheduleCardStyle = (colorStr: string) => {
    if (colorStr.includes('emerald')) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' };
    if (colorStr.includes('blue')) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' };
    if (colorStr.includes('red')) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', badge: 'bg-red-100 text-red-800' };
    return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', badge: 'bg-slate-200 text-slate-600' };
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-20 font-sans relative">
      
      {/* LOCKED OVERLAY */}
      {isLocked && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white/90 backdrop-blur-sm absolute inset-0 rounded-3xl" />
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center border border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                      <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{t.reportLocked}</h2>
                  <p className="text-slate-500 mb-8 font-medium leading-relaxed">
                      {t.unlockDesc}
                  </p>
                  <button 
                      onClick={onUnlock}
                      className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95"
                  >
                      <Zap size={20} className="fill-current" />
                      {t.unlockReport}
                  </button>
                  <div className="mt-4">
                     <button onClick={onBack} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
                         Go Back
                     </button>
                  </div>
              </div>
          </div>
      )}

      <div className={`transition-all duration-500 ${isLocked ? 'blur-sm pointer-events-none select-none opacity-50' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 no-print px-4 md:px-0 mt-8 gap-4">
            <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-white transition-colors"
            >
            <ArrowLeft size={16} />
            {t.edit}
            </button>
            
            <div className="flex flex-wrap items-center gap-2">
            {/* METHOD SELECTOR */}
            <div className="relative group mr-2">
                <div className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium shadow-sm">
                <Settings2 size={14} className="text-slate-400" />
                <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value as ThresholdMethod)}
                    className="bg-transparent text-xs font-bold outline-none appearance-none pr-4 cursor-pointer"
                >
                    <option value="fixed">{t.methodFixed}</option>
                    <option value="baseline">{t.methodBaseline}</option>
                    <option value="dmax">{t.methodDmax}</option>
                </select>
                </div>
            </div>

            {/* FREQUENCY SELECTOR */}
            <div className="relative group mr-2">
                <div className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium shadow-sm">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">{t.trainingFreq}:</span>
                    <div className="flex gap-1">
                        {[3, 4, 5, 6, 7].map(num => (
                            <button 
                                key={num} 
                                onClick={() => onUpdateFrequency(num)}
                                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${frequency === num ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button 
                onClick={onToggleLang}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 text-xs px-3 py-2 rounded-lg font-bold transition-colors"
            >
                <Globe size={14} />
                {lang === 'fi' ? 'EN' : 'FI'}
            </button>

            <button 
                onClick={() => window.print()}
                className="hidden md:flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 text-xs px-3 py-2 rounded-lg font-bold transition-colors"
                title={t.print}
            >
                <Printer size={14} />
                {t.print}
            </button>

            <button 
                onClick={handleShare}
                className="flex items-center gap-2 bg-pink-500 text-white text-sm px-5 py-2 rounded-full font-bold hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/20"
            >
                <Share2 size={16} />
                {t.share}
            </button>
            </div>
        </div>

        <div className="bg-white md:rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden print:shadow-none print:border-none">
            
            {/* REPORT HEADER */}
            <div className="p-6 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
                <div className="flex items-center gap-2 text-pink-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
                <Activity size={14} />
                <span>{t.analysis}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-widest leading-none">
                {t.profile.split('-')[0]}<br/>{t.profile.split('-')[1] || 'Profile'}
                </h1>
            </div>
            <div className="md:text-right flex flex-row md:flex-col justify-between items-end md:items-end border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                <div className="text-lg font-bold text-slate-800 uppercase tracking-wide">{data.athleteName}</div>
                <div className="text-slate-400 font-mono text-xs">
                {new Date(data.testDate).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US')}
                </div>
            </div>
            </div>

            {/* INFO CARDS */}
            <div className="px-6 md:px-10 py-8 grid grid-cols-2 gap-4 md:gap-8">
            {/* Aerobic */}
            <div className="relative overflow-hidden bg-emerald-50/50 rounded-2xl p-5 md:p-6 border border-emerald-100">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                <Heart size={64} className="text-emerald-500" />
                </div>
                <div className="relative z-10">
                <h3 className="font-bold text-emerald-700 text-[10px] md:text-xs uppercase tracking-wider mb-1">
                    {t.aerobicThreshold} ({data.aerobic.lac.toFixed(1)} mmol)
                </h3>
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                    <span className="text-3xl md:text-4xl font-black text-slate-900">{data.aerobic.hr} <span className="text-sm font-medium text-slate-400">bpm</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 bg-white border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 shadow-sm">
                        {formatPace(data.aerobic.paceDecimal)} /km
                    </div>
                    {data.previous && (
                        renderComparison(data.aerobic.paceDecimal, data.previous.aerobic.paceDecimal)
                    )}
                </div>
                {data.previous && (
                    <div className="mt-2 text-[10px] text-slate-400 font-mono">
                        {t.prevAer}: {formatPace(data.previous.aerobic.paceDecimal)} / {data.previous.aerobic.hr} bpm
                    </div>
                )}
                </div>
            </div>

            {/* Anaerobic */}
            <div className="relative overflow-hidden bg-red-50/50 rounded-2xl p-5 md:p-6 border border-red-100">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                <Zap size={64} className="text-red-500" />
                </div>
                <div className="relative z-10">
                <h3 className="font-bold text-red-700 text-[10px] md:text-xs uppercase tracking-wider mb-1">
                    {t.anaerobicThreshold} ({data.anaerobic.lac.toFixed(1)} mmol)
                </h3>
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                    <span className="text-3xl md:text-4xl font-black text-slate-900">{data.anaerobic.hr} <span className="text-sm font-medium text-slate-400">bpm</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 bg-white border border-red-200 px-3 py-1 rounded-full text-xs font-bold text-red-700 shadow-sm">
                        {formatPace(data.anaerobic.paceDecimal)} /km
                    </div>
                    {data.previous && (
                        renderComparison(data.anaerobic.paceDecimal, data.previous.anaerobic.paceDecimal)
                    )}
                </div>
                {data.previous && (
                    <div className="mt-2 text-[10px] text-slate-400 font-mono">
                        {t.prevAna}: {formatPace(data.previous.anaerobic.paceDecimal)} / {data.previous.anaerobic.hr} bpm
                    </div>
                )}
                </div>
            </div>
            </div>

            {/* CHART SECTION */}
            <div className="pb-8 print:break-inside-avoid">
            <div className="px-6 md:px-10 mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">{t.chartTitle}</h3>
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{t.aerobic}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>{t.threshold}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>{t.maximal}</span>
                </div>
            </div>
            
            <div className="h-[400px] md:h-[500px] w-full bg-white relative">
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                    data={chartData} 
                    margin={{ top: 20, right: 0, bottom: 20, left: 0 }}
                >
                    {/* 1. BACKGROUND ZONES */}
                    <ReferenceArea 
                    yAxisId="hr"
                    x1={maxPace} 
                    x2={data.aerobic.paceDecimal} 
                    fill="#10b981" 
                    fillOpacity={0.15} 
                    ifOverflow="extendDomain"
                    />
                    <ReferenceArea 
                    yAxisId="hr"
                    x1={data.aerobic.paceDecimal} 
                    x2={data.anaerobic.paceDecimal} 
                    fill="#3b82f6" 
                    fillOpacity={0.15}
                    ifOverflow="extendDomain"
                    />
                    <ReferenceArea 
                    yAxisId="hr"
                    x1={data.anaerobic.paceDecimal} 
                    x2={minPace} 
                    fill="#ef4444" 
                    fillOpacity={0.15} 
                    ifOverflow="extendDomain"
                    />

                    {/* 2. GRID & AXES */}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    
                    <XAxis 
                    dataKey="pace" 
                    type="number" 
                    domain={[minPace, maxPace]} 
                    reversed={true} 
                    tickFormatter={(val) => formatPace(val)}
                    stroke="#94a3b8"
                    tick={{fontSize: 10, fill: '#94a3b8'}}
                    tickMargin={10}
                    allowDataOverflow={true} 
                    />
                    
                    <YAxis 
                    yAxisId="hr" 
                    domain={[Math.floor(data.minHr / 10) * 10 - 10, 'auto']} 
                    stroke="#ef4444" 
                    tick={{fontSize: 10, fill: '#ef4444', fontWeight: 600}}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    label={{ value: `${t.hr} (bpm)`, angle: -90, position: 'insideLeft', fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
                    />
                    
                    <YAxis 
                    yAxisId="lac" 
                    orientation="right" 
                    domain={[0, Math.max(8, Math.ceil(data.maxLac) + 1)]} 
                    stroke="#3b82f6" 
                    tick={{fontSize: 10, fill: '#3b82f6', fontWeight: 600}}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    label={{ value: `${t.lacLong} (mmol)`, angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                    />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.2)' }} />

                    {/* 3. DATA LINES */}
                    <Line 
                        yAxisId="hr" 
                        type="monotone" 
                        dataKey="hr" 
                        name={t.hr}
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }}
                        activeDot={{ r: 8, strokeWidth: 0 }} 
                        unit="bpm" 
                    />
                    <Line 
                        yAxisId="lac" 
                        type="monotone" 
                        dataKey="lac" 
                        name={t.lacLong}
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                        activeDot={{ r: 8, strokeWidth: 0 }} 
                        unit="mmol/l" 
                    />

                    {/* 4. THRESHOLD LINES */}
                    <ReferenceLine 
                    yAxisId="hr"
                    x={data.aerobic.paceDecimal} 
                    stroke="#059669" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={(props) => renderThresholdLabel(props, t.aerT, data.aerobic.paceDecimal, data.aerobic.hr, "#059669")}
                    />
                    
                    <ReferenceLine 
                    yAxisId="hr"
                    x={data.anaerobic.paceDecimal} 
                    stroke="#dc2626" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={(props) => renderThresholdLabel(props, t.anaT, data.anaerobic.paceDecimal, data.anaerobic.hr, "#dc2626")}
                    />

                </ComposedChart>
                </ResponsiveContainer>
            </div>
            </div>

            {/* ZONES TABLE */}
            <div className="px-6 md:px-10 pb-8 print:break-inside-avoid">
            <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] md:text-xs uppercase text-slate-500 font-bold tracking-wider">
                    <th className="p-3 md:p-4">{t.zone}</th>
                    <th className="p-3 md:p-4 hidden md:table-cell">{t.effort}</th>
                    <th className="p-3 md:p-4 whitespace-nowrap">{t.hr}</th>
                    <th className="p-3 md:p-4 text-right whitespace-nowrap">{t.pace}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs md:text-sm font-medium text-slate-700">
                    <tr className="bg-emerald-50/50">
                    <td className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span>
                            <span className="font-bold text-slate-800">{t.zone1}</span>
                        </div>
                    </td>
                    <td className="p-3 md:p-4 text-slate-500 hidden md:table-cell">{t.effort1}</td>
                    <td className="p-3 md:p-4 text-emerald-700 font-bold font-mono">&lt; {data.aerobic.hr}</td>
                    <td className="p-3 md:p-4 text-right font-mono text-slate-600">&gt; {formatPace(data.aerobic.paceDecimal)}</td>
                    </tr>
                    <tr className="bg-blue-50/50">
                    <td className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-200"></span>
                            <span className="font-bold text-slate-800">{t.zone2}</span>
                        </div>
                    </td>
                    <td className="p-3 md:p-4 text-slate-500 hidden md:table-cell">{t.effort2}</td>
                    <td className="p-3 md:p-4 text-blue-700 font-bold font-mono">{data.aerobic.hr} - {data.anaerobic.hr}</td>
                    <td className="p-3 md:p-4 text-right font-mono text-slate-600">
                        {formatPace(data.aerobic.paceDecimal)} - {formatPace(data.anaerobic.paceDecimal)}
                    </td>
                    </tr>
                    <tr className="bg-red-50/50">
                    <td className="p-3 md:p-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500 shadow-sm shadow-red-200"></span>
                            <span className="font-bold text-slate-800">{t.zone3}</span>
                        </div>
                    </td>
                    <td className="p-3 md:p-4 text-slate-500 hidden md:table-cell">{t.effort3}</td>
                    <td className="p-3 md:p-4 text-red-700 font-bold font-mono">&gt; {data.anaerobic.hr}</td>
                    <td className="p-3 md:p-4 text-right font-mono text-slate-600">&lt; {formatPace(data.anaerobic.paceDecimal)}</td>
                    </tr>
                </tbody>
                </table>
            </div>
            </div>

            {/* TRAINING RECOMMENDATIONS (REDESIGNED) */}
            <div className="px-6 md:px-10 pb-8 print:break-inside-avoid">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                        <Target size={18} className="text-slate-400" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{t.recTitle}</h3>
                    </div>
                    <button 
                    onClick={() => setIsEditingContent(!isEditingContent)}
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors no-print ${isEditingContent ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                    >
                    {isEditingContent ? <Check size={14} /> : <Pencil size={14} />}
                    {isEditingContent ? t.saveContent : t.editContent}
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    {[
                        { zone: 'z1', title: t.zone1, color: 'emerald', icon: Mountain, data: customRecs.z1 },
                        { zone: 'z2', title: t.zone2, color: 'blue', icon: Gauge, data: customRecs.z2 },
                        { zone: 'z3', title: t.zone3, color: 'red', icon: Flame, data: customRecs.z3 }
                    ].map((item: any) => (
                        <div key={item.zone} className={`flex flex-col bg-${item.color}-50/60 border-2 border-${item.color}-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all`}>
                            {/* Card Header */}
                            <div className={`px-5 py-4 bg-${item.color}-100/50 border-b border-${item.color}-200 flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg bg-white text-${item.color}-600 shadow-sm`}>
                                    <item.icon size={20} />
                                </div>
                                <h4 className={`font-bold text-${item.color}-800 text-sm uppercase tracking-wider`}>{item.title}</h4>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col gap-4">
                                <div>
                                    <span className={`block text-[10px] font-bold text-${item.color}-600/70 uppercase mb-1`}>{t.recGoal}</span>
                                    {isEditingContent ? (
                                        <textarea 
                                            className="w-full text-sm text-slate-600 bg-white border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            rows={3}
                                            value={item.data.desc}
                                            onChange={(e) => handleRecChange(item.zone, 'desc', e.target.value)}
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{item.data.desc}</p>
                                    )}
                                </div>
                                
                                <div className="mt-auto">
                                    <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm relative overflow-hidden">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${item.color}-400`}></div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 pl-2">{t.recWorkout}</span>
                                        {isEditingContent ? (
                                            <textarea 
                                                className="w-full text-sm text-slate-800 font-medium bg-slate-50 border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                rows={3}
                                                value={item.data.workout}
                                                onChange={(e) => handleRecChange(item.zone, 'workout', e.target.value)}
                                            />
                                        ) : (
                                            <div className="flex items-start gap-2 pl-2">
                                                <p className="text-sm text-slate-900 font-semibold">{item.data.workout}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* WEEKLY SCHEDULE (REDESIGNED) */}
            <div className="px-6 md:px-10 pb-10 print:break-inside-avoid bg-slate-50 border-t border-slate-100">
                <div className="pt-8 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={18} className="text-slate-400" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                            {t.weeklySchedule.replace('{freq}', frequency.toString())}
                        </h3>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl">{t.scheduleDesc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    {customSchedule.map((day, index) => {
                        const style = getScheduleCardStyle(day.color);
                        return (
                            <div key={index} className={`relative group rounded-xl border ${style.border} ${style.bg} p-3 shadow-sm hover:shadow-md transition-all min-w-0 flex flex-col h-full overflow-hidden`}>
                                {/* Mobile visual cue: Left colored border */}
                                <div className={`md:hidden absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${style.text.replace('text', 'bg').replace('900', '500')}`}></div>
                                
                                <div className="flex items-center justify-between mb-2 pl-2 md:pl-0">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{day.day}</div>
                                </div>
                                
                                <div className="pl-2 md:pl-0 flex-1 flex flex-col">
                                    {isEditingContent ? (
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                type="text" 
                                                className="w-full text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1"
                                                value={day.type}
                                                onChange={(e) => handleScheduleChange(index, 'type', e.target.value)}
                                            />
                                            <textarea 
                                                className="w-full text-[10px] bg-white border border-slate-200 rounded px-2 py-1"
                                                rows={3}
                                                value={day.desc}
                                                onChange={(e) => handleScheduleChange(index, 'desc', e.target.value)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide mb-2 ${style.badge} whitespace-normal break-words text-center leading-tight`}>
                                                {day.type}
                                            </div>
                                            <div className={`text-[11px] font-medium leading-snug ${style.text} opacity-90 break-words`}>
                                                {day.desc}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default ReportView;
