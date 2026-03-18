'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://freightwizard-production.up.railway.app';

const formatTime = (minutes: number): string => {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

interface MemberStats {
  analyzed: number;
  replied: number;
  avgResponseTime: number;
  replyRate: number;
  uniqueCustomers: number;
  modeBreakdown: { ocean: number; air: number; road: number; rail: number; other: number };
  importExport: { import: number; export: number };
  intentBreakdown: Record<string, number>;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  stats: MemberStats;
}

interface LeaderboardData {
  leaderboard: Member[];
  currentUserId: string;
  isManager: boolean;
}

interface TeamProfile {
  role: string;
  team_id: string | null;
  teams: { name: string; invite_code: string } | null;
}

type Language = 'en' | 'pt' | 'nl';

const NAV_ITEMS = [
  { href: '/dashboard', label: { en: 'Inbox', pt: 'Caixa de Entrada', nl: 'Inbox' }, icon: 'Dashboard_analytics_total email' },
  { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' }, icon: 'Dashboard_email_team' },
  { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

export default function TeamPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [setupMode, setSetupMode] = useState<'create' | 'join' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const theme = darkMode ? {
    bg: 'bg-[#050510]',
    card: 'bg-[#0a0a1a]',
    cardBorder: 'border-white/5',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hover: 'hover:bg-white/5',
    input: 'bg-[#0f0f1f] border-white/10 text-white',
    iconFilter: { filter: 'brightness(0) invert(1)' },
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm',
    cardBorder: 'border-slate-200/50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50',
    input: 'bg-white border-slate-200 text-slate-900',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      setSession(sid);
      loadAll(sid);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const loadAll = async (sid: string, skipProfile = false) => {
    setLoading(true);
    if (!skipProfile) await loadProfile(sid);
    await loadLeaderboard(sid);
    setLoading(false);
  };

  const loadProfile = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/team?session=${sid}`);
      const data = await res.json();
      setProfile(data.profile);
      if (!data.profile?.team_id) setShowSetup(true);
      else setShowSetup(false);
    } catch (e) { console.error(e); }
  };

  const loadLeaderboard = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/team/leaderboard?session=${sid}`);
      const result = await res.json();
      if (!result.error) {
        setData(result);
        if (result.leaderboard?.length > 0) setSelected(result.leaderboard[0]);
      }
    } catch (e) { console.error(e); }
  };

  const createTeam = async () => {
    const currentSession = session || localStorage.getItem('fw_session');
    if (!teamName.trim() || !currentSession) return;
    setSetupLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession, teamName }),
      });
      const result = await res.json();
      if (result.team) {
        notify('success', 'Team created!');
        setShowSetup(false);
        setProfile((prev: any) => ({ ...prev, team_id: result.team.id, teams: result.team }));
        await loadAll(currentSession, true);
      } else {
        notify('error', result.error || 'Failed to create team');
      }
    } catch (e) { notify('error', 'Error creating team'); }
    setSetupLoading(false);
  };

  const joinTeam = async () => {
    const currentSession = session || localStorage.getItem('fw_session');
    if (!inviteCode.trim() || !currentSession) return;
    setSetupLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/team/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession, inviteCode }),
      });
      const result = await res.json();
      if (result.team) {
        notify('success', `Joined ${result.team.name}!`);
        setShowSetup(false);
        setProfile((prev: any) => ({ ...prev, team_id: result.team.id, teams: result.team }));
        await loadAll(currentSession, true);
      } else {
        notify('error', result.error || 'Invalid invite code');
      }
    } catch (e) { notify('error', 'Error joining team'); }
    setSetupLoading(false);
  };

  const copyInviteCode = () => {
    const code = profile?.teams?.invite_code;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getMedalBg = (index: number) => {
    if (index === 0) return 'border-yellow-400/30 bg-yellow-400/5';
    if (index === 1) return 'border-gray-300/30 bg-gray-300/5';
    if (index === 2) return 'border-orange-400/30 bg-orange-400/5';
    return `${theme.card} ${theme.cardBorder}`;
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

  if (loading) return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center`}>
      <div className="w-10 h-10 border-4 border-[#5200FF] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-3 flex items-center justify-between sticky top-0 z-40`}>
        {/* Logo */}
        <Link href={`/dashboard?session=${session}`} className="flex items-center gap-2 flex-shrink-0">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
          <span className="text-base font-bold">FreightWizard</span>
        </Link>

        {/* Right: Nav + Controls */}
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map(item => (
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

          <div className={`w-px h-5 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />

          {/* Invite button for managers */}
          {profile?.teams && profile.role === 'manager' && (
            <button onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white">
              <Icon name="Dashboard_team_crown" className="w-3.5 h-3.5" style={{ filter: 'brightness(0) invert(1)' }} />
              Invite
            </button>
          )}

          {/* Language */}
          <div className="relative">
            <button onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover} flex items-center gap-1`}>
              {language.toUpperCase()} <span className="text-xs">▼</span>
            </button>
            {langMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>
                {(['en', 'pt', 'nl'] as Language[]).map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    className={`w-full px-4 py-2 text-left text-sm ${theme.hover} ${language === l ? 'text-[#9E14FB] font-medium' : theme.textMuted}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme */}
          <button onClick={toggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
            {darkMode
              ? <Icon name="Dashboard_team_sun_light_mode" className="w-4 h-4" style={theme.iconFilter} />
              : <Icon name="Dashboard_team_moon_dark_mode" className="w-4 h-4" style={theme.iconFilter} />
            }
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-8 max-w-md w-full shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Invite Team Members</h2>
                <button onClick={() => setShowInviteModal(false)} className={`${theme.textMuted} hover:text-white text-xl`}>✕</button>
              </div>
              <p className={`text-sm ${theme.textMuted} mb-4`}>Share this code with your team members so they can join:</p>
              <div className={`flex items-center gap-3 p-4 ${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl border ${theme.cardBorder} mb-4`}>
                <span className="text-3xl font-mono font-bold bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] bg-clip-text text-transparent flex-1">
                  {profile?.teams?.invite_code}
                </span>
                <button onClick={copyInviteCode}
                  className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-lg text-white text-sm font-medium">
                  {copiedCode ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p className={`text-xs ${theme.textDim}`}>Team members enter this code when they visit the Team page for the first time.</p>
            </div>
          </div>
        )}

        {/* Setup Modal */}
        {showSetup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-8 max-w-md w-full shadow-2xl`}>
              <h2 className="text-2xl font-bold mb-2">Join or Create a Team</h2>
              <p className={`${theme.textMuted} mb-6 text-sm`}>Connect with your colleagues to see the leaderboard.</p>
              {!setupMode ? (
                <div className="flex flex-col gap-3">
                  <button onClick={() => setSetupMode('create')}
                    className="w-full py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl font-medium text-white flex items-center justify-center gap-2">
                    <Icon name="Dashboard_team_crown" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
                    Create a Team (Manager)
                  </button>
                  <button onClick={() => setSetupMode('join')}
                    className={`w-full py-4 border ${theme.cardBorder} rounded-xl font-medium ${theme.hover} flex items-center justify-center gap-2`}>
                    <Icon name="Dashboard_team_employee" className="w-5 h-5" style={theme.iconFilter} />
                    Join with Invite Code
                  </button>
                </div>
              ) : setupMode === 'create' ? (
                <div>
                  <button onClick={() => setSetupMode(null)} className={`text-sm ${theme.textMuted} mb-4 flex items-center gap-1`}>← Back</button>
                  <label className={`text-sm ${theme.textMuted} mb-2 block`}>Team Name</label>
                  <input value={teamName} onChange={e => setTeamName(e.target.value)}
                    placeholder="e.g. Rotterdam Freight Team"
                    className={`w-full px-4 py-3 rounded-xl border ${theme.input} mb-4 focus:outline-none focus:border-[#5200FF]`} />
                  <button onClick={createTeam} disabled={setupLoading || !teamName.trim()}
                    className="w-full py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl font-medium text-white disabled:opacity-50">
                    {setupLoading ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              ) : (
                <div>
                  <button onClick={() => setSetupMode(null)} className={`text-sm ${theme.textMuted} mb-4 flex items-center gap-1`}>← Back</button>
                  <label className={`text-sm ${theme.textMuted} mb-2 block`}>Invite Code</label>
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FW-X7K2"
                    className={`w-full px-4 py-3 rounded-xl border ${theme.input} mb-4 focus:outline-none focus:border-[#5200FF] font-mono`} />
                  <button onClick={joinTeam} disabled={setupLoading || !inviteCode.trim()}
                    className="w-full py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl font-medium text-white disabled:opacity-50">
                    {setupLoading ? 'Joining...' : 'Join Team'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Header */}
        {profile?.teams && (
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{profile.teams.name}</h1>
              <p className={`${theme.textMuted} text-sm mt-1`}>
                {data?.leaderboard.length || 0} members •{' '}
                {profile.role === 'manager' ? (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="Dashboard_team_crown" className="w-3 h-3" style={theme.iconFilter} /> Manager
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="Dashboard_team_employee" className="w-3 h-3" style={theme.iconFilter} /> Employee
                  </span>
                )}
              </p>
            </div>
            {profile.role !== 'manager' && (
              <div className={`px-4 py-2 ${theme.card} border ${theme.cardBorder} rounded-full text-sm ${theme.textMuted}`}>
                Your rank: #{(data?.leaderboard.findIndex(m => m.id === data.currentUserId) || 0) + 1}
              </div>
            )}
          </div>
        )}

        {!data || data.leaderboard.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Icon name="Dashboard_team_employee" className="w-16 h-16 mx-auto mb-4" style={theme.iconFilter} />
              <p className={`${theme.textMuted} mb-2`}>No team members yet.</p>
              <p className={`text-sm ${theme.textDim}`}>Share your invite code to add teammates.</p>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Leaderboard */}
            <div className="space-y-3">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Icon name="Dashboard_team_ranking" className="w-5 h-5" style={theme.iconFilter} />
                Rankings
              </h2>
              {data.leaderboard.map((member, index) => (
                <div key={member.id} onClick={() => setSelected(member)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selected?.id === member.id
                      ? 'border-[#5200FF]/50 bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10'
                      : `${getMedalBg(index)} ${theme.hover}`
                  } ${member.id === data.currentUserId ? 'ring-1 ring-[#5200FF]/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex items-center justify-center">
                      {index < 3 ? (
                        <Icon name="Dashboard_team_medal" className="w-7 h-7"
                          style={{ filter: index === 0
                            ? 'brightness(0) saturate(100%) invert(83%) sepia(61%) saturate(1000%) hue-rotate(0deg) brightness(103%) contrast(101%)'
                            : index === 1
                            ? 'brightness(0) saturate(100%) invert(80%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%)'
                            : 'brightness(0) saturate(100%) invert(60%) sepia(40%) saturate(800%) hue-rotate(0deg) brightness(90%)'
                          }} />
                      ) : (
                        <span className={`text-sm font-bold ${theme.textDim}`}>#{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{member.name}</p>
                        {member.id === data.currentUserId && <span className="text-xs px-2 py-0.5 bg-[#5200FF]/20 text-[#9E14FB] rounded-full">You</span>}
                        {member.role === 'manager' && <Icon name="Dashboard_team_crown" className="w-3 h-3" style={theme.iconFilter} />}
                      </div>
                      <p className={`text-xs ${theme.textDim} truncate`}>{member.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{member.stats.analyzed}</p>
                      <p className={`text-xs ${theme.textDim}`}>analyzed</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-medium">{member.stats.replyRate}%</p>
                      <p className={`text-xs ${theme.textDim}`}>reply rate</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatTime(member.stats.avgResponseTime)}</p>
                      <p className={`text-xs ${theme.textDim}`}>avg time</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.stats.uniqueCustomers}</p>
                      <p className={`text-xs ${theme.textDim}`}>customers</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail Panel */}
            {selected && (
              <div className="lg:col-span-2 space-y-4">
                <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 flex items-center justify-center">
                        <Icon name={selected.role === 'manager' ? 'Dashboard_team_crown' : 'Dashboard_team_employee'} className="w-6 h-6" style={theme.iconFilter} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selected.name}</h2>
                        <p className={`text-sm ${theme.textMuted}`}>{selected.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${theme.textMuted}`}>Rank</p>
                      <p className="text-3xl font-bold">#{(data.leaderboard.findIndex(m => m.id === selected.id) || 0) + 1}</p>
                    </div>
                  </div>

                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Emails Analyzed', value: selected.stats.analyzed, icon: 'Dashboard_team_Emails_Analyzed' },
                      { label: 'Replies Sent', value: selected.stats.replied, icon: 'Dashboard_team_Replies_Sent' },
                      { label: 'Reply Rate', value: `${selected.stats.replyRate}%`, icon: 'Dashboard_team_reply_Rate' },
                      { label: 'Avg Response', value: formatTime(selected.stats.avgResponseTime), icon: 'Dashboard_team_Avg-Response' },
                    ].map((kpi, i) => (
                      <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-4 text-center`}>
                        <div className="w-8 h-8 mx-auto mb-2 p-1.5 rounded-lg bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                          <Icon name={kpi.icon} className="w-full h-full" style={theme.iconFilter} />
                        </div>
                        <p className="text-xl font-bold">{kpi.value}</p>
                        <p className={`text-xs ${theme.textDim}`}>{kpi.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Transport Mode */}
                  <div className="mb-6">
                    <h3 className={`text-sm font-semibold ${theme.textMuted} mb-3 uppercase tracking-wider`}>Transport Mode</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { mode: 'ocean', icon: 'Dashboard_team_ocean', color: '#1BA1FF' },
                        { mode: 'air', icon: 'Dashboard_team_air', color: '#9E14FB' },
                        { mode: 'road', icon: 'Dashboard_team_road', color: '#00D4AA' },
                        { mode: 'rail', icon: 'Dashboard_team_rail', color: '#FFB84D' },
                      ].map(({ mode, icon, color }) => (
                        <div key={mode} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3 text-center`}>
                          <div className="w-8 h-8 mx-auto mb-2">
                            <Icon name={icon} className="w-full h-full" style={theme.iconFilter} />
                          </div>
                          <p className="text-lg font-bold" style={{ color }}>
                            {selected.stats.modeBreakdown[mode as keyof typeof selected.stats.modeBreakdown] || 0}
                          </p>
                          <p className={`text-xs ${theme.textDim} capitalize`}>{mode}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Import vs Export */}
                  <div className="mb-6">
                    <h3 className={`text-sm font-semibold ${theme.textMuted} mb-3 uppercase tracking-wider`}>Import / Export</h3>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>🟢 Import</span>
                          <span>{selected.stats.importExport.import}</span>
                        </div>
                        <div className={`h-3 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-full overflow-hidden`}>
                          <div className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${selected.stats.analyzed > 0 ? (selected.stats.importExport.import / selected.stats.analyzed) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>🔵 Export</span>
                          <span>{selected.stats.importExport.export}</span>
                        </div>
                        <div className={`h-3 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-full overflow-hidden`}>
                          <div className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${selected.stats.analyzed > 0 ? (selected.stats.importExport.export / selected.stats.analyzed) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customers */}
                  <div>
                    <h3 className={`text-sm font-semibold ${theme.textMuted} mb-3 uppercase tracking-wider`}>Customers</h3>
                    <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-4 flex items-center justify-between`}>
                      <div>
                        <p className="text-3xl font-bold">{selected.stats.uniqueCustomers}</p>
                        <p className={`text-sm ${theme.textDim}`}>Unique customers handled</p>
                      </div>
                      <div className="w-12 h-12">
                        <Icon name="Dasboard_team_customers" className="w-full h-full" style={theme.iconFilter} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}