
import React, { useState } from 'react';
import { Check, Zap, Users, Crown, ArrowLeft, LogOut } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface PricingPageProps {
  onPurchase: (plan: 'single' | 'pro' | 'coach') => void;
  onBack: () => void; // Actually logout
  lang: Language;
}

const PricingPage: React.FC<PricingPageProps> = ({ onPurchase, onBack, lang }) => {
  const t = translations[lang];
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelect = (plan: 'single' | 'pro' | 'coach') => {
      setLoadingPlan(plan);
      // Simulate Payment Processing
      setTimeout(() => {
          onPurchase(plan);
          setLoadingPlan(null);
      }, 2000);
  };

  const PlanCard = ({ id, title, price, features, icon: Icon, color, popular }: any) => (
    <div className={`relative bg-white rounded-2xl p-6 border transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col ${popular ? 'border-pink-500 shadow-pink-500/10' : 'border-slate-200 shadow-sm'}`}>
      {popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
              Most Popular
          </div>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
         <Icon size={24} />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-2 mb-6">
          <span className="text-3xl font-black text-slate-900">{price}</span>
          {price !== 'Free' && <span className="text-slate-500 font-medium">/mo</span>}
      </div>
      
      <ul className="space-y-3 mb-8 flex-1">
          {features.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 font-medium">
                  <Check size={16} className="text-emerald-500 min-w-[16px] mt-0.5" />
                  {f}
              </li>
          ))}
      </ul>

      <button 
        onClick={() => handleSelect(id)}
        disabled={loadingPlan !== null}
        className={`w-full py-3 rounded-xl font-bold transition-all ${popular ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/30' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
      >
        {loadingPlan === id ? (
            <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t.processing}
            </span>
        ) : t.buyNow}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-2xl font-black text-slate-900 uppercase">Koutsimo <span className="text-pink-500">Test Pro</span></h1>
                <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-red-500 flex items-center gap-2">
                    <LogOut size={16} />
                    {t.logout}
                </button>
            </header>
            
            <div className="text-center max-w-2xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">{t.pricingTitle}</h2>
                <p className="text-slate-500 text-lg">{t.pricingSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PlanCard 
                    id="single"
                    title={t.planSingle}
                    price="15€"
                    icon={Zap}
                    color="bg-emerald-100 text-emerald-600"
                    features={[t.feature1, t.feature2, t.feature3]}
                />
                <PlanCard 
                    id="pro"
                    title={t.planPro}
                    price="29€"
                    icon={Crown}
                    color="bg-pink-100 text-pink-500"
                    popular={true}
                    features={[t.feature1, t.feature2, t.feature3, t.unlimited]}
                />
                <PlanCard 
                    id="coach"
                    title={t.planCoach}
                    price="99€"
                    icon={Users}
                    color="bg-purple-100 text-purple-600"
                    features={[t.feature1, t.feature2, t.feature3, t.unlimited, t.coachFeatures]}
                />
            </div>
        </div>
    </div>
  );
};

export default PricingPage;