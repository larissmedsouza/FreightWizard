'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/header';

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
    s2SecurityTitle: '🔐 Security Notice',
    s2SecurityDesc: 'All credentials are encrypted with AES-256-GCM before storage. Your certificate and secrets are never exposed after saving.',
    s2Desc: 'The SERPRO Integra Comex Restricted API provides full CE Mercante status, AFRMM values, cargo situation, and dispatch document links. Each company must contract this service directly with SERPRO at ',
    s2DescEnd: ' and receive their own API credentials.',
    clientId: 'SERPRO Client ID', clientSecret: 'SERPRO Client Secret',
    environment: 'Environment', sandbox: 'sandbox', production: 'production',
    certificate: 'e-CPF Certificate (.pfx / .p12)',
    certReplace: 'Replace Certificate', certUpload: 'Upload Certificate',
    certLoaded: '🔐 Certificate loaded (encrypted)', certHint: 'Max 2MB — .pfx or .p12 only',
    certErrExt: 'Only .pfx or .p12 files are accepted', certErrSize: 'Certificate file must be under 2MB',
    certPassword: 'Certificate Password', certCnpj: 'CNPJ Linked to Certificate',
    certCnpjHint: 'Auto-filled from Company Profile if left blank',
    secretPlaceholder: '(saved — enter new value to replace)',
    testBtn: 'Test Connection', removeBtn: 'Remove Credentials',
    // Section 3
    s3Title: 'Siscomex Carga', s3Badge1: 'Public API', s3Badge2: 'No Auth Required',
    s3Status: 'Status', s3Auth: 'Auth Required', s3Endpoint: 'Endpoint', s3Data: 'Data Available',
    s3StatusVal: '🟢 Available (always on)', s3AuthVal: 'None',
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
    s2SecurityTitle: '🔐 Aviso de Segurança',
    s2SecurityDesc: 'Todas as credenciais são criptografadas com AES-256-GCM antes do armazenamento. Seu certificado e segredos nunca são expostos após salvar.',
    s2Desc: 'A API Restrita SERPRO Integra Comex fornece status completo do CE Mercante, valores AFRMM, situação da carga e links de documentos de despacho. Cada empresa deve contratar este serviço diretamente com o SERPRO em ',
    s2DescEnd: ' e receber suas próprias credenciais de API.',
    clientId: 'Client ID SERPRO', clientSecret: 'Client Secret SERPRO',
    environment: 'Ambiente', sandbox: 'homologação', production: 'produção',
    certificate: 'Certificado e-CPF (.pfx / .p12)',
    certReplace: 'Substituir Certificado', certUpload: 'Enviar Certificado',
    certLoaded: '🔐 Certificado carregado (criptografado)', certHint: 'Máx 2MB — apenas .pfx ou .p12',
    certErrExt: 'Apenas arquivos .pfx ou .p12 são aceitos', certErrSize: 'O arquivo deve ter menos de 2MB',
    certPassword: 'Senha do Certificado', certCnpj: 'CNPJ Vinculado ao Certificado',
    certCnpjHint: 'Preenchido automaticamente do Perfil da Empresa se vazio',
    secretPlaceholder: '(salvo — insira novo valor para substituir)',
    testBtn: 'Testar Conexão', removeBtn: 'Remover Credenciais',
    s3Title: 'Siscomex Carga', s3Badge1: 'API Pública', s3Badge2: 'Sem Autenticação',
    s3Status: 'Status', s3Auth: 'Autenticação', s3Endpoint: 'Endpoint', s3Data: 'Dados Disponíveis',
    s3StatusVal: '🟢 Disponível (sempre ativo)', s3AuthVal: 'Nenhuma',
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
    s2SecurityTitle: '🔐 Beveiligingsmelding',
    s2SecurityDesc: 'Alle inloggegevens worden versleuteld opgeslagen met AES-256-GCM. Uw certificaat en geheimen worden nooit blootgesteld na opslaan.',
    s2Desc: 'De SERPRO Integra Comex Beperkte API biedt volledige CE Mercante status, AFRMM-waarden, ladingstatus en verzendingsdocumentlinks. Elk bedrijf moet deze dienst rechtstreeks bij SERPRO contracteren via ',
    s2DescEnd: ' en eigen API-inloggegevens ontvangen.',
    clientId: 'SERPRO Client ID', clientSecret: 'SERPRO Client Secret',
    environment: 'Omgeving', sandbox: 'sandbox', production: 'productie',
    certificate: 'e-CPF Certificaat (.pfx / .p12)',
    certReplace: 'Certificaat Vervangen', certUpload: 'Certificaat Uploaden',
    certLoaded: '🔐 Certificaat geladen (versleuteld)', certHint: 'Max 2MB — alleen .pfx of .p12',
    certErrExt: 'Alleen .pfx of .p12 bestanden zijn toegestaan', certErrSize: 'Bestand moet kleiner zijn dan 2MB',
    certPassword: 'Certificaatwachtwoord', certCnpj: 'CNPJ Gekoppeld aan Certificaat',
    certCnpjHint: 'Automatisch ingevuld vanuit Bedrijfsprofiel indien leeg',
    secretPlaceholder: '(opgeslagen — voer nieuwe waarde in om te vervangen)',
    testBtn: 'Verbinding Testen', removeBtn: 'Inloggegevens Verwijderen',
    s3Title: 'Siscomex Carga', s3Badge1: 'Publieke API', s3Badge2: 'Geen Auth Vereist',
    s3Status: 'Status', s3Auth: 'Authenticatie', s3Endpoint: 'Endpoint', s3Data: 'Beschikbare Data',
    s3StatusVal: '🟢 Beschikbaar (altijd actief)', s3AuthVal: 'Geen',
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

  const theme = darkMode ? {
    bg: 'bg-[#050510]', card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5',
    text: 'text-white', textMuted: 'text-gray-400', textDim: 'text-gray-500',
    input: 'bg-[#0a0a1a] border-white/10 text-white placeholder-gray-600',
    hover: 'hover:bg-white/5', iconFilter: { filter: 'brightness(0) invert(1)' },
    section: 'bg-[#080814]',
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50',
    text: 'text-slate-900', textMuted: 'text-slate-600', textDim: 'text-slate-500',
    input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    hover: 'hover:bg-slate-50', iconFilter: {},
    section: 'bg-slate-50/60',
  };

  const serproConfigured = saved?.hasSerproSecret && saved?.serproClientId;
  const certExpiringSoon = saved?.serproCertExpiry
    ? (new Date(saved.serproCertExpiry).getTime() - Date.now()) / 86400000 < 30
    : false;

  const serproStatusBadge = () => {
    const t = T[language];
    if (!serproConfigured) return { icon: '⚪', text: t.statusNotConfigured, color: 'text-gray-400' };
    if (saved?.serproStatus === 'connected' && certExpiringSoon) {
      const days = Math.ceil((new Date(saved.serproCertExpiry!).getTime() - Date.now()) / 86400000);
      return { icon: '🟡', text: t.statusCertWarning.replace('{days}', String(days)), color: 'text-yellow-400' };
    }
    if (saved?.serproStatus === 'connected') return { icon: '🟢', text: t.statusConnected.replace('{date}', saved.serproCertExpiry || 'unknown'), color: 'text-green-400' };
    if (saved?.serproStatus === 'error') return { icon: '🔴', text: t.statusError, color: 'text-red-400' };
    return { icon: '⚪', text: t.statusNotConfigured, color: 'text-gray-400' };
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

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { type?: string; placeholder?: string; error?: string | null; hint?: string; showToggle?: boolean; onToggle?: () => void; shown?: boolean }) => (
    <div>
      <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>{label}</label>
      <div className="relative">
        <input
          type={opts?.showToggle ? (opts.shown ? 'text' : 'password') : (opts?.type || 'text')}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] transition ${opts?.error ? 'border-red-500' : ''}`}
        />
        {opts?.showToggle && (
          <button type="button" onClick={opts.onToggle} className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${theme.textDim} hover:${theme.textMuted}`}>
            {opts.shown ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {opts?.error && <p className="text-xs text-red-400 mt-1">{opts.error}</p>}
      {opts?.hint && !opts?.error && <p className={`text-xs ${theme.textDim} mt-1`}>{opts.hint}</p>}
    </div>
  );

  const sectionCard = (children: React.ReactNode, className = '') => (
    <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6 space-y-5 ${className}`}>{children}</div>
  );

  const badge = (text: string, color: string) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>{text}</span>
  );

  const status = serproStatusBadge();

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {saveMsg && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${saveMsg.ok ? 'bg-green-500' : 'bg-red-500'}`}>{saveMsg.text}</div>
      )}

      <Header
        session={session} user={user} darkMode={darkMode} language={language}
        onToggleTheme={() => { setDarkMode(d => !d); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); }}
        onChangeLanguage={l => { setLanguage(l); localStorage.setItem('fw_lang', l); }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/dashboard?session=${session}`} className={`text-sm ${theme.textDim} hover:${theme.textMuted} transition`}>{T[language].backToInbox}</Link>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">{T[language].pageTitle}</h1>
          <p className={`text-sm ${theme.textDim}`}>{T[language].pageDesc}</p>
        </div>

        {/* ── SECTION 1: Company Profile ─────────────────────────────────── */}
        {sectionCard(<>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🏢</span>
            <h2 className="text-base font-semibold">{T[language].s1Title}</h2>
          </div>
          <p className={`text-xs ${theme.textDim} -mt-3`}>{T[language].s1Desc}</p>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].companyName, form.companyName, v => setForm(f => ({ ...f, companyName: v })), { placeholder: 'Empresa Ltda.' })}
            <div>
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>{T[language].cnpj}</label>
              <input
                type="text" value={form.cnpj}
                onChange={e => {
                  const v = formatCNPJ(e.target.value);
                  setForm(f => ({ ...f, cnpj: v }));
                  const digits = v.replace(/\D/g, '');
                  setCnpjValid(digits.length === 14 ? validateCNPJ(v) : null);
                }}
                placeholder="00.000.000/0001-00"
                className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] transition ${cnpjValid === false ? 'border-red-500' : cnpjValid === true ? 'border-green-500' : ''}`}
              />
              {cnpjValid === false && <p className="text-xs text-red-400 mt-1">{T[language].cnpjInvalid}</p>}
              {cnpjValid === true && <p className="text-xs text-green-400 mt-1">{T[language].cnpjValid}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].tradeName, form.tradeName, v => setForm(f => ({ ...f, tradeName: v })), { placeholder: 'My Freight Co.' })}
            <div>
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>{T[language].country}</label>
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                <option value="Brazil">Brazil</option>
                <option value="Portugal">Portugal</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {field(T[language].contactName, form.contactName, v => setForm(f => ({ ...f, contactName: v })), { placeholder: 'João Silva' })}
            {field(T[language].contactEmail, form.contactEmail, v => setForm(f => ({ ...f, contactEmail: v })), { type: 'email', placeholder: 'joao@empresa.com.br' })}
            <div>
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>{T[language].contactPhone}</label>
              <input type="text" value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: formatPhone(e.target.value) }))}
                placeholder="(11) 99999-9999"
                className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}
              />
            </div>
          </div>
        </>)}

        {/* ── SECTION 2: SERPRO Integra Comex ─────────────────────────────── */}
        {sectionCard(<>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <h2 className="text-base font-semibold">{T[language].s2Title}</h2>
              {badge(T[language].s2Badge1, 'bg-purple-500/20 text-purple-400')}
              {badge(T[language].s2Badge2, 'bg-green-500/20 text-green-400')}
            </div>
            <span className={`text-xs font-medium ${status.color}`}>{status.icon} {status.text}</span>
          </div>

          {/* Encryption info box */}
          <div className={`p-3 rounded-xl border ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <p className="text-xs text-blue-400 font-medium mb-1">{T[language].s2SecurityTitle}</p>
            <p className={`text-xs ${theme.textDim}`}>{T[language].s2SecurityDesc}</p>
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-xs ${theme.textDim} leading-relaxed`}>
              {T[language].s2Desc}
              <a href="https://atendimento.serpro.gov.br/integracomex" target="_blank" rel="noopener noreferrer" className="text-[#9E14FB] hover:underline">atendimento.serpro.gov.br/integracomex</a>
              {T[language].s2DescEnd}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].clientId, form.serproClientId, v => setForm(f => ({ ...f, serproClientId: v })), {
              placeholder: saved?.serproClientId ? '••••••' + (saved.serproClientId?.slice(-4) || '') : 'Enter client ID',
            })}
            {field(T[language].clientSecret, form.serproClientSecret, v => setForm(f => ({ ...f, serproClientSecret: v })), {
              showToggle: true, shown: showSecret, onToggle: () => setShowSecret(s => !s),
              placeholder: saved?.hasSerproSecret ? T[language].secretPlaceholder : 'Enter client secret',
            })}
          </div>

          {/* Environment toggle */}
          <div>
            <label className={`block text-xs font-medium ${theme.textMuted} mb-2`}>{T[language].environment}</label>
            <div className="flex rounded-xl overflow-hidden border border-white/10 w-fit">
              {(['sandbox', 'production'] as const).map(env => (
                <button key={env} onClick={() => setForm(f => ({ ...f, serproEnvironment: env }))}
                  className={`px-5 py-2 text-sm font-medium transition capitalize ${form.serproEnvironment === env ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : `${darkMode ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'} hover:bg-white/10`}`}>
                  {env === 'sandbox' ? T[language].sandbox : T[language].production}
                </button>
              ))}
            </div>
          </div>

          {/* Certificate upload */}
          <div>
            <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>{T[language].certificate}</label>
            <div className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed ${darkMode ? 'border-white/10' : 'border-slate-200'} ${certError ? 'border-red-500' : ''}`}>
              <input ref={certRef} type="file" accept=".pfx,.p12" onChange={handleCertUpload} className="hidden" />
              <button type="button" onClick={() => certRef.current?.click()}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} transition`}>
                {saved?.hasCertificate ? T[language].certReplace : T[language].certUpload}
              </button>
              <span className={`text-sm ${theme.textDim}`}>
                {certFileName ? certFileName : saved?.hasCertificate ? T[language].certLoaded : T[language].certHint}
              </span>
            </div>
            {certError && <p className="text-xs text-red-400 mt-1">{certError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field(T[language].certPassword, form.serproCertPassword, v => setForm(f => ({ ...f, serproCertPassword: v })), {
              showToggle: true, shown: showCertPass, onToggle: () => setShowCertPass(s => !s),
              placeholder: saved?.hasCertPassword ? T[language].secretPlaceholder : 'Certificate password',
            })}
            {field(T[language].certCnpj, form.serproCertCnpj, v => setForm(f => ({ ...f, serproCertCnpj: formatCNPJ(v) })), {
              placeholder: form.cnpj || '00.000.000/0001-00',
              hint: T[language].certCnpjHint,
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button onClick={handleTest} disabled={testing || !saved?.hasSerproSecret}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${!saved?.hasSerproSecret ? 'opacity-40 cursor-not-allowed' : ''} ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
              {testing ? <span className="w-4 h-4 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin inline-block" /> : '🔌'}
              {T[language].testBtn}
            </button>
            {testResult && (
              <span className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? '✅' : '❌'} {testResult.message}
              </span>
            )}
            <div className="flex-1" />
            {serproConfigured && (
              <button onClick={() => setShowRemoveModal(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 transition">
                {T[language].removeBtn}
              </button>
            )}
          </div>
        </>)}

        {/* ── SECTION 3: Siscomex Carga Public ─────────────────────────────── */}
        {sectionCard(<>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">📡</span>
            <h2 className="text-base font-semibold">{T[language].s3Title}</h2>
            {badge(T[language].s3Badge1, 'bg-blue-500/20 text-blue-400')}
            {badge(T[language].s3Badge2, 'bg-gray-500/20 text-gray-400')}
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-xs ${theme.textDim} leading-relaxed`}>{T[language].siscomexDesc}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              [T[language].s3Status, <span className="text-green-400 font-medium">{T[language].s3StatusVal}</span>],
              [T[language].s3Auth, <span className={theme.textDim}>{T[language].s3AuthVal}</span>],
              [T[language].s3Endpoint, <span className={`text-xs font-mono ${theme.textDim}`}>siscomex-carga.estaleiro.serpro.gov.br</span>],
              [T[language].s3Data, <span className={theme.textDim}>{T[language].s3DataVal}</span>],
            ].map(([label, value]) => (
              <div key={label as string} className={`p-3 rounded-xl ${darkMode ? 'bg-white/3' : 'bg-white/60'} border ${theme.cardBorder}`}>
                <p className={`text-[10px] ${theme.textDim} mb-1`}>{label as string}</p>
                {value}
              </div>
            ))}
          </div>

          <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduaneiro/siscomex" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#9E14FB] hover:underline">
            {T[language].s3Docs}
          </a>
        </>)}

        {/* ── SECTION 4: Fallback & Manual Mode ────────────────────────────── */}
        {sectionCard(<>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">⚙️</span>
            <h2 className="text-base font-semibold">{T[language].s4Title}</h2>
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-xs ${theme.textDim}`}>{T[language].s4Desc}</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{T[language].autoToggle}</p>
              <p className={`text-xs ${theme.textDim}`}>{T[language].autoToggleDesc}</p>
            </div>
            <button onClick={() => setForm(f => ({ ...f, autoRequestMissing: !f.autoRequestMissing }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.autoRequestMissing ? 'bg-[#9E14FB]' : darkMode ? 'bg-white/20' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.autoRequestMissing ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {form.autoRequestMissing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-xs font-medium ${theme.textMuted}`}>{T[language].templateLabel}</label>
                <button onClick={() => setForm(f => ({ ...f, missingDataTemplate: DEFAULT_TEMPLATE }))}
                  className={`text-xs ${theme.textDim} hover:text-[#9E14FB] transition`}>{T[language].resetTemplate}</button>
              </div>
              <div className={`text-xs ${theme.textDim} mb-2 flex gap-2 flex-wrap`}>
                {['{{client_name}}', '{{shipment_route}}', '{{missing_fields}}'].map(v => (
                  <code key={v} className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>{v}</code>
                ))}
              </div>
              <textarea value={form.missingDataTemplate}
                onChange={e => setForm(f => ({ ...f, missingDataTemplate: e.target.value }))}
                rows={8}
                className={`w-full px-3 py-2.5 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none font-mono`}
              />
            </div>
          )}
        </>)}

        {/* Save button */}
        <div className="flex justify-end pb-8">
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? T[language].saving : T[language].saveSettings}
          </button>
        </div>
      </div>

      {/* Remove credentials confirmation modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
            <h3 className="text-base font-semibold mb-2">{T[language].removeModalTitle}</h3>
            <p className={`text-sm ${theme.textDim} mb-5`}>{T[language].removeModalDesc}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRemoveModal(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} transition`}>{T[language].cancel}</button>
              <button onClick={handleRemove} disabled={removing}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50">
                {removing ? T[language].removing : T[language].remove}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
