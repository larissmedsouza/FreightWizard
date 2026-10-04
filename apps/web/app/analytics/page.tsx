'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';
import Icon, { type IconName } from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import SettingsTabs from '../components/ui/SettingsTabs';
import { appRootClass, PageHeader, SectionTitle, EmptyState, Notice } from '../components/ui/Panel';
import { Button, ButtonLink, Spinner } from '../components/ui/Button';
import { inputClass, selectClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, Chip } from '../components/ui/Tag';
import { Toast, Stat, Segmented } from '../components/ui/Data';
import { toneClass, priorityTone, type Tone } from '../components/ui/tones';
import { usePathname } from 'next/navigation';

const API_URL = 'https://freightwizard-production.up.railway.app';

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

  const statCards: { label: string; value: string | number; icon: IconName }[] = [
    { label: t.totalEmails, value: data?.stats.totalEmails || 0, icon: 'mail' },
    { label: t.analyzed, value: data?.stats.analyzed || 0, icon: 'sparkle' },
    { label: t.replied, value: data?.stats.replied || 0, icon: 'reply' },
    { label: t.avgResponse, value: data?.stats.avgResponseTime || '0 min', icon: 'clock' },
    { label: t.automationRate, value: data?.stats.automationRate || '0%', icon: 'bolt' },
  ];
  const maxIntent = Math.max(1, ...(data?.intentBreakdown?.map(i => i.count) || [0]));
  const maxTrend = Math.max(1, ...(data?.responseTimes?.trend || [0]));

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <TopBar session={session} user={null} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <TrialBanner session={session} />

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <PageHeader className="mb-5" title={t.title} description={t.subtitle}
          actions={<Segmented label="Time range" value={timeRange} onChange={setTimeRange}
            options={(['daily', 'weekly', 'monthly'] as TimeRange[]).map(range => ({ value: range, label: t[range] }))} />} />

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-3 text-app-ink-2">
            <Spinner className="size-5 text-app-accent" /> {t.loading}
          </div>
        ) : !data || data.stats.totalEmails === 0 ? (
          <div className="rounded-fw-card border border-app-line bg-app-card">
            <EmptyState icon="analytics" title={t.noData}
              action={<ButtonLink href="/dashboard" variant="primary">Go to Dashboard</ButtonLink>} />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {statCards.map((stat, i) => <Stat key={i} label={stat.label} value={stat.value} icon={stat.icon} />)}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Intent Breakdown — labelled bar list, one hue; counts printed */}
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <div className="mb-4 flex items-baseline justify-between">
                  <SectionTitle>{t.intentBreakdown}</SectionTitle>
                  <span className="font-fw-mono text-app-mono text-app-ink-3">{totalIntents} total</span>
                </div>
                {data.intentBreakdown.length > 0 ? (
                  <ul className="space-y-3">
                    {data.intentBreakdown.map((item, i) => {
                      const pct = totalIntents > 0 ? Math.round((item.count / totalIntents) * 100) : 0;
                      return (
                        <li key={i} title={`${item.intent.replace(/_/g, ' ')}: ${item.count} (${pct}%)`}>
                          <div className="mb-1 flex items-center justify-between text-app-ui-sm">
                            <span className="capitalize text-app-ink-2">{item.intent.replace(/_/g, ' ')}</span>
                            <span className="font-fw-mono text-app-mono text-app-ink">{item.count} <span className="text-app-ink-3">· {pct}%</span></span>
                          </div>
                          <div className="h-2 bg-app-raised" aria-hidden>
                            <div className="h-full bg-app-accent transition-all duration-500" style={{ width: `${(item.count / maxIntent) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-app-ui-sm text-app-ink-3">No intent data yet</p>
                )}
              </section>

              {/* Response Time */}
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <SectionTitle className="mb-4">{t.responseTime}</SectionTitle>
                <div className="mb-5 grid grid-cols-3 gap-3">
                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-3">
                    <DataLabel>{t.avgResponseTime}</DataLabel>
                    <p className="mt-1 font-fw-display text-app-kpi font-normal text-app-accent">{formatTime(data.responseTimes.average)}</p>
                  </div>
                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-3">
                    <DataLabel>{t.fastest}</DataLabel>
                    <p className="mt-1 font-fw-display text-app-kpi font-normal text-app-ok-ink">{formatTime(data.responseTimes.fastest)}</p>
                  </div>
                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-3">
                    <DataLabel>{t.slowest}</DataLabel>
                    <p className="mt-1 font-fw-display text-app-kpi font-normal text-app-danger-ink">{formatTime(data.responseTimes.slowest)}</p>
                  </div>
                </div>

                {/* Trend: single-hue bars, value on hover */}
                {data.responseTimes.trend.length > 0 && (
                  <div>
                    <DataLabel className="mb-2">Trend</DataLabel>
                    <div className="flex h-20 items-end gap-0.5 border-b border-app-line-strong" role="img" aria-label={`Response time trend: ${data.responseTimes.trend.map(formatTime).join(', ')}`}>
                      {data.responseTimes.trend.map((time, i) => (
                        <div key={i} title={formatTime(time)} className="group relative flex h-full flex-1 items-end">
                          <div className="w-full rounded-t-[2px] bg-app-accent transition-all duration-500 group-hover:opacity-80" style={{ height: `${Math.max((time / maxTrend) * 100, 5)}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Priority Breakdown — semantic tones, label + count beside every bar */}
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <SectionTitle className="mb-4">{t.priorityBreakdown}</SectionTitle>
                {data.priorityBreakdown.length > 0 ? (
                  <ul className="space-y-3">
                    {data.priorityBreakdown.map((item, i) => {
                      const pct = totalPriority > 0 ? Math.round((item.count / totalPriority) * 100) : 0;
                      const tc = toneClass[priorityTone(item.priority)];
                      return (
                        <li key={i} title={`${item.priority}: ${item.count} (${pct}%)`}>
                          <div className="mb-1 flex items-center justify-between text-app-ui-sm">
                            <span className="flex items-center gap-2 capitalize text-app-ink-2"><span aria-hidden className={`size-2 rounded-full ${tc.dot}`} />{item.priority}</span>
                            <span className="font-fw-mono text-app-mono text-app-ink">{item.count} <span className="text-app-ink-3">· {pct}%</span></span>
                          </div>
                          <div className="h-2 bg-app-raised" aria-hidden>
                            <div className={`h-full transition-all duration-500 ${tc.dot}`} style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-app-ui-sm text-app-ink-3">No priority data yet</p>
                )}
              </section>

              {/* AI Insights */}
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <SectionTitle icon="sparkle" className="mb-4">{t.aiInsights}</SectionTitle>
                <div className="rounded-fw-btn border border-app-line bg-app-panel p-4">
                  <p className="text-app-ui leading-relaxed">
                    {data.stats.totalEmails > 0 ? (
                      <>
                        You&apos;ve processed <strong className="font-fw-mono font-semibold">{data.stats.totalEmails}</strong> emails with a <strong className="font-fw-mono font-semibold">{data.stats.automationRate}</strong> automation rate.
                        {data.stats.replied > 0 && ` Average response time is ${data.stats.avgResponseTime}.`}
                        {data.intentBreakdown[0] && ` Most common intent: ${data.intentBreakdown[0].intent.replace(/_/g, ' ')}.`}
                      </>
                    ) : (
                      'Start analyzing emails to get AI-powered insights!'
                    )}
                  </p>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
