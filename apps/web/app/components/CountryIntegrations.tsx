'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Icon from './ui/Icon';
import Toggle from './ui/Toggle';
import { Button, Spinner } from './ui/Button';
import { inputClass, selectClass, selectInlineClass, Field } from './ui/Field';
import { Notice } from './ui/Panel';
import { Tag } from './ui/Tag';
import { Toast } from './ui/Data';
import { toneClass, type Tone } from './ui/tones';

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
  { code: 'BR', name: 'Brazil' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'US', name: 'United States' },
];

/** Country identity as a mono code chip (no flag emoji). */
function CountryCode({ code }: { code: string }) {
  return <span className="inline-flex h-5 min-w-7 items-center justify-center rounded-fw-btn border border-app-line px-1 font-fw-mono text-app-mono-xs text-app-ink-2">{code}</span>;
}

function verifiedBadge(row: IntegrationRow | undefined) {
  if (!row?.last_verified_at) return <Tag tone="neutral">Not verified</Tag>;
  const daysSince = (Date.now() - new Date(row.last_verified_at).getTime()) / 86400000;
  if (daysSince > 30) return <Tag tone="danger">Verification failed</Tag>;
  return <Tag tone="ok">Verified {new Date(row.last_verified_at).toLocaleDateString()}</Tag>;
}

function validateEORI(v: string) { return /^[A-Z]{2}\d{9,12}$/.test(v.replace(/\s/g, '')); }
function validateKVK(v: string) { return /^\d{8}$/.test(v.replace(/\s/g, '')); }
function validateEIN(v: string) { return /^\d{2}-\d{7}$/.test(v.trim()); }

/**
 * Netherlands, United States and EU panels. With `only`, the settings page
 * tabs pick a single panel and this component hides its own selector.
 */
export default function CountryIntegrations({ session, only }: { session: string | null; darkMode: boolean; only?: 'NL' | 'US' | 'EU' }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

  const [nl, setNl] = useState({ portbase_api_key: '', portbase_client_id: '', eori: '', kvk: '' });
  const [us, setUs] = useState({ ace_filer_code: '', ein: '', aes_itn_prefix: '', ctpat: false });
  const [eu, setEu] = useState({ eori: '', aeo_status: 'None' });


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

  const show = (code: string) => (only ? only === code : code === 'EU' || selected.has(code));

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


  const helpLink = (href: string, label = 'Where do I get this?') => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-app-ui-sm text-app-accent hover:underline">{label} <Icon name="external" size={12} /></a>
  );

  const card = (code: string, title: string, badge: ReactNode, children: ReactNode) => (
    <section className="space-y-4 rounded-fw-card border border-app-line bg-app-card p-5">
      <div className="flex items-center gap-2">
        <CountryCode code={code} />
        <h3 className="text-app-ui font-semibold">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );

  const errClass = (bad: boolean) => (bad ? 'border-app-danger-dot focus:border-app-danger-dot focus:ring-app-danger-dot' : '');

  return (
    <div className="space-y-5">
      <Toast notification={notice} />

      {!only && <div>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="flex items-center gap-2 font-fw-display text-app-title-sm font-normal"><Icon name="globe" size={18} className="text-app-accent" /> Country Integrations & Compliance</h2>
          {(() => {
            const activeRows = integrations.filter(i => selected.has(i.country_code) && i.is_active);
            if (activeRows.length === 0) return null;
            const failed = activeRows.some(i => i.last_verified_at && (Date.now() - new Date(i.last_verified_at).getTime()) / 86400000 > 30);
            const allVerified = activeRows.every(i => !!i.last_verified_at);
            const tone: Tone = failed ? 'danger' : allVerified ? 'ok' : 'warn';
            const label = failed ? 'Verification failed' : allVerified ? 'All verified' : 'Some not yet verified';
            return <span className={`size-2 rounded-full ${toneClass[tone].dot}`} title={label} aria-label={label} />;
          })()}
        </div>
        <p className="mb-4 text-app-ui text-app-ink-2">Bring your own credentials (BYOC) — FreightWizard is the interface layer, you contract directly with each authority.</p>

        {/* Country selector */}
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(c => (
            <button key={c.code} onClick={() => toggleCountry(c.code)} aria-pressed={selected.has(c.code)}
              className={`flex h-9 items-center gap-2 rounded-fw-btn border px-3 text-app-ui transition-colors ${
                selected.has(c.code) ? 'border-app-accent-fill bg-app-selected font-medium text-app-ink' : 'border-app-line-strong text-app-ink-2 hover:bg-app-raised'
              }`}>
              <CountryCode code={c.code} /> {c.name}
            </button>
          ))}
          <span className="flex h-9 items-center gap-2 rounded-fw-btn border border-dashed border-app-line-strong px-3 text-app-ui text-app-ink-2">
            <CountryCode code="EU" /> EU <span className="text-app-ui-sm text-app-ink-3">(always shown)</span>
          </span>
        </div>
      </div>}

      {/* Netherlands panel */}
      {show('NL') && card('NL', 'Netherlands', verifiedBadge(rowFor('NL', 'portbase')), <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-app-ui-sm font-medium text-app-ink-2">Portbase API Key</span>
              {helpLink('https://www.portbase.com/en/marketplace/')}
            </div>
            <input type="password" value={nl.portbase_api_key} onChange={e => setNl(f => ({ ...f, portbase_api_key: e.target.value }))} aria-label="Portbase API Key"
              placeholder={rowFor('NL', 'portbase')?.has_api_key ? '(saved — enter to replace)' : ''} className={`${inputClass} font-fw-mono`} />
            <p className="mt-1 text-app-ui-sm text-app-ink-3">Requires an IAMconnected account at portbase.com</p>
          </div>
          <Field label="Portbase Client ID">
            <input value={nl.portbase_client_id} onChange={e => setNl(f => ({ ...f, portbase_client_id: e.target.value }))} className={`${inputClass} font-fw-mono`} />
          </Field>
          <Field label="EORI Number" hint="Your EU Economic Operators Registration and Identification number">
            <input value={nl.eori} onChange={e => setNl(f => ({ ...f, eori: e.target.value.toUpperCase() }))} placeholder="NL123456789"
              className={`${inputClass} font-fw-mono ${errClass(!!nl.eori && !validateEORI(nl.eori))}`} />
            {nl.eori && !validateEORI(nl.eori) && <span className="mt-0.5 block text-app-ui-sm text-app-danger-ink">Format: NL + 9-12 digits</span>}
          </Field>
          <Field label="KVK Number" hint="Dutch Chamber of Commerce (8 digits)">
            <input value={nl.kvk} onChange={e => setNl(f => ({ ...f, kvk: e.target.value }))} placeholder="12345678"
              className={`${inputClass} font-fw-mono ${errClass(!!nl.kvk && !validateKVK(nl.kvk))}`} />
          </Field>
        </div>

        <Notice tone="neutral" icon="info" title="DMS Access (Douane Management Systeem)"
          action={<a href="https://nh.douane.nl" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-app-ui-sm text-app-accent hover:underline">nh.douane.nl <Icon name="external" size={12} /></a>}>
          DMS declarations require certified customs software. FreightWizard currently shows DMS compliance checklists only. Direct DMS filing coming in a future update.
        </Notice>

        <div className="flex gap-2">
          <Button variant="primary" onClick={() => saveIntegration('NL', 'portbase', { api_key: nl.portbase_api_key || undefined, extra_fields: { client_id: nl.portbase_client_id, eori: nl.eori, kvk: nl.kvk } })}
            disabled={savingKey === 'NL:portbase'}>
            {savingKey === 'NL:portbase' ? 'Saving...' : 'Save'}
          </Button>
          <Button icon="plug" onClick={() => verifyIntegration('NL', 'portbase')} disabled={verifyingKey === 'NL:portbase'}>
            {verifyingKey === 'NL:portbase' ? 'Verifying...' : 'Verify Connection'}
          </Button>
        </div>
      </>)}

      {/* USA panel */}
      {show('US') && card('US', 'United States', verifiedBadge(rowFor('US', 'ace')), <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ACE Filer Code" hint="Your CBP-assigned filer code. Only licensed customs brokers can submit ABI entries.">
            <input value={us.ace_filer_code} onChange={e => setUs(f => ({ ...f, ace_filer_code: e.target.value.toUpperCase().slice(0, 3) }))} placeholder="ABC" className={`${inputClass} font-fw-mono`} />
          </Field>
          <Field label="EIN Number">
            <input value={us.ein} onChange={e => setUs(f => ({ ...f, ein: e.target.value }))} placeholder="12-3456789"
              className={`${inputClass} font-fw-mono ${errClass(!!us.ein && !validateEIN(us.ein))}`} />
            {us.ein && !validateEIN(us.ein) && <span className="mt-1 block text-app-ui-sm text-app-danger-ink">Format: XX-XXXXXXX</span>}
          </Field>
          <Field label="AES ITN Prefix">
            <input value={us.aes_itn_prefix} onChange={e => setUs(f => ({ ...f, aes_itn_prefix: e.target.value }))} placeholder="For export shipments" className={`${inputClass} font-fw-mono`} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-app-ui font-medium">CTPAT Member</p>
              <p className="text-app-ui-sm text-app-ink-3">Customs-Trade Partnership Against Terrorism</p>
            </div>
            <Toggle checked={us.ctpat} onChange={() => setUs(f => ({ ...f, ctpat: !f.ctpat }))} label="CTPAT Member" />
          </div>
        </div>

        <Notice tone="neutral" icon="info">FreightWizard uses this for compliance reference only — ABI submissions require certified customs broker software.</Notice>

        <div className="flex gap-2">
          <Button variant="primary" onClick={() => saveIntegration('US', 'ace', { extra_fields: { ace_filer_code: us.ace_filer_code, ein: us.ein, aes_itn_prefix: us.aes_itn_prefix, ctpat: us.ctpat } })}
            disabled={savingKey === 'US:ace'}>
            {savingKey === 'US:ace' ? 'Saving...' : 'Save'}
          </Button>
          <Button icon="check" onClick={() => verifyIntegration('US', 'ace')} disabled={verifyingKey === 'US:ace'}>
            {verifyingKey === 'US:ace' ? 'Confirming...' : 'Mark Confirmed'}
          </Button>
        </div>
      </>)}

      {/* EU panel — always visible */}
      {show('EU') && card('EU', 'European Union', null, <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="EORI Number">
            <input value={eu.eori} onChange={e => setEu(f => ({ ...f, eori: e.target.value.toUpperCase() }))} placeholder="Same as NL EORI if applicable" className={`${inputClass} font-fw-mono`} />
          </Field>
          <Field label="AEO Status" hint="Speeds up customs clearance across all EU member states">
            <select value={eu.aeo_status} onChange={e => setEu(f => ({ ...f, aeo_status: e.target.value }))} className={selectClass}>
              <option value="None">None</option>
              <option value="AEO-C">AEO-C (Customs)</option>
              <option value="AEO-S">AEO-S (Security)</option>
              <option value="AEO-F">AEO-F (Full)</option>
            </select>
          </Field>
        </div>

        <Button variant="primary" onClick={() => saveIntegration('EU', 'eu_compliance', { extra_fields: { eori: eu.eori, aeo_status: eu.aeo_status } })}
          disabled={savingKey === 'EU:eu_compliance'}>
          {savingKey === 'EU:eu_compliance' ? 'Saving...' : 'Save'}
        </Button>

        {/* HS code duty lookup: no free TARIC API behind it yet, so no working-looking form */}
        <Notice tone="neutral" icon="search" title={<span className="flex items-center gap-2">HS code duty lookup <Tag tone="neutral" dot={false}>Coming soon</Tag></span>}>
          Automatic duty-rate lookup isn't available yet. Until then, check a code in the European Commission's{' '}
          <a href="https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en" target="_blank" rel="noopener noreferrer" className="font-medium text-app-accent underline-offset-2 hover:underline">TARIC consultation</a>.
        </Notice>
      </>)}
    </div>
  );
}
