
import React from 'react';
import { ArrowLeft, Printer, Activity, Zap, TrendingDown, Gauge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { VbtSessionData } from './VbtTest';

interface VbtReportViewProps {
  lang: Language;
  sessionData: VbtSessionData;
  onBack: () => void;
}

const VbtReportView: React.FC<VbtReportViewProps> = ({
  lang, sessionData, onBack
}) => {
  const t = translations[lang];

  const bestRep = sessionData.reps.reduce((best, rep) => rep.peakVelocity > best.peakVelocity ? rep : best, sessionData.reps[0]);
  const avgPeakVelocity = sessionData.reps.reduce((sum, r) => sum + r.peakVelocity, 0) / sessionData.reps.length;
  const avgVelocity = sessionData.reps.reduce((sum, r) => sum + r.avgVelocity, 0) / sessionData.reps.length;

  const velocityDrop = sessionData.reps.length > 1
    ? ((sessionData.reps[0].peakVelocity - sessionData.reps[sessionData.reps.length - 1].peakVelocity) / sessionData.reps[0].peakVelocity) * 100
    : 0;

  const chartData = sessionData.reps.map((rep, idx) => ({
    rep: idx + 1,
    peak: rep.peakVelocity,
    avg: rep.avgVelocity
  }));

  let fatigueProfile = t.vbtFatigueGood;
  let fatigueDesc = t.vbtFatigueDescGood;
  let fatigueColor = 'text-green-500';
  let fatigueBg = 'bg-green-50';

  if (velocityDrop > 20) {
    fatigueProfile = t.vbtFatiguePoor;
    fatigueDesc = t.vbtFatigueDescPoor;
    fatigueColor = 'text-red-500';
    fatigueBg = 'bg-red-50';
  } else if (velocityDrop > 10) {
    fatigueProfile = t.vbtFatigueModerate;
    fatigueDesc = t.vbtFatigueDescModerate;
    fatigueColor = 'text-yellow-500';
    fatigueBg = 'bg-yellow-50';
  }

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
                   <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">VBT <span className="text-cyan-500">ANALYSIS</span></h1>
                   <div className="text-slate-400 font-bold text-sm mt-1">
                       {sessionData.athleteName} | {new Date(sessionData.date).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US')}
                   </div>
               </div>
               <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.vbtPeakVelocity}</div>
                   <div className="text-4xl font-black text-slate-900">
                       {bestRep.peakVelocity.toFixed(2)} <span className="text-lg text-slate-400 font-medium">m/s</span>
                   </div>
               </div>
           </div>

           {/* SUMMARY CARDS */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Zap className="text-cyan-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.vbtAvgPeak}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {avgPeakVelocity.toFixed(2)} <span className="text-xs text-slate-400">m/s</span>
                   </div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Gauge className="text-blue-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.vbtAvgVelocity}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {avgVelocity.toFixed(2)} <span className="text-xs text-slate-400">m/s</span>
                   </div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Activity className="text-green-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.vbtTotalReps}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {sessionData.reps.length}
                   </div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <TrendingDown className="text-orange-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.vbtVelocityDrop}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {velocityDrop.toFixed(1)} <span className="text-xs text-slate-400">%</span>
                   </div>
               </div>
           </div>

           {/* CHART SECTION */}
           <div className="h-80 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-8">
               <div className="flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-slate-400"/>
                    <h3 className="text-xs font-bold text-slate-500 uppercase">{t.vbtVelocityProgression}</h3>
               </div>
               <ResponsiveContainer width="100%" height="85%">
                   <LineChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                       <XAxis
                            dataKey="rep"
                            stroke="#94a3b8"
                            tick={{fontSize: 10}}
                            label={{ value: t.vbtRepNumber, position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#94a3b8' } }}
                       />
                       <YAxis
                            stroke="#06b6d4"
                            tick={{fontSize: 10, fill: '#06b6d4'}}
                            width={40}
                            label={{ value: t.vbtVelocity + ' (m/s)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#06b6d4' } }}
                       />
                       <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                       />
                       <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}/>
                       <Line type="monotone" dataKey="peak" name={t.vbtPeakVelocity} stroke="#06b6d4" strokeWidth={3} dot={{r: 4, fill: 'white', strokeWidth: 2}} />
                       <Line type="monotone" dataKey="avg" name={t.vbtAvgVelocity} stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} strokeDasharray="5 5" />
                   </LineChart>
               </ResponsiveContainer>
           </div>

           {/* FATIGUE ANALYSIS */}
           <div className={`rounded-2xl p-8 border-l-8 ${fatigueBg} ${fatigueColor.replace('text', 'border')}`}>
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{t.vbtFatigueAnalysis}</h3>
               <div className={`text-3xl font-black uppercase mb-3 ${fatigueColor}`}>
                   {fatigueProfile}
               </div>
               <p className="text-slate-700 font-medium text-base leading-relaxed max-w-2xl">
                   {fatigueDesc}
               </p>
           </div>

       </div>
    </div>
  );
};

export default VbtReportView;
