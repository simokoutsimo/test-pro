
import React from 'react';
import { Activity, Timer, ArrowRight, TrendingUp, Dumbbell, Heart, LogOut, Ruler, Zap, Camera } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, TestType } from '../types';

interface TestSelectionPageProps {
  onSelect: (type: TestType) => void;
  onLogout: () => void;
  lang: Language;
}

const TestSelectionPage: React.FC<TestSelectionPageProps> = ({ onSelect, onLogout, lang }) => {
  const t = translations[lang];

  const TestCard = ({ type, title, desc, icon: Icon, color, comingSoon = false }: any) => (
    <div 
        onClick={() => !comingSoon && onSelect(type)}
        className={`relative bg-white rounded-2xl p-6 border transition-all flex flex-col h-full ${comingSoon ? 'border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:border-pink-200 cursor-pointer group'}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${comingSoon ? 'bg-slate-100 text-slate-400' : `${color.replace('text', 'bg').replace('500', '100')} ${color}`}`}>
         <Icon size={24} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-6 flex-1">{desc}</p>
      
      {comingSoon ? (
          <div className="mt-auto bg-slate-100 text-slate-400 text-xs font-bold py-2 px-3 rounded-lg self-start">
              {t.comingSoon}
          </div>
      ) : (
          <div className="mt-auto flex items-center gap-2 text-sm font-bold text-pink-500 group-hover:gap-3 transition-all">
              {t.buyNow.replace('Buy Now', 'Select')} <ArrowRight size={16} />
          </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-2xl font-black text-slate-900 uppercase">Koutsimo <span className="text-pink-500">Test Pro</span></h1>
                <button onClick={onLogout} className="text-sm font-bold text-slate-500 hover:text-red-500 flex items-center gap-2">
                    <LogOut size={16} />
                    {t.logout}
                </button>
            </header>
            
            <div className="text-center max-w-2xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">{t.selectTestTitle}</h2>
                <p className="text-slate-500 text-lg">{t.selectTestSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <TestCard 
                    type="threshold"
                    title={t.testThreshold}
                    desc={t.testThresholdDesc}
                    icon={Activity}
                    color="text-pink-500"
                />
                <TestCard 
                    type="mart"
                    title={t.testMart}
                    desc={t.testMartDesc}
                    icon={Zap}
                    color="text-orange-500"
                />
                 <TestCard 
                    type="vbt"
                    title={t.testVbt}
                    desc={t.testVbtDesc}
                    icon={Camera}
                    color="text-cyan-500"
                />
                 <TestCard 
                    type="jump"
                    title={t.testJump}
                    desc={t.testJumpDesc}
                    icon={TrendingUp}
                    color="text-emerald-500"
                    comingSoon={false}
                />
                <TestCard 
                    type="growth"
                    title={t.testGrowth}
                    desc={t.testGrowthDesc}
                    icon={Ruler}
                    color="text-indigo-500"
                    comingSoon={true}
                />
                <TestCard 
                    type="speed"
                    title={t.testSpeed}
                    desc={t.testSpeedDesc}
                    icon={Timer}
                    color="text-blue-500"
                    comingSoon={true}
                />
                <TestCard 
                    type="strength"
                    title={t.testStrength}
                    desc={t.testStrengthDesc}
                    icon={Dumbbell}
                    color="text-purple-500"
                    comingSoon={true}
                />
                <TestCard 
                    type="endurance"
                    title={t.testEndurance}
                    desc={t.testEnduranceDesc}
                    icon={Heart}
                    color="text-red-500"
                    comingSoon={true}
                />
            </div>
        </div>
    </div>
  );
};

export default TestSelectionPage;