'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface IntegrationRow {
  id: string;
  country_code: string;
  integration_key: string;
  has_api_key: boolean;
  has_api_secret: boolean;
  extra_fields: Record<string, any>;
  is_active: boolean;
  last_verified_at: string | null;
}

const COUNTRIES = [
  { code: 'BR', flag: '🇧🇷', name: 'Brazil', accent: 'green' },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands', accent: 'orange' },
  { code: 'US', flag: '🇺🇸', name: 'United States', accent: 'blue' },
];

function verifiedBadge(row: IntegrationRow | undefined, darkMode: boolean) {
  if (!row?.last_verified_at) {
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>Not verified</span>;
  }
  const daysSince = (Date.now() - new Date(row.last_verified_at).getTime()) / 86400000;
  if (daysSince > 30) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400">Verification failed</span>;
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">✓ Verified {new Date(row.last_verified_at).toLocaleDateString()}</span>;
}

function validateEORI(v: string) { return /^[A-Z]{2}\d{9,12}$/.test(v.replace(/\s/g, '')); }
function validateKVK(v: string) { return /^\d{8}$/.test(v.replace(/\s/g, '')); }
function validateEIN(v: string) { return /^\d{2}-\d{7}$/.test(v.trim()); }

export default function CountryIntegrations({ session, darkMode }: { session: string | null; darkMode: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

  const [nl, setNl] = useState({ portbase_api_key: '', portbase_client_id: '', eori: '', kvk: '' });
  const [us, setUs] = useState({ ace_filer_code: '', ein: '', aes_itn_prefix: '', ctpat: false });
  const [eu, setEu] = useState({ eori: '', aeo_status: 'None' });

  const [taricHs, setTaricHs] = useState('');
  const [taricCountry, setTaricCountry] = useState('NL');
  const [taricLoading, setTaricLoading] = useState(false);
  const [taricResult, setTaricResult] = useState<any>(null);
  const [taricError, setTaricError] = useState<string | null>(null);

  const theme = darkMode ? {
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white',
    textMuted: 'text-gray-400', textDim: 'text-gray-500',
    input: 'bg-[#0a0a1a] border-white/10 text-white placeholder-gray-600',
    hover: 'hover:bg-white/5', section: 'bg-[#080814]',
  } : {
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50', text: 'text-slate-900',
    textMuted: 'text-slate-600', textDim: 'text-slate-500',
    input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    hover: 'hover:bg-slate-50', section: 'bg-slate-50/60',
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotice({ type, msg }); setTimeout(() => setNotice(null), 4000); };

  const loadIntegrations = () => {
    if (!session) return;
    fetch(`${API_URL}/api/integrations?session=${session}`)
      .then(r => r.json())
      .then(d => {
        if (!d.integrations) return;
        setIntegrations(d.integrations);
        const active = new Set<string>(d.integrations.filter((i: IntegrationRow) => i.is_active).map((i: IntegrationRow) => i.country_code));
        setSelected(prev => new Set([...prev, ...active]));

        const nlRow = d.integrations.find((i: IntegrationRow) => i.country_code === 'NL' && i.integration_key === 'portbase');
        if (nlRow) setNl(f => ({ ...f, portbase_client_id: nlRow.extra_fields?.client_id || '', eori: nlRow.extra_fields?.eori || '', kvk: nlRow.extra_fields?.kvk || '' }));
        const usRow = d.integrations.find((i: IntegrationRow) => i.country_code === 'US' && i.integration_key === 'ace');
        if (usRow) setUs({ ace_filer_code: usRow.extra_fields?.ace_filer_code || '', ein: usRow.extra_fields?.ein || '', aes_itn_prefix: usRow.extra_fields?.aes_itn_prefix || '', ctpat: !!usRow.extra_fields?.ctpat });
        const euRow = d.integrations.find((i: IntegrationRow) => i.country_code === 'EU' && i.integration_key === 'eu_compliance');
        if (euRow) setEu({ eori: euRow.extra_fields?.eori || '', aeo_status: euRow.extra_fields?.aeo_status || 'None' });
      })
      .catch(() => {});
  };

  useEffect(loadIntegrations, [session]);

  const toggleCountry = (code: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(code) ? next.delete(code) : next.add(code); return next; });
  };

  const rowFor = (country: string, key: string) => integrations.find(i => i.country_code === country && i.integration_key === key);

  const saveIntegration = async (country_code: string, integration_key: string, payload: { api_key?: string; api_secret?: string; extra_fields: Record<string, any> }) => {
    if (!session) return;
    setSavingKey(`${country_code}:${integration_key}`);
    try {
      const res = await fetch(`${API_URL}/api/integrations?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code, integration_key, ...payload }),
      });
      if (!res.ok) throw new Error();
      notify('success', 'Saved!');
      loadIntegrations();
    } catch { notify('error', 'Failed to save'); }
    setSavingKey(null);
  };

  const verifyIntegration = async (country_code: string, integration_key: string) => {
    if (!session) return;
    setVerifyingKey(`${country_code}:${integration_key}`);
    try {
      const res = await fetch(`${API_URL}/api/integrations/verify?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code, integration_key, session_id: session }),
      });
      const data = await res.json();
      notify(data.verified ? 'success' : 'error', data.message);
      loadIntegrations();
    } catch { notify('error', 'Verification failed'); }
    setVerifyingKey(null);
  };

  const lookupTaric = async () => {
    const code = taricHs.replace(/\D/g, '');
    if (code.length < 6) { setTaricError('Enter a valid 6-10 digit HS code'); return; }
    setTaricLoading(true); setTaricError(null); setTaricResult(null);
    try {
      const res = await fetch(`${API_URL}/api/integrations/taric/lookup?hs_code=${code}&country=${taricCountry}`);
      const data = await res.json();
      if (!res.ok) { setTaricError(data.message || 'Lookup failed'); }
      else setTaricResult(data);
    } catch { setTaricError('Lookup failed — try again'); }
    setTaricLoading(false);
  };

  const helpLink = (href: string, label = 'Where do I get this?') => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-[#9E14FB] hover:underline">{label} ↗</a>
  );

  const cardWrap = (accentClass: string, children: React.ReactNode) => (
    <div className={`${theme.card} border-2 ${accentClass} rounded-2xl p-6 space-y-4`}>{children}</div>
  );

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white text-sm ${notice.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{notice.msg}</div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-bold">🌍 Country Integrations & Compliance</h2>
          {(() => {
            const activeRows = integrations.filter(i => selected.has(i.country_code) && i.is_active);
            if (activeRows.length === 0) return null;
            const failed = activeRows.some(i => i.last_verified_at && (Date.now() - new Date(i.last_verified_at).getTime()) / 86400000 > 30);
            const allVerified = activeRows.every(i => !!i.last_verified_at);
            const color = failed ? 'bg-red-500' : allVerified ? 'bg-green-500' : 'bg-yellow-500';
            const label = failed ? 'Verification failed' : allVerified ? 'All verified' : 'Some not yet verified';
            return <span className={`w-2 h-2 rounded-full ${color}`} title={label} />;
          })()}
        </div>
        <p className={`text-sm ${theme.textDim} mb-4`}>Bring your own credentials (BYOC) — FreightWizard is the interface layer, you contract directly with each authority.</p>

        {/* Country selector */}
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(c => (
            <button key={c.code} onClick={() => toggleCountry(c.code)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition ${
                selected.has(c.code) ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border-[#5200FF]/50' : `${theme.cardBorder} ${theme.hover}`
              }`}>
              <span className="text-base">{c.flag}</span> {c.name}
            </button>
          ))}
          <span className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${theme.cardBorder} text-sm font-medium ${theme.textMuted}`}>
            🇪🇺 EU <span className="text-[9px] opacity-70">(always shown)</span>
          </span>
        </div>
      </div>

      {/* Netherlands panel */}
      {selected.has('NL') && cardWrap('border-orange-500/30', <>
        <div className="flex items-center gap-2">
          <span className="text-lg">🇳🇱</span>
          <h3 className="font-semibold">Netherlands</h3>
          {verifiedBadge(rowFor('NL', 'portbase'), darkMode)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-medium ${theme.textMuted}`}>Portbase API Key</label>
              {helpLink('https://www.portbase.com/en/marketplace/')}
            </div>
            <input type="password" value={nl.portbase_api_key} onChange={e => setNl(f => ({ ...f, portbase_api_key: e.target.value }))}
              placeholder={rowFor('NL', 'portbase')?.has_api_key ? '(saved — enter to replace)' : ''}
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
            <p className={`text-xs ${theme.textDim} mt-1`}>Requires an IAMconnected account at portbase.com</p>
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>Portbase Client ID</label>
            <input value={nl.portbase_client_id} onChange={e => setNl(f => ({ ...f, portbase_client_id: e.target.value }))}
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>EORI Number</label>
            <input value={nl.eori} onChange={e => setNl(f => ({ ...f, eori: e.target.value.toUpperCase() }))}
              placeholder="NL123456789"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] ${nl.eori && !validateEORI(nl.eori) ? 'border-red-500' : ''}`} />
            <p className={`text-xs ${theme.textDim} mt-1`}>Your EU Economic Operators Registration and Identification number</p>
            {nl.eori && !validateEORI(nl.eori) && <p className="text-xs text-red-400 mt-0.5">Format: NL + 9-12 digits</p>}
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>KVK Number</label>
            <input value={nl.kvk} onChange={e => setNl(f => ({ ...f, kvk: e.target.value }))}
              placeholder="12345678"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] ${nl.kvk && !validateKVK(nl.kvk) ? 'border-red-500' : ''}`} />
            <p className={`text-xs ${theme.textDim} mt-1`}>Dutch Chamber of Commerce (8 digits)</p>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-xs font-medium ${theme.textMuted} mb-1`}>DMS Access (Douane Management Systeem)</p>
          <p className={`text-xs ${theme.textDim} leading-relaxed mb-1.5`}>DMS declarations require certified customs software. FreightWizard currently shows DMS compliance checklists only. Direct DMS filing coming in a future update.</p>
          <a href="https://nh.douane.nl" target="_blank" rel="noopener noreferrer" className="text-xs text-[#9E14FB] hover:underline">nh.douane.nl ↗</a>
        </div>

        <div className="flex gap-2">
          <button onClick={() => saveIntegration('NL', 'portbase', { api_key: nl.portbase_api_key || undefined, extra_fields: { client_id: nl.portbase_client_id, eori: nl.eori, kvk: nl.kvk } })}
            disabled={savingKey === 'NL:portbase'}
            className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
            {savingKey === 'NL:portbase' ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => verifyIntegration('NL', 'portbase')} disabled={verifyingKey === 'NL:portbase'}
            className={`px-4 py-2 border ${theme.cardBorder} ${theme.hover} rounded-xl text-sm font-medium disabled:opacity-50`}>
            {verifyingKey === 'NL:portbase' ? 'Verifying...' : 'Verify Connection'}
          </button>
        </div>
      </>)}

      {/* USA panel */}
      {selected.has('US') && cardWrap('border-blue-500/30', <>
        <div className="flex items-center gap-2">
          <span className="text-lg">🇺🇸</span>
          <h3 className="font-semibold">United States</h3>
          {verifiedBadge(rowFor('US', 'ace'), darkMode)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>ACE Filer Code</label>
            <input value={us.ace_filer_code} onChange={e => setUs(f => ({ ...f, ace_filer_code: e.target.value.toUpperCase().slice(0, 3) }))}
              placeholder="ABC"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
            <p className={`text-xs ${theme.textDim} mt-1`}>Your CBP-assigned filer code. Only licensed customs brokers can submit ABI entries.</p>
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>EIN Number</label>
            <input value={us.ein} onChange={e => setUs(f => ({ ...f, ein: e.target.value }))}
              placeholder="12-3456789"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] ${us.ein && !validateEIN(us.ein) ? 'border-red-500' : ''}`} />
            {us.ein && !validateEIN(us.ein) && <p className="text-xs text-red-400 mt-1">Format: XX-XXXXXXX</p>}
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>AES ITN Prefix</label>
            <input value={us.aes_itn_prefix} onChange={e => setUs(f => ({ ...f, aes_itn_prefix: e.target.value }))}
              placeholder="For export shipments"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${theme.text}`}>CTPAT Member</p>
              <p className={`text-xs ${theme.textDim}`}>Customs-Trade Partnership Against Terrorism</p>
            </div>
            <button onClick={() => setUs(f => ({ ...f, ctpat: !f.ctpat }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${us.ctpat ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF]' : (darkMode ? 'bg-white/20' : 'bg-slate-300')}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${us.ctpat ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <p className={`text-xs ${theme.textDim} p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          FreightWizard uses this for compliance reference only — ABI submissions require certified customs broker software.
        </p>

        <button onClick={() => saveIntegration('US', 'ace', { extra_fields: { ace_filer_code: us.ace_filer_code, ein: us.ein, aes_itn_prefix: us.aes_itn_prefix, ctpat: us.ctpat } })}
          disabled={savingKey === 'US:ace'}
          className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
          {savingKey === 'US:ace' ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => verifyIntegration('US', 'ace')} disabled={verifyingKey === 'US:ace'}
          className={`ml-2 px-4 py-2 border ${theme.cardBorder} ${theme.hover} rounded-xl text-sm font-medium disabled:opacity-50`}>
          {verifyingKey === 'US:ace' ? 'Confirming...' : 'Mark Confirmed'}
        </button>
      </>)}

      {/* EU panel — always visible */}
      {cardWrap('border-[#FFD700]/40', <>
        <div className="flex items-center gap-2">
          <span className="text-lg">🇪🇺</span>
          <h3 className="font-semibold">European Union</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>EORI Number</label>
            <input value={eu.eori} onChange={e => setEu(f => ({ ...f, eori: e.target.value.toUpperCase() }))}
              placeholder="Same as NL EORI if applicable"
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
          </div>
          <div>
            <label className={`text-xs font-medium ${theme.textMuted} mb-1.5 block`}>AEO Status</label>
            <select value={eu.aeo_status} onChange={e => setEu(f => ({ ...f, aeo_status: e.target.value }))}
              className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
              <option value="None">None</option>
              <option value="AEO-C">AEO-C (Customs)</option>
              <option value="AEO-S">AEO-S (Security)</option>
              <option value="AEO-F">AEO-F (Full)</option>
            </select>
            <p className={`text-xs ${theme.textDim} mt-1`}>Speeds up customs clearance across all EU member states</p>
          </div>
        </div>

        <button onClick={() => saveIntegration('EU', 'eu_compliance', { extra_fields: { eori: eu.eori, aeo_status: eu.aeo_status } })}
          disabled={savingKey === 'EU:eu_compliance'}
          className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
          {savingKey === 'EU:eu_compliance' ? 'Saving...' : 'Save'}
        </button>

        {/* TARIC lookup */}
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'} space-y-3`}>
          <p className={`text-sm font-medium ${theme.text}`}>🔍 Look up HS code duty rate</p>
          <div className="flex flex-wrap gap-2">
            <input value={taricHs} onChange={e => setTaricHs(e.target.value)} placeholder="e.g. 0901.21"
              className={`flex-1 min-w-32 px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
            <select value={taricCountry} onChange={e => setTaricCountry(e.target.value)}
              className={`px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
              {['NL', 'DE', 'FR', 'BE', 'IT', 'ES', 'PT', 'PL', 'IE'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={lookupTaric} disabled={taricLoading}
              className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
              {taricLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : 'Look up'}
            </button>
          </div>
          {taricError && <p className="text-xs text-red-400">{taricError}</p>}
          {taricResult && (
            <div className={`p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-white'} border ${theme.cardBorder} text-sm`}>
              <p className={theme.text}><strong>HS {taricResult.hs_code}</strong>: {taricResult.description}</p>
              <p className={theme.textMuted}>Duty: {taricResult.duty_rate} · VAT: {taricResult.vat_rate}</p>
              {taricResult.restrictions?.length > 0 && <p className="text-red-400">⚠️ {taricResult.restrictions.join(', ')}</p>}
            </div>
          )}
          <p className={`text-[10px] ${theme.textDim}`}>Powered by EU TARIC (European Commission)</p>
        </div>
      </>)}
    </div>
  );
}
