'use client';

import { useEffect, useState } from 'react';
import Icon from './ui/Icon';
import { Button } from './ui/Button';
import { inputClass, inputInlineClass, selectClass, textareaClass, Field, DataLabel } from './ui/Field';
import { toneClass } from './ui/tones';

import { API_URL } from '@/app/lib/api';

export interface Charge {
  name: string;
  amount: number;
}

export interface Quote {
  id?: string;
  session_id?: string;
  email_id?: string | null;
  email_subject?: string | null;
  customer_name: string;
  customer_email: string;
  origin: string;
  destination: string;
  mode: string;
  commodity: string;
  container_type: string;
  weight: string;
  incoterm: string;
  carrier: string;
  sell_rate: number;
  currency: string;
  transit_time: string;
  validity_date: string;
  notes: string;
  charges: Charge[];
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  created_at?: string;
  updated_at?: string;
}

const EMPTY_QUOTE: Quote = {
  customer_name: '', customer_email: '', origin: '', destination: '', mode: '',
  commodity: '', container_type: '', weight: '', incoterm: '', carrier: '', sell_rate: 0,
  currency: 'USD', transit_time: '', validity_date: '', notes: '', charges: [],
  status: 'draft',
};

export interface SuggestedRate {
  id: string;
  origin: string;
  destination: string;
  mode: string;
  carrier: string;
  container_type: string;
  sell_rate: number | null;
  currency: string;
  transit_time: string;
  validity_end: string | null;
}

export function quoteNumber(q: Quote) {
  return q.id ? `FW-QUOTE-${q.id.slice(0, 8).toUpperCase()}` : 'FW-QUOTE-DRAFT';
}

export function quoteTotal(q: Quote) {
  return q.charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

interface QuoteBuilderModalProps {
  darkMode: boolean;
  session: string | null;
  initial: Quote;
  onClose: () => void;
  onSaved?: (quote: Quote) => void;
  onSent?: (quote: Quote) => void;
}

export default function QuoteBuilderModal({ session, initial, onClose, onSaved, onSent }: QuoteBuilderModalProps) {
  const [quote, setQuote] = useState<Quote>({ ...EMPTY_QUOTE, ...initial, charges: initial.charges?.length ? initial.charges : [{ name: 'Ocean Freight', amount: 0 }] });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [suggestedRates, setSuggestedRates] = useState<SuggestedRate[]>([]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Suggest rate cards only for a brand-new quote (not one being reopened for
  // editing) that already has origin/destination/mode from the AI analysis.
  useEffect(() => {
    if (quote.id || !session || !quote.origin || !quote.destination || !quote.mode) return;
    const params = new URLSearchParams({ session, origin: quote.origin, destination: quote.destination, mode: quote.mode });
    if (quote.container_type) params.set('container', quote.container_type);
    fetch(`${API_URL}/api/rates/suggest?${params.toString()}`)
      .then(r => r.json())
      .then(d => { if (d.rates) setSuggestedRates(d.rates); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySuggestedRate = (rate: SuggestedRate) => {
    setQuote(prev => ({
      ...prev,
      carrier: rate.carrier,
      currency: rate.currency || prev.currency,
      transit_time: rate.transit_time || prev.transit_time,
      charges: rate.sell_rate != null ? [{ name: `${rate.mode === 'ocean' ? 'Ocean' : rate.mode === 'air' ? 'Air' : rate.mode === 'road' ? 'Road' : 'Rail'} Freight — ${rate.carrier}`, amount: Number(rate.sell_rate) }] : prev.charges,
    }));
    setSuggestedRates([]);
  };

  const total = quoteTotal(quote);

  const set = <K extends keyof Quote>(key: K, value: Quote[K]) => setQuote(prev => ({ ...prev, [key]: value }));

  const addCharge = () => set('charges', [...quote.charges, { name: '', amount: 0 }]);
  const removeCharge = (i: number) => set('charges', quote.charges.filter((_, idx) => idx !== i));
  const updateCharge = (i: number, field: keyof Charge, value: string) => {
    const next = [...quote.charges];
    next[i] = { ...next[i], [field]: field === 'amount' ? Number(value) || 0 : value };
    set('charges', next);
  };

  const persist = async (status?: Quote['status']) => {
    const payload = { ...quote, sell_rate: total, status: status || quote.status };
    const method = quote.id ? 'PATCH' : 'POST';
    const url = quote.id ? `${API_URL}/api/quotes/${quote.id}?session=${session}` : `${API_URL}/api/quotes?session=${session}`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.quote) throw new Error(data.error || 'Failed to save quote');
    return data.quote as Quote;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const saved = await persist('draft');
      setQuote(saved);
      onSaved?.(saved);
      setNotice({ type: 'success', msg: 'Draft saved!' });
    } catch (e: any) {
      setNotice({ type: 'error', msg: e.message || 'Failed to save draft' });
    }
    setSaving(false);
  };

  const handleSendQuote = async () => {
    if (!quote.customer_email.trim()) {
      setNotice({ type: 'error', msg: 'Customer email is required to send' });
      return;
    }
    setSending(true);
    try {
      const saved = await persist();
      const res = await fetch(`${API_URL}/api/quotes/${saved.id}/send?session=${session}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to send quote');
      setQuote(data.quote);
      onSent?.(data.quote);
      setNotice({ type: 'success', msg: 'Quote sent!' });
    } catch (e: any) {
      setNotice({ type: 'error', msg: e.message || 'Failed to send quote' });
    }
    setSending(false);
  };

  const handleDownloadPdf = () => window.print();

  const text = (label: string, key: keyof Quote, opts: { placeholder?: string; mono?: boolean; type?: string } = {}) => (
    <Field label={label}>
      <input type={opts.type || 'text'} value={quote[key] as string} onChange={e => set(key, e.target.value as any)} placeholder={opts.placeholder}
        className={`${inputClass} ${opts.mono ? 'font-fw-mono' : ''}`} />
    </Field>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4 print:bg-white print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-print-area, #quote-print-area * { visibility: visible; }
          #quote-print-area { position: fixed; inset: 0; width: 100%; padding: 24px; }
        }
      `}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="quote-builder-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-fw-card border border-app-line bg-app-card font-fw-sans text-app-ink shadow-app-pop print:max-h-none print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-app-line px-5 py-3.5 print:hidden">
          <h2 id="quote-builder-title" className="flex items-center gap-2 font-fw-display text-app-title-sm font-normal">
            <Icon name="quote" size={18} className="text-app-accent" />
            Quote Builder <span className="font-fw-mono text-app-mono text-app-ink-3">{quoteNumber(quote)}</span>
          </h2>
          <Button variant="ghost" size="icon-sm" icon="close" onClick={onClose} aria-label="Close" />
        </div>

        {notice && (
          <div className={`mx-5 mt-3 flex flex-shrink-0 items-center gap-2 rounded-fw-btn border border-app-line px-3 py-2 text-app-ui-sm print:hidden ${toneClass[notice.type === 'success' ? 'ok' : 'danger'].tag}`}>
            <Icon name={notice.type === 'success' ? 'check' : 'alert'} size={14} /> {notice.msg}
          </div>
        )}

        {/* Body: form + preview */}
        <div className="grid flex-1 overflow-hidden md:grid-cols-2 print:block">
          {/* LEFT — Form */}
          <div className="space-y-4 overflow-y-auto border-r border-app-line p-5 print:hidden">
            {suggestedRates.length > 0 && (
              <div className="rounded-fw-card border border-app-line bg-app-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-app-ui-sm font-semibold text-app-ink"><Icon name="sparkle" size={14} className="text-app-accent" /> Suggested Rates</p>
                  <span className="text-app-ui-sm text-app-ink-3">AI matched from your rate cards</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {suggestedRates.map(r => (
                    <button key={r.id} onClick={() => applySuggestedRate(r)}
                      className="rounded-fw-btn border border-app-line bg-app-card p-2 text-left transition-colors hover:border-app-accent-fill">
                      <p className="text-app-ui-sm font-semibold">{r.carrier}</p>
                      <p className="font-fw-mono text-app-mono-xs text-app-ink-2">{r.container_type || '—'}</p>
                      <p className="mt-1 font-fw-mono text-app-mono font-medium text-app-accent">{r.sell_rate != null ? `${r.currency} ${Number(r.sell_rate).toFixed(2)}` : '—'}</p>
                      <p className="text-app-ui-sm text-app-ink-3">{r.transit_time || '—'}</p>
                      {r.validity_end && <p className="font-fw-mono text-app-mono-xs text-app-ink-3">Valid until {r.validity_end}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {text('Customer Name', 'customer_name')}
              {text('Customer Email', 'customer_email')}
              {text('Origin', 'origin', { mono: true })}
              {text('Destination', 'destination', { mono: true })}
              <Field label="Mode">
                <select value={quote.mode} onChange={e => set('mode', e.target.value)} className={selectClass}>
                  <option value="">Select mode</option>
                  <option value="ocean">Ocean</option>
                  <option value="air">Air</option>
                  <option value="road">Road</option>
                  <option value="rail">Rail</option>
                </select>
              </Field>
              {text('Incoterm', 'incoterm', { mono: true })}
              {text('Carrier', 'carrier', { placeholder: 'e.g. Maersk' })}
              {text('Commodity', 'commodity')}
              {text('Container Type', 'container_type', { placeholder: 'e.g. 1x40HC', mono: true })}
              {text('Weight', 'weight', { mono: true })}
              <Field label="Currency">
                <select value={quote.currency} onChange={e => set('currency', e.target.value)} className={selectClass}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                </select>
              </Field>
              {text('Transit Time', 'transit_time', { placeholder: 'e.g. 25-30 days' })}
              {text('Validity Date', 'validity_date', { type: 'date', mono: true })}
            </div>

            {/* Charges breakdown */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <DataLabel>Charges Breakdown</DataLabel>
                <Button variant="ghost" size="xs" icon="plus" onClick={addCharge}>Add charge</Button>
              </div>
              <div className="space-y-2">
                {quote.charges.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={c.name} onChange={e => updateCharge(i, 'name', e.target.value)} placeholder="e.g. Ocean Freight" aria-label="Charge name"
                      className={`${inputInlineClass} min-w-0 flex-1`} />
                    <input type="number" value={c.amount} onChange={e => updateCharge(i, 'amount', e.target.value)} placeholder="0.00" aria-label="Charge amount"
                      className={`${inputInlineClass} w-28 flex-none font-fw-mono`} />
                    <Button variant="danger" size="icon-sm" icon="close" onClick={() => removeCharge(i)} aria-label="Remove charge" className="h-9 w-9" />
                  </div>
                ))}
                {quote.charges.length === 0 && <p className="text-app-ui-sm text-app-ink-3">No charges added yet.</p>}
              </div>
              <p className="mt-2 text-app-ui font-semibold">Total: <span className="font-fw-mono">{quote.currency} {total.toFixed(2)}</span></p>
            </div>

            <Field label="Additional Notes">
              <textarea value={quote.notes} onChange={e => set('notes', e.target.value)} rows={3} className={textareaClass} />
            </Field>
          </div>

          {/* RIGHT — Live Preview: a white paper document in both modes (and in print). */}
          <div data-theme="light" className="overflow-y-auto bg-app-panel p-5 print:overflow-visible print:bg-white print:p-0" id="quote-print-area">
            <div className="rounded-fw-frame border border-app-line bg-app-bg p-6 font-fw-sans text-app-ink print:border-0">
              <div className="mb-4 flex items-center justify-between border-b border-app-line pb-4">
                <img src="/icons/freightwizard_logo_white.png" alt="FreightWizard" className="h-6 w-auto invert" />
                <h3 className="text-right font-fw-display text-app-title-sm font-light tracking-wide">FREIGHT<br />QUOTATION</h3>
              </div>

              <div className="mb-4 flex items-center justify-between text-app-ui">
                <div>
                  <p className="font-fw-mono text-app-mono font-medium">{quoteNumber(quote)}</p>
                  <p className="text-app-ink-2">Date: <span className="font-fw-mono">{new Date().toLocaleDateString()}</span></p>
                  <p className="text-app-ink-2">Valid until: <span className="font-fw-mono">{quote.validity_date || '—'}</span></p>
                </div>
                <div className="text-right">
                  <DataLabel>To</DataLabel>
                  <p className="font-medium">{quote.customer_name || '—'}</p>
                  <p className="text-app-ink-2">{quote.customer_email || '—'}</p>
                </div>
              </div>

              <table className="mb-4 w-full border-collapse text-app-ui">
                <tbody>
                  {[
                    ['Origin', quote.origin], ['Destination', quote.destination], ['Mode', quote.mode],
                    ['Commodity', quote.commodity], ['Container', quote.container_type],
                    ['Weight', quote.weight], ['Incoterm', quote.incoterm], ['Carrier', quote.carrier],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-app-line">
                      <td className="py-1.5 text-app-ink-2">{label}</td>
                      <td className="py-1.5 text-right font-fw-mono text-app-mono">{value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="mb-4 w-full border-collapse text-app-ui">
                <thead>
                  <tr className="border-b border-app-line-strong">
                    <th className="py-1.5 text-left font-fw-mono text-app-mono-xs font-normal uppercase text-app-ink-3">Charge</th>
                    <th className="py-1.5 text-right font-fw-mono text-app-mono-xs font-normal uppercase text-app-ink-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.charges.map((c, i) => (
                    <tr key={i} className="border-b border-app-line">
                      <td className="py-1.5">{c.name || '—'}</td>
                      <td className="py-1.5 text-right font-fw-mono text-app-mono">{quote.currency} {Number(c.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-semibold">TOTAL</td>
                    <td className="py-2 text-right font-fw-mono text-app-mono font-semibold">{quote.currency} {total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="mb-2 text-app-ui"><span className="text-app-ink-2">Transit time:</span> {quote.transit_time || '—'}</p>
              {quote.notes && <p className="mb-2 text-app-ui"><span className="text-app-ink-2">Notes:</span> {quote.notes}</p>}

              <p className="mt-6 border-t border-app-line pt-4 text-app-ui-sm text-app-ink-3">
                This quotation is valid until {quote.validity_date || 'the date above'}.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="flex flex-shrink-0 gap-3 border-t border-app-line px-5 py-3 print:hidden">
          <Button icon="draft" onClick={handleSaveDraft} disabled={saving}>{saving ? 'Saving...' : 'Save Draft'}</Button>
          <Button variant="primary" icon="send" className="flex-1" onClick={handleSendQuote} disabled={sending}>{sending ? 'Sending...' : 'Send Quote'}</Button>
          <Button icon="download" onClick={handleDownloadPdf}>Download PDF</Button>
        </div>
      </div>
    </div>
  );
}
