'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import QuoteBuilderModal, { Quote } from '../components/QuoteBuilderModal';
import TrialBanner from '../components/TrialBanner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

type Language = 'en' | 'pt' | 'nl';
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

const NAV_ITEMS = [
  { href: '/dashboard',  label: { en: 'Inbox',      pt: 'Inbox',      nl: 'Inbox'      }, icon: 'Dashboard_inbox' },
  { href: '/shipments',  label: { en: 'Shipments',  pt: 'Embarques',  nl: 'Zendingen'  }, icon: 'Dashboard_tracking' },
  { href: '/quotes',     label: { en: 'Quotes',     pt: 'Cotações',   nl: 'Offertes'   }, icon: 'Dashboard_quotation' },
  { href: '/rates',      label: { en: 'Rates',      pt: 'Tarifas',    nl: 'Tarieven'   }, icon: 'Dashboard_quotation' },
  { href: '/analytics',  label: { en: 'Analytics',  pt: 'Analytics',  nl: 'Analytics'  }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team',       label: { en: 'Team',       pt: 'Equipa',     nl: 'Team'       }, icon: 'Dashboard_email_team' },
  { href: '/documents',  label: { en: 'Documents',  pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

const STATUS_TABS: { key: QuoteStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' }, { key: 'declined', label: 'Declined' }, { key: 'expired', label: 'Expired' },
];

const STATUS_PILL: Record<QuoteStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  accepted: 'bg-green-500/10 text-green-400 border-green-500/30',
  declined: 'bg-red-500/10 text-red-400 border-red-500/30',
  expired: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const MODE_ICONS: Record<string, string> = { ocean: '🚢', air: '✈️', road: '🚛', rail: '🚂', '': '📦' };

export default function QuotesPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [billingUrgent, setBillingUrgent] = useState(false);

  const theme = darkMode ? {
    bg: 'bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510]',
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white',
    textMuted: 'text-gray-400', textDim: 'text-gray-500',
    hover: 'hover:bg-white/5', iconFilter: { filter: 'brightness(0) invert(1)' },
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50', text: 'text-slate-900',
    textMuted: 'text-slate-600', textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50',
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

  const loadQuotes = useCallback((sid: string) => {
    fetch(`${API_URL}/api/quotes?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.quotes) setQuotes(d.quotes); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (session) loadQuotes(session); }, [session, loadQuotes]);

  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  const deleteQuote = async (id: string) => {
    setQuotes(prev => prev.filter(q => q.id !== id));
    try {
      await fetch(`${API_URL}/api/quotes/${id}?session=${session}`, { method: 'DELETE' });
      notify('success', 'Quote deleted');
    } catch { notify('error', 'Failed to delete quote'); }
  };

  const filtered = statusFilter === 'all' ? quotes : quotes.filter(q => q.status === statusFilter);

  const sentOrBeyond = quotes.filter(q => q.status !== 'draft');
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const acceptanceRate = sentOrBeyond.length ? Math.round((acceptedCount / sentOrBeyond.length) * 100) : 0;
  const totalValue = quotes.reduce((sum, q) => sum + (Number(q.sell_rate) || 0), 0);

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

          {user && (
            <Link href={`/billing?session=${session}`} className={`relative text-sm ${theme.textMuted} border ${theme.cardBorder} px-3 py-1.5 rounded-full ${theme.hover} transition`}>
              Billing
              {billingUrgent && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </Link>
          )}
          {user && <span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span>}
        </div>
      </header>

      <TrialBanner session={session} onSubscription={(sub) => setBillingUrgent(sub.plan === 'trial' && sub.trial_days_remaining < 3)} />

      <div className="p-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
          <Icon name="Dashboard_quotation" className="w-7 h-7" style={theme.iconFilter} />
          Quote History
        </h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Total Quotes Sent</p>
            <p className="text-2xl font-bold">{sentOrBeyond.length}</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Acceptance Rate</p>
            <p className="text-2xl font-bold">{acceptanceRate}%</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
            <p className={`text-xs ${theme.textDim} mb-1`}>Total Value Quoted</p>
            <p className="text-2xl font-bold">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className={`flex gap-1 p-1 mb-4 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl w-fit`}>
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${statusFilter === tab.key ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${theme.cardBorder} ${theme.textDim} text-xs uppercase tracking-wide`}>
                <th className="text-left px-4 py-3 font-medium">Quote #</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Route</th>
                <th className="text-left px-4 py-3 font-medium">Mode</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id} onClick={() => setEditingQuote(q)}
                  className={`border-b ${theme.cardBorder} last:border-0 cursor-pointer ${theme.hover}`}>
                  <td className="px-4 py-3 font-medium">FW-QUOTE-{(q.id || '').slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">{q.customer_name || '—'}</td>
                  <td className={`px-4 py-3 ${theme.textMuted}`}>{q.origin || '—'} → {q.destination || '—'}</td>
                  <td className="px-4 py-3">{MODE_ICONS[q.mode] || '📦'}</td>
                  <td className="px-4 py-3 font-medium">{q.currency} {Number(q.sell_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${STATUS_PILL[q.status] || STATUS_PILL.draft}`}>{q.status}</span>
                  </td>
                  <td className={`px-4 py-3 ${theme.textDim}`}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); if (q.id) deleteQuote(q.id); }}
                      className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">🗑️</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className={`px-4 py-10 text-center ${theme.textDim}`}>No quotes {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingQuote && (
        <QuoteBuilderModal
          darkMode={darkMode}
          session={session}
          initial={editingQuote}
          onClose={() => setEditingQuote(null)}
          onSaved={(q) => { setQuotes(prev => prev.map(x => x.id === q.id ? q : x)); }}
          onSent={(q) => { setQuotes(prev => prev.map(x => x.id === q.id ? q : x)); setEditingQuote(null); }}
        />
      )}
    </div>
  );
}
