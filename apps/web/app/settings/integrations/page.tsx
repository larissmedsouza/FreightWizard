'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/header';
import CountryIntegrations from '../../components/CountryIntegrations';
import Icon, { type IconName } from '../../components/ui/Icon';
import TopBar from '../../components/ui/TopBar';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';
import SettingsTabs from '../../components/ui/SettingsTabs';
import { appRootClass, PageHeader, SectionTitle, EmptyState, Notice } from '../../components/ui/Panel';
import { Button, ButtonLink, Spinner } from '../../components/ui/Button';
import { inputClass, selectClass, textareaClass, Field, DataLabel } from '../../components/ui/Field';
import { Tag, Chip } from '../../components/ui/Tag';
import { Toast, Stat, Segmented } from '../../components/ui/Data';
import { toneClass, priorityTone, type Tone } from '../../components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

type Language = 'en' | 'pt' | 'nl';

const T = {
  en: {
    pageTitle: 'Integrations & Credentials',
    pageDesc: 'Configure CE Mercante data sources, SERPRO credentials, and automation settings.',
    backToInbox: '← Back to Inbox',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    savedOk: 'Settings saved successfully',
    // Section 1
    s1Title: 'Company Profile',
    s1Desc: 'Used to pre-fill email templates and Mercante query context.',
    companyName: 'Company Legal Name', tradeName: 'Trade Name / Fantasy Name',
    cnpj: 'CNPJ', country: 'Country of Operation',
    contactName: 'Primary Contact Name', contactEmail: 'Contact Email', contactPhone: 'Contact Phone',
    cnpjInvalid: 'Invalid CNPJ checksum', cnpjValid: 'Valid CNPJ ✓',
    // Section 2
    s2Title: 'SERPRO Integra Comex', s2Badge1: 'Restricted API', s2Badge2: 'Full Data',
    s2SecurityTitle: 'Security Notice',
    s2SecurityDesc: 'All credentials are encrypted with AES-256-GCM before storage. Your certificate and secrets are never exposed after saving.',
    s2Desc: 'The SERPRO Integra Comex Restricted API provides full CE Mercante status, AFRMM values, cargo situation, and dispatch document links. Each company must contract this service directly with SERPRO at ',
    s2DescEnd: ' and receive their own API credentials.',
    clientId: 'SERPRO Client ID', clientSecret: 'SERPRO Client Secret',
    environment: 'Environment', sandbox: 'sandbox', production: 'production',
    certificate: 'e-CPF Certificate (.pfx / .p12)',
    certReplace: 'Replace Certificate', certUpload: 'Upload Certificate',
    certLoaded: 'Certificate loaded (encrypted)', certHint: 'Max 2MB — .pfx or .p12 only',
    certErrExt: 'Only .pfx or .p12 files are accepted', certErrSize: 'Certificate file must be under 2MB',
    certPassword: 'Certificate Password', certCnpj: 'CNPJ Linked to Certificate',
    certCnpjHint: 'Auto-filled from Company Profile if left blank',
    secretPlaceholder: '(saved — enter new value to replace)',
    testBtn: 'Test Connection', removeBtn: 'Remove Credentials',
    // Section 3
    s3Title: 'Siscomex Carga', s3Badge1: 'Public API', s3Badge2: 'No Auth Required',
    s3Status: 'Status', s3Auth: 'Auth Required', s3Endpoint: 'Endpoint', s3Data: 'Data Available',
    s3StatusVal: 'Available (always on)', s3AuthVal: 'None',
    s3DataVal: 'CE last modified, Manifesto, Escala/Vessel',
    s3Docs: 'View API Docs ↗',
    // Section 4
    s4Title: 'Fallback & Manual Mode',
    s4Desc: 'When neither SERPRO credentials nor a CE/BL number are available, the system will show a structured Missing Info card and suggest requesting data from the client.',
    autoToggle: 'Auto-send missing data request to client',
    autoToggleDesc: 'Sends a templated reply automatically when CE/BL is missing',
    templateLabel: 'Reply Template', resetTemplate: 'Reset to default',
    // Remove modal
    removeModalTitle: 'Remove SERPRO Credentials?',
    removeModalDesc: 'This will permanently delete the stored Client Secret, e-CPF certificate, and certificate password. You will need to re-enter them to reconnect.',
    cancel: 'Cancel', remove: 'Remove', removing: 'Removing...',
    statusNotConfigured: 'Not configured',
    statusCertWarning: 'Warning — Certificate expires in {days} days',
    statusConnected: 'Connected — Certificate valid until {date}',
    statusError: 'Error — last test failed',
    siscomexDesc: 'The Siscomex Carga Public API provides basic CE Mercante data (last modified date, manifesto reference, vessel/escala info) without requiring credentials. It is used automatically as a fallback when SERPRO credentials are not configured. No setup required.',
  },
  pt: {
    pageTitle: 'Integrações & Credenciais',
    pageDesc: 'Configure fontes de dados do CE Mercante, credenciais SERPRO e configurações de automação.',
    backToInbox: '← Voltar para Caixa de Entrada',
    saveSettings: 'Salvar Configurações',
    saving: 'Salvando...',
    savedOk: 'Configurações salvas com sucesso',
    s1Title: 'Perfil da Empresa',
    s1Desc: 'Usado para preencher modelos de e-mail e contexto de consulta Mercante.',
    companyName: 'Razão Social', tradeName: 'Nome Fantasia',
    cnpj: 'CNPJ', country: 'País de Operação',
    contactName: 'Nome do Contato', contactEmail: 'E-mail do Contato', contactPhone: 'Telefone do Contato',
    cnpjInvalid: 'CNPJ inválido', cnpjValid: 'CNPJ válido ✓',
    s2Title: 'SERPRO Integra Comex', s2Badge1: 'API Restrita', s2Badge2: 'Dados Completos',
    s2SecurityTitle: 'Aviso de Segurança',
    s2SecurityDesc: 'Todas as credenciais são criptografadas com AES-256-GCM antes do armazenamento. Seu certificado e segredos nunca são expostos após salvar.',
    s2Desc: 'A API Restrita SERPRO Integra Comex fornece status completo do CE Mercante, valores AFRMM, situação da carga e links de documentos de despacho. Cada empresa deve contratar este serviço diretamente com o SERPRO em ',
    s2DescEnd: ' e receber suas próprias credenciais de API.',
    clientId: 'Client ID SERPRO', clientSecret: 'Client Secret SERPRO',
    environment: 'Ambiente', sandbox: 'homologação', production: 'produção',
    certificate: 'Certificado e-CPF (.pfx / .p12)',
    certReplace: 'Substituir Certificado', certUpload: 'Enviar Certificado',
    certLoaded: 'Certificado carregado (criptografado)', certHint: 'Máx 2MB — apenas .pfx ou .p12',
    certErrExt: 'Apenas arquivos .pfx ou .p12 são aceitos', certErrSize: 'O arquivo deve ter menos de 2MB',
    certPassword: 'Senha do Certificado', certCnpj: 'CNPJ Vinculado ao Certificado',
    certCnpjHint: 'Preenchido automaticamente do Perfil da Empresa se vazio',
    secretPlaceholder: '(salvo — insira novo valor para substituir)',
    testBtn: 'Testar Conexão', removeBtn: 'Remover Credenciais',
    s3Title: 'Siscomex Carga', s3Badge1: 'API Pública', s3Badge2: 'Sem Autenticação',
    s3Status: 'Status', s3Auth: 'Autenticação', s3Endpoint: 'Endpoint', s3Data: 'Dados Disponíveis',
    s3StatusVal: 'Disponível (sempre ativo)', s3AuthVal: 'Nenhuma',
    s3DataVal: 'Última modificação CE, Manifesto, Escala/Navio',
    s3Docs: 'Ver Documentação da API ↗',
    s4Title: 'Fallback & Modo Manual',
    s4Desc: 'Quando nem as credenciais SERPRO nem um número CE/BL estão disponíveis, o sistema exibirá um cartão de Informações Ausentes e sugerirá solicitar dados ao cliente.',
    autoToggle: 'Enviar automaticamente solicitação de dados ao cliente',
    autoToggleDesc: 'Envia uma resposta modelo automaticamente quando CE/BL está faltando',
    templateLabel: 'Modelo de Resposta', resetTemplate: 'Redefinir para padrão',
    removeModalTitle: 'Remover Credenciais SERPRO?',
    removeModalDesc: 'Isso excluirá permanentemente o Client Secret, o certificado e-CPF e a senha do certificado. Você precisará inseri-los novamente para reconectar.',
    cancel: 'Cancelar', remove: 'Remover', removing: 'Removendo...',
    statusNotConfigured: 'Não configurado',
    statusCertWarning: 'Aviso — Certificado expira em {days} dias',
    statusConnected: 'Conectado — Certificado válido até {date}',
    statusError: 'Erro — último teste falhou',
    siscomexDesc: 'A API Pública do Siscomex Carga fornece dados básicos do CE Mercante (data da última modificação, referência do manifesto, informações do navio/escala) sem necessidade de credenciais. É usada automaticamente como fallback quando as credenciais SERPRO não estão configuradas.',
  },
  nl: {
    pageTitle: 'Integraties & Inloggegevens',
    pageDesc: 'Configureer CE Mercante gegevensbronnen, SERPRO-inloggegevens en automatiseringsinstellingen.',
    backToInbox: '← Terug naar Inbox',
    saveSettings: 'Instellingen Opslaan',
    saving: 'Opslaan...',
    savedOk: 'Instellingen succesvol opgeslagen',
    s1Title: 'Bedrijfsprofiel',
    s1Desc: 'Gebruikt voor het vooraf invullen van e-mailsjablonen en Mercante querycontext.',
    companyName: 'Bedrijfsnaam (juridisch)', tradeName: 'Handelsnaam',
    cnpj: 'CNPJ', country: 'Land van Operatie',
    contactName: 'Primaire Contactpersoon', contactEmail: 'Contact E-mail', contactPhone: 'Telefoonnummer',
    cnpjInvalid: 'Ongeldig CNPJ', cnpjValid: 'Geldig CNPJ ✓',
    s2Title: 'SERPRO Integra Comex', s2Badge1: 'Beperkte API', s2Badge2: 'Volledige Data',
    s2SecurityTitle: 'Beveiligingsmelding',
    s2SecurityDesc: 'Alle inloggegevens worden versleuteld opgeslagen met AES-256-GCM. Uw certificaat en geheimen worden nooit blootgesteld na opslaan.',
    s2Desc: 'De SERPRO Integra Comex Beperkte API biedt volledige CE Mercante status, AFRMM-waarden, ladingstatus en verzendingsdocumentlinks. Elk bedrijf moet deze dienst rechtstreeks bij SERPRO contracteren via ',
    s2DescEnd: ' en eigen API-inloggegevens ontvangen.',
    clientId: 'SERPRO Client ID', clientSecret: 'SERPRO Client Secret',
    environment: 'Omgeving', sandbox: 'sandbox', production: 'productie',
    certificate: 'e-CPF Certificaat (.pfx / .p12)',
    certReplace: 'Certificaat Vervangen', certUpload: 'Certificaat Uploaden',
    certLoaded: 'Certificaat geladen (versleuteld)', certHint: 'Max 2MB — alleen .pfx of .p12',
    certErrExt: 'Alleen .pfx of .p12 bestanden zijn toegestaan', certErrSize: 'Bestand moet kleiner zijn dan 2MB',
    certPassword: 'Certificaatwachtwoord', certCnpj: 'CNPJ Gekoppeld aan Certificaat',
    certCnpjHint: 'Automatisch ingevuld vanuit Bedrijfsprofiel indien leeg',
    secretPlaceholder: '(opgeslagen — voer nieuwe waarde in om te vervangen)',
    testBtn: 'Verbinding Testen', removeBtn: 'Inloggegevens Verwijderen',
    s3Title: 'Siscomex Carga', s3Badge1: 'Publieke API', s3Badge2: 'Geen Auth Vereist',
    s3Status: 'Status', s3Auth: 'Authenticatie', s3Endpoint: 'Endpoint', s3Data: 'Beschikbare Data',
    s3StatusVal: 'Beschikbaar (altijd actief)', s3AuthVal: 'Geen',
    s3DataVal: 'CE laatste wijziging, Manifesto, Schip/Escala',
    s3Docs: 'API Documentatie Bekijken ↗',
    s4Title: 'Fallback & Handmatige Modus',
    s4Desc: 'Wanneer noch SERPRO-inloggegevens noch een CE/BL-nummer beschikbaar zijn, toont het systeem een gestructureerde ontbrekende informatiekaart.',
    autoToggle: 'Automatisch ontbrekende data aanvragen bij klant',
    autoToggleDesc: 'Stuurt automatisch een sjabloonreactie wanneer CE/BL ontbreekt',
    templateLabel: 'Antwoordsjabloon', resetTemplate: 'Terugzetten naar standaard',
    removeModalTitle: 'SERPRO Inloggegevens Verwijderen?',
    removeModalDesc: 'Dit verwijdert permanent de Client Secret, het e-CPF-certificaat en het certificaatwachtwoord.',
    cancel: 'Annuleren', remove: 'Verwijderen', removing: 'Verwijderen...',
    statusNotConfigured: 'Niet geconfigureerd',
    statusCertWarning: 'Waarschuwing — Certificaat verloopt over {days} dagen',
    statusConnected: 'Verbonden — Certificaat geldig tot {date}',
    statusError: 'Fout — laatste test mislukt',
    siscomexDesc: 'De Siscomex Carga Publieke API biedt basis CE Mercante gegevens (laatste wijzigingsdatum, manifesto referentie, schip/escala info) zonder inloggegevens. Het wordt automatisch gebruikt als fallback wanneer SERPRO niet geconfigureerd is.',
  },
};

// ── CNPJ validation (Brazilian checksum) ──────────────────────────────────────
function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (d: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(d[i]) * w, 0);
  const mod = (n: number) => { const r = n % 11; return r < 2 ? 0 : 11 - r; };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return mod(calc(digits, w1)) === parseInt(digits[12]) && mod(calc(digits, w2)) === parseInt(digits[13]);
}

function formatCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
}

const DEFAULT_TEMPLATE = `Dear {{client_name}},

Thank you for your message regarding your shipment from {{shipment_route}}.

To query the CE Mercante and AFRMM status, we need the following information:
{{missing_fields}}

Please provide these details at your earliest convenience.

Best regards,
[Operator]`;

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const session = searchParams.get('session');
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [certFileName, setCertFileName] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showCertPass, setShowCertPass] = useState(false);
  const certRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    cnpj: '', companyName: '', tradeName: '', country: 'Brazil',
    contactName: '', contactEmail: '', contactPhone: '',
    serproClientId: '', serproClientSecret: '',
    serproCertificate: '', serproCertPassword: '',
    serproCertCnpj: '', serproEnvironment: 'sandbox' as 'production' | 'sandbox',
    autoRequestMissing: false, missingDataTemplate: DEFAULT_TEMPLATE,
    radarStatus: '', mapaEnabled: false, mapaRegistrationNumber: '',
  });

  // Remote state (what was last saved)
  const [saved, setSaved] = useState<{
    hasSerproSecret: boolean; hasCertificate: boolean; hasCertPassword: boolean;
    serproStatus: string; serproCertExpiry: string | null; serproClientId: string;
    serproEnvironment: string;
  } | null>(null);

  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);

  useEffect(() => {
    const dm = localStorage.getItem('fw_theme');
    const lang = localStorage.getItem('fw_lang') as Language | null;
    if (dm) setDarkMode(dm === 'dark');
    if (lang) setLanguage(lang);
    if (session) {
      fetch(`${API_URL}/api/settings/integrations?session=${session}`)
        .then(r => r.json())
        .then(data => {
          if (data.integration) {
            const d = data.integration;
            setForm(f => ({
              ...f,
              cnpj: d.cnpj || '', companyName: d.companyName || '',
              tradeName: d.tradeName || '', country: d.country || 'Brazil',
              contactName: d.contactName || '', contactEmail: d.contactEmail || '',
              contactPhone: d.contactPhone || '', serproClientId: d.serproClientId || '',
              serproCertCnpj: d.serproCertCnpj || '', serproEnvironment: d.serproEnvironment || 'sandbox',
              autoRequestMissing: d.autoRequestMissing || false,
              missingDataTemplate: d.missingDataTemplate || DEFAULT_TEMPLATE,
              radarStatus: d.radarStatus || '', mapaEnabled: !!d.mapaEnabled,
              mapaRegistrationNumber: d.mapaRegistrationNumber || '',
            }));
            setSaved({
              hasSerproSecret: d.hasSerproSecret, hasCertificate: d.hasCertificate,
              hasCertPassword: d.hasCertPassword, serproStatus: d.serproStatus,
              serproCertExpiry: d.serproCertExpiry, serproClientId: d.serproClientId,
              serproEnvironment: d.serproEnvironment,
            });
          }
        }).catch(() => {});
      fetch(`${API_URL}/api/emails?session=${session}`, { method: 'HEAD' })
        .catch(() => {});
      const savedUser = localStorage.getItem('fw_user');
      if (savedUser) try { setUser(JSON.parse(savedUser)); } catch {}
    }
  }, [session]);


  const serproConfigured = saved?.hasSerproSecret && saved?.serproClientId;
  const certExpiringSoon = saved?.serproCertExpiry
    ? (new Date(saved.serproCertExpiry).getTime() - Date.now()) / 86400000 < 30
    : false;

  const serproStatusBadge = (): { tone: Tone; text: string } => {
    const t = T[language];
    if (!serproConfigured) return { tone: 'neutral', text: t.statusNotConfigured };
    if (saved?.serproStatus === 'connected' && certExpiringSoon) {
      const days = Math.ceil((new Date(saved.serproCertExpiry!).getTime() - Date.now()) / 86400000);
      return { tone: 'warn', text: t.statusCertWarning.replace('{days}', String(days)) };
    }
    if (saved?.serproStatus === 'connected') return { tone: 'ok', text: t.statusConnected.replace('{date}', saved.serproCertExpiry || 'unknown') };
    if (saved?.serproStatus === 'error') return { tone: 'danger', text: t.statusError };
    return { tone: 'neutral', text: t.statusNotConfigured };
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCertError(null);
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pfx' && ext !== 'p12') { setCertError(T[language].certErrExt); return; }
    if (file.size > 2 * 1024 * 1024) { setCertError(T[language].certErrSize); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setForm(f => ({ ...f, serproCertificate: (ev.target?.result as string)?.split(',')[1] || '' }));
      setCertFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/integrations?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) setSaveMsg({ text: T[language].savedOk, ok: true });
      else setSaveMsg({ text: 'Save failed: ' + (data.error || 'unknown error'), ok: false });
    } catch { setSaveMsg({ text: 'Save failed — network error', ok: false }); }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 4000);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/integrations/test?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) setSaved(prev => prev ? { ...prev, serproStatus: 'connected', serproCertExpiry: data.certExpiry || prev.serproCertExpiry } : null);
    } catch { setTestResult({ success: false, message: 'Connection test failed — network error' }); }
    setTesting(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await fetch(`${API_URL}/api/settings/integrations/serpro?session=${session}`, { method: 'DELETE' });
      setForm(f => ({ ...f, serproClientId: '', serproClientSecret: '', serproCertificate: '', serproCertPassword: '', serproCertCnpj: '' }));
      setSaved(prev => prev ? { ...prev, hasSerproSecret: false, hasCertificate: false, hasCertPassword: false, serproStatus: 'unconfigured', serproCertExpiry: null, serproClientId: '' } : null);
      setCertFileName(null);
    } catch {}
    setRemoving(false); setShowRemoveModal(false);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { type?: string; placeholder?: string; error?: string | null; hint?: string; showToggle?: boolean; onToggle?: () => void; shown?: boolean; mono?: boolean }) => (
    <div>
      <label className="mb-1 block text-app-ui-sm font-medium text-app-ink-2">{label}</label>
      <div className="relative">
        <input
          type={opts?.showToggle ? (opts.shown ? 'text' : 'password') : (opts?.type || 'text')}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          aria-label={label}
          className={`${inputClass} ${opts?.mono || opts?.showToggle ? 'font-fw-mono' : ''} ${opts?.showToggle ? 'pr-10' : ''} ${opts?.error ? 'border-app-danger-dot' : ''}`}
        />
        {opts?.showToggle && (
          <button type="button" onClick={opts.onToggle} aria-label={opts.shown ? 'Hide value' : 'Show value'}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-fw-btn text-app-ink-3 hover:text-app-ink">
            <Icon name="eye" size={15} />
          </button>
        )}
      </div>
      {opts?.error && <p className="mt-1 text-app-ui-sm text-app-danger-ink">{opts.error}</p>}
      {opts?.hint && !opts?.error && <p className="mt-1 text-app-ui-sm text-app-ink-3">{opts.hint}</p>}
    </div>
  );

  const sectionCard = (children: React.ReactNode, className = '') => (
    <section className={`space-y-5 rounded-fw-card border border-app-line bg-app-card p-5 ${className}`}>{children}</section>
  );

  const sectionHead = (icon: IconName, title: string, extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <Icon name={icon} size={18} className="text-app-accent" />
      <h2 className="font-fw-display text-app-title-sm font-normal">{title}</h2>
      {extra}
    </div>
  );

  const status = serproStatusBadge();
  const toggleTheme = () => { setDarkMode(d => !d); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={saveMsg ? { type: saveMsg.ok ? 'success' : 'error', msg: saveMsg.text } : null} />

      <Header
        session={session} user={user} darkMode={darkMode} language={language}
        onToggleTheme={toggleTheme}
        onChangeLanguage={l => { setLanguage(l); localStorage.setItem('fw_lang', l); }}
      />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <ButtonLink href={`/dashboard?session=${session}`} variant="ghost" size="xs" icon="arrow-left">{T[language].backToInbox.replace(/^←\s*/, '')}</ButtonLink>
        <PageHeader title={T[language].pageTitle} description={T[language].pageDesc} />

        {/* Settings sub-nav */}
        <SettingsTabs active="integrations" session={session} />

        {/* ── SECTION 1: Company Profile ─────────────────────────────────── */}
        {sectionCard(<>
          <div>
            {sectionHead('building', T[language].s1Title)}
            <p className="mt-1 text-app-ui-sm text-app-ink-3">{T[language].s1Desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].companyName, form.companyName, v => setForm(f => ({ ...f, companyName: v })), { placeholder: 'Empresa Ltda.' })}
            <div>
              <label className="mb-1 block text-app-ui-sm font-medium text-app-ink-2">{T[language].cnpj}</label>
              <input
                type="text" value={form.cnpj} aria-label={T[language].cnpj}
                onChange={e => {
                  const v = formatCNPJ(e.target.value);
                  setForm(f => ({ ...f, cnpj: v }));
                  const digits = v.replace(/\D/g, '');
                  setCnpjValid(digits.length === 14 ? validateCNPJ(v) : null);
                }}
                placeholder="00.000.000/0001-00"
                className={`${inputClass} font-fw-mono ${cnpjValid === false ? 'border-app-danger-dot' : cnpjValid === true ? 'border-app-ok-dot' : ''}`}
              />
              {cnpjValid === false && <p className="mt-1 text-app-ui-sm text-app-danger-ink">{T[language].cnpjInvalid}</p>}
              {cnpjValid === true && <p className="mt-1 text-app-ui-sm text-app-ok-ink">{T[language].cnpjValid}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].tradeName, form.tradeName, v => setForm(f => ({ ...f, tradeName: v })), { placeholder: 'My Freight Co.' })}
            <Field label={T[language].country}>
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={selectClass}>
                <option value="Brazil">Brazil</option>
                <option value="Portugal">Portugal</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {field(T[language].contactName, form.contactName, v => setForm(f => ({ ...f, contactName: v })), { placeholder: 'João Silva' })}
            {field(T[language].contactEmail, form.contactEmail, v => setForm(f => ({ ...f, contactEmail: v })), { type: 'email', placeholder: 'joao@empresa.com.br' })}
            {field(T[language].contactPhone, form.contactPhone, v => setForm(f => ({ ...f, contactPhone: formatPhone(v) })), { placeholder: '(11) 99999-9999', mono: true })}
          </div>
        </>)}

        {/* ── SECTION 2: SERPRO Integra Comex ─────────────────────────────── */}
        {sectionCard(<>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {sectionHead('lock', T[language].s2Title, <>
              <Tag tone="accent">{T[language].s2Badge1}</Tag>
              <Tag tone="ok">{T[language].s2Badge2}</Tag>
            </>)}
            <span className={`inline-flex items-center gap-1.5 text-app-ui-sm font-medium ${toneClass[status.tone].text}`}>
              <span aria-hidden className={`size-2 rounded-full ${toneClass[status.tone].dot}`} />{status.text}
            </span>
          </div>

          <Notice tone="info" icon="lock" title={T[language].s2SecurityTitle}>{T[language].s2SecurityDesc}</Notice>

          <p className="rounded-fw-btn border border-app-line bg-app-panel p-3 text-app-ui-sm leading-relaxed text-app-ink-2">
            {T[language].s2Desc}
            <a href="https://atendimento.serpro.gov.br/integracomex" target="_blank" rel="noopener noreferrer" className="font-fw-mono text-app-accent hover:underline">atendimento.serpro.gov.br/integracomex</a>
            {T[language].s2DescEnd}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].clientId, form.serproClientId, v => setForm(f => ({ ...f, serproClientId: v })), {
              placeholder: saved?.serproClientId ? '••••••' + (saved.serproClientId?.slice(-4) || '') : 'Enter client ID', mono: true,
            })}
            {field(T[language].clientSecret, form.serproClientSecret, v => setForm(f => ({ ...f, serproClientSecret: v })), {
              showToggle: true, shown: showSecret, onToggle: () => setShowSecret(s => !s),
              placeholder: saved?.hasSerproSecret ? T[language].secretPlaceholder : 'Enter client secret',
            })}
          </div>

          {/* Environment toggle */}
          <div>
            <p className="mb-1 text-app-ui-sm font-medium text-app-ink-2">{T[language].environment}</p>
            <Segmented label={T[language].environment} value={form.serproEnvironment} onChange={env => setForm(f => ({ ...f, serproEnvironment: env }))}
              options={(['sandbox', 'production'] as const).map(env => ({ value: env, label: env === 'sandbox' ? T[language].sandbox : T[language].production }))} />
          </div>

          {/* Certificate upload */}
          <div>
            <p className="mb-1 text-app-ui-sm font-medium text-app-ink-2">{T[language].certificate}</p>
            <div className={`flex items-center gap-3 rounded-fw-btn border border-dashed p-3 ${certError ? 'border-app-danger-dot' : 'border-app-line-strong'}`}>
              <input ref={certRef} type="file" accept=".pfx,.p12" onChange={handleCertUpload} className="hidden" />
              <Button size="sm" icon="upload" onClick={() => certRef.current?.click()}>
                {saved?.hasCertificate ? T[language].certReplace : T[language].certUpload}
              </Button>
              <span className="flex items-center gap-1.5 text-app-ui-sm text-app-ink-2">
                {certFileName ? <span className="font-fw-mono">{certFileName}</span> : saved?.hasCertificate ? <><Icon name="lock" size={13} className="text-app-ok-ink" />{T[language].certLoaded}</> : T[language].certHint}
              </span>
            </div>
            {certError && <p className="mt-1 text-app-ui-sm text-app-danger-ink">{certError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].certPassword, form.serproCertPassword, v => setForm(f => ({ ...f, serproCertPassword: v })), {
              showToggle: true, shown: showCertPass, onToggle: () => setShowCertPass(s => !s),
              placeholder: saved?.hasCertPassword ? T[language].secretPlaceholder : 'Certificate password',
            })}
            {field(T[language].certCnpj, form.serproCertCnpj, v => setForm(f => ({ ...f, serproCertCnpj: formatCNPJ(v) })), {
              placeholder: form.cnpj || '00.000.000/0001-00', hint: T[language].certCnpjHint, mono: true,
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button icon={testing ? undefined : 'plug'} onClick={handleTest} disabled={testing || !saved?.hasSerproSecret}>
              {testing && <Spinner className="size-3.5 text-app-accent" />}
              {T[language].testBtn}
            </Button>
            {testResult && (
              <span className={`flex items-center gap-1.5 text-app-ui-sm font-medium ${testResult.success ? 'text-app-ok-ink' : 'text-app-danger-ink'}`}>
                <Icon name={testResult.success ? 'check' : 'alert'} size={14} /> {testResult.message}
              </span>
            )}
            <div className="flex-1" />
            {serproConfigured && (
              <Button variant="danger" icon="trash" onClick={() => setShowRemoveModal(true)}>{T[language].removeBtn}</Button>
            )}
          </div>
        </>)}

        {/* ── SECTION 3: Siscomex Carga Public ─────────────────────────────── */}
        {sectionCard(<>
          {sectionHead('globe', T[language].s3Title, <>
            <Tag tone="info">{T[language].s3Badge1}</Tag>
            <Tag tone="neutral">{T[language].s3Badge2}</Tag>
          </>)}

          <p className="rounded-fw-btn border border-app-line bg-app-panel p-3 text-app-ui-sm leading-relaxed text-app-ink-2">{T[language].siscomexDesc}</p>

          <dl className="grid grid-cols-2 gap-3">
            {([
              [T[language].s3Status, <span className="inline-flex items-center gap-1.5 font-medium text-app-ok-ink"><span aria-hidden className="size-2 rounded-full bg-app-ok-dot" />{T[language].s3StatusVal}</span>],
              [T[language].s3Auth, <span className="text-app-ink-2">{T[language].s3AuthVal}</span>],
              [T[language].s3Endpoint, <span className="break-all font-fw-mono text-app-mono-xs text-app-ink-2">siscomex-carga.estaleiro.serpro.gov.br</span>],
              [T[language].s3Data, <span className="text-app-ink-2">{T[language].s3DataVal}</span>],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label} className="rounded-fw-btn border border-app-line bg-app-panel p-3 text-app-ui-sm">
                <DataLabel className="mb-1">{label}</DataLabel>
                {value}
              </div>
            ))}
          </dl>

          <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduaneiro/siscomex" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-app-ui text-app-accent hover:underline">
            {T[language].s3Docs.replace(/\s*↗$/, '')} <Icon name="external" size={13} />
          </a>
        </>)}

        {/* ── SECTION 3b: Brazil — RADAR & MAPA ────────────────────────────── */}
        {sectionCard(<>
          {sectionHead('compliance', 'Additional Compliance', <span className="inline-flex h-5 items-center rounded-fw-btn border border-app-line px-1 font-fw-mono text-app-mono-xs text-app-ink-2">BR</span>)}

          <Field label="RADAR Status">
            <select value={form.radarStatus} onChange={e => setForm(f => ({ ...f, radarStatus: e.target.value }))} className={selectClass}>
              <option value="">Not set</option>
              <option value="Ilimitada">Ilimitada</option>
              <option value="Limitada">Limitada</option>
              <option value="Suspensa">Suspensa</option>
            </select>
          </Field>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-app-ui font-medium">MAPA-regulated shipments</p>
              <p className="text-app-ui-sm text-app-ink-3">This company ships agricultural/food products regulated by MAPA</p>
            </div>
            <Toggle checked={form.mapaEnabled} onChange={() => setForm(f => ({ ...f, mapaEnabled: !f.mapaEnabled }))} label="MAPA-regulated shipments" />
          </div>

          {form.mapaEnabled && (
            <Field label="MAPA Registration Number" hint="When enabled, quote-request emails involving Brazil and regulated commodities (food, grain, coffee, wood, etc.) will show a MAPA alert.">
              <input value={form.mapaRegistrationNumber} onChange={e => setForm(f => ({ ...f, mapaRegistrationNumber: e.target.value }))} className={`${inputClass} font-fw-mono`} />
            </Field>
          )}
        </>)}

        {/* ── SECTION 4: Fallback & Manual Mode ────────────────────────────── */}
        {sectionCard(<>
          {sectionHead('settings', T[language].s4Title)}

          <p className="rounded-fw-btn border border-app-line bg-app-panel p-3 text-app-ui-sm text-app-ink-2">{T[language].s4Desc}</p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-app-ui font-medium">{T[language].autoToggle}</p>
              <p className="text-app-ui-sm text-app-ink-3">{T[language].autoToggleDesc}</p>
            </div>
            <Toggle checked={form.autoRequestMissing} onChange={() => setForm(f => ({ ...f, autoRequestMissing: !f.autoRequestMissing }))} label={T[language].autoToggle} />
          </div>

          {form.autoRequestMissing && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-app-ui-sm font-medium text-app-ink-2">{T[language].templateLabel}</label>
                <Button variant="ghost" size="xs" icon="restore" onClick={() => setForm(f => ({ ...f, missingDataTemplate: DEFAULT_TEMPLATE }))}>{T[language].resetTemplate}</Button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {['{{client_name}}', '{{shipment_route}}', '{{missing_fields}}'].map(v => (
                  <code key={v} className="rounded-fw-btn border border-app-line bg-app-panel px-1.5 py-0.5 font-fw-mono text-app-mono-xs text-app-ink-2">{v}</code>
                ))}
              </div>
              <textarea value={form.missingDataTemplate} onChange={e => setForm(f => ({ ...f, missingDataTemplate: e.target.value }))} rows={8}
                aria-label={T[language].templateLabel} className={`${textareaClass} font-fw-mono text-app-mono`} />
            </div>
          )}
        </>)}

        {/* Save button */}
        <div className="flex justify-end">
          <Button variant="primary" size="lg" onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="size-3.5" />}
            {saving ? T[language].saving : T[language].saveSettings}
          </Button>
        </div>

        <div className="border-t border-app-line pb-8 pt-6">
          <CountryIntegrations session={session} darkMode={darkMode} />
        </div>
      </main>

      {/* Remove credentials confirmation modal */}
      {showRemoveModal && (
        <Modal title={T[language].removeModalTitle} icon="alert" size="sm" onClose={() => setShowRemoveModal(false)}
          footer={<>
            <Button onClick={() => setShowRemoveModal(false)}>{T[language].cancel}</Button>
            <Button variant="danger" icon="trash" onClick={handleRemove} disabled={removing}>{removing ? T[language].removing : T[language].remove}</Button>
          </>}>
          <p className="p-5 text-app-ui text-app-ink-2">{T[language].removeModalDesc}</p>
        </Modal>
      )}
    </div>
  );
}
