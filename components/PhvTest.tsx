import React, { useState } from 'react';
import { ArrowLeft, Ruler, User, Calendar, Weight, TrendingUp, Globe } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { calculatePHV, PHVInputData, PHVResult } from '../utils/phvCalculations';

interface PhvTestProps {
  lang: Language;
  onBack?: () => void;
  onShowReport?: (data: PHVSessionData) => void;
  onToggleLang?: () => void;
}

export interface PHVSessionData {
  athleteName: string;
  date: string;
  inputData: PHVInputData;
  result: PHVResult;
}

const PhvTest: React.FC<PhvTestProps> = ({ lang, onBack, onShowReport, onToggleLang }) => {
  const t = translations[lang];

  const [athleteName, setAthleteName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('0');
  const [height, setHeight] = useState('');
  const [sittingHeight, setSittingHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validateInputs = (): boolean => {
    const newErrors: string[] = [];

    if (!athleteName.trim()) {
      newErrors.push(t.phvErrorName);
    }

    const ageY = parseFloat(ageYears);
    const ageM = parseFloat(ageMonths);
    if (!ageYears || isNaN(ageY) || ageY < 6 || ageY > 18) {
      newErrors.push(t.phvErrorAge);
    }
    if (isNaN(ageM) || ageM < 0 || ageM > 11) {
      newErrors.push(t.phvErrorMonths);
    }

    const h = parseFloat(height);
    if (!height || isNaN(h) || h < 80 || h > 220) {
      newErrors.push(t.phvErrorHeight);
    }

    const sh = parseFloat(sittingHeight);
    if (!sittingHeight || isNaN(sh) || sh < 40 || sh > 120) {
      newErrors.push(t.phvErrorSitting);
    }

    if (h && sh && sh >= h) {
      newErrors.push(t.phvErrorSittingLess);
    }

    const w = parseFloat(weight);
    if (!weight || isNaN(w) || w < 15 || w > 150) {
      newErrors.push(t.phvErrorWeight);
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleCalculate = () => {
    if (!validateInputs()) {
      return;
    }

    const inputData: PHVInputData = {
      gender,
      ageYears: parseFloat(ageYears),
      ageMonths: parseFloat(ageMonths),
      height: parseFloat(height),
      sittingHeight: parseFloat(sittingHeight),
      weight: parseFloat(weight)
    };

    const result = calculatePHV(inputData);

    const sessionData: PHVSessionData = {
      athleteName: athleteName.trim(),
      date: new Date().toISOString(),
      inputData,
      result
    };

    if (onShowReport) {
      onShowReport(sessionData);
    }
  };

  const fillDemo = () => {
    setAthleteName('Demo Athlete');
    setGender('male');
    setAgeYears('13');
    setAgeMonths('6');
    setHeight('165');
    setSittingHeight('85');
    setWeight('55');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors font-bold"
          >
            <ArrowLeft size={18} />
            {t.selectTestTitle}
          </button>
        )}
        {onToggleLang && (
          <button
            onClick={onToggleLang}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-bold text-slate-700"
          >
            <Globe size={16} />
            {lang === 'fi' ? 'EN' : 'FI'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Ruler className="text-emerald-500" size={24} />
            <h2 className="text-xl font-bold text-white uppercase tracking-wide">
              {t.phvTitle}
            </h2>
          </div>
          <button onClick={fillDemo} className="text-xs text-slate-400 hover:text-white underline">
            {t.demoData}
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
              <TrendingUp size={18} />
              {t.phvSubtitle}
            </h3>
            <p className="text-sm text-emerald-800">
              {t.phvDescription}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-bold text-red-900 mb-2">{t.phvCorrectFollowing}</h4>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-800">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                <User size={14} className="inline mr-1" />
                {t.athleteName}
              </label>
              <input
                type="text"
                value={athleteName}
                onChange={(e) => setAthleteName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder={t.placeholderName}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                {t.phvGender}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="male"
                    checked={gender === 'male'}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-700">{t.phvMale}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="female"
                    checked={gender === 'female'}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-700">{t.phvFemale}</span>
                </label>
              </div>
            </div>

            <div></div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                <Calendar size={14} className="inline mr-1" />
                {t.phvAgeYears}
              </label>
              <input
                type="number"
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder="13"
                min="6"
                max="18"
                step="1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                {t.phvAgeMonths}
              </label>
              <input
                type="number"
                value={ageMonths}
                onChange={(e) => setAgeMonths(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder="0-11"
                min="0"
                max="11"
                step="1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                <Ruler size={14} className="inline mr-1" />
                {t.phvHeight}
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder="165.5"
                min="80"
                max="220"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                <Ruler size={14} className="inline mr-1" />
                {t.phvSittingHeight}
              </label>
              <input
                type="number"
                value={sittingHeight}
                onChange={(e) => setSittingHeight(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder="85.0"
                min="40"
                max="120"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                <Weight size={14} className="inline mr-1" />
                {t.phvWeight}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                placeholder="55.0"
                min="15"
                max="150"
                step="0.1"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-bold text-slate-700 text-sm mb-2">{t.phvMeasurementInstructions}</h4>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>{t.phvInstrSitting}</li>
              <li>{t.phvInstrHeight}</li>
              <li>{t.phvInstrWeight}</li>
              <li>{t.phvInstrAge}</li>
            </ul>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-lg uppercase tracking-wide transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <TrendingUp size={20} />
            {t.phvCalculate}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhvTest;
