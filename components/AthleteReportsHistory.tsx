import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, User, TrendingUp, Zap, Activity, ChevronRight, Calendar } from 'lucide-react';
import { Language } from '../types';
import { supabase } from '../utils/supabase';

interface AthleteReportsHistoryProps {
  lang: Language;
  onBack: () => void;
}

interface AthleteReport {
  id: string;
  athlete_name: string;
  test_type: string;
  test_subtype: string | null;
  test_date: string;
  test_data: any;
  created_at: string;
}

interface AthleteGroup {
  name: string;
  reports: AthleteReport[];
}

const AthleteReportsHistory: React.FC<AthleteReportsHistoryProps> = ({ lang, onBack }) => {
  const [athletes, setAthletes] = useState<AthleteGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('athlete_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('test_date', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce((acc: { [key: string]: AthleteReport[] }, report: AthleteReport) => {
        const name = report.athlete_name;
        if (!acc[name]) acc[name] = [];
        acc[name].push(report);
        return acc;
      }, {});

      const athleteGroups = Object.entries(grouped).map(([name, reports]) => ({
        name,
        reports: (reports as AthleteReport[]).sort((a: AthleteReport, b: AthleteReport) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime())
      }));

      setAthletes(athleteGroups);
    } catch (error) {
      console.error('Error fetching athletes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAthletes = athletes.filter(athlete =>
    athlete.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTestIcon = (testType: string) => {
    switch (testType) {
      case 'Jump':
        return TrendingUp;
      case 'VBT':
        return Zap;
      case 'MART':
        return Activity;
      case 'Growth':
        return User;
      default:
        return Activity;
    }
  };

  const getTestColor = (testType: string) => {
    switch (testType) {
      case 'Jump':
        return 'text-emerald-500 bg-emerald-50 border-emerald-200';
      case 'VBT':
        return 'text-cyan-500 bg-cyan-50 border-cyan-200';
      case 'MART':
        return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'Growth':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  const getTestSummary = (report: AthleteReport) => {
    const data = report.test_data;

    switch (report.test_type) {
      case 'Jump':
        const bestHeight = data.bestJump?.height || data.jumps?.[0]?.height || 0;
        return `${bestHeight.toFixed(1)} cm • ${data.jumps?.length || 0} jumps`;
      case 'VBT':
        const peakVel = data.bestRep?.peakVelocity || data.avgPeakVelocity || 0;
        return `${peakVel.toFixed(2)} m/s • ${data.reps?.length || 0} reps`;
      case 'MART':
        const pmax = data.pMax || 0;
        return `Pmax: ${pmax.toFixed(1)} km/h`;
      case 'Growth':
        const maturityOffset = data.result?.maturityOffset || 0;
        const status = maturityOffset < 0 ? 'Pre-PHV' : maturityOffset > 0 ? 'Post-PHV' : 'Circa-PHV';
        return `${status} • ${maturityOffset > 0 ? '+' : ''}${maturityOffset.toFixed(2)}y`;
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-2xl font-black text-slate-900 uppercase">
            Athlete <span className="text-pink-500">Reports</span>
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search athlete by name..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredAthletes.length === 0 ? (
          <div className="text-center py-20">
            <User size={64} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-500 mb-2">
              {searchQuery ? 'No athletes found' : 'No reports yet'}
            </h3>
            <p className="text-slate-400">
              {searchQuery ? 'Try a different search term' : 'Complete a test and save a report to see it here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAthletes.map((athlete) => (
              <div key={athlete.name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setSelectedAthlete(selectedAthlete === athlete.name ? null : athlete.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                      <User size={24} className="text-pink-500" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-slate-900">{athlete.name}</h3>
                      <p className="text-sm text-slate-500">{athlete.reports.length} reports</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={20}
                    className={`text-slate-400 transition-transform ${
                      selectedAthlete === athlete.name ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {selectedAthlete === athlete.name && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2">
                      {athlete.reports.map((report) => {
                        const Icon = getTestIcon(report.test_type);
                        const colorClass = getTestColor(report.test_type);

                        return (
                          <div
                            key={report.id}
                            className="bg-white rounded-lg border border-slate-200 p-4 hover:border-pink-300 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg border ${colorClass}`}>
                                  <Icon size={18} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900">
                                    {report.test_type}
                                    {report.test_subtype && (
                                      <span className="ml-1 text-sm font-normal text-slate-500">
                                        ({report.test_subtype})
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-slate-500">{getTestSummary(report)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Calendar size={12} />
                                  {new Date(report.test_date).toLocaleDateString(
                                    lang === 'fi' ? 'fi-FI' : 'en-US',
                                    { day: 'numeric', month: 'short', year: 'numeric' }
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  Saved {new Date(report.created_at).toLocaleDateString(
                                    lang === 'fi' ? 'fi-FI' : 'en-US'
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AthleteReportsHistory;
