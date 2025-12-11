import React, { useState } from 'react';
import { ArrowLeft, Printer, Save, Check, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { PHVSessionData } from './PhvTest';
import { getMaturityInterpretation, getTypicalPHVAge } from '../utils/phvCalculations';
import { supabase } from '../utils/supabase';

interface PhvReportViewProps {
  lang: Language;
  sessionData: PHVSessionData;
  onBack: () => void;
}

const PhvReportView: React.FC<PhvReportViewProps> = ({ lang, sessionData, onBack }) => {
  const t = translations[lang];
  const [athleteName, setAthleteName] = useState(sessionData.athleteName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveReport = async () => {
    if (!athleteName.trim()) {
      alert('Please enter athlete name');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Please log in to save reports');
        return;
      }

      const { error } = await supabase
        .from('athlete_reports')
        .insert({
          user_id: user.id,
          athlete_name: athleteName.trim(),
          test_type: 'Growth',
          test_date: new Date(sessionData.date).toISOString(),
          test_data: {
            inputData: sessionData.inputData,
            result: sessionData.result
          }
        });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const { result, inputData } = sessionData;
  const interpretation = getMaturityInterpretation(result.maturityOffset);
  const typicalPHV = getTypicalPHVAge(inputData.gender);

  const getStatusColor = () => {
    if (result.maturityStatus === 'pre-PHV') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (result.maturityStatus === 'circa-PHV') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusIcon = () => {
    if (result.maturityOffset < 0) return '↗️';
    if (result.maturityOffset > 0) return '✓';
    return '⚡';
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="flex flex-col gap-4 no-print">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm">
            <ArrowLeft size={16} /> {t.edit || 'Edit'}
          </button>
          <div className="flex gap-2">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                <Check size={18} />
                Saved
              </div>
            )}
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => window.print()} className="bg-white border border-slate-200 p-2 rounded-lg text-slate-500 hover:text-slate-900">
              <Printer size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
            Athlete Name
          </label>
          <input
            type="text"
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            placeholder="Enter athlete name"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden p-8">
        <div className="flex justify-between items-end border-b border-slate-100 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              GROWTH <span className="text-emerald-500">MATURITY</span>
            </h1>
            <div className="text-slate-400 font-bold text-sm mt-1">
              {athleteName} | {new Date(sessionData.date).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maturity Offset</div>
            <div className="text-4xl font-black text-slate-900">
              {result.maturityOffset > 0 ? '+' : ''}{result.maturityOffset.toFixed(2)}{' '}
              <span className="text-lg text-slate-400 font-medium">years</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Current Age</div>
            <div className="text-2xl font-black text-slate-900">
              {inputData.ageYears}y {inputData.ageMonths}m
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Predicted PHV Age</div>
            <div className="text-2xl font-black text-slate-900">
              {result.predictedAgeAtPHV.toFixed(1)} <span className="text-sm font-medium">years</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Leg Length</div>
            <div className="text-2xl font-black text-slate-900">
              {result.legLength.toFixed(1)} <span className="text-sm font-medium">cm</span>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 border-2 mb-6 ${getStatusColor()}`}>
          <div className="flex items-start gap-4">
            <div className="text-4xl">{getStatusIcon()}</div>
            <div className="flex-1">
              <h3 className="text-xl font-black uppercase mb-2">{interpretation.status}</h3>
              <p className="font-bold mb-3">{interpretation.description}</p>
              <div className="text-sm opacity-90">
                {result.maturityOffset < 0 ? (
                  <p>
                    <strong>{Math.abs(result.maturityOffset).toFixed(1)} years</strong> before predicted peak growth.
                    Expected PHV at age <strong>{result.predictedAgeAtPHV.toFixed(1)}</strong>.
                  </p>
                ) : result.maturityOffset > 0 ? (
                  <p>
                    <strong>{result.maturityOffset.toFixed(1)} years</strong> after predicted peak growth.
                    Peak was estimated at age <strong>{result.predictedAgeAtPHV.toFixed(1)}</strong>.
                  </p>
                ) : (
                  <p>Currently experiencing peak height velocity!</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <AlertCircle size={18} />
            Training & Development Recommendations
          </h3>
          <ul className="space-y-2">
            {interpretation.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 font-medium">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
              Measurement Data
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Gender</span>
                <span className="text-sm font-bold text-slate-900 capitalize">{inputData.gender}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Height</span>
                <span className="text-sm font-bold text-slate-900">{inputData.height} cm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Sitting Height</span>
                <span className="text-sm font-bold text-slate-900">{inputData.sittingHeight} cm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Weight</span>
                <span className="text-sm font-bold text-slate-900">{inputData.weight} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Leg Length</span>
                <span className="text-sm font-bold text-slate-900">{result.legLength.toFixed(1)} cm</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
              Reference Information
            </h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Typical PHV Age ({inputData.gender}s)</div>
                <div className="text-sm font-bold text-slate-900">
                  Average: {typicalPHV.average} years
                </div>
                <div className="text-xs text-slate-600">Range: {typicalPHV.range}</div>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Assessment Method</div>
                <div className="text-sm font-bold text-slate-900">Mirwald et al. (2002)</div>
                <div className="text-xs text-slate-600">Maturity offset prediction from anthropometric measurements</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold mb-1">Important Note:</p>
              <p>
                This assessment predicts biological maturity based on anthropometric measurements. Individual variation
                exists, and predictions should be used as guidance alongside professional judgment. Regular reassessment
                every 3-6 months is recommended during adolescence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhvReportView;
