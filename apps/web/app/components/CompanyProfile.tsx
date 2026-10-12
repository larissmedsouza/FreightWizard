'use client';

// Settings → Company Profile. Country-aware: the identifier fields, their
// local names, format checks and examples follow the selected country
// (lib/company/rules.ts). Values of other countries stay stored and hidden.
// Saved through GET/PUT /api/company-profile; one profile per company.
import { useEffect, useMemo, useState } from 'react';
import Icon from './ui/Icon';
import Modal from './ui/Modal';
import { Notice } from './ui/Panel';
import { Button, Spinner } from './ui/Button';
import { inputClass, selectClass } from './ui/Field';
import { Tag } from './ui/Tag';
import { API_URL } from '@/app/lib/api';
import { countryName, countryOptions, guessCountry, DIAL_CODES, type Lang } from '@/app/lib/company/countries';
import { countrySchema, validEmail, validPhone, type IdField } from '@/app/lib/company/rules';
import { VERIFIERS, verificationKey, type VerifyResult } from '@/app/lib/company/verify';

interface Address { line1: string; line2: string; postalCode: string; city: string; region: string }
interface Profile {
  country: string; legalName: string; tradeName: string;
  identifiers: Record<string, Record<string, string>>;
  verifications: Record<string, VerifyResult>;
  address: Address; contactName: string; contactEmail: string; phoneCountry: string; phoneNumber: string;
  updatedAt?: string | null;
}

const EMPTY_ADDRESS: Address = { line1: '', line2: '', postalCode: '', city: '', region: '' };
const emptyProfile = (country: string): Profile => ({
  country, legalName: '', tradeName: '', identifiers: {}, verifications: {}, address: { ...EMPTY_ADDRESS },
  contactName: '', contactEmail: '', phoneCountry: '', phoneNumber: '',
});

const T = {
  en: {
    title: 'Company Profile',
    descBR: 'Used to pre-fill email templates and Mercante query context.',
    desc: 'Used to pre-fill email templates and documents.',
    country: 'Country', otherCountries: 'All countries',
    address: 'Address', line1: 'Street and number', line2: 'Address line 2 (optional)', postalCode: 'Postal code', city: 'City',
    contactName: 'Primary contact name', contactEmail: 'Contact email', phone: 'Phone', phoneCode: 'Country code',
    formatOk: 'Format OK', valid: 'Valid', invalid: (ex: string) => `Doesn't match the expected format${ex ? ` (e.g. ${ex})` : ''}`,
    emailInvalid: 'Not a valid email address', phoneInvalid: 'Enter 4 to 14 digits, without the country code',
    hidden: (c: string, fields: string) => `Saved details for ${c} (${fields}) are kept but hidden while another country is selected.`,
    save: 'Save company profile', saving: 'Saving...', saved: 'Company profile saved',
    readOnly: 'Only the account owner or a manager can edit the company profile.',
    shared: (team: string) => `Shared with ${team}`,
    confirmTitle: 'Replace saved details?', confirmIntro: 'Saving changes these saved values:',
    cleared: '(cleared)', cancel: 'Cancel', replace: 'Replace and save',
    countryChange: 'The details of the previous country stay stored and come back if you switch back.',
    check: 'Check', checkValid: 'Found in register', checkInvalid: 'Not found in register', checkUnavailable: 'Register unavailable',
    loadError: 'The company profile could not be loaded.',
  },
  pt: {
    title: 'Perfil da Empresa',
    descBR: 'Usado para preencher modelos de e-mail e o contexto de consulta Mercante.',
    desc: 'Usado para preencher modelos de e-mail e documentos.',
    country: 'País', otherCountries: 'Todos os países',
    address: 'Endereço', line1: 'Logradouro e número', line2: 'Complemento (opcional)', postalCode: 'Código postal', city: 'Cidade',
    contactName: 'Nome do contato principal', contactEmail: 'E-mail do contato', phone: 'Telefone', phoneCode: 'Código do país',
    formatOk: 'Formato OK', valid: 'Válido', invalid: (ex: string) => `Não corresponde ao formato esperado${ex ? ` (ex.: ${ex})` : ''}`,
    emailInvalid: 'E-mail inválido', phoneInvalid: 'Digite de 4 a 14 dígitos, sem o código do país',
    hidden: (c: string, fields: string) => `Os dados salvos de ${c} (${fields}) continuam guardados, mas ocultos enquanto outro país está selecionado.`,
    save: 'Salvar perfil da empresa', saving: 'Salvando...', saved: 'Perfil da empresa salvo',
    readOnly: 'Somente o titular da conta ou um gerente pode editar o perfil da empresa.',
    shared: (team: string) => `Compartilhado com ${team}`,
    confirmTitle: 'Substituir dados salvos?', confirmIntro: 'Salvar altera estes valores salvos:',
    cleared: '(apagado)', cancel: 'Cancelar', replace: 'Substituir e salvar',
    countryChange: 'Os dados do país anterior continuam guardados e voltam se você selecioná-lo de novo.',
    check: 'Verificar', checkValid: 'Encontrado no registro', checkInvalid: 'Não encontrado no registro', checkUnavailable: 'Registro indisponível',
    loadError: 'Não foi possível carregar o perfil da empresa.',
  },
  nl: {
    title: 'Bedrijfsprofiel',
    descBR: 'Gebruikt voor e-mailsjablonen en de Mercante-querycontext.',
    desc: 'Gebruikt voor e-mailsjablonen en documenten.',
    country: 'Land', otherCountries: 'Alle landen',
    address: 'Adres', line1: 'Straat en huisnummer', line2: 'Adresregel 2 (optioneel)', postalCode: 'Postcode', city: 'Plaats',
    contactName: 'Primaire contactpersoon', contactEmail: 'Contact e-mail', phone: 'Telefoon', phoneCode: 'Landcode',
    formatOk: 'Formaat OK', valid: 'Geldig', invalid: (ex: string) => `Komt niet overeen met het verwachte formaat${ex ? ` (bijv. ${ex})` : ''}`,
    emailInvalid: 'Ongeldig e-mailadres', phoneInvalid: 'Vul 4 tot 14 cijfers in, zonder landcode',
    hidden: (c: string, fields: string) => `Opgeslagen gegevens voor ${c} (${fields}) blijven bewaard, maar zijn verborgen zolang een ander land is gekozen.`,
    save: 'Bedrijfsprofiel opslaan', saving: 'Opslaan...', saved: 'Bedrijfsprofiel opgeslagen',
    readOnly: 'Alleen de accounteigenaar of een manager kan het bedrijfsprofiel wijzigen.',
    shared: (team: string) => `Gedeeld met ${team}`,
    confirmTitle: 'Opgeslagen gegevens vervangen?', confirmIntro: 'Opslaan wijzigt deze opgeslagen waarden:',
    cleared: '(gewist)', cancel: 'Annuleren', replace: 'Vervangen en opslaan',
    countryChange: 'De gegevens van het vorige land blijven bewaard en komen terug als je het weer kiest.',
    check: 'Controleren', checkValid: 'Gevonden in register', checkInvalid: 'Niet gevonden in register', checkUnavailable: 'Register niet beschikbaar',
    loadError: 'Het bedrijfsprofiel kon niet worden geladen.',
  },
};

type Change = { label: string; from: string; to: string };

export default function CompanyProfile({ session, language, onCnpjChange }: {
  session: string | null;
  language: Lang;
  /** The Brazilian CNPJ, for the SERPRO certificate CNPJ default. */
  onCnpjChange?: (cnpj: string) => void;
}) {
  const t = T[language];
  const [loaded, setLoaded] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>(() => emptyProfile(typeof navigator !== 'undefined' ? guessCountry(navigator.language) : 'BR'));
  const [canEdit, setCanEdit] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!session);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Change[] | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${API_URL}/api/company-profile?session=${session}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        setCanEdit(data.canEdit !== false);
        setTeamName(data.teamName || null);
        if (data.profile) { setLoaded(data.profile); setForm(data.profile); }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [session]);

  const schema = countrySchema(form.country);
  const ex = schema.examples;
  const ids = form.identifiers[form.country] || {};
  const { top, rest } = useMemo(() => countryOptions(language), [language]);
  const phoneCountry = form.phoneCountry || form.country;

  useEffect(() => { onCnpjChange?.(form.identifiers.BR?.cnpj || ''); }, [form.identifiers.BR?.cnpj]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Profile>) => setForm(f => ({ ...f, ...patch }));
  const setAddress = (patch: Partial<Address>) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));
  const setId = (field: IdField, value: string) => setForm(f => ({
    ...f, identifiers: { ...f.identifiers, [f.country]: { ...(f.identifiers[f.country] || {}), [field.key]: field.format ? field.format(value) : value } },
  }));

  // Other countries' stored identifiers: kept, hidden, and said so.
  const hiddenNotes = Object.entries(form.identifiers)
    .filter(([c, v]) => c !== form.country && Object.values(v).some(Boolean))
    .map(([c, v]) => {
      const labels = countrySchema(c).ids.filter(f => v[f.key]).map(f => f.label[language]);
      return { country: c, text: t.hidden(countryName(c, language), labels.join(', ')) };
    });

  const dirty = JSON.stringify(normalize(form)) !== JSON.stringify(normalize(loaded || emptyProfile(form.country)));

  /** Saved, non-empty values this save would replace or clear. */
  const overwrites = (): Change[] => {
    if (!loaded) return [];
    const out: Change[] = [];
    const cmp = (label: string, from: string, to: string) => { if (from && from !== to) out.push({ label, from, to }); };
    if (loaded.country !== form.country) out.push({ label: t.country, from: countryName(loaded.country, language), to: `${countryName(form.country, language)} — ${t.countryChange}` });
    cmp(schema.legalName[language], loaded.legalName, form.legalName);
    cmp(schema.tradeName[language], loaded.tradeName, form.tradeName);
    for (const [c, fields] of Object.entries(form.identifiers)) {
      for (const f of countrySchema(c).ids) cmp(`${f.label[language]} (${c})`, loaded.identifiers[c]?.[f.key] || '', fields[f.key] || '');
    }
    cmp(t.line1, loaded.address.line1, form.address.line1);
    cmp(t.line2, loaded.address.line2, form.address.line2);
    cmp(t.postalCode, loaded.address.postalCode, form.address.postalCode);
    cmp(t.city, loaded.address.city, form.address.city);
    if (schema.region) cmp(schema.region[language], loaded.address.region, form.address.region);
    cmp(t.contactName, loaded.contactName, form.contactName);
    cmp(t.contactEmail, loaded.contactEmail, form.contactEmail);
    const phone = (p: Profile) => (p.phoneNumber ? `+${DIAL_CODES[p.phoneCountry || p.country] || ''} ${p.phoneNumber}` : '');
    cmp(t.phone, phone(loaded), phone(form));
    return out;
  };

  const save = async () => {
    setConfirm(null); setSaving(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/company-profile?session=${session}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phoneCountry: form.phoneNumber ? phoneCountry : form.phoneCountry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLoaded(data.profile); setForm(data.profile);
      setMessage({ ok: true, text: t.saved });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    }
    setSaving(false);
  };

  const onSave = () => { const changes = overwrites(); if (changes.length) setConfirm(changes); else save(); };

  // ---- Field rendering -------------------------------------------------------

  const label = (text: string, htmlFor: string) => <label htmlFor={htmlFor} className="mb-1 block text-app-ui-sm font-medium text-app-ink-2">{text}</label>;
  const status = (state: 'ok' | 'bad' | null, okText: string, badText: string, hint?: string) =>
    state === 'bad' ? <p className="mt-1 text-app-ui-sm text-app-danger-ink">{badText}</p>
      : state === 'ok' ? <p className="mt-1 flex items-center gap-1 text-app-ui-sm text-app-ok-ink"><Icon name="check" size={13} />{okText}</p>
        : hint ? <p className="mt-1 text-app-ui-sm text-app-ink-3">{hint}</p> : null;
  const tone = (state: 'ok' | 'bad' | null) => (state === 'bad' ? 'border-app-danger-dot' : state === 'ok' ? 'border-app-ok-dot' : '');

  const textField = (id: string, text: string, value: string, onChange: (v: string) => void, opts: { placeholder?: string; type?: string; state?: 'ok' | 'bad' | null; bad?: string; className?: string } = {}) => (
    <div className={opts.className}>
      {label(text, id)}
      <input id={id} type={opts.type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder}
        disabled={!canEdit} className={`${inputClass} ${tone(opts.state ?? null)}`} />
      {status(opts.state ?? null, '', opts.bad || '')}
    </div>
  );

  // Register check (EU tools): only when a verifier is registered for the field.
  const checkSlot = (field: IdField, value: string) => {
    const verifier = field.check && VERIFIERS[field.check];
    const key = verificationKey(form.country, field.key);
    const stored = loaded?.identifiers[form.country]?.[field.key] === value ? form.verifications?.[key] : undefined;
    if (!verifier && !stored) return null;
    return (
      <div className="mt-1 flex items-center gap-2">
        {stored && <Tag tone={stored.status === 'valid' ? 'ok' : stored.status === 'invalid' ? 'danger' : 'warn'}>
          {stored.status === 'valid' ? t.checkValid : stored.status === 'invalid' ? t.checkInvalid : t.checkUnavailable}
        </Tag>}
        {verifier && (
          <Button size="xs" variant="ghost" disabled={!value || checking === key || !session} onClick={async () => {
            setChecking(key);
            try {
              const result = await verifier(value, form.country, session!);
              setForm(f => ({ ...f, verifications: { ...f.verifications, [key]: result } }));
            } finally { setChecking(null); }
          }}>{checking === key ? <Spinner className="size-3" /> : t.check}</Button>
        )}
      </div>
    );
  };

  const idField = (field: IdField) => {
    const value = ids[field.key] || '';
    const state = value ? (field.valid(value) ? 'ok' : 'bad') : null;
    const id = `cp-${field.key}`;
    return (
      <div key={`${form.country}-${field.key}`}>
        {label(field.label[language], id)}
        <input id={id} value={value} onChange={e => setId(field, e.target.value)} placeholder={field.placeholder}
          disabled={!canEdit} spellCheck={false} autoComplete="off"
          className={`${inputClass} font-fw-mono ${tone(state)}`} data-check={field.check || undefined} />
        {status(state, field.checksum ? t.valid : t.formatOk, t.invalid(field.placeholder), field.hint?.[language])}
        {checkSlot(field, value)}
      </div>
    );
  };

  if (loading) {
    return <section className="flex items-center gap-2 rounded-fw-card border border-app-line bg-app-card p-5 text-app-ui-sm text-app-ink-3"><Spinner className="size-3.5" /> {t.title}</section>;
  }

  const emailState = form.contactEmail ? (validEmail(form.contactEmail) ? null : 'bad') : null;
  const phoneState = form.phoneNumber ? (validPhone(form.phoneNumber) ? null : 'bad') : null;

  return (
    <section className="space-y-5 rounded-fw-card border border-app-line bg-app-card p-5" aria-labelledby="company-profile-title">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="building" size={18} className="text-app-accent" />
          <h2 id="company-profile-title" className="font-fw-display text-app-title-sm font-normal">{t.title}</h2>
          {teamName && <Tag tone="neutral">{t.shared(teamName)}</Tag>}
        </div>
        <p className="mt-1 text-app-ui-sm text-app-ink-3">{schema.mercante ? t.descBR : t.desc}</p>
      </div>

      {loadError && <Notice tone="danger" icon="alert">{t.loadError}</Notice>}
      {!canEdit && <Notice tone="info" icon="lock">{t.readOnly}</Notice>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          {label(t.country, 'cp-country')}
          <select id="cp-country" value={form.country} disabled={!canEdit} className={selectClass}
            onChange={e => set({ country: e.target.value })}>
            {top.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            <optgroup label={t.otherCountries}>
              {rest.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {textField('cp-legal', schema.legalName[language], form.legalName, v => set({ legalName: v }), { placeholder: ex.legalName })}
        {textField('cp-trade', schema.tradeName[language], form.tradeName, v => set({ tradeName: v }), { placeholder: ex.tradeName })}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${schema.ids.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {schema.ids.map(idField)}
      </div>

      {hiddenNotes.map(n => <Notice key={n.country} tone="info" icon="info">{n.text}</Notice>)}

      <fieldset className="space-y-4">
        <legend className="mb-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{t.address}</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField('cp-line1', t.line1, form.address.line1, v => setAddress({ line1: v }), { placeholder: ex.line1 })}
          {textField('cp-line2', t.line2, form.address.line2, v => setAddress({ line2: v }))}
        </div>
        <div className={`grid grid-cols-1 gap-4 ${schema.region ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {textField('cp-postal', t.postalCode, form.address.postalCode, v => setAddress({ postalCode: v }), { placeholder: ex.postalCode })}
          {textField('cp-city', t.city, form.address.city, v => setAddress({ city: v }), { placeholder: ex.city })}
          {schema.region && textField('cp-region', schema.region[language], form.address.region, v => setAddress({ region: v }), { placeholder: ex.region })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {textField('cp-contact', t.contactName, form.contactName, v => set({ contactName: v }), { placeholder: ex.contactName })}
        {textField('cp-email', t.contactEmail, form.contactEmail, v => set({ contactEmail: v }), { type: 'email', placeholder: ex.contactEmail, state: emailState, bad: t.emailInvalid })}
      </div>

      <div>
        {label(t.phone, 'cp-phone')}
        <div className="flex gap-2">
          <select aria-label={t.phoneCode} value={phoneCountry} disabled={!canEdit} className={`${selectClass} w-auto max-w-[45%] flex-shrink-0`}
            onChange={e => set({ phoneCountry: e.target.value })}>
            {[...top, ...rest].map(c => <option key={c.code} value={c.code}>{c.name} (+{DIAL_CODES[c.code]})</option>)}
          </select>
          <span className="flex items-center font-fw-mono text-app-ui text-app-ink-2" aria-hidden>+{DIAL_CODES[phoneCountry]}</span>
          <input id="cp-phone" type="tel" value={form.phoneNumber} onChange={e => set({ phoneNumber: e.target.value.replace(/[^0-9 ()\-.]/g, '') })}
            placeholder={phoneCountry === form.country ? ex.phone : ''} disabled={!canEdit}
            className={`${inputClass} min-w-0 flex-1 font-fw-mono ${tone(phoneState)}`} />
        </div>
        {status(phoneState, '', t.phoneInvalid)}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {message && <span className={`text-app-ui-sm ${message.ok ? 'text-app-ok-ink' : 'text-app-danger-ink'}`}>{message.text}</span>}
          <Button variant="primary" onClick={onSave} disabled={saving || !session || !dirty}>
            {saving && <Spinner className="size-3.5" />}
            {saving ? t.saving : t.save}
          </Button>
        </div>
      )}

      {confirm && (
        <Modal title={t.confirmTitle} icon="alert" size="sm" onClose={() => setConfirm(null)}
          footer={<>
            <Button onClick={() => setConfirm(null)}>{t.cancel}</Button>
            <Button variant="primary" onClick={save}>{t.replace}</Button>
          </>}>
          <div className="space-y-3 p-5 text-app-ui text-app-ink-2">
            <p>{t.confirmIntro}</p>
            <ul className="space-y-2">
              {confirm.map(c => (
                <li key={c.label} className="rounded-fw-btn border border-app-line bg-app-panel p-2 text-app-ui-sm">
                  <span className="font-medium text-app-ink">{c.label}</span>
                  <span className="block font-fw-mono text-app-mono-xs text-app-ink-3">{c.from} → {c.to || t.cleared}</span>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** For change detection: drops empty identifiers and server-only fields. */
function normalize(p: Profile) {
  const identifiers: Record<string, Record<string, string>> = {};
  for (const [c, f] of Object.entries(p.identifiers)) {
    const kept = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    if (Object.keys(kept).length) identifiers[c] = kept;
  }
  return { ...p, identifiers, verifications: undefined, updatedAt: undefined };
}
