import React, { useState } from 'react';
import { ArrowLeft, Printer, Save, Check, AlertCircle, Globe } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { PHVSessionData } from './PhvTest';
import { getMaturityInterpretation, getTypicalPHVAge } from '../utils/phvCalculations';
import { supabase } from '../utils/supabase';

interface PhvReportViewProps {
  lang: Language;
  sessionData: PHVSessionData;
  onBack: () => void;
  onToggleLang?: () => void;
}

const PhvReportView: React.FC<PhvReportViewProps> = ({ lang, sessionData, onBack, onToggleLang }) => {
  const t = translations[lang];
  const [athleteName, setAthleteName] = useState(sessionData.athleteName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const formatYearsMonths = (decimalYears: number) => {
    const absYears = Math.abs(decimalYears);
    const years = Math.floor(absYears);
    const months = Math.round((absYears - years) * 12);

    const sign = decimalYears < 0 ? '-' : decimalYears > 0 ? '+' : '';

    if (years === 0) {
      return `${sign}${months}${lang === 'fi' ? 'kk' : 'mo'}`;
    } else if (months === 0) {
      return `${sign}${years}${lang === 'fi' ? 'v' : 'y'}`;
    } else {
      return `${sign}${years}${lang === 'fi' ? 'v' : 'y'} ${months}${lang === 'fi' ? 'kk' : 'mo'}`;
    }
  };

  const handleSaveReport = async () => {
    if (!athleteName.trim()) {
      alert(t.phvErrorName);
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
            <ArrowLeft size={16} /> {t.edit}
          </button>
          <div className="flex gap-2 items-center">
            {onToggleLang && (
              <button
                onClick={onToggleLang}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold text-slate-700"
              >
                <Globe size={16} />
                {lang === 'fi' ? 'EN' : 'FI'}
              </button>
            )}
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                <Check size={18} />
                {t.phvSaved}
              </div>
            )}
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
            >
              <Save size={18} />
              {isSaving ? t.phvSaving : t.phvSave}
            </button>
            <button onClick={() => window.print()} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-500 hover:text-slate-900 transition-colors">
              <Printer size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
            {t.athleteName}
          </label>
          <input
            type="text"
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium"
            placeholder={t.placeholderName}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden p-8">
        <div className="flex justify-between items-end border-b border-slate-100 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              {lang === 'fi' ? 'KYPSYYS' : 'MATURITY'} <span className="text-pink-500">{lang === 'fi' ? 'ANALYYSI' : 'ANALYSIS'}</span>
            </h1>
            <div className="text-slate-400 font-bold text-sm mt-1">
              {athleteName} | {new Date(sessionData.date).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-US')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.phvMaturityOffset}</div>
            <div className="text-4xl font-black text-slate-900">
              {formatYearsMonths(result.maturityOffset)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t.phvCurrentAge}</div>
            <div className="text-2xl font-black text-slate-900">
              {inputData.ageYears}v {inputData.ageMonths}m
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t.phvPredictedAge}</div>
            <div className="text-2xl font-black text-slate-900">
              {result.predictedAgeAtPHV.toFixed(1)} <span className="text-sm font-medium">{lang === 'fi' ? 'vuotta' : 'years'}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t.phvLegLength}</div>
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
                    <strong>{formatYearsMonths(Math.abs(result.maturityOffset))}</strong> {t.phvYearsBefore}.{' '}
                    {t.phvExpectedAt} <strong>{result.predictedAgeAtPHV.toFixed(1)}</strong>.
                  </p>
                ) : result.maturityOffset > 0 ? (
                  <p>
                    <strong>{formatYearsMonths(result.maturityOffset)}</strong> {t.phvYearsAfter}.{' '}
                    {t.phvPeakWasAt} <strong>{result.predictedAgeAtPHV.toFixed(1)}</strong>.
                  </p>
                ) : (
                  <p>{t.phvCurrentlyAt}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <AlertCircle size={18} />
            {t.phvRecommendations}
          </h3>
          <ul className="space-y-2">
            {interpretation.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-2 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 font-medium">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
              {t.phvMeasurementData}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t.phvGender}</span>
                <span className="text-sm font-bold text-slate-900 capitalize">
                  {inputData.gender === 'male' ? t.phvMale : t.phvFemale}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t.phvHeight}</span>
                <span className="text-sm font-bold text-slate-900">{inputData.height} cm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t.phvSittingHeight}</span>
                <span className="text-sm font-bold text-slate-900">{inputData.sittingHeight} cm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t.phvWeight}</span>
                <span className="text-sm font-bold text-slate-900">{inputData.weight} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t.phvLegLength}</span>
                <span className="text-sm font-bold text-slate-900">{result.legLength.toFixed(1)} cm</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
              {t.phvReferenceInfo}
            </h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {t.phvTypicalAge} ({inputData.gender === 'male' ? t.phvMale : t.phvFemale})
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {t.phvAverage}: {typicalPHV.average} {lang === 'fi' ? 'vuotta' : 'years'}
                </div>
                <div className="text-xs text-slate-600">{t.phvRange}: {typicalPHV.range}</div>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 mb-1">{t.phvAssessmentMethod}</div>
                <div className="text-sm font-bold text-slate-900">Mirwald et al. (2002)</div>
                <div className="text-xs text-slate-600">
                  {lang === 'fi'
                    ? 'Kypsyyden ennuste antropometrisistä mittauksista'
                    : 'Maturity offset prediction from anthropometric measurements'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold mb-1">{t.phvImportantNote}:</p>
              <p>{t.phvNoteText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhvReportView;
