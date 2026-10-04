'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
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

const API_URL = 'https://freightwizard-production.up.railway.app';

const formatTime = (minutes: number): string => {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

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
  const [billingUrgent, setBillingUrgent] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [setupMode, setSetupMode] = useState<'create' | 'join' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);


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
    <div data-theme={darkMode ? 'dark' : 'light'} className={`${appRootClass} flex items-center justify-center`}>
      <Spinner className="size-8 text-app-accent" />
    </div>
  );

  const rankOf = (id: string) => (data?.leaderboard.findIndex(m => m.id === id) ?? 0) + 1;

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={null} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} alert={billingUrgent} />

      <TrialBanner session={session} onSubscription={(sub) => setBillingUrgent(sub.plan === 'trial' && sub.trial_days_remaining < 3)} />

      <main className="mx-auto max-w-7xl p-4 lg:p-6">

        {/* Invite Modal */}
        {showInviteModal && (
          <Modal title="Invite Team Members" icon="team" onClose={() => setShowInviteModal(false)}>
            <div className="space-y-4 p-5">
              <p className="text-app-ui text-app-ink-2">Share this code with your team members so they can join:</p>
              <div className="flex items-center gap-3 rounded-fw-card border border-app-line bg-app-panel p-4">
                <span className="flex-1 font-fw-mono text-[1.75rem] font-medium tracking-wider text-app-accent">{profile?.teams?.invite_code}</span>
                <Button variant="primary" icon={copiedCode ? 'check' : 'copy'} onClick={copyInviteCode}>{copiedCode ? 'Copied!' : 'Copy'}</Button>
              </div>
              <p className="text-app-ui-sm text-app-ink-3">Team members enter this code when they visit the Team page for the first time.</p>
            </div>
          </Modal>
        )}

        {/* Setup Modal */}
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-fw-card border border-app-line bg-app-card p-6 shadow-app-pop">
              <h2 className="mb-1 font-fw-display text-app-title-sm font-normal">Join or Create a Team</h2>
              <p className="mb-5 text-app-ui text-app-ink-2">Connect with your colleagues to see the leaderboard.</p>
              {!setupMode ? (
                <div className="flex flex-col gap-3">
                  <Button variant="primary" size="lg" icon="owner" className="w-full" onClick={() => setSetupMode('create')}>Create a Team (Manager)</Button>
                  <Button size="lg" icon="user" className="w-full" onClick={() => setSetupMode('join')}>Join with Invite Code</Button>
                </div>
              ) : setupMode === 'create' ? (
                <div className="space-y-4">
                  <Button variant="ghost" size="xs" icon="arrow-left" onClick={() => setSetupMode(null)}>Back</Button>
                  <Field label="Team Name">
                    <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Rotterdam Freight Team" className={inputClass} />
                  </Field>
                  <Button variant="primary" className="w-full" onClick={createTeam} disabled={setupLoading || !teamName.trim()}>{setupLoading ? 'Creating...' : 'Create Team'}</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button variant="ghost" size="xs" icon="arrow-left" onClick={() => setSetupMode(null)}>Back</Button>
                  <Field label="Invite Code">
                    <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="e.g. FW-X7K2" className={`${inputClass} font-fw-mono`} />
                  </Field>
                  <Button variant="primary" className="w-full" onClick={joinTeam} disabled={setupLoading || !inviteCode.trim()}>{setupLoading ? 'Joining...' : 'Join Team'}</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Header */}
        {profile?.teams && (
          <PageHeader
            className="mb-6"
            title={profile.teams.name}
            description={
              <span className="inline-flex items-center gap-2">
                <span><span className="font-fw-mono">{data?.leaderboard.length || 0}</span> members</span>
                <span className="text-app-ink-3">·</span>
                <span className="inline-flex items-center gap-1"><Icon name={profile.role === 'manager' ? 'owner' : 'user'} size={14} className="text-app-ink-3" />{profile.role === 'manager' ? 'Manager' : 'Employee'}</span>
              </span>
            }
            actions={<>
              {profile.role !== 'manager' && data && (
                <Chip className="h-9 px-3 text-app-ui">Your rank: <span className="font-fw-mono">#{rankOf(data.currentUserId)}</span></Chip>
              )}
              {profile.role === 'manager' && (
                <Button variant="primary" icon="team" onClick={() => setShowInviteModal(true)}>Invite</Button>
              )}
            </>}
          />
        )}

        {!data || data.leaderboard.length === 0 ? (
          <div className="rounded-fw-card border border-app-line bg-app-card">
            <EmptyState icon="team" title="No team members yet." text="Share your invite code to add teammates." />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Leaderboard */}
            <div className="space-y-2">
              <SectionTitle icon="analytics" className="mb-3">Rankings</SectionTitle>
              {data.leaderboard.map((member, index) => (
                <button key={member.id} type="button" onClick={() => setSelected(member)}
                  className={`w-full rounded-fw-card border p-4 text-left transition-colors ${
                    selected?.id === member.id ? 'border-app-accent-fill bg-app-selected' : 'border-app-line bg-app-card hover:bg-app-raised'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex size-8 flex-none items-center justify-center rounded-fw-btn border font-fw-mono text-app-mono ${index < 3 ? 'border-transparent bg-app-accent-bg text-app-accent-ink' : 'border-app-line text-app-ink-3'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-app-ui font-medium">{member.name}</p>
                        {member.id === data.currentUserId && <Tag tone="accent">You</Tag>}
                        {member.role === 'manager' && <Icon name="owner" size={13} className="text-app-ink-3" />}
                      </div>
                      <p className="truncate text-app-ui-sm text-app-ink-3">{member.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-fw-mono text-app-mono font-semibold">{member.stats.analyzed}</p>
                      <p className="text-app-ui-sm text-app-ink-3">analyzed</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-app-line pt-3 text-center">
                    <div><p className="font-fw-mono text-app-mono">{member.stats.replyRate}%</p><p className="text-app-ui-sm text-app-ink-3">reply rate</p></div>
                    <div><p className="font-fw-mono text-app-mono">{formatTime(member.stats.avgResponseTime)}</p><p className="text-app-ui-sm text-app-ink-3">avg time</p></div>
                    <div><p className="font-fw-mono text-app-mono">{member.stats.uniqueCustomers}</p><p className="text-app-ui-sm text-app-ink-3">customers</p></div>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail Panel */}
            {selected && (
              <section className="space-y-5 rounded-fw-card border border-app-line bg-app-card p-5 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
                      <Icon name={selected.role === 'manager' ? 'owner' : 'user'} size={20} />
                    </span>
                    <div>
                      <h2 className="font-fw-display text-app-title-sm font-normal">{selected.name}</h2>
                      <p className="text-app-ui-sm text-app-ink-2">{selected.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <DataLabel>Rank</DataLabel>
                    <p className="font-fw-display text-app-kpi font-normal">#{rankOf(selected.id)}</p>
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Emails Analyzed" value={selected.stats.analyzed} icon="sparkle" />
                  <Stat label="Replies Sent" value={selected.stats.replied} icon="reply" />
                  <Stat label="Reply Rate" value={`${selected.stats.replyRate}%`} icon="check" />
                  <Stat label="Avg Response" value={formatTime(selected.stats.avgResponseTime)} icon="clock" />
                </div>

                {/* Transport Mode */}
                <div>
                  <DataLabel className="mb-2">Transport Mode</DataLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {(['ocean', 'air', 'road', 'rail'] as const).map(mode => (
                      <div key={mode} className="rounded-fw-btn border border-app-line bg-app-panel p-3 text-center">
                        <Icon name={mode} size={20} className="mx-auto mb-1.5 text-app-accent" />
                        <p className="font-fw-mono text-app-mono font-semibold">{selected.stats.modeBreakdown[mode] || 0}</p>
                        <p className="text-app-ui-sm capitalize text-app-ink-3">{mode}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Import vs Export */}
                <div>
                  <DataLabel className="mb-2">Import / Export</DataLabel>
                  <div className="flex gap-4">
                    {([
                      { label: 'Import', value: selected.stats.importExport.import },
                      { label: 'Export', value: selected.stats.importExport.export },
                    ]).map(row => (
                      <div key={row.label} className="flex-1">
                        <div className="mb-1 flex justify-between text-app-ui-sm">
                          <span className="text-app-ink-2">{row.label}</span>
                          <span className="font-fw-mono">{row.value}</span>
                        </div>
                        <div className="h-2 bg-app-raised" aria-hidden>
                          <div className="h-full bg-app-accent transition-all" style={{ width: `${selected.stats.analyzed > 0 ? (row.value / selected.stats.analyzed) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customers */}
                <div>
                  <DataLabel className="mb-2">Customers</DataLabel>
                  <div className="flex items-center justify-between rounded-fw-btn border border-app-line bg-app-panel p-4">
                    <div>
                      <p className="font-fw-display text-app-kpi font-normal">{selected.stats.uniqueCustomers}</p>
                      <p className="text-app-ui-sm text-app-ink-3">Unique customers handled</p>
                    </div>
                    <Icon name="building" size={28} className="text-app-accent" />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
