
import React, { useState, useEffect, useRef } from 'react';
import { Timer, Zap, Plus, User, Trash2, ClipboardList, Play, Minus, ArrowLeft } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import MartReportView from './MartReportView';

interface MartTestProps {
  lang: Language;
  onBack?: () => void;
}

export interface MartRow {
    id: number;
    speed: number;
    lac: string;
    hr: string;
    rpe: string;
    duration: string; // seconds
}

// Audio Context for Beeps
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

const MartTest: React.FC<MartTestProps> = ({ lang, onBack }) => {
  const t = translations[lang];
  
  // View State
  const [view, setView] = useState<'input' | 'report'>('input');

  // Basic Info
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Protocol Settings
  const [startSpeed, setStartSpeed] = useState('14.0');
  const [increment, setIncrement] = useState('1.3');

  // Dynamic Data Rows
  const [rows, setRows] = useState<MartRow[]>([
      { id: 1, speed: 14.0, lac: '', hr: '', rpe: '', duration: '20' }
  ]);
  
  // Recovery Inputs
  const [lac2min, setLac2min] = useState('');
  const [lac5min, setLac5min] = useState('');
  const [lac10min, setLac10min] = useState('');

  // TIMER STATE
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPhase, setTimerPhase] = useState<'idle' | 'countdown' | 'work' | 'recovery'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Audio Context on user interaction
  const initAudio = () => {
      if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
      }
  };

  const playBeep = (type: 'start' | 'stop' | 'warning') => {
      if (!audioCtxRef.current) return;
      
      const oscillator = audioCtxRef.current.createOscillator();
      const gainNode = audioCtxRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtxRef.current.destination);
      
      if (type === 'start') {
          oscillator.frequency.value = 1000; // High pitch
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
          oscillator.start();
          oscillator.stop(audioCtxRef.current.currentTime + 0.7);
      } else if (type === 'stop') {
          oscillator.frequency.value = 600; // Low pitch
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
          oscillator.start();
          oscillator.stop(audioCtxRef.current.currentTime + 0.5);
      } else { // warning
          oscillator.frequency.value = 800;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
          oscillator.start();
          oscillator.stop(audioCtxRef.current.currentTime + 0.1);
      }
  };

  // Timer Effect
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      
      if (isTimerRunning && timeLeft > 0) {
          interval = setInterval(() => {
              setTimeLeft((prev) => {
                  const newVal = prev - 1;
                  
                  // Warning beeps for work phase
                  if (timerPhase === 'work' && newVal <= 3 && newVal > 0) {
                      playBeep('warning');
                  }
                  
                  return newVal;
              });
          }, 1000);
      } else if (isTimerRunning && timeLeft === 0) {
          // Phase transition
          handlePhaseTransition();
      }

      return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, timerPhase]);

  const handlePhaseTransition = () => {
      if (timerPhase === 'countdown') {
          // Start Work
          setTimerPhase('work');
          setTimeLeft(20);
          playBeep('start');
      } else if (timerPhase === 'work') {
          // Start Recovery
          setTimerPhase('recovery');
          setTimeLeft(100);
          playBeep('stop');
      } else if (timerPhase === 'recovery') {
          // Next Stage Logic
          // Automatically add next row if needed
          if (currentStageIndex === rows.length - 1) {
              addNextStage();
          }
          setCurrentStageIndex(prev => prev + 1);
          setTimerPhase('work'); // Go straight to work or back to countdown? Usually immediate or small gap.
          // Let's do a 10s countdown again for speed adjustment?
          // Rusko protocol usually allows time to adjust treadmill. Let's do countdown.
          setTimerPhase('countdown');
          setTimeLeft(10);
      }
  };

  const startTestTimer = () => {
      initAudio();
      setIsTimerRunning(true);
      setTimerPhase('countdown');
      setTimeLeft(10);
      setCurrentStageIndex(0);
      // Ensure we are on first row
      if (rows.length === 0) reset();
  };

  const stopTestTimer = () => {
      setIsTimerRunning(false);
      setTimerPhase('idle');
      setTimeLeft(0);
  };


  // Actions
  const handleStartSpeedChange = (val: string) => {
      setStartSpeed(val);
      if (rows.length === 1) {
          setRows([{ ...rows[0], speed: parseFloat(val) || 0 }]);
      }
  };

  const addNextStage = () => {
      const lastRow = rows[rows.length - 1];
      const inc = parseFloat(increment) || 0;
      const nextSpeed = parseFloat((lastRow.speed + inc).toFixed(1));
      
      const newRow: MartRow = {
          id: lastRow.id + 1,
          speed: nextSpeed,
          lac: '',
          hr: '',
          rpe: '',
          duration: '20'
      };
      setRows(prev => [...prev, newRow]);
  };

  const removeRow = (index: number) => {
      if (rows.length <= 1) return;
      const newRows = rows.filter((_, i) => i !== index);
      setRows(newRows);
  };

  const updateRow = (index: number, field: keyof MartRow, value: string) => {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], [field]: value };
      setRows(newRows);
  };

  const calculateAndAnalyze = () => {
    setView('report');
  };

  const reset = () => {
    setRows([{ id: 1, speed: parseFloat(startSpeed), lac: '', hr: '', rpe: '', duration: '20' }]);
    setLac2min('');
    setLac5min('');
    setLac10min('');
    setView('input');
    stopTestTimer();
  };

  const fillDemo = () => {
      setName("Teemu Tykittäjä");
      setStartSpeed("14.0");
      setIncrement("1.3");
      const demoRows = [
          { id: 1, speed: 14.0, lac: '2.1', hr: '140', rpe: '9', duration: '20' },
          { id: 2, speed: 15.3, lac: '3.5', hr: '155', rpe: '11', duration: '20' },
          { id: 3, speed: 16.6, lac: '5.8', hr: '168', rpe: '13', duration: '20' },
          { id: 4, speed: 17.9, lac: '8.2', hr: '179', rpe: '15', duration: '20' },
          { id: 5, speed: 19.2, lac: '11.5', hr: '188', rpe: '17', duration: '20' },
          { id: 6, speed: 20.5, lac: '14.2', hr: '195', rpe: '19', duration: '20' },
          { id: 7, speed: 21.8, lac: '16.5', hr: '202', rpe: '20', duration: '10' }
      ];
      setRows(demoRows);
      setLac2min("16.0");
      setLac5min("15.2");
      setLac10min("13.5");
  };

  // Helper for inputs
  const InputStepper = ({ label, value, setter, step, unit, min = 0, onChange }: any) => (
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => {
                    const val = parseFloat(value) || 0;
                    const newVal = Math.max(min, val - step).toFixed(Number.isInteger(step) ? 0 : 1);
                    setter(newVal);
                    if(onChange) onChange(newVal);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition-all"
            >
                <Minus size={16} />
            </button>
            <div className="flex-1 relative">
                <input 
                    type="number" 
                    value={value}
                    onChange={(e) => {
                        setter(e.target.value);
                        if(onChange) onChange(e.target.value);
                    }}
                    className="w-full h-10 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">{unit}</span>
            </div>
            <button 
                onClick={() => {
                    const val = parseFloat(value) || 0;
                    const newVal = (val + step).toFixed(Number.isInteger(step) ? 0 : 1);
                    setter(newVal);
                    if(onChange) onChange(newVal);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition-all"
            >
                <Plus size={16} />
            </button>
        </div>
      </div>
  );

  if (view === 'report') {
      return (
          <MartReportView 
            lang={lang}
            athleteName={name}
            date={date}
            rows={rows}
            lacRecovery={{
                l2: lac2min,
                l5: lac5min,
                l10: lac10min
            }}
            onBack={() => setView('input')}
            increment={parseFloat(increment)}
          />
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors font-bold"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      )}

      {/* HEADER & PROTOCOL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <Zap className="text-pink-500" size={24} />
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">{t.testMart}</h2>
            </div>
            <div className="flex gap-4">
                <button onClick={fillDemo} className="text-xs text-slate-400 hover:text-white underline">Demo</button>
            </div>
        </div>
        
        {/* TIMER SECTION */}
        <div className="bg-slate-800 p-6 text-center border-b border-slate-700">
            {isTimerRunning ? (
                 <div className="animate-fade-in">
                     <div className={`text-sm font-bold uppercase tracking-widest mb-2 ${timerPhase === 'work' ? 'text-green-400 animate-pulse' : timerPhase === 'recovery' ? 'text-blue-400' : 'text-yellow-400'}`}>
                         {timerPhase === 'countdown' ? 'Get Ready' : timerPhase === 'work' ? 'RUN / JUOKSE' : 'RECOVERY / PALAUTUS'}
                     </div>
                     <div className="text-6xl font-black text-white font-mono mb-6 tabular-nums">
                         {timeLeft}s
                     </div>
                     
                     {timerPhase === 'recovery' && (
                         <div className="bg-blue-900/50 border border-blue-500/30 p-4 rounded-xl max-w-sm mx-auto mb-6">
                             <p className="text-blue-200 text-sm font-medium mb-1">Take Lactate & HR</p>
                             <p className="text-white font-bold text-lg">Stage {rows[currentStageIndex].id}: {rows[currentStageIndex].speed} km/h</p>
                         </div>
                     )}

                     {timerPhase === 'countdown' && (
                         <div className="text-slate-300 font-medium">
                             Next Stage: <span className="text-white font-bold">{rows[currentStageIndex]?.speed || parseFloat(startSpeed)} km/h</span>
                         </div>
                     )}

                     <button 
                        onClick={stopTestTimer}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full font-bold text-xs"
                     >
                         Stop Timer
                     </button>
                 </div>
            ) : (
                <div className="flex flex-col items-center">
                    <p className="text-slate-400 text-sm mb-4">Use the built-in timer to run the test protocol.</p>
                    <button 
                        onClick={startTestTimer}
                        className="flex items-center gap-3 bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-pink-500/20 hover:scale-105 transition-all"
                    >
                        <Play size={20} fill="currentColor" />
                        Start Test Timer
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT COL: INFO & SETTINGS */}
          <div className="space-y-6 md:col-span-1">
              {/* 1. BASIC INFO */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                    <User size={14} /> {t.athleteName}
                 </h3>
                 <div className="space-y-3">
                     <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.athleteName}</label>
                         <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" placeholder={t.placeholderName} />
                     </div>
                     <div>
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.testDate}</label>
                         <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
                     </div>
                 </div>
              </div>

              {/* 2. PROTOCOL SETTINGS */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                    <Timer size={14} /> {t.martSettings}
                </h3>
                <div className="space-y-4">
                    <InputStepper label={t.martStartSpeed} value={startSpeed} setter={setStartSpeed} onChange={handleStartSpeedChange} step={0.5} unit="km/h" />
                    <InputStepper label={t.martIncrement} value={increment} setter={setIncrement} step={0.1} unit="km/h" />
                </div>
              </div>
          </div>

          {/* RIGHT COL: DYNAMIC TABLE */}
          <div className="md:col-span-2 space-y-6">
              
              {/* STAGE ENTRY TABLE */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-pink-500 uppercase flex items-center gap-2">
                        <Zap size={14} /> {t.martInput}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">{rows.length} {t.stage}s</span>
                 </div>

                 <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left">
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase w-6 text-center">#</th>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase w-12 text-center">km/h</th>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase text-center px-1">{t.lac}</th>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase text-center px-1">{t.hr}</th>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase text-center px-1">{t.rpe}</th>
                                <th className="pb-2 text-[10px] font-bold text-slate-400 uppercase w-12 text-center">{t.duration}</th>
                                <th className="w-6"></th>
                            </tr>
                        </thead>
                        <tbody className="space-y-1">
                            {rows.map((row, idx) => (
                                <tr key={row.id} className={`group ${currentStageIndex === idx && isTimerRunning ? 'bg-blue-50/50' : ''}`}>
                                    <td className="py-1">
                                        <div className="w-6 h-6 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                            {row.id}
                                        </div>
                                    </td>
                                    <td className="py-1">
                                        <div className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center font-mono font-bold text-slate-700 text-xs">
                                            {row.speed.toFixed(1)}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <input 
                                            type="number" 
                                            value={row.lac}
                                            onChange={e => updateRow(idx, 'lac', e.target.value)}
                                            className="w-full h-9 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none text-xs px-0"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="py-1 px-1">
                                        <input 
                                            type="number" 
                                            value={row.hr}
                                            onChange={e => updateRow(idx, 'hr', e.target.value)}
                                            className="w-full h-9 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-red-500 outline-none text-xs px-0"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="py-1 px-1">
                                        <input 
                                            type="number" 
                                            value={row.rpe}
                                            onChange={e => updateRow(idx, 'rpe', e.target.value)}
                                            className="w-full h-9 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-slate-500 outline-none text-xs px-0"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="py-1">
                                        <input 
                                            type="number" 
                                            value={row.duration}
                                            onChange={e => updateRow(idx, 'duration', e.target.value)}
                                            className={`w-full h-9 border rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-pink-500 outline-none text-xs px-0 ${parseFloat(row.duration) < 20 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200'}`}
                                        />
                                    </td>
                                    <td className="py-1 text-center">
                                        <button onClick={() => removeRow(idx)} className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>

                 <div className="mt-4 pt-4 border-t border-slate-100">
                     <button 
                        onClick={addNextStage}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50 transition-all flex items-center justify-center gap-2 text-sm"
                     >
                         <Plus size={16} />
                         {t.nextStage}
                     </button>
                 </div>
              </div>

              {/* RECOVERY & ACTION */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">{t.martRecovery}</h4>
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">2 min</label>
                            <input type="number" value={lac2min} onChange={e => setLac2min(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-center font-bold" placeholder="mmol" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">5 min</label>
                            <input type="number" value={lac5min} onChange={e => setLac5min(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-center font-bold" placeholder="mmol" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">10 min</label>
                            <input type="number" value={lac10min} onChange={e => setLac10min(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-center font-bold" placeholder="mmol" />
                        </div>
                    </div>
                    
                    <button 
                        onClick={calculateAndAnalyze}
                        className="w-full h-14 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2 transform active:scale-95 text-lg"
                    >
                        <ClipboardList size={20} className="fill-current" />
                        {t.calculate}
                    </button>
              </div>

          </div>
      </div>
    </div>
  );
};

export default MartTest;
