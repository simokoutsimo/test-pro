
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Activity, FlaskConical, Globe, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { InputRow, TestResult, Language, ThresholdMethod, PreviousResultData, InputCacheData } from '../types';
import { calculateTestResults } from '../utils/calculations';
import { translations } from '../utils/translations';

interface InputFormProps {
  initialData?: InputCacheData;
  onCalculate: (result: TestResult, inputData: InputCacheData) => void;
  lang: Language;
  onToggleLang: () => void;
  credits: number;
}

const BrandLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 180L40 120C20 100 20 60 50 40C70 25 90 40 100 60C110 40 130 25 150 40C180 60 180 100 160 120L100 180Z" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const InputForm: React.FC<InputFormProps> = ({ onCalculate, initialData, lang, onToggleLang, credits }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [frequency, setFrequency] = useState<number>(3); 
  const t = translations[lang];
  
  // Previous Data States
  const [showPrev, setShowPrev] = useState(false);
  const [prevDate, setPrevDate] = useState('');
  
  // Aerobic
  const [prevAerMin, setPrevAerMin] = useState('');
  const [prevAerSec, setPrevAerSec] = useState('');
  const [prevAerHr, setPrevAerHr] = useState('');
  
  // Anaerobic
  const [prevAnaMin, setPrevAnaMin] = useState('');
  const [prevAnaSec, setPrevAnaSec] = useState('');
  const [prevAnaHr, setPrevAnaHr] = useState('');

  // Initial rows
  const [rows, setRows] = useState<InputRow[]>(
    Array(8).fill(null).map((_, i) => ({
      id: `row-${i}`,
      min: '',
      sec: '',
      hr: '',
      lac: ''
    }))
  );

  // Load initial data if available
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDate(initialData.date);
      setRows(initialData.rows);
      if (initialData.frequency) setFrequency(initialData.frequency);
      if (initialData.prevData) {
          setShowPrev(true);
          setPrevDate(initialData.prevData.date);
          
          const aerPace = initialData.prevData.aerobic.paceDecimal;
          const aerMin = Math.floor(aerPace);
          const aerSec = Math.round((aerPace - aerMin) * 60);
          setPrevAerMin(aerMin.toString());
          setPrevAerSec(aerSec.toString().padStart(2, '0'));
          setPrevAerHr(initialData.prevData.aerobic.hr.toString());

          const anaPace = initialData.prevData.anaerobic.paceDecimal;
          const anaMin = Math.floor(anaPace);
          const anaSec = Math.round((anaPace - anaMin) * 60);
          setPrevAnaMin(anaMin.toString());
          setPrevAnaSec(anaSec.toString().padStart(2, '0'));
          setPrevAnaHr(initialData.prevData.anaerobic.hr.toString());
      }
    }
  }, [initialData]);

  const handleRowChange = (index: number, field: keyof InputRow, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, { id: `row-${Date.now()}`, min: '', sec: '', hr: '', lac: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 2) return;
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  const fillTestData = () => {
    setName(t.demoName);
    const demoData = [
      { min: '7', sec: '00', hr: '125', lac: '1.1' },
      { min: '6', sec: '30', hr: '132', lac: '1.2' },
      { min: '6', sec: '00', hr: '139', lac: '1.4' },
      { min: '5', sec: '30', hr: '148', lac: '1.7' },
      { min: '5', sec: '00', hr: '158', lac: '2.4' },
      { min: '4', sec: '45', hr: '166', lac: '3.5' },
      { min: '4', sec: '30', hr: '174', lac: '5.8' },
      { min: '4', sec: '15', hr: '181', lac: '8.4' },
    ];
    
    const newRows = rows.map((row, i) => {
      if (i < demoData.length) {
        return { ...row, ...demoData[i] };
      }
      return row;
    });
    
    if (rows.length < demoData.length) {
       for (let i = rows.length; i < demoData.length; i++) {
         newRows.push({ id: `row-demo-${i}`, ...demoData[i] });
       }
    }
    
    setRows(newRows);
    setFrequency(4);

    setShowPrev(true);
    setPrevDate('2023-01-01');
    setPrevAerMin('6');
    setPrevAerSec('15');
    setPrevAerHr('138');
    setPrevAnaMin('4');
    setPrevAnaSec('50');
    setPrevAnaHr('164');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!name) {
        alert(t.alertName);
        return;
      }
      
      let prevData: PreviousResultData | undefined = undefined;
      
      if (showPrev && prevAerMin && prevAnaMin) {
          const aerPace = parseFloat(prevAerMin) + (parseFloat(prevAerSec || '0') / 60);
          const anaPace = parseFloat(prevAnaMin) + (parseFloat(prevAnaSec || '0') / 60);
          
          prevData = {
              date: prevDate,
              aerobic: {
                  paceDecimal: aerPace,
                  hr: parseInt(prevAerHr || '0')
              },
              anaerobic: {
                  paceDecimal: anaPace,
                  hr: parseInt(prevAnaHr || '0')
              }
          };
      }

      const defaultMethod: ThresholdMethod = 'fixed';
      const results = calculateTestResults(name, date, rows, defaultMethod, prevData);
      
      onCalculate(results, { name, date, rows, method: defaultMethod, prevData, frequency });
    } catch (err: any) {
      const isInsufficient = err.message.includes("Insufficient data");
      alert(isInsufficient ? t.insufficientData : t.alertError + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 px-4 py-3 md:px-8 md:py-6 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo className="w-8 h-8 text-pink-500" />
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight uppercase">Koutsimo <span className="text-pink-500">Test Pro</span></h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 mr-2">
             <Zap size={14} className={credits > 0 ? "text-yellow-400" : "text-slate-500"} fill={credits > 0 ? "currentColor" : "none"} />
             <span className="text-xs font-bold text-slate-300">
                {credits === Infinity ? t.unlimitedAccess : `${credits} ${t.creditsRemaining}`}
             </span>
          </div>

          <button 
            onClick={onToggleLang}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Globe size={14} />
            {lang === 'fi' ? 'EN' : 'FI'}
          </button>
          
          <button 
            onClick={fillTestData}
            className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
          >
            <FlaskConical size={14} />
            <span className="hidden sm:inline">{t.demoData}</span>
            <span className="sm:hidden">Demo</span>
          </button>
        </div>
      </div>

      <div className="p-3 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.athleteName}</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 md:h-12 px-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-medium transition-all"
              placeholder={t.placeholderName}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.testDate}</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 md:h-12 px-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-medium transition-all"
            />
          </div>
        </div>

        <div className="mb-6">
            <button 
                type="button"
                onClick={() => setShowPrev(!showPrev)}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-pink-600 transition-colors"
            >
                {showPrev ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {t.addComparison}
            </button>

            {showPrev && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{t.compareTitle}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.prevDate}</label>
                             <input type="date" value={prevDate} onChange={e => setPrevDate(e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm font-medium" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2">{t.prevAer}</label>
                             <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="Min" value={prevAerMin} onChange={e => setPrevAerMin(e.target.value)} className="w-full p-2 pl-2 rounded border border-emerald-200 focus:ring-1 focus:ring-emerald-500 text-sm" />
                                 </div>
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="Sec" value={prevAerSec} onChange={e => setPrevAerSec(e.target.value)} className="w-full p-2 pl-2 rounded border border-emerald-200 focus:ring-1 focus:ring-emerald-500 text-sm" />
                                 </div>
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="HR" value={prevAerHr} onChange={e => setPrevAerHr(e.target.value)} className="w-full p-2 pl-2 rounded border border-emerald-200 focus:ring-1 focus:ring-emerald-500 text-sm" />
                                 </div>
                             </div>
                         </div>
                         
                         <div>
                             <label className="block text-[10px] font-bold text-red-600 uppercase mb-2">{t.prevAna}</label>
                             <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="Min" value={prevAnaMin} onChange={e => setPrevAnaMin(e.target.value)} className="w-full p-2 pl-2 rounded border border-red-200 focus:ring-1 focus:ring-red-500 text-sm" />
                                 </div>
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="Sec" value={prevAnaSec} onChange={e => setPrevAnaSec(e.target.value)} className="w-full p-2 pl-2 rounded border border-red-200 focus:ring-1 focus:ring-red-500 text-sm" />
                                 </div>
                                 <div className="relative flex-1">
                                    <input type="number" placeholder="HR" value={prevAnaHr} onChange={e => setPrevAnaHr(e.target.value)} className="w-full p-2 pl-2 rounded border border-red-200 focus:ring-1 focus:ring-red-500 text-sm" />
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] mb-4">
            <thead>
              <tr className="text-left">
                <th className="pb-2 text-xs font-bold text-slate-400 uppercase w-12">#</th>
                <th className="pb-2 text-xs font-bold text-slate-400 uppercase">{t.pace} ({t.min})</th>
                <th className="pb-2 text-xs font-bold text-slate-400 uppercase">{t.pace} ({t.sec})</th>
                <th className="pb-2 text-xs font-bold text-slate-400 uppercase">{t.hr} (bpm)</th>
                <th className="pb-2 text-xs font-bold text-slate-400 uppercase">{t.lac} (mmol/l)</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              {rows.map((row, index) => (
                <tr key={row.id} className="group">
                  <td className="pr-2 py-1 text-sm font-bold text-slate-300">{index + 1}</td>
                  <td className="pr-2 py-1">
                    <input 
                      type="number" 
                      value={row.min}
                      onChange={(e) => handleRowChange(index, 'min', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono text-slate-700 font-bold"
                      placeholder="0"
                    />
                  </td>
                  <td className="pr-2 py-1">
                    <input 
                      type="number" 
                      value={row.sec}
                      onChange={(e) => handleRowChange(index, 'sec', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono text-slate-700 font-bold"
                      placeholder="00"
                    />
                  </td>
                  <td className="pr-2 py-1">
                    <input 
                      type="number" 
                      value={row.hr}
                      onChange={(e) => handleRowChange(index, 'hr', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/50 focus:border-transparent font-mono text-slate-700 font-bold"
                      placeholder="000"
                    />
                  </td>
                  <td className="pr-2 py-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={row.lac}
                      onChange={(e) => handleRowChange(index, 'lac', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-mono text-slate-700 font-bold"
                      placeholder="0.0"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button 
                      type="button"
                      onClick={() => removeRow(index)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title={t.deleteRow}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center pt-4 border-t border-slate-100">
           <button 
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-pink-600 transition-colors"
          >
            <Plus size={16} />
            {t.addRow}
          </button>

          <button 
            onClick={handleSubmit}
            className="w-full md:w-auto px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95"
          >
            <Activity size={18} />
            {t.createReport}
          </button>
        </div>

      </div>
    </div>
  );
};

export default InputForm;