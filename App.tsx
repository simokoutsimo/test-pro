import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import ReportView from './components/ReportView';
import AuthPage from './components/AuthPage';
import PricingPage from './components/PricingPage';
import TestSelectionPage from './components/TestSelectionPage';
import MartTest from './components/MartTest';
import VbtTest from './components/VbtTest';
import { TestResult, Language, User, InputCacheData, TestType } from './types';
import { translations } from './utils/translations';
import { LogOut, ArrowLeft } from 'lucide-react';
import { supabase } from './utils/supabase';

const App: React.FC = () => {
  // 1. Auth & User State
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // 2. View State within the App
  const [appView, setAppView] = useState<'selection' | 'input' | 'report'>('selection');

  // 3. Selected Test Type
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null);

  // 4. Data State
  const [resultData, setResultData] = useState<TestResult | null>(null);
  const [inputCache, setInputCache] = useState<InputCacheData | undefined>(undefined);

  // 5. Global Settings
  const [lang, setLang] = useState<Language>('fi');

  // 6. Locking Logic
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: profile?.full_name || session.user.email!.split('@')[0],
          plan: profile?.plan || null,
          credits: profile?.credits || 0
        });
      }

      setIsLoadingSession(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!profile) {
            await supabase
              .from('user_profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || session.user.email!.split('@')[0],
                credits: 0
              });
          }

          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: profile?.full_name || session.user.user_metadata?.full_name || session.user.email!.split('@')[0],
            plan: profile?.plan || null,
            credits: profile?.credits || 0
          });
        } else {
          setUser(null);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // HANDLERS

  const handleLogin = (loggedInUser: User) => {
      setUser(loggedInUser);
      setAppView('selection');
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      setAppView('selection');
      setSelectedTest(null);
      setResultData(null);
      setInputCache(undefined);
  };

  const handleTestSelect = (type: TestType) => {
      setSelectedTest(type);
      setAppView('input');
  };

  const handlePurchase = (plan: 'single' | 'pro' | 'coach') => {
      if (user) {
          const credits = plan === 'single' ? 1 : -1;
          setUser({ ...user, plan, credits });
          setAppView('input');
      }
  };

  const handleCalculate = (result: TestResult, inputData: InputCacheData) => {
    setResultData(result);
    setInputCache(inputData);
    if (user?.credits === -1) {
        setIsReportUnlocked(true);
    } else {
        setIsReportUnlocked(false);
    }
    setAppView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUnlockReport = async () => {
      if (!user) return;
      if (user.credits > 0 || user.credits === -1) {
          if (user.credits !== -1) {
             const newCredits = user.credits - 1;
             setUser({ ...user, credits: newCredits });

             await supabase
               .from('user_profiles')
               .update({ credits: newCredits })
               .eq('id', user.id);
          }
          setIsReportUnlocked(true);
      } else {
          alert("No credits remaining. Please purchase more.");
      }
  };

  const handleUpdateFrequency = (freq: number) => {
    if (inputCache) {
      setInputCache({ ...inputCache, frequency: freq });
    }
  };

  const handleBack = () => {
      if (appView === 'report') {
          setAppView('input');
      } else if (appView === 'input') {
          // Back to selection
          setSelectedTest(null);
          setAppView('selection');
      }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'fi' ? 'en' : 'fi');
  };

  // ROUTING LOGIC

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. Not Logged In -> Auth Page
  if (!user) {
      return <AuthPage onLogin={handleLogin} lang={lang} onToggleLang={toggleLang} />;
  }

  // 2. Logged In -> Selection Page (if no test selected)
  if (!selectedTest || appView === 'selection') {
      return <TestSelectionPage onSelect={handleTestSelect} onLogout={handleLogout} lang={lang} />;
  }

  // 3. Test Selected -> Check Plan
  if (!user.plan) {
      return <PricingPage onPurchase={handlePurchase} onBack={handleBack} lang={lang} userId={user.id} />;
  }

  // 4. Test Selected & Plan OK -> Input/Report
  if (selectedTest === 'vbt') {
      return <VbtTest lang={lang} onBack={handleBack} />;
  }
  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-slate-900 bg-slate-50">
      <div className="flex justify-between max-w-4xl mx-auto mb-4">
          <button 
             onClick={handleBack} 
             className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
          >
              <ArrowLeft size={12} />
              {t.selectTestTitle}
          </button>
          
          <button 
             onClick={handleLogout} 
             className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
          >
              <LogOut size={12} />
              {t.logout}
          </button>
      </div>

      {appView === 'input' ? (
        <div className="animate-fade-in pt-4 md:pt-0">
           <header className="max-w-4xl mx-auto mb-8 md:mb-10 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 uppercase">
                Koutsimo <span className="text-pink-500">Test Pro</span>
              </h1>
              <p className="text-slate-500 font-medium">{t.appSubtitle}</p>
           </header>
           
           {selectedTest === 'threshold' ? (
               <InputForm 
                 initialData={inputCache}
                 onCalculate={handleCalculate}
                 lang={lang}
                 onToggleLang={toggleLang}
                 credits={user.credits}
               />
           ) : selectedTest === 'mart' ? (
               <MartTest lang={lang} />
           ) : (
               <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                   <p className="text-slate-500 font-bold">{t.comingSoon}</p>
               </div>
           )}
        </div>
      ) : (
        resultData && inputCache && selectedTest === 'threshold' && (
          <ReportView 
            initialResult={resultData}
            inputData={inputCache}
            onBack={() => setAppView('input')} 
            lang={lang} 
            onToggleLang={toggleLang}
            onUpdateFrequency={handleUpdateFrequency}
            isLocked={!isReportUnlocked}
            onUnlock={handleUnlockReport}
          />
        )
      )}
    </div>
  );
};

export default App;
