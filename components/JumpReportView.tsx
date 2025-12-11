
import React from 'react';
import { ArrowLeft, Printer, Activity, Zap, TrendingUp, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { JumpSessionData } from './JumpTest';

interface JumpReportViewProps {
  lang: Language;
  sessionData: JumpSessionData;
  onBack: () => void;
}

const JumpReportView: React.FC<JumpReportViewProps> = ({
  lang, sessionData, onBack
}) => {
  const t = translations[lang];

  const bestJump = sessionData.jumps.reduce((best, jump) => jump.height > best.height ? jump : best, sessionData.jumps[0]);
  const avgHeight = sessionData.jumps.reduce((sum, j) => sum + j.height, 0) / sessionData.jumps.length;
  const avgFlightTime = sessionData.jumps.reduce((sum, j) => sum + j.flightTime, 0) / sessionData.jumps.length;
  const avgContactTime = sessionData.jumps.reduce((sum, j) => sum + j.contactTime, 0) / sessionData.jumps.length;
  const avgRsi = sessionData.mode === 'rsi' && avgContactTime > 0 ? avgFlightTime / avgContactTime : undefined;

  const chartData = sessionData.jumps.map((jump, idx) => ({
    jump: idx + 1,
    height: jump.height,
    rsi: jump.rsi || 0
  }));

  const heightVariation = sessionData.jumps.length > 1
    ? (sessionData.jumps[sessionData.jumps.length - 1].height / sessionData.jumps[0].height) * 100 - 100
    : 0;

  let consistencyProfile = t.jumpConsistencyGood;
  let consistencyDesc = t.jumpConsistencyDescGood;
  let consistencyColor = 'text-green-500';
  let consistencyBg = 'bg-green-50';

  if (Math.abs(heightVariation) > 15) {
    consistencyProfile = t.jumpConsistencyPoor;
    consistencyDesc = t.jumpConsistencyDescPoor;
    consistencyColor = 'text-red-500';
    consistencyBg = 'bg-red-50';
  } else if (Math.abs(heightVariation) > 8) {
    consistencyProfile = t.jumpConsistencyModerate;
    consistencyDesc = t.jumpConsistencyDescModerate;
    consistencyColor = 'text-yellow-500';
    consistencyBg = 'bg-yellow-50';
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
                   <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                       {sessionData.mode === 'cmj' ? 'CMJ' : 'RSI'} <span className="text-pink-500">ANALYSIS</span>
                   </h1>
                   <div className="text-slate-400 font-bold text-sm mt-1">
                       {sessionData.athleteName} | {new Date(sessionData.date).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US')}
                   </div>
               </div>
               <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.jumpBestHeight}</div>
                   <div className="text-4xl font-black text-slate-900">
                       {bestJump.height.toFixed(1)} <span className="text-lg text-slate-400 font-medium">cm</span>
                   </div>
               </div>
           </div>

           {/* SUMMARY CARDS */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <TrendingUp className="text-pink-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.jumpAvgHeight}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {avgHeight.toFixed(1)} <span className="text-xs text-slate-400">cm</span>
                   </div>
               </div>
               <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                       <Activity className="text-blue-500" size={18} />
                       <span className="text-xs font-bold text-slate-500 uppercase">{t.jumpAvgFlight}</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">
                       {avgFlightTime.toFixed(0)} <span className="text-xs text-slate-400">ms</span>
                   </div>
               </div>
               {sessionData.mode === 'rsi' && (
                   <>
                       <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                           <div className="flex items-center gap-2 mb-2">
                               <Zap className="text-orange-500" size={18} />
                               <span className="text-xs font-bold text-slate-500 uppercase">{t.jumpAvgContact}</span>
                           </div>
                           <div className="text-2xl font-black text-slate-900">
                               {avgContactTime.toFixed(0)} <span className="text-xs text-slate-400">ms</span>
                           </div>
                       </div>
                       <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                           <div className="flex items-center gap-2 mb-2">
                               <Target className="text-green-500" size={18} />
                               <span className="text-xs font-bold text-slate-500 uppercase">{t.jumpAvgRsi}</span>
                           </div>
                           <div className="text-2xl font-black text-slate-900">
                               {avgRsi ? avgRsi.toFixed(2) : '--'}
                           </div>
                       </div>
                   </>
               )}
               {sessionData.mode === 'cmj' && (
                   <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                       <div className="flex items-center gap-2 mb-2">
                           <Activity className="text-green-500" size={18} />
                           <span className="text-xs font-bold text-slate-500 uppercase">{t.jumpTotalJumps}</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900">
                           {sessionData.jumps.length}
                       </div>
                   </div>
               )}
           </div>

           {/* CHART SECTION */}
           <div className="h-80 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-8">
               <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-slate-400"/>
                    <h3 className="text-xs font-bold text-slate-500 uppercase">{t.jumpHeightProgression}</h3>
               </div>
               <ResponsiveContainer width="100%" height="85%">
                   <BarChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                       <XAxis
                            dataKey="jump"
                            stroke="#94a3b8"
                            tick={{fontSize: 10}}
                            label={{ value: t.jumpNumber, position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#94a3b8' } }}
                       />
                       <YAxis
                            stroke="#ec4899"
                            tick={{fontSize: 10, fill: '#ec4899'}}
                            width={40}
                            label={{ value: t.jumpHeight + ' (cm)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#ec4899' } }}
                       />
                       <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                       />
                       <Bar dataKey="height" fill="#ec4899" radius={[8, 8, 0, 0]} />
                   </BarChart>
               </ResponsiveContainer>
           </div>

           {/* PERFORMANCE PROFILE */}
           <div className={`rounded-2xl p-8 border-l-8 ${consistencyBg} ${consistencyColor.replace('text', 'border')}`}>
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{t.jumpPerformanceProfile}</h3>
               <div className={`text-3xl font-black uppercase mb-3 ${consistencyColor}`}>
                   {consistencyProfile}
               </div>
               <p className="text-slate-700 font-medium text-base leading-relaxed max-w-2xl">
                   {consistencyDesc}
               </p>
           </div>

       </div>
    </div>
  );
};

export default JumpReportView;
