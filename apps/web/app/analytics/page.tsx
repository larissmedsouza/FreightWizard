'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const API_URL = 'https://freightwizard-production.up.railway.app';

// Icon component for easy SVG usage
const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

// Translations
const translations = {
  en: {
    title: 'Analytics & Insights',
    subtitle: 'Track your freight email performance',
    totalEmails: 'Total Emails',
    analyzed: 'Analyzed',
    replied: 'Replied',
    avgResponse: 'Avg Response',
    automationRate: 'Automation Rate',
    intentBreakdown: 'Intent Breakdown',
    responseTime: 'Response Time',
    priorityBreakdown: 'Priority Breakdown',
    weeklyReport: 'Weekly Report',
    avgResponseTime: 'Average Response Time',
    fastest: 'Fastest',
    slowest: 'Slowest',
    minutes: 'min',
    backToDashboard: 'Back to Dashboard',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    noData: 'No data yet. Start analyzing emails to see insights!',
    loading: 'Loading analytics...',
    aiInsights: 'AI Insights',
  },
  pt: {
    title: 'Analytics & Insights',
    subtitle: 'Acompanhe o desempenho dos seus e-mails de frete',
    totalEmails: 'Total de E-mails',
    analyzed: 'Analisados',
    replied: 'Respondidos',
    avgResponse: 'Resp. Média',
    automationRate: 'Taxa de Automação',
    intentBreakdown: 'Breakdown de Intenções',
    responseTime: 'Tempo de Resposta',
    priorityBreakdown: 'Breakdown de Prioridade',
    weeklyReport: 'Relatório Semanal',
    avgResponseTime: 'Tempo Médio de Resposta',
    fastest: 'Mais Rápido',
    slowest: 'Mais Lento',
    minutes: 'min',
    backToDashboard: 'Voltar ao Dashboard',
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    noData: 'Sem dados ainda. Comece a analisar emails para ver insights!',
    loading: 'Carregando analytics...',
    aiInsights: 'Insights de IA',
  },
  nl: {
    title: 'Analytics & Insights',
    subtitle: 'Volg je vracht e-mail prestaties',
    totalEmails: 'Totaal E-mails',
    analyzed: 'Geanalyseerd',
    replied: 'Beantwoord',
    avgResponse: 'Gem. Reactie',
    automationRate: 'Automatiseringsgraad',
    intentBreakdown: 'Intentie Breakdown',
    responseTime: 'Reactietijd',
    priorityBreakdown: 'Prioriteit Breakdown',
    weeklyReport: 'Wekelijks Rapport',
    avgResponseTime: 'Gemiddelde Reactietijd',
    fastest: 'Snelste',
    slowest: 'Langzaamste',
    minutes: 'min',
    backToDashboard: 'Terug naar Dashboard',
    daily: 'Dagelijks',
    weekly: 'Wekelijks',
    monthly: 'Maandelijks',
    noData: 'Nog geen data. Begin met analyseren om insights te zien!',
    loading: 'Analytics laden...',
    aiInsights: 'AI Insights',
  },
};

type Language = 'en' | 'pt' | 'nl';
type TimeRange = 'daily' | 'weekly' | 'monthly';

interface AnalyticsData {
  stats: {
    totalEmails: number;
    analyzed: number;
    replied: number;
    avgResponseTime: string;
    automationRate: string;
  };
  dailyStats: any[];
  intentBreakdown: { intent: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
  responseTimes: {
    average: number;
    fastest: number;
    slowest: number;
    trend: number[];
  };
}

// Intent colors
const intentColors: Record<string, string> = {
  quote_request: '#9E14FB',
  tracking: '#5200FF',
  booking: '#1BA1FF',
  documentation: '#00D4AA',
  status_inquiry: '#FF6B6B',
  general: '#FFB84D',
};

// Priority colors
const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

// Format minutes to human readable time
const formatTime = (minutes: number): string => {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<string | null>(null);
  const pathname = usePathname();

  const t = translations[language];

  // Theme
  const theme = darkMode ? {
    bg: 'bg-[#050510]',
    card: 'bg-[#0a0a1a]',
    cardBorder: 'border-white/5',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    iconFilter: { filter: 'brightness(0) invert(1)' }, // Makes icons white in dark mode
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm',
    cardBorder: 'border-slate-200/50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    textDim: 'text-slate-500',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' }, // Makes icons purple (#7C0BFD) in light mode
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);

    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      setSession(sid);
      fetchAnalytics(sid, timeRange);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (session) {
      fetchAnalytics(session, timeRange);
    }
  }, [timeRange]);

  const fetchAnalytics = async (sid: string, range: TimeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analytics?session=${sid}&range=${range}`);
      const result = await res.json();
      if (!result.error) {
        setData(result);
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    }
    setLoading(false);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light');
  };

  const changeLang = (l: Language) => {
    setLanguage(l);
    localStorage.setItem('fw_lang', l);
    setLangMenuOpen(false);
  };

  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  // Calculate totals for charts
  const totalIntents = data?.intentBreakdown?.reduce((sum, i) => sum + i.count, 0) || 0;
  const totalPriority = data?.priorityBreakdown?.reduce((sum, p) => sum + p.count, 0) || 0;

  // Stat cards config with icons
  const statCards = [
    { label: t.totalEmails, value: data?.stats.totalEmails || 0, icon: 'Dashboard_analytics_total email' },
    { label: t.analyzed, value: data?.stats.analyzed || 0, icon: 'Dashboard_analytics_Analyzed' },
    { label: t.replied, value: data?.stats.replied || 0, icon: 'Dashboard_analytics_replied' },
    { label: t.avgResponse, value: data?.stats.avgResponseTime || '0 min', icon: 'Dashboard_analyrtics_Avg Response' },
    { label: t.automationRate, value: data?.stats.automationRate || '0%', icon: 'Dashboard_analyrtics_Automation Rate' },
  ];

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-3 flex items-center justify-between sticky top-0 z-40`}>
  <Link href={`/dashboard?session=${session}`} className="flex items-center gap-2 flex-shrink-0">
    <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
    <span className="text-base font-bold">FreightWizard</span>
  </Link>

  <nav className="flex items-center gap-1 mx-4">
    {[
      { href: '/dashboard', label: { en: 'Inbox', pt: 'Caixa de Entrada', nl: 'Inbox' }, icon: 'Dashboard_analytics_total email' },
      { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' }, icon: 'Dashboard_analyrtics_AI Insights' },
      { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' }, icon: 'Dashboard_email_team' },
      { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
    ].map(item => (
      <Link key={item.href} href={`${item.href}?session=${session}`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
          pathname?.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
            ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/40'
            : `border border-transparent ${darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`
        }`}>
        <Icon name={item.icon} className="w-3.5 h-3.5" style={theme.iconFilter} />
        {item.label[language]}
      </Link>
    ))}
  </nav>

  <div className="flex items-center gap-2 flex-shrink-0">
    <div className="relative">
      <button onClick={() => setLangMenuOpen(!langMenuOpen)} className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full hover:bg-white/5`}>
        {langLabels[language]} ▼
      </button>
      {langMenuOpen && (
        <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-lg shadow-xl z-50`}>
          {(['en', 'pt', 'nl'] as Language[]).map(l => (
            <button key={l} onClick={() => changeLang(l)} className="w-full px-4 py-2 text-left text-sm hover:bg-white/5">{langLabels[l]}</button>
          ))}
        </div>
      )}
    </div>
    <button onClick={toggleTheme} className={`p-2 rounded-full hover:bg-white/5 border ${theme.cardBorder}`}>
      {darkMode ? <Icon name="Dashboard_sun_light_mode" className="w-5 h-5" /> : <Icon name="Dashboard_moon_dark_mode" className="w-5 h-5" />}
    </button>
    <Link href={`/dashboard?session=${session}`} className={`px-4 py-2 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full hover:bg-white/5`}>
      ← {t.backToDashboard}
    </Link>
  </div>
</header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
          <p className={theme.textMuted}>{t.subtitle}</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {(['daily', 'weekly', 'monthly'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white'
                  : `${theme.card} border ${theme.cardBorder} ${theme.textMuted} hover:bg-white/5`
              }`}
            >
              {t[range]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-[#5200FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className={theme.textMuted}>{t.loading}</p>
            </div>
          </div>
        ) : !data || data.stats.totalEmails === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                <Icon name="Dashboard_analyrtics_AI Insights" className="w-full h-full" style={theme.iconFilter} />
              </div>
              <p className={theme.textMuted}>{t.noData}</p>
              <Link href="/dashboard" className="mt-4 inline-block px-6 py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-white font-medium">
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {statCards.map((stat, i) => (
                <div key={i} className={`${theme.card} rounded-2xl p-4 border ${theme.cardBorder}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 p-1.5 rounded-lg bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                      <Icon name={stat.icon} className="w-full h-full" style={theme.iconFilter} />
                    </div>
                    <span className={`text-xs ${theme.textMuted}`}>{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Intent Breakdown */}
              <div className={`${theme.card} rounded-2xl p-6 border ${theme.cardBorder}`}>
                <h2 className="text-lg font-semibold mb-4">{t.intentBreakdown}</h2>
                
                {data.intentBreakdown.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        {data.intentBreakdown.reduce((acc, item, i) => {
                          const prevOffset = acc.offset;
                          const percentage = (item.count / totalIntents) * 100;
                          acc.elements.push(
                            <circle
                              key={i}
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke={intentColors[item.intent] || '#888'}
                              strokeWidth="4"
                              strokeDasharray={`${percentage} ${100 - percentage}`}
                              strokeDashoffset={-prevOffset}
                              className="transition-all duration-500"
                            />
                          );
                          acc.offset += percentage;
                          return acc;
                        }, { elements: [] as JSX.Element[], offset: 0 }).elements}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{totalIntents}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      {data.intentBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: intentColors[item.intent] || '#888' }}></div>
                            <span className={`text-sm ${theme.textMuted}`}>{item.intent.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-sm font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className={theme.textMuted}>No intent data yet</p>
                )}
              </div>

              {/* Response Time */}
              <div className={`${theme.card} rounded-2xl p-6 border ${theme.cardBorder}`}>
                <h2 className="text-lg font-semibold mb-4">{t.responseTime}</h2>
                
                <div className="flex items-center gap-8 mb-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] bg-clip-text text-transparent">
                      {formatTime(data.responseTimes.average)}
                    </p>
                    <p className={`text-xs ${theme.textMuted}`}>{t.avgResponseTime} ({t.minutes})</p>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className={`${darkMode ? 'bg-green-500/10' : 'bg-green-50'} rounded-xl p-3 text-center`}>
                      <p className="text-xl font-bold text-green-500">{formatTime(data.responseTimes.fastest)}</p>
                      <p className={`text-xs ${theme.textMuted}`}>{t.fastest}</p>
                    </div>
                    <div className={`${darkMode ? 'bg-red-500/10' : 'bg-red-50'} rounded-xl p-3 text-center`}>
                      <p className="text-xl font-bold text-red-500">{formatTime(data.responseTimes.slowest)}</p>
                      <p className={`text-xs ${theme.textMuted}`}>{t.slowest}</p>
                    </div>
                  </div>
                </div>

                {/* Trend Line */}
                {data.responseTimes.trend.length > 0 && (
                  <div className="h-20 flex items-end gap-1">
                    {data.responseTimes.trend.map((time, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-gradient-to-t from-[#5200FF] to-[#1BA1FF] rounded-t transition-all duration-500"
                          style={{ height: `${Math.max((time / Math.max(...data.responseTimes.trend, 1)) * 100, 5)}%` }}
                        ></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Breakdown */}
              <div className={`${theme.card} rounded-2xl p-6 border ${theme.cardBorder}`}>
                <h2 className="text-lg font-semibold mb-4">{t.priorityBreakdown}</h2>
                
                {data.priorityBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {data.priorityBreakdown.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priorityColors[item.priority] || '#888' }}></div>
                            <span className={`text-sm ${theme.textMuted}`}>{item.priority}</span>
                          </div>
                          <span className="text-sm font-medium">{item.count} ({totalPriority > 0 ? Math.round((item.count / totalPriority) * 100) : 0}%)</span>
                        </div>
                        <div className={`h-2 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-full overflow-hidden`}>
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${totalPriority > 0 ? (item.count / totalPriority) * 100 : 0}%`,
                              backgroundColor: priorityColors[item.priority] || '#888'
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={theme.textMuted}>No priority data yet</p>
                )}
              </div>

              {/* AI Insights */}
              <div className={`${theme.card} rounded-2xl p-6 border ${theme.cardBorder}`}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Icon name="Dashboard_analyrtics_AI Insights" className="w-5 h-5" style={theme.iconFilter} />
                  {t.aiInsights}
                </h2>
                
                <div className={`${darkMode ? 'bg-gradient-to-br from-[#9E14FB]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-br from-purple-50 to-blue-50'} rounded-xl p-4`}>
                  <p className="text-sm leading-relaxed">
                    {data.stats.totalEmails > 0 ? (
                      <>
                        You've processed <strong>{data.stats.totalEmails}</strong> emails with a <strong>{data.stats.automationRate}</strong> automation rate. 
                        {data.stats.replied > 0 && ` Average response time is ${data.stats.avgResponseTime}.`}
                        {data.intentBreakdown[0] && ` Most common intent: ${data.intentBreakdown[0].intent.replace(/_/g, ' ')}.`}
                      </>
                    ) : (
                      'Start analyzing emails to get AI-powered insights!'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
