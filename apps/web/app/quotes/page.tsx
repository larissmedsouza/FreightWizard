'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import QuoteBuilderModal, { Quote } from '../components/QuoteBuilderModal';
import TrialBanner from '../components/TrialBanner';
import Icon from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import { appRootClass, PageHeader, EmptyState, Notice, ColumnHeader } from '../components/ui/Panel';
import { Button, Spinner } from '../components/ui/Button';
import { inputClass, selectClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, Chip } from '../components/ui/Tag';
import { Toast, Stat, Segmented, DataTable, SearchField, Route, th, td, tdMono, tr } from '../components/ui/Data';
import { toneClass, shipmentTone, quoteTone, MODE_ICON, type Tone } from '../components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

type Language = 'en' | 'pt' | 'nl';
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

const STATUS_TABS: { key: QuoteStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' }, { key: 'declined', label: 'Declined' }, { key: 'expired', label: 'Expired' },
];



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


  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    const statusParam = searchParams.get('status') as QuoteStatus | null;
    if (statusParam && STATUS_TABS.some(t => t.key === statusParam)) setStatusFilter(statusParam);

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
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={user} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <TrialBanner session={session} />

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <PageHeader className="mb-5" title="Quote History" />

        {/* Summary stats */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Total Quotes Sent" value={sentOrBeyond.length} />
          <Stat label="Acceptance Rate" value={`${acceptanceRate}%`} />
          <Stat label="Total Value Quoted" value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        </div>

        {/* Status filter tabs */}
        <Segmented className="mb-4" label="Filter by status" value={statusFilter} onChange={setStatusFilter}
          options={STATUS_TABS.map(tab => ({ value: tab.key, label: tab.label }))} />

        {/* Table */}
        <DataTable label="Quotes">
          <thead className="border-b border-app-line">
            <tr>
              <th scope="col" className={th}>Quote #</th>
              <th scope="col" className={th}>Customer</th>
              <th scope="col" className={th}>Route</th>
              <th scope="col" className={th}>Mode</th>
              <th scope="col" className={th}>Amount</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => (
              <tr key={q.id} onClick={() => setEditingQuote(q)} className={`${tr} cursor-pointer hover:bg-app-raised`}>
                <th scope="row" className={`${tdMono} text-left font-normal`}>FW-QUOTE-{(q.id || '').slice(0, 8).toUpperCase()}</th>
                <td className={td}>{q.customer_name || '—'}</td>
                <td className={td}><Route from={q.origin} to={q.destination} className="text-app-ink-2" /></td>
                <td className={td}>
                  <span className="flex items-center gap-1.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-2">
                    <Icon name={MODE_ICON[q.mode] || 'container'} size={15} className="text-app-ink-3" />{q.mode || '—'}
                  </span>
                </td>
                <td className={`${tdMono} font-medium`}>{q.currency} {Number(q.sell_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={td}><Tag tone={quoteTone(q.status)}>{q.status}</Tag></td>
                <td className={`${tdMono} text-app-ink-3`}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</td>
                <td className={td}>
                  <Button variant="danger" size="icon-sm" icon="trash" aria-label="Delete quote" title="Delete" onClick={(e) => { e.stopPropagation(); if (q.id) deleteQuote(q.id); }} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8}><EmptyState icon="quote" title={`No quotes ${statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}.`} /></td></tr>
            )}
          </tbody>
        </DataTable>
      </main>

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
