
import React from 'react';
import { ArrowLeft, Printer, Activity, Zap, Battery, TrendingUp } from 'lucide-react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { MartRow } from './MartTest';

interface MartReportViewProps {
  lang: Language;
  athleteName: string;
  date: string;
  rows: MartRow[];
  lacRecovery: { l2: string; l5: string; l10: string };
  onBack: () => void;
  increment: number;
}

const MartReportView: React.FC<MartReportViewProps> = ({
  lang, athleteName, date, rows, lacRecovery, onBack, increment
}) => {
  const t = translations[lang];

  // 1. Calculate Pmax
  const lastRow = rows[rows.length - 1];
  const lastDuration = parseFloat(lastRow.duration);
  const lastSpeed = lastRow.speed;
  
  let pMax = 0;
  if (lastDuration >= 20) {
      pMax = lastSpeed;
  } else {
      // Pmax = Speed_prev + (t/T * inc)
      // Speed_last = Speed_prev + inc
      // => Speed_prev = Speed_last - inc
      const prevSpeed = lastSpeed - increment;
      pMax = prevSpeed + (lastDuration / 20 * increment);
  }

  // 2. Max Lac & HR
  const maxLac = Math.max(...rows.map(r => parseFloat(r.lac) || 0));
  const maxHr = Math.max(...rows.map(r => parseFloat(r.hr) || 0));

  // 3. Profile Analysis (Updated Thresholds)
  const l10 = parseFloat(lacRecovery.l10);
  const recoveryDrop = l10 ? (maxLac - l10) / maxLac : 0;
  
  let profileType = t.profileBase;
  let profileDesc = t.descBase;
  let profileColor = "text-slate-500";
  let profileBg = "bg-slate-100";

  // Thresholds based on Python logic: > 12.0 mmol and > 40% drop
  const isHighLactate = maxLac > 12.0; 
  const isFastRecovery = recoveryDrop > 0.40; 

  if (isHighLactate && !isFastRecovery) {
      profileType = t.profileSprint; // "LASITYKKI"
      profileDesc = t.descSprint;
      profileColor = "text-pink-500";
      profileBg = "bg-pink-50";
  } else if (!isHighLactate && isFastRecovery) {
      profileType = t.profileDiesel;
      profileDesc = t.descDiesel;
      profileColor = "text-blue-500";
      profileBg = "bg-blue-50";
  } else if (isHighLactate && isFastRecovery) {
      profileType = t.profileHybrid;
      profileDesc = t.descHybrid;
      profileColor = "text-purple-500";
      profileBg = "bg-purple-50";
  }

  // 4. Chart Data (Recovery)
  const recoveryData = [
      { time: 0, lac: maxLac },
      { time: 2, lac: parseFloat(lacRecovery.l2) || null },
      { time: 5, lac: parseFloat(lacRecovery.l5) || null },
      { time: 10, lac: parseFloat(lacRecovery.l10) || null },
  ].filter(d => d.lac !== null);

  // 5. Chart Data (Response)
  const responseData = rows.map(r => ({
      speed: r.speed,
      hr: parseFloat(r.hr) || null,
      lac: parseFloat(r.lac) || null
  }));

  return (
    <div className="animate-fade-in space-y-6 pb-20">
       {/* HEADER */}
       <div className="flex items-center justify-between no-print">
           <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm">
               <ArrowLeft size={16} /> {t.edit}
           </button>
           <div className="flex gap-2">
               <button onClick={() => window.print()} className="bg-white border border-slate-200 p-2 rounded-lg text-slate-500 hover:text-slate-900">
                   <Printer size={18} />
               </button>
           </div>
       </div>

       <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden p-8">
           <div className="flex justify-between items-end border-b border-slate-100 pb-6 mb-6">
               <div>
                   <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">MART <span className="text-pink-500">ANALYSIS</span></h1>
                   <div className="text-slate-400 font-bold text-sm mt-1">{athleteName} | {date}</div>
               </div>
               <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pmax (Teho)</div>
                   <div className="text-4xl font-black text-slate-900">{pMax.toFixed(2)} <span className="text-lg text-slate-400 font-medium">km/h</span></div>
               </div>
           </div>

           {/* SUMMARY CARDS */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Zap className="text-pink-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.maxLac}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">{maxLac.toFixed(1)} <span className="text-xs text-slate-400">mmol/l</span></div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Activity className="text-red-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.maxHr}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">{maxHr} <span className="text-xs text-slate-400">bpm</span></div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Battery className="text-blue-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">Rec Drop (10')</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">{(recoveryDrop * 100).toFixed(0)} <span className="text-xs text-slate-400">%</span></div>
               </div>
           </div>

           {/* CHARTS SECTION */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               
               {/* RESPONSE CHART */}
               <div className="h-72 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                   <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-slate-400"/>
                        <h3 className="text-xs font-bold text-slate-500 uppercase">{t.chartTitle}</h3>
                   </div>
                   <ResponsiveContainer width="100%" height="85%">
                       <ComposedChart data={responseData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis 
                                dataKey="speed" 
                                type="number" 
                                domain={['dataMin', 'dataMax']} 
                                tickCount={rows.length} 
                                stroke="#94a3b8" 
                                unit=" km/h" 
                                tick={{fontSize: 10}} 
                           />
                           <YAxis 
                                yAxisId="hr" 
                                orientation="left" 
                                stroke="#ef4444" 
                                domain={['auto', 'auto']}
                                tick={{fontSize: 10, fill: '#ef4444'}} 
                                width={30}
                           />
                           <YAxis 
                                yAxisId="lac" 
                                orientation="right" 
                                stroke="#3b82f6" 
                                domain={[0, 'auto']}
                                tick={{fontSize: 10, fill: '#3b82f6'}} 
                                width={30}
                           />
                           <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }} 
                           />
                           <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}/>
                           <Line yAxisId="hr" type="monotone" dataKey="hr" name={t.hr} stroke="#ef4444" strokeWidth={2} dot={{r: 3}} />
                           <Line yAxisId="lac" type="monotone" dataKey="lac" name={t.lac} stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} />
                       </ComposedChart>
                   </ResponsiveContainer>
               </div>

               {/* RECOVERY CHART */}
               <div className="h-72 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                   <div className="flex items-center gap-2 mb-4">
                        <Battery size={16} className="text-slate-400"/>
                        <h3 className="text-xs font-bold text-slate-500 uppercase">{t.martRecGraph}</h3>
                   </div>
                   <ResponsiveContainer width="100%" height="85%">
                       <ComposedChart data={recoveryData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis dataKey="time" type="number" domain={[0, 10]} tickCount={6} stroke="#94a3b8" unit=" min" tick={{fontSize: 10}} />
                           <YAxis stroke="#3b82f6" tick={{fontSize: 10, fill: '#3b82f6'}} unit=" mmol" domain={[0, 'auto']} width={30} />
                           <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }} />
                           <Line type="monotone" dataKey="lac" name="Lactate" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: 'white', strokeWidth: 2}} />
                       </ComposedChart>
                   </ResponsiveContainer>
               </div>
           </div>

           {/* ATHLETE PROFILE (BOTTOM) */}
           <div className={`rounded-2xl p-8 border-l-8 ${profileBg} ${profileColor.replace('text', 'border')}`}>
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{t.martProfileTitle}</h3>
               <div className={`text-3xl font-black uppercase mb-3 ${profileColor}`}>
                   {profileType}
               </div>
               <p className="text-slate-700 font-medium text-base leading-relaxed max-w-2xl">
                   {profileDesc}
               </p>
           </div>

       </div>
    </div>
  );
};

export default MartReportView;
