'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';
import Icon from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import { appRootClass, PageHeader, EmptyState, Notice, ColumnHeader } from '../components/ui/Panel';
import { Button, Spinner } from '../components/ui/Button';
import { inputClass, selectClass, selectInlineClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, Chip } from '../components/ui/Tag';
import { Toast, Stat, Segmented, DataTable, SearchField, Route, th, td, tdMono, tr } from '../components/ui/Data';
import { toneClass, shipmentTone, quoteTone, MODE_ICON, type Tone } from '../components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

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

const MODE_OPTIONS = ['ocean', 'air', 'road', 'rail'];

function marginPct(r: RateCard): number | null {
  if (r.buy_rate == null || r.sell_rate == null || r.buy_rate === 0) return null;
  return ((r.sell_rate - r.buy_rate) / r.buy_rate) * 100;
}

function marginTone(pct: number): Tone {
  if (pct > 20) return 'ok';
  if (pct >= 10) return 'warn';
  return 'danger';
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.ceil(ms / 86400000);
}

function validityInfo(r: RateCard): { label: string; tone: Tone } {
  if (!r.validity_end) return { label: 'Active', tone: 'ok' };
  const days = daysUntil(r.validity_end);
  if (days < 0) return { label: 'Expired', tone: 'danger' };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'warn' };
  return { label: 'Active', tone: 'ok' };
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
  const [expiringOnly, setExpiringOnly] = useState(false); // opened from the Overview

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RateCard>({ ...EMPTY_RATE });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);


  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    if (searchParams.get('filter') === 'expiring') setExpiringOnly(true);

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
    if (expiringOnly && !(r.is_active && r.validity_end && daysUntil(r.validity_end) >= 0 && daysUntil(r.validity_end) <= 30)) return false;
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

  const fieldInput = inputClass;
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_RATE }); };

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={user} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <TrialBanner session={session} />

      <main className="p-4 lg:p-6">
        <PageHeader
          className="mb-5"
          title="Rate Cards"
          description="Your negotiated carrier rates, ready to suggest into quotes"
          actions={<Button variant="primary" icon="plus" onClick={openAdd}>Add Rate</Button>}
        />

        {/* Stats */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Active Rates" value={totalActive} />
          <Stat label="Expiring This Month" value={expiringRates.length} tone={expiringRates.length > 0 ? 'warn' : undefined} />
          <Stat label="Carriers" value={totalCarriers} />
        </div>

        {/* Expiry warning banner */}
        {expiringRates.length > 0 && (
          <div className="mb-5">
            <Notice tone="warn" icon="alert"
              title={`${expiringRates.length} rate card${expiringRates.length > 1 ? 's' : ''} expire${expiringRates.length === 1 ? 's' : ''} within 30 days — review and update ${expiringRates.length > 1 ? 'them' : 'it'} to keep your quotes accurate`}>
              <ul className="mt-1 space-y-1">
                {expiringRates.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="flex flex-wrap items-center gap-x-2 text-app-ink-2">
                      <Route from={r.origin} to={r.destination} /> · {r.carrier} · <span className="font-fw-mono">{r.validity_end && validityInfo(r).label}</span>
                    </span>
                    <button onClick={() => openEdit(r)} className="inline-flex flex-shrink-0 items-center gap-1 font-medium text-app-accent hover:underline">Edit <Icon name="arrow-right" size={12} /></button>
                  </li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Segmented label="Filter by mode" value={filterMode} onChange={setFilterMode}
            options={['', ...MODE_OPTIONS].map(m => ({ value: m, label: m ? m[0].toUpperCase() + m.slice(1) : 'All', icon: m ? MODE_ICON[m] : undefined }))} />
          <select value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)} aria-label="Filter by carrier" className={selectInlineClass}>
            <option value="">All carriers</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search origin or destination..." className="w-64" />
          {expiringOnly && (
            <span className="flex items-center gap-1.5">
              <Chip>Expiring in the next 30 days</Chip>
              <Button variant="ghost" size="xs" icon="close" onClick={() => setExpiringOnly(false)}>Clear filter</Button>
            </span>
          )}
        </div>

        {/* Table / empty state */}
        {rates.length === 0 ? (
          <div className="rounded-fw-card border border-app-line bg-app-card">
            <EmptyState icon="rates" title="No rate cards yet" text="Add your first rate to get AI-powered suggestions in the Quote Builder"
              action={<Button variant="primary" icon="plus" onClick={openAdd}>Add Rate</Button>} />
          </div>
        ) : (
          <DataTable label="Rate cards">
            <thead className="border-b border-app-line">
              <tr>
                <th scope="col" className={th}>Route</th>
                <th scope="col" className={th}>Mode</th>
                <th scope="col" className={th}>Carrier</th>
                <th scope="col" className={th}>Container</th>
                <th scope="col" className={th}>Buy</th>
                <th scope="col" className={th}>Sell</th>
                <th scope="col" className={th}>Margin</th>
                <th scope="col" className={th}>Transit</th>
                <th scope="col" className={th}>Validity</th>
                <th scope="col" className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const margin = marginPct(r);
                const validity = validityInfo(r);
                return (
                  <tr key={r.id} className={`${tr} ${!r.is_active ? 'opacity-50' : ''}`}>
                    <th scope="row" className={`${td} text-left font-normal`}><Route from={r.origin} to={r.destination} /></th>
                    <td className={td}><span className="inline-flex items-center gap-1.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-2"><Icon name={MODE_ICON[r.mode] || 'container'} size={15} className="text-app-ink-3" />{r.mode}</span></td>
                    <td className={td}>{r.carrier}</td>
                    <td className={`${tdMono} text-app-ink-2`}>{r.container_type || '—'}</td>
                    <td className={tdMono}>{r.buy_rate != null ? `${r.currency} ${Number(r.buy_rate).toFixed(2)}` : '—'}</td>
                    <td className={`${tdMono} font-medium`}>{r.sell_rate != null ? `${r.currency} ${Number(r.sell_rate).toFixed(2)}` : '—'}</td>
                    <td className={tdMono}>{margin != null ? <span className={`font-medium ${toneClass[marginTone(margin)].text}`}>{margin.toFixed(0)}%</span> : '—'}</td>
                    <td className={`${tdMono} text-app-ink-2`}>{r.transit_time || '—'}</td>
                    <td className={td}><Tag tone={validity.tone}>{validity.label}</Tag></td>
                    <td className={td}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" icon="edit" onClick={() => openEdit(r)} title="Edit" aria-label="Edit rate" />
                        <Button variant="ghost" size="icon-sm" icon={r.is_active ? 'pause' : 'play'} onClick={() => toggleActive(r)} title={r.is_active ? 'Deactivate' : 'Activate'} aria-label={r.is_active ? 'Deactivate rate' : 'Activate rate'} />
                        <Button variant="danger" size="icon-sm" icon="trash" onClick={() => deleteRate(r)} title="Delete" aria-label="Delete rate" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10}><EmptyState icon="filter" title="No rate cards match these filters." /></td></tr>
              )}
            </tbody>
          </DataTable>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal title={editingId ? 'Edit Rate Card' : 'Add Rate Card'} icon="rates" onClose={closeForm}
          footer={<>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" onClick={saveRate}>{editingId ? 'Save Changes' : 'Add Rate'}</Button>
          </>}>
          <div className="grid grid-cols-2 gap-4 p-5">
            <Field label="Origin *">
              <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} placeholder="e.g. Santos, BR" className={fieldInput} />
            </Field>
            <Field label="Destination *">
              <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Rotterdam, NL" className={fieldInput} />
            </Field>
            <Field label="Mode *">
              <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className={selectClass}>
                {MODE_OPTIONS.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Carrier *">
              <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. Maersk" className={fieldInput} />
            </Field>
            <Field label="Container Type">
              <input value={form.container_type} onChange={e => setForm(f => ({ ...f, container_type: e.target.value }))} placeholder="e.g. 40HC, LCL, per kg" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={selectClass}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
              </select>
            </Field>
            <Field label="Buy Rate">
              <input type="number" value={form.buy_rate ?? ''} onChange={e => setForm(f => ({ ...f, buy_rate: e.target.value === '' ? null : Number(e.target.value) }))} placeholder="What you pay the carrier" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Sell Rate">
              <input type="number" value={form.sell_rate ?? ''} onChange={e => setForm(f => ({ ...f, sell_rate: e.target.value === '' ? null : Number(e.target.value) }))} placeholder="What you charge the customer" className={`${fieldInput} font-fw-mono`} />
            </Field>

            {form_margin != null && (
              <div className="col-span-2">
                <p className={`text-app-ui font-medium ${toneClass[marginTone(form_margin)].text}`}>Margin: <span className="font-fw-mono">{form_margin.toFixed(1)}%</span></p>
              </div>
            )}

            <Field label="Transit Time">
              <input value={form.transit_time} onChange={e => setForm(f => ({ ...f, transit_time: e.target.value }))} placeholder="e.g. 25-30 days" className={fieldInput} />
            </Field>
            <div />
            <Field label="Valid From (optional)">
              <input type="date" value={form.validity_start || ''} onChange={e => setForm(f => ({ ...f, validity_start: e.target.value || null }))} className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Valid Until (optional)">
              <input type="date" value={form.validity_end || ''} onChange={e => setForm(f => ({ ...f, validity_end: e.target.value || null }))} className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any special conditions..." className={textareaClass} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
