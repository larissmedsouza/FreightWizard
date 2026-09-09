'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

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

export default function QuoteBuilderModal({ darkMode, session, initial, onClose, onSaved, onSent }: QuoteBuilderModalProps) {
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

  const theme = darkMode ? {
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white',
    textMuted: 'text-gray-400', textDim: 'text-gray-500',
    hover: 'hover:bg-white/5', input: 'bg-[#0f0f1f] border-white/10 text-white placeholder-gray-600',
    previewBg: 'bg-white text-slate-900',
  } : {
    card: 'bg-white', cardBorder: 'border-slate-200', text: 'text-slate-900',
    textMuted: 'text-slate-600', textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100', input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    previewBg: 'bg-white text-slate-900',
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-print-area, #quote-print-area * { visibility: visible; }
          #quote-print-area { position: fixed; inset: 0; width: 100%; padding: 24px; }
        }
      `}</style>
      <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl flex flex-col print:max-w-none print:max-h-none print:shadow-none print:border-0 print:rounded-none`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.cardBorder} flex-shrink-0 print:hidden`}>
          <h2 className={`font-bold text-lg ${theme.text}`}>Quote Builder — {quoteNumber(quote)}</h2>
          <button onClick={onClose} className={`${theme.textDim} hover:text-red-400 text-xl`}>✕</button>
        </div>

        {notice && (
          <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm text-white flex-shrink-0 print:hidden ${notice.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {notice.msg}
          </div>
        )}

        {/* Body: form + preview */}
        <div className="flex-1 overflow-hidden grid md:grid-cols-2 print:block">
          {/* LEFT — Form */}
          <div className={`overflow-y-auto p-6 space-y-4 border-r ${theme.cardBorder} print:hidden`}>
            {suggestedRates.length > 0 && (
              <div className={`rounded-xl border border-[#9E14FB]/30 ${darkMode ? 'bg-[#9E14FB]/5' : 'bg-purple-50'} p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#9E14FB]">💡 Suggested Rates</p>
                  <span className={`text-[10px] ${theme.textDim}`}>AI matched from your rate cards</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {suggestedRates.map(r => (
                    <button key={r.id} onClick={() => applySuggestedRate(r)}
                      className={`text-left p-2 rounded-lg border ${theme.cardBorder} ${theme.card} hover:border-[#9E14FB]/60 transition`}>
                      <p className={`text-xs font-semibold ${theme.text}`}>{r.carrier}</p>
                      <p className={`text-[10px] ${theme.textMuted}`}>{r.container_type || '—'}</p>
                      <p className="text-xs font-bold text-[#9E14FB] mt-1">{r.sell_rate != null ? `${r.currency} ${Number(r.sell_rate).toFixed(2)}` : '—'}</p>
                      <p className={`text-[10px] ${theme.textDim}`}>{r.transit_time || '—'}</p>
                      {r.validity_end && <p className={`text-[9px] ${theme.textDim}`}>Valid until {r.validity_end}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Customer Name</label>
                <input value={quote.customer_name} onChange={e => set('customer_name', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Customer Email</label>
                <input value={quote.customer_email} onChange={e => set('customer_email', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Origin</label>
                <input value={quote.origin} onChange={e => set('origin', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Destination</label>
                <input value={quote.destination} onChange={e => set('destination', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Mode</label>
                <select value={quote.mode} onChange={e => set('mode', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="">Select mode</option>
                  <option value="ocean">🚢 Ocean</option>
                  <option value="air">✈️ Air</option>
                  <option value="road">🚛 Road</option>
                  <option value="rail">🚂 Rail</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Incoterm</label>
                <input value={quote.incoterm} onChange={e => set('incoterm', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Carrier</label>
                <input value={quote.carrier} onChange={e => set('carrier', e.target.value)}
                  placeholder="e.g. Maersk"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Commodity</label>
                <input value={quote.commodity} onChange={e => set('commodity', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Container Type</label>
                <input value={quote.container_type} onChange={e => set('container_type', e.target.value)}
                  placeholder="e.g. 1x40HC"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Weight</label>
                <input value={quote.weight} onChange={e => set('weight', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Currency</label>
                <select value={quote.currency} onChange={e => set('currency', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Transit Time</label>
                <input value={quote.transit_time} onChange={e => set('transit_time', e.target.value)}
                  placeholder="e.g. 25-30 days"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Validity Date</label>
                <input type="date" value={quote.validity_date} onChange={e => set('validity_date', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>
            </div>

            {/* Charges breakdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-xs font-medium ${theme.textDim}`}>Charges Breakdown</label>
                <button onClick={addCharge} className="text-xs text-[#9E14FB] hover:underline font-medium">+ Add charge</button>
              </div>
              <div className="space-y-2">
                {quote.charges.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={c.name} onChange={e => updateCharge(i, 'name', e.target.value)}
                      placeholder="e.g. Ocean Freight"
                      className={`flex-1 px-3 py-1.5 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
                    <input type="number" value={c.amount} onChange={e => updateCharge(i, 'amount', e.target.value)}
                      placeholder="0.00"
                      className={`w-28 px-3 py-1.5 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
                    <button onClick={() => removeCharge(i)} className="text-red-400 hover:text-red-500 text-sm px-1">✕</button>
                  </div>
                ))}
                {quote.charges.length === 0 && <p className={`text-xs ${theme.textDim}`}>No charges added yet.</p>}
              </div>
              <p className={`text-sm font-semibold mt-2 ${theme.text}`}>Total: {quote.currency} {total.toFixed(2)}</p>
            </div>

            <div>
              <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Additional Notes</label>
              <textarea value={quote.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none`} />
            </div>
          </div>

          {/* RIGHT — Live Preview */}
          <div className={`overflow-y-auto p-6 print:overflow-visible print:p-0`} id="quote-print-area">
            <div className={`${theme.previewBg} rounded-xl border border-slate-200 p-6 shadow-sm print:shadow-none print:border-0`}>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className="h-8 w-8 object-contain brightness-0" />
                  <span className="font-bold text-lg">FreightWizard</span>
                </div>
                <h3 className="text-xl font-bold tracking-wide text-right">FREIGHT<br />QUOTATION</h3>
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <div>
                  <p className="font-semibold">{quoteNumber(quote)}</p>
                  <p className="text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-slate-500">Valid until: {quote.validity_date || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs uppercase tracking-wide">To</p>
                  <p className="font-medium">{quote.customer_name || '—'}</p>
                  <p className="text-slate-500">{quote.customer_email || '—'}</p>
                </div>
              </div>

              <table className="w-full text-sm mb-4 border-collapse">
                <tbody>
                  {[
                    ['Origin', quote.origin], ['Destination', quote.destination], ['Mode', quote.mode],
                    ['Commodity', quote.commodity], ['Container', quote.container_type],
                    ['Weight', quote.weight], ['Incoterm', quote.incoterm], ['Carrier', quote.carrier],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500">{label}</td>
                      <td className="py-1.5 text-right font-medium">{value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="w-full text-sm mb-4 border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300">
                    <th className="text-left py-1.5 font-semibold">Charge</th>
                    <th className="text-right py-1.5 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.charges.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5">{c.name || '—'}</td>
                      <td className="py-1.5 text-right">{quote.currency} {Number(c.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-bold">TOTAL</td>
                    <td className="py-2 text-right font-bold">{quote.currency} {total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-sm mb-2"><span className="text-slate-500">Transit time:</span> {quote.transit_time || '—'}</p>
              {quote.notes && <p className="text-sm mb-2"><span className="text-slate-500">Notes:</span> {quote.notes}</p>}

              <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-200">
                This quotation is valid until {quote.validity_date || 'the date above'}.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className={`flex gap-3 px-6 py-4 border-t ${theme.cardBorder} flex-shrink-0 print:hidden`}>
          <button onClick={handleSaveDraft} disabled={saving}
            className={`px-5 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm font-medium disabled:opacity-50`}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={handleSendQuote} disabled={sending}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
            {sending ? 'Sending...' : 'Send Quote'}
          </button>
          <button onClick={handleDownloadPdf}
            className={`px-5 py-2.5 border ${theme.cardBorder} ${theme.hover} rounded-xl text-sm font-medium ${theme.text}`}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
