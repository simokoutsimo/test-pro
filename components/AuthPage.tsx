
import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, User } from '../types';

interface AuthPageProps {
  onLogin: (user: User) => void;
  lang: Language;
  onToggleLang: () => void;
}

// Brand Logo Component
const BrandLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M100 180L40 120C20 100 20 60 50 40C70 25 90 40 100 60C110 40 130 25 150 40C180 60 180 100 160 120L100 180Z" stroke="currentColor" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500"/>
    <path d="M50 40C65 55 75 70 100 95" stroke="currentColor" strokeWidth="15" strokeLinecap="round" className="text-pink-500 opacity-50"/>
    <path d="M150 40C135 55 125 70 100 95" stroke="currentColor" strokeWidth="15" strokeLinecap="round" className="text-pink-500 opacity-50"/>
  </svg>
);

const AuthPage: React.FC<AuthPageProps> = ({ onLogin, lang, onToggleLang }) => {
  const t = translations[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      onLogin({
        id: isRegister ? `user-${Date.now()}` : 'user-123',
        email: email,
        name: isRegister ? name : email.split('@')[0],
        plan: null, // User starts with no plan
        credits: 0
      });
      setIsLoading(false);
    }, 1500);
  };

  const handleGoogleLogin = () => {
      setIsLoading(true);
      setTimeout(() => {
        onLogin({
          id: 'user-google-123',
          email: 'demo@gmail.com',
          name: 'Demo User',
          plan: null,
          credits: 0
        });
        setIsLoading(false);
      }, 1500);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      
      {/* LEFT SIDE: VIDEO & BRANDING (Desktop only) */}
      <div className="hidden md:flex w-1/2 bg-slate-900 relative flex-col justify-center items-center overflow-hidden p-12">
        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(236,72,153,0.5),_transparent_50%)]"></div>
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full max-w-xl flex flex-col items-start">
           <div className="mb-6">
              <BrandLogo className="w-20 h-20 text-pink-500" />
           </div>
           
           <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight leading-tight uppercase">
             Koutsimo <span className="text-pink-500">Test Pro</span>
           </h1>
           
           <h2 className="text-lg text-slate-300 font-medium leading-relaxed mb-10 max-w-md">
             {t.welcomeSubtitle}
           </h2>

           {/* PRODUCT DEMO VIDEO CONTAINER */}
           <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl shadow-pink-900/30 border border-slate-700 bg-slate-800 aspect-video group">
               <div className="absolute inset-0 bg-slate-800 animate-pulse" />
               <video 
                 autoPlay 
                 loop 
                 muted 
                 playsInline 
                 className="relative z-10 w-full h-full object-cover opacity-100"
                 src="https://assets.mixkit.co/videos/preview/mixkit-athlete-running-on-a-treadmill-in-a-gym-44383-large.mp4"
               >
                  Your browser does not support the video tag.
               </video>
               
               {/* Overlay gradient */}
               <div className="absolute inset-0 border-[1px] border-white/10 rounded-2xl pointer-events-none z-20 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"></div>
           </div>
           
        </div>
      </div>

      {/* RIGHT SIDE: LOGIN FORM */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 md:p-12 relative bg-white md:bg-slate-50">
        
        {/* Mobile Logo */}
        <div className="md:hidden text-center mb-8 flex flex-col items-center">
            <BrandLogo className="w-16 h-16 text-pink-500 mb-2" />
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
              Koutsimo <span className="text-pink-500">Test Pro</span>
            </h1>
             <p className="text-slate-500 text-sm mt-2">{t.welcomeSubtitle}</p>
        </div>

        <div className="absolute top-6 right-6">
            <button 
                onClick={onToggleLang}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 text-xs px-3 py-2 rounded-lg font-bold transition-colors shadow-sm"
            >
                {lang === 'fi' ? 'EN' : 'FI'}
            </button>
        </div>

        <div className="max-w-md w-full bg-white md:bg-transparent md:p-0 rounded-3xl md:rounded-none shadow-2xl md:shadow-none p-8 border border-slate-100 md:border-none">
          <div className="mb-8 text-center md:text-left">
             <h2 className="text-2xl font-black text-slate-900">{isRegister ? t.register : t.login}</h2>
             <p className="text-slate-400 text-sm mt-1">{isRegister ? "Create your professional account" : "Welcome back"}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            
            {isRegister && (
            <div className="space-y-1.5 animate-fade-in">
               <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t.yourName}</label>
               <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.placeholderName}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:outline-none transition-all font-medium text-slate-900"
                    required={isRegister}
                  />
               </div>
            </div>
            )}

            <div className="space-y-1.5">
               <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t.emailPlaceholder}</label>
               <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:outline-none transition-all font-medium text-slate-900"
                    required
                  />
               </div>
            </div>
            
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t.passwordPlaceholder}</label>
               <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:outline-none transition-all font-medium text-slate-900"
                    required
                  />
               </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2 mt-4 transform active:scale-95"
            >
              {isLoading ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                 <>
                   {isRegister ? t.register : t.signIn}
                   <ArrowRight size={18} />
                 </>
              )}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR CONTINUE WITH</span>
              <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <button 
              onClick={handleGoogleLogin}
              type="button"
              className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t.googleLogin}
          </button>

          <div className="mt-8 text-center">
              <button 
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-sm font-semibold text-slate-500 hover:text-pink-600 transition-colors"
              >
                  {isRegister ? "Already have an account? " : "Don't have an account? "}
                  <span className="text-pink-600 font-bold">{isRegister ? t.login : t.register}</span>
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;