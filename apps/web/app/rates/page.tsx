'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

type Language = 'en' | 'pt' | 'nl';

export interface RateCard {
  id?: string;
  session_id?: string;
  origin: string;
  destination: string;
  mode: string;
  carrier: string;
  container_type: string;
  buy_rate: number | null;
  sell_rate: number | null;
  currency: string;
  transit_time: string;
  validity_start: string | null;
  validity_end: string | null;
  notes: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const EMPTY_RATE: RateCard = {
  origin: '', destination: '', mode: 'ocean', carrier: '', container_type: '',
  buy_rate: null, sell_rate: null, currency: 'USD', transit_time: '',
  validity_start: null, validity_end: null, notes: '', is_active: true,
};

const NAV_ITEMS = [
  { href: '/dashboard',  label: { en: 'Inbox',      pt: 'Inbox',      nl: 'Inbox'      }, icon: 'Dashboard_inbox' },
  { href: '/shipments',  label: { en: 'Shipments',  pt: 'Embarques',  nl: 'Zendingen'  }, icon: 'Dashboard_tracking' },
  { href: '/quotes',     label: { en: 'Quotes',     pt: 'Cotações',   nl: 'Offertes'   }, icon: 'Dashboard_quotation' },
  { href: '/rates',      label: { en: 'Rates',      pt: 'Tarifas',    nl: 'Tarieven'   }, icon: 'Dashboard_quotation' },
  { href: '/analytics',  label: { en: 'Analytics',  pt: 'Analytics',  nl: 'Analytics'  }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team',       label: { en: 'Team',       pt: 'Equipa',     nl: 'Team'       }, icon: 'Dashboard_email_team' },
  { href: '/documents',  label: { en: 'Documents',  pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

const MODE_OPTIONS = ['ocean', 'air', 'road', 'rail'];
const MODE_ICONS: Record<string, string> = { ocean: '🚢', air: '✈️', road: '🚛', rail: '🚂', '': '📦' };

function marginPct(r: RateCard): number | null {
  if (r.buy_rate == null || r.sell_rate == null || r.buy_rate === 0) return null;
  return ((r.sell_rate - r.buy_rate) / r.buy_rate) * 100;
}

function marginColor(pct: number): string {
  if (pct > 20) return 'text-green-400';
  if (pct >= 10) return 'text-yellow-400';
  return 'text-red-400';
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.ceil(ms / 86400000);
}

function validityInfo(r: RateCard): { label: string; color: string } {
  if (!r.validity_end) return { label: 'Active', color: 'text-green-400' };
  const days = daysUntil(r.validity_end);
  if (days < 0) return { label: 'Expired', color: 'text-red-400' };
  if (days <= 30) return { label: `Expires in ${days}d`, color: 'text-orange-400' };
  return { label: 'Active', color: 'text-green-400' };
}

export default function RatesPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [rates, setRates] = useState<RateCard[]>([]);
  const [filterMode, setFilterMode] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RateCard>({ ...EMPTY_RATE });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const theme = darkMode ? {
    bg: 'bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510]',
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white',
    textMuted: 'text-gray-400', textDim: 'text-gray-500',
    hover: 'hover:bg-white/5', input: 'bg-[#0f0f1f] border-white/10 text-white placeholder-gray-600',
    iconFilter: { filter: 'brightness(0) invert(1)' },
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50', text: 'text-slate-900',
    textMuted: 'text-slate-600', textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50', input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);

    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      setSession(sid);
      fetch(`${API_URL}/api/auth/status?session=${sid}`)
        .then(r => r.json())
        .then(d => { if (d.authenticated) setUser({ email: d.email, name: d.name }); })
        .catch(() => {});
    }
  }, [searchParams]);

  const loadRates = useCallback((sid: string) => {
    fetch(`${API_URL}/api/rates?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.rates) setRates(d.rates); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (session) loadRates(session); }, [session, loadRates]);

  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  const openAdd = () => { setForm({ ...EMPTY_RATE }); setEditingId(null); setShowForm(true); };
  const openEdit = (r: RateCard) => { setForm({ ...r }); setEditingId(r.id || null); setShowForm(true); };

  const saveRate = async () => {
    if (!form.origin.trim() || !form.destination.trim() || !form.mode || !form.carrier.trim()) {
      notify('error', 'Origin, destination, mode, and carrier are required');
      return;
    }
    try {
      if (editingId) {
        await fetch(`${API_URL}/api/rates/${editingId}?session=${session}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        notify('success', 'Rate card updated!');
      } else {
        await fetch(`${API_URL}/api/rates?session=${session}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, session_id: session }),
        });
        notify('success', 'Rate card added!');
      }
      if (session) loadRates(session); // stay on the page, just refresh the list
    } catch (e) { notify('error', 'Failed to save rate card'); }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_RATE });
  };

  const toggleActive = async (r: RateCard) => {
    if (!r.id) return;
    setRates(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
    try {
      await fetch(`${API_URL}/api/rates/${r.id}?session=${session}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !r.is_active }),
      });
    } catch (e) { notify('error', 'Failed to update rate card'); }
  };

  const deleteRate = async (r: RateCard) => {
    if (!r.id) return;
    setRates(prev => prev.filter(x => x.id !== r.id));
    try {
      await fetch(`${API_URL}/api/rates/${r.id}?session=${session}`, { method: 'DELETE' });
      notify('success', 'Rate card deleted');
    } catch (e) { notify('error', 'Failed to delete rate card'); }
  };

  const carriers = useMemo(() => Array.from(new Set(rates.map(r => r.carrier).filter(Boolean))).sort(), [rates]);

  const filtered = rates.filter(r => {
    if (filterMode && r.mode !== filterMode) return false;
    if (filterCarrier && r.carrier !== filterCarrier) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.origin.toLowerCase().includes(q) && !r.destination.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const expiringRates = rates.filter(r => r.validity_end && daysUntil(r.validity_end) >= 0 && daysUntil(r.validity_end) <= 30);
  const totalActive = rates.filter(r => r.is_active).length;
  const totalCarriers = carriers.length;

  const form_margin = marginPct(form);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white text-sm ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-3 flex items-center justify-between sticky top-0 z-40`}>
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
          <span className="text-base font-bold">FreightWizard</span>
        </Link>

        <div className="flex items-center gap-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={`${item.href}?session=${session}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/40'
                  : `border border-transparent ${darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`
              }`}>
              <Icon name={item.icon} className="w-3.5 h-3.5" style={theme.iconFilter} />
              {item.label[language]}
            </Link>
          ))}

          <div className={`w-px h-5 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />

          <div className="relative">
            <button onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover} flex items-center gap-1`}>
              {langLabels[language]} <span className="text-xs">▾</span>
            </button>
            {langMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>
                {(['en', 'pt', 'nl'] as Language[]).map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    className={`w-full px-4 py-2 text-left text-sm ${theme.hover} ${language === l ? 'text-[#9E14FB] font-medium' : theme.textMuted}`}>
                    {langLabels[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
            {darkMode
              ? <Icon name="Dashboard_sun_light_mode" className="w-4 h-4" style={theme.iconFilter} />
              : <Icon name="Dashboard_moon_dark_mode" className="w-4 h-4" style={theme.iconFilter} />
            }
          </button>

          {user && <span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span>}
        </div>
      </header>

      <TrialBanner session={session} />

      <div className="p-4">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon name="Dashboard_quotation" className="w-7 h-7" style={theme.iconFilter} />
              Rate Cards
            </h1>
            <p className={`text-sm ${theme.textMuted} mt-0.5`}>Your negotiated carrier rates, ready to suggest into quotes</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium">
            + Add Rate
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Active Rates</p>
            <p className="text-2xl font-bold">{totalActive}</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Expiring This Month</p>
            <p className={`text-2xl font-bold ${expiringRates.length > 0 ? 'text-orange-400' : ''}`}>{expiringRates.length}</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Carriers</p>
            <p className="text-2xl font-bold">{totalCarriers}</p>
          </div>
        </div>

        {/* Expiry warning banner */}
        {expiringRates.length > 0 && (
          <div className={`mb-4 p-4 rounded-2xl border border-orange-500/30 ${darkMode ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
            <p className="text-sm font-semibold text-orange-400 mb-2">
              ⚠️ {expiringRates.length} rate card{expiringRates.length > 1 ? 's' : ''} expire{expiringRates.length === 1 ? 's' : ''} within 30 days — review and update {expiringRates.length > 1 ? 'them' : 'it'} to keep your quotes accurate
            </p>
            <div className="space-y-1">
              {expiringRates.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className={theme.textMuted}>{r.origin} → {r.destination} · {r.carrier} · {r.validity_end && validityInfo(r).label}</span>
                  <button onClick={() => openEdit(r)} className="text-[#9E14FB] hover:underline">Edit →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className={`flex gap-1 p-1 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl`}>
            {['', ...MODE_OPTIONS].map(m => (
              <button key={m || 'all'} onClick={() => setFilterMode(m)}
                className={`px-3 py-1.5 text-xs rounded-lg transition font-medium capitalize ${filterMode === m ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
                {m ? `${MODE_ICONS[m]} ${m}` : 'All'}
              </button>
            ))}
          </div>
          <select value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)}
            className={`px-3 py-2 rounded-xl border ${theme.cardBorder} ${theme.card} ${theme.text} text-sm focus:outline-none focus:border-[#5200FF] cursor-pointer`}>
            <option value="">All carriers</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search origin or destination..."
            className={`px-3 py-2 rounded-xl border ${theme.cardBorder} ${theme.card} ${theme.text} text-sm focus:outline-none focus:border-[#5200FF] w-56`} />
        </div>

        {/* Table / empty state */}
        {rates.length === 0 ? (
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-12 text-center`}>
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold mb-1">No rate cards yet</p>
            <p className={`text-sm ${theme.textDim} mb-4`}>Add your first rate to get AI-powered suggestions in the Quote Builder</p>
            <button onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium">
              + Add Rate
            </button>
          </div>
        ) : (
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${theme.cardBorder} ${theme.textDim} text-xs uppercase tracking-wide`}>
                  <th className="text-left px-4 py-3 font-medium">Route</th>
                  <th className="text-left px-4 py-3 font-medium">Mode</th>
                  <th className="text-left px-4 py-3 font-medium">Carrier</th>
                  <th className="text-left px-4 py-3 font-medium">Container</th>
                  <th className="text-left px-4 py-3 font-medium">Buy</th>
                  <th className="text-left px-4 py-3 font-medium">Sell</th>
                  <th className="text-left px-4 py-3 font-medium">Margin</th>
                  <th className="text-left px-4 py-3 font-medium">Transit</th>
                  <th className="text-left px-4 py-3 font-medium">Validity</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const margin = marginPct(r);
                  const validity = validityInfo(r);
                  return (
                    <tr key={r.id} className={`border-b ${theme.cardBorder} last:border-0 ${!r.is_active ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                      <td className="px-4 py-3">{MODE_ICONS[r.mode] || '📦'}</td>
                      <td className="px-4 py-3">{r.carrier}</td>
                      <td className={`px-4 py-3 ${theme.textMuted}`}>{r.container_type || '—'}</td>
                      <td className="px-4 py-3">{r.buy_rate != null ? `${r.currency} ${Number(r.buy_rate).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 font-medium">{r.sell_rate != null ? `${r.currency} ${Number(r.sell_rate).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3">{margin != null ? <span className={`font-medium ${marginColor(margin)}`}>{margin.toFixed(0)}%</span> : '—'}</td>
                      <td className={`px-4 py-3 ${theme.textMuted}`}>{r.transit_time || '—'}</td>
                      <td className={`px-4 py-3 font-medium ${validity.color}`}>{validity.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className={`text-xs px-2 py-1 rounded-lg ${theme.hover} ${theme.textMuted}`} title="Edit">✏️</button>
                          <button onClick={() => toggleActive(r)} className={`text-xs px-2 py-1 rounded-lg ${theme.hover} ${theme.textMuted}`} title={r.is_active ? 'Deactivate' : 'Activate'}>{r.is_active ? '⏸️' : '▶️'}</button>
                          <button onClick={() => deleteRate(r)} className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className={`px-4 py-10 text-center ${theme.textDim}`}>No rate cards match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.cardBorder} sticky top-0 ${theme.card} z-10`}>
              <h2 className="font-bold text-lg">{editingId ? 'Edit Rate Card' : 'Add Rate Card'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_RATE }); }} className={`${theme.textDim} hover:text-white text-xl`}>✕</button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Origin *</label>
                <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                  placeholder="e.g. Santos, BR"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Destination *</label>
                <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g. Rotterdam, NL"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Mode *</label>
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  {MODE_OPTIONS.map(m => <option key={m} value={m}>{MODE_ICONS[m]} {m[0].toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Carrier *</label>
                <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                  placeholder="e.g. Maersk"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Container Type</label>
                <input value={form.container_type} onChange={e => setForm(f => ({ ...f, container_type: e.target.value }))}
                  placeholder="e.g. 40HC, LCL, per kg"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Buy Rate</label>
                <input type="number" value={form.buy_rate ?? ''} onChange={e => setForm(f => ({ ...f, buy_rate: e.target.value === '' ? null : Number(e.target.value) }))}
                  placeholder="What you pay the carrier"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Sell Rate</label>
                <input type="number" value={form.sell_rate ?? ''} onChange={e => setForm(f => ({ ...f, sell_rate: e.target.value === '' ? null : Number(e.target.value) }))}
                  placeholder="What you charge the customer"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {form_margin != null && (
                <div className="col-span-2">
                  <p className={`text-sm font-medium ${marginColor(form_margin)}`}>Margin: {form_margin.toFixed(1)}%</p>
                </div>
              )}

              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Transit Time</label>
                <input value={form.transit_time} onChange={e => setForm(f => ({ ...f, transit_time: e.target.value }))}
                  placeholder="e.g. 25-30 days"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div />
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Valid From (optional)</label>
                <input type="date" value={form.validity_start || ''} onChange={e => setForm(f => ({ ...f, validity_start: e.target.value || null }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Valid Until (optional)</label>
                <input type="date" value={form.validity_end || ''} onChange={e => setForm(f => ({ ...f, validity_end: e.target.value || null }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              <div className="col-span-2">
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Any special conditions..."
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none`} />
              </div>
            </div>

            <div className={`flex gap-3 px-6 py-4 border-t ${theme.cardBorder}`}>
              <button onClick={saveRate}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium">
                {editingId ? 'Save Changes' : 'Add Rate'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_RATE }); }}
                className={`px-6 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
