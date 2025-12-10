import React, { useState } from 'react';
import InputForm from './components/InputForm';
import ReportView from './components/ReportView';
import AuthPage from './components/AuthPage';
import TestSelectionPage from './components/TestSelectionPage';
import MartTest from './components/MartTest';
import VbtTest from './components/VbtTest';
import JumpTest from './components/JumpTest';
import { TestResult, Language, User, InputCacheData, TestType } from './types';
import { translations } from './utils/translations';
import { LogOut, ArrowLeft } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [appView, setAppView] = useState<'selection' | 'input' | 'report'>('selection');
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null);
  const [resultData, setResultData] = useState<TestResult | null>(null);
  const [inputCache, setInputCache] = useState<InputCacheData | undefined>(undefined);
  const [lang, setLang] = useState<Language>('fi');
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const t = translations[lang];

  const handleLogin = (loggedInUser: User) => {
      // DEMO MODE: Grant Pro plan and infinite credits on login
      setUser({ ...loggedInUser, plan: 'pro', credits: Infinity });
      setAppView('selection');
  };

  const handleLogout = () => {
      setUser(null);
      setAppView('selection');
      setSelectedTest(null);
      setResultData(null);
      setInputCache(undefined);
  };

  const handleTestSelect = (type: TestType) => {
      setSelectedTest(type);
      if (type !== 'jump') {
        setAppView('input');
      } else {
        // For JumpTest, we go directly to the test view which is handled by the router
      }
  };

  const handleCalculate = (result: TestResult, inputData: InputCacheData) => {
    setResultData(result);
    setInputCache(inputData);
    if (user?.credits === Infinity) {
        setIsReportUnlocked(true);
    } else {
        setIsReportUnlocked(false);
    }
    setAppView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUnlockReport = () => {
      if (!user) return;
      if (user.credits > 0) {
          if (user.credits !== Infinity) {
             setUser({ ...user, credits: user.credits - 1 });
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
      } else if (appView === 'input' || selectedTest === 'jump' || selectedTest === 'vbt') {
          setSelectedTest(null);
          setAppView('selection');
      }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'fi' ? 'en' : 'fi');
  };

  // --- ROUTING LOGIC ---

  if (!user) {
      return <AuthPage onLogin={handleLogin} lang={lang} onToggleLang={toggleLang} />;
  }

  if (!selectedTest || appView === 'selection') {
      return <TestSelectionPage onSelect={handleTestSelect} onLogout={handleLogout} lang={lang} />;
  }

  // DEMO MODE: Bypassing the pricing page logic
  // The original check `!user.plan` is removed.

  if (selectedTest === 'vbt') {
      return <VbtTest lang={lang} onBack={handleBack} />;
  }
  
  if (selectedTest === 'jump') {
      return <JumpTest />;
  }

  // Default view for other tests
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
