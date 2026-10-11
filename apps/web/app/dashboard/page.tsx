'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import QuoteBuilderModal, { Quote } from '../components/QuoteBuilderModal';
import TrialBanner from '../components/TrialBanner';
import UpgradeModal, { UpgradeReason } from '../components/UpgradeModal';
import Icon, { type IconName, toIconName } from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import { appRootClass, EmptyState, Notice } from '../components/ui/Panel';
import { Button, Spinner } from '../components/ui/Button';
import { inputClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, PriorityTag, WorkflowTag, Chip } from '../components/ui/Tag';
import { toneClass, priorityTone, labelTone, workflowTone, type Tone } from '../components/ui/tones';
import { decodeEntities } from '../components/ui/text';

import { API_URL } from '@/app/lib/api';

// Legacy <img> icons, replaced section by section with the shared line icons.
const ImgIcon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

interface Email {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  analysis?: any;
  isAnalyzing?: boolean;
  // From /api/emails: bulk = newsletter/marketing (labelled without AI), score = freight likelihood
  triage?: { bulk: boolean; reasons: string[]; score: number };
  // From the mailbox thread (Gmail threadId / Outlook conversationId): replied = the user sent a
  // message in the thread after this one, from anywhere; draft = the user's latest draft there.
  repliedAt?: string | null;
  responseMinutes?: number | null;
  draft?: { id: string; at: string; text: string } | null;
}

// One rule set for the folder lists and their counts (status folders follow the mailbox).
function inSystemFolder(e: Email, key: string): boolean {
  const a = e.analysis;
  const waiting = !!a && !e.repliedAt && a.intent !== 'marketing';
  switch (key) {
    case 'urgent': return a?.priority?.toLowerCase() === 'urgent';
    case 'high': return a?.priority?.toLowerCase() === 'high';
    case 'medium': return a?.priority?.toLowerCase() === 'medium';
    case 'low': return a?.priority?.toLowerCase() === 'low';
    case 'replied': return !!e.repliedAt;
    case 'not_replied': return waiting;
    case 'draft_saved': return !!e.draft;
    case 'ocean': return a?.mode?.toLowerCase() === 'ocean';
    case 'air': return a?.mode?.toLowerCase() === 'air';
    case 'road': return a?.mode?.toLowerCase() === 'road';
    case 'rail': return a?.mode?.toLowerCase() === 'rail';
    case 'quote_request': return a?.intent === 'quote_request';
    case 'booking_confirmation': return a?.intent === 'booking_confirmation';
    case 'tracking_inquiry': return a?.intent === 'tracking_inquiry';
    case 'documentation_request': return a?.intent === 'documentation_request';
    case 'urgent_high_waiting': return waiting && ['urgent', 'high'].includes(a?.priority?.toLowerCase());
    default: return false;
  }
}

type AnalyzeOutcome = 'analyzed' | 'marketing' | 'limit' | 'auth' | 'failed';

interface CustomLabel {
  key: string;
  label: string;
  color: string;
  icon: string;
  isFolder?: boolean;
}

interface MercanteEntities {
  ce_number: string | null;
  bl_number: string | null;
  container_number: string | null;
  vessel_name: string | null;
  voyage: string | null;
  discharge_port: string | null;
  origin_port: string | null;
  carrier: string | null;
  importer_cnpj: string | null;
  shipment_date: string | null;
}

interface MercanteResult {
  // tier & source (new 3-tier fields)
  tier?: 'restricted' | 'public' | 'mock' | 'missing_info';
  source?: 'serpro_integracomex' | 'siscomex_public' | 'mock' | 'none';
  // core fields
  ce_number: string | null;
  bl_number: string | null;
  manifesto: string | null;
  vessel_name: string | null;
  vessel?: string | null;
  voyage: string | null;
  discharge_port: string | null;
  carrier?: string | null;
  afrmm_status: 'paid' | 'pending' | 'unknown';
  afrmm_value?: number | null;
  cargo_situation?: string | null;
  operational_status?: string;
  pending_items: string[];
  last_checked: string;
  last_modified?: string | null;
  response_confidence?: 'high' | 'medium' | 'low';
  confidence?: 'high' | 'medium' | 'low';
  suggested_action: string;
  missingFields?: string[];
  note?: string;
  error?: string;
}

interface MercanteState {
  result: MercanteResult | null;
  rules: { blocked: boolean; alerts: string[]; suggestedAction: string } | null;
  loading: boolean;
  error: string | null;
  lastAction: string | null;
}

interface Note {
  id: string;
  emailId: string;
  text: string;
  author: string;
  createdAt: string;
}

interface Assignment {
  owner: string;
  watchers: string[];
  queue: string;
}

type WorkflowStatus = 'new' | 'quoted' | 'booked' | 'pending_docs' | 'waiting_customer' | 'closed';
type Language = 'en' | 'pt' | 'nl';
type FolderKey = 'all' | 'urgent' | 'high' | 'medium' | 'low' | 'replied' | 'draft_saved' | 'not_replied' | 'ocean' | 'air' | 'road' | 'rail' | 'quote_request' | 'booking_confirmation' | 'tracking_inquiry' | 'documentation_request' | 'trash' | string;

interface FolderDef {
  key: FolderKey;
  label: string;
  icon: IconName;
  iconStyle?: React.CSSProperties;
  group: string;
  color?: string;
}

// Tag colours come from workflowTone() (components/ui/tones.ts).
const WORKFLOW_STATUSES: { key: WorkflowStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'pending_docs', label: 'Pending Docs' },
  { key: 'waiting_customer', label: 'Waiting' },
  { key: 'closed', label: 'Closed' },
];

// One option per tag tone (values keep the stored format; see labelTone()).
const LABEL_COLORS = [
  { name: 'Indigo', value: 'text-indigo-400' },
  { name: 'Blue', value: 'text-blue-400' },
  { name: 'Green', value: 'text-green-400' },
  { name: 'Amber', value: 'text-amber-400' },
  { name: 'Red', value: 'text-red-400' },
  { name: 'Gray', value: 'text-gray-400' },
];

const MODE_ICON: Record<string, IconName> = { ocean: 'ocean', sea: 'ocean', air: 'air', road: 'road', truck: 'road', rail: 'rail' };

const LABEL_ICONS: IconName[] = ['tag', 'pin', 'star', 'folder', 'attach', 'check', 'bell', 'building', 'flag', 'link'];

const translations = {
  en: { inbox: 'Inbox', analyzeAll: 'Analyze All', analyzing: 'Analyzing', selectEmail: 'Select an email to view details', connect: 'Connect Your Email', connectDesc: 'Connect your Gmail or Outlook to analyze freight emails with AI', connectGmail: 'Connect Gmail', connectOutlook: 'Connect Outlook', disconnect: 'Disconnect', analyze: 'Analyze with AI', from: 'From', aiAnalysis: 'AI Analysis', intent: 'Intent', priority: 'Priority', mode: 'Mode', route: 'Route', summary: 'Summary', missingInfo: 'Missing Info', suggestedReply: 'Suggested Reply', sendReply: 'Send', editReply: 'Edit', saveDraft: 'Save Draft', cancel: 'Cancel', sending: 'Sending...', saving: 'Saving...', search: 'Search emails...', allMail: 'All Mail', compose: 'Compose', trash: 'Trash', restore: 'Restore', deleteForever: 'Delete Forever', trashEmpty: 'Trash is empty',
    groupPriority: 'PRIORITY', groupStatus: 'STATUS', groupTransport: 'TRANSPORT', groupIntent: 'INTENT',
    foldersLabels: 'Folders & Labels', folderBtn: 'Folder', labelBtn: 'Label',
    mercanteStatus: 'Mercante Status', mercanteCannotQuery: 'Cannot query CE Mercante: missing CE number or linked BL.', mercanteSuggestedAction: 'Suggested action: request data from client.', mercanteRequestMissing: 'Request Missing Data from Client',
    mercanteTierFull: 'Full Data — SERPRO', mercanteTierBasic: 'Basic Data — Siscomex', mercanteTierMock: 'Dev Mock', mercanteTierNoData: 'No Data',
    mercanteUpgradePrompt: 'Configure SERPRO credentials for full AFRMM status and cargo release data.', mercanteSetUp: 'Set up →',
    mercanteMissingDesc: 'Missing data required to query Sistema Mercante:', mercanteRequestClient: 'Request from Client',
    mercanteNotLocated: 'Not Located', mercanteQueryPrompt: 'Query Sistema Mercante to get CE status', mercanteConsult: 'Consult CE Mercante',
    fieldCE: 'CE Mercante', fieldBL: 'BL / MBL / HBL', fieldManifesto: 'Manifesto', fieldVessel: 'Vessel / Voyage', fieldDischargePort: 'Discharge Port', fieldCarrier: 'Carrier',
    fieldAfrmmStatus: 'AFRMM Status', fieldAfrmmAvailSerpro: 'Available with SERPRO credentials', fieldAfrmmAmount: 'AFRMM Amount Due', fieldConfidence: 'Confidence', fieldLastChecked: 'Last Checked', fieldOperationalStatus: 'Operational Status', fieldPendingItems: 'Pending Items', fieldSuggestedAction: 'Suggested Action', fieldSource: 'Source:',
    translateReply: 'Translate reply', translating: 'Translating...',
  },
  pt: { inbox: 'Caixa de Entrada', analyzeAll: 'Analisar Todos', analyzing: 'Analisando', selectEmail: 'Selecione um email para ver detalhes', connect: 'Conectar Seu Email', connectDesc: 'Conecte seu Gmail ou Outlook para analisar emails de frete com IA', connectGmail: 'Conectar Gmail', connectOutlook: 'Conectar Outlook', disconnect: 'Desconectar', analyze: 'Analisar com IA', from: 'De', aiAnalysis: 'Análise de IA', intent: 'Intenção', priority: 'Prioridade', mode: 'Modo', route: 'Rota', summary: 'Resumo', missingInfo: 'Info Faltando', suggestedReply: 'Resposta Sugerida', sendReply: 'Enviar', editReply: 'Editar', saveDraft: 'Salvar Rascunho', cancel: 'Cancelar', sending: 'Enviando...', saving: 'Salvando...', search: 'Buscar emails...', allMail: 'Todos', compose: 'Escrever', trash: 'Lixeira', restore: 'Restaurar', deleteForever: 'Apagar', trashEmpty: 'Lixeira vazia',
    groupPriority: 'PRIORIDADE', groupStatus: 'STATUS', groupTransport: 'TRANSPORTE', groupIntent: 'INTENÇÃO',
    foldersLabels: 'Pastas & Etiquetas', folderBtn: 'Pasta', labelBtn: 'Etiqueta',
    mercanteStatus: 'Status Mercante', mercanteCannotQuery: 'Não é possível consultar o CE Mercante: número CE ou BL vinculado ausente.', mercanteSuggestedAction: 'Ação sugerida: solicitar dados ao cliente.', mercanteRequestMissing: 'Solicitar Dados Ausentes ao Cliente',
    mercanteTierFull: 'Dados Completos — SERPRO', mercanteTierBasic: 'Dados Básicos — Siscomex', mercanteTierMock: 'Mock Dev', mercanteTierNoData: 'Sem Dados',
    mercanteUpgradePrompt: 'Configure credenciais SERPRO para status AFRMM completo e dados de liberação de carga.', mercanteSetUp: 'Configurar →',
    mercanteMissingDesc: 'Dados necessários para consultar o Sistema Mercante ausentes:', mercanteRequestClient: 'Solicitar ao Cliente',
    mercanteNotLocated: 'Não Localizado', mercanteQueryPrompt: 'Consultar Sistema Mercante para obter status do CE', mercanteConsult: 'Consultar CE Mercante',
    fieldCE: 'CE Mercante', fieldBL: 'BL / MBL / HBL', fieldManifesto: 'Manifesto', fieldVessel: 'Navio / Viagem', fieldDischargePort: 'Porto de Descarga', fieldCarrier: 'Armador',
    fieldAfrmmStatus: 'Status AFRMM', fieldAfrmmAvailSerpro: 'Disponível com credenciais SERPRO', fieldAfrmmAmount: 'Valor AFRMM Devido', fieldConfidence: 'Confiança', fieldLastChecked: 'Última Verificação', fieldOperationalStatus: 'Status Operacional', fieldPendingItems: 'Itens Pendentes', fieldSuggestedAction: 'Ação Sugerida', fieldSource: 'Fonte:',
    translateReply: 'Traduzir resposta', translating: 'Traduzindo...',
  },
  nl: { inbox: 'Inbox', analyzeAll: 'Analyseer Alles', analyzing: 'Analyseren', selectEmail: 'Selecteer een email', connect: 'Verbind Je Email', connectDesc: 'Verbind je Gmail of Outlook', connectGmail: 'Gmail Verbinden', connectOutlook: 'Outlook Verbinden', disconnect: 'Ontkoppelen', analyze: 'Analyseer met AI', from: 'Van', aiAnalysis: 'AI Analyse', intent: 'Intentie', priority: 'Prioriteit', mode: 'Modus', route: 'Route', summary: 'Samenvatting', missingInfo: 'Ontbrekende Info', suggestedReply: 'Voorgesteld Antwoord', sendReply: 'Verstuur', editReply: 'Bewerk', saveDraft: 'Concept Opslaan', cancel: 'Annuleren', sending: 'Versturen...', saving: 'Opslaan...', search: 'Emails zoeken...', allMail: 'Alle mail', compose: 'Opstellen', trash: 'Prullenbak', restore: 'Herstellen', deleteForever: 'Verwijderen', trashEmpty: 'Prullenbak leeg',
    groupPriority: 'PRIORITEIT', groupStatus: 'STATUS', groupTransport: 'TRANSPORT', groupIntent: 'INTENTIE',
    foldersLabels: 'Mappen & Labels', folderBtn: 'Map', labelBtn: 'Label',
    mercanteStatus: 'Mercante Status', mercanteCannotQuery: 'Kan CE Mercante niet bevragen: CE-nummer of gekoppeld BL ontbreekt.', mercanteSuggestedAction: 'Aanbevolen actie: vraag gegevens op bij klant.', mercanteRequestMissing: 'Ontbrekende Gegevens Opvragen bij Klant',
    mercanteTierFull: 'Volledige Data — SERPRO', mercanteTierBasic: 'Basisdata — Siscomex', mercanteTierMock: 'Dev Mock', mercanteTierNoData: 'Geen Data',
    mercanteUpgradePrompt: 'Configureer SERPRO-inloggegevens voor volledige AFRMM-status en vrachtgegevens.', mercanteSetUp: 'Instellen →',
    mercanteMissingDesc: 'Ontbrekende gegevens voor het bevragen van Sistema Mercante:', mercanteRequestClient: 'Opvragen bij Klant',
    mercanteNotLocated: 'Niet Gevonden', mercanteQueryPrompt: 'Bevraag Sistema Mercante voor CE-status', mercanteConsult: 'CE Mercante Raadplegen',
    fieldCE: 'CE Mercante', fieldBL: 'BL / MBL / HBL', fieldManifesto: 'Manifesto', fieldVessel: 'Schip / Reis', fieldDischargePort: 'Loshaven', fieldCarrier: 'Rederij',
    fieldAfrmmStatus: 'AFRMM Status', fieldAfrmmAvailSerpro: 'Beschikbaar met SERPRO-inloggegevens', fieldAfrmmAmount: 'AFRMM Verschuldigd Bedrag', fieldConfidence: 'Betrouwbaarheid', fieldLastChecked: 'Laatste Controle', fieldOperationalStatus: 'Operationele Status', fieldPendingItems: 'Openstaande Punten', fieldSuggestedAction: 'Aanbevolen Actie', fieldSource: 'Bron:',
    translateReply: 'Vertaal antwoord', translating: 'Vertalen...',
  },
};

const SYSTEM_FOLDERS: FolderDef[] = [
  { key: 'all', label: 'All Mail', icon: 'mail', group: 'main' },
  { key: 'urgent', label: 'Urgent', icon: 'flag', group: 'priority' },
  { key: 'high', label: 'High', icon: 'flag', group: 'priority' },
  { key: 'medium', label: 'Medium', icon: 'flag', group: 'priority' },
  { key: 'low', label: 'Low', icon: 'flag', group: 'priority' },
  { key: 'not_replied', label: 'Not Replied', icon: 'clock', group: 'status' },
  { key: 'replied', label: 'Replied', icon: 'reply', group: 'status' },
  { key: 'draft_saved', label: 'Drafts', icon: 'draft', group: 'status' },
  { key: 'ocean', label: 'Ocean', icon: 'ocean', group: 'transport' },
  { key: 'air', label: 'Air', icon: 'air', group: 'transport' },
  { key: 'road', label: 'Road', icon: 'road', group: 'transport' },
  { key: 'rail', label: 'Rail', icon: 'rail', group: 'transport' },
  { key: 'quote_request', label: 'Quote Requests', icon: 'quote', group: 'intent' },
  { key: 'booking_confirmation', label: 'Bookings', icon: 'booking', group: 'intent' },
  { key: 'tracking_inquiry', label: 'Tracking', icon: 'tracking', group: 'intent' },
  { key: 'documentation_request', label: 'Documents', icon: 'docs', group: 'intent' },
  // Not in the sidebar: opened from the Overview ("Urgent and high waiting").
  { key: 'urgent_high_waiting', label: 'Urgent & high · not replied', icon: 'flag', group: 'view' },
];

const AI_ACTIONS = [
  { key: 'summarize', label: 'Summarize Thread', icon: 'list' as IconName, prompt: (e: Email) => `Summarize this freight email in 3 bullet points:\nSubject: ${e.subject}\n\n${e.body || e.snippet}` },
  { key: 'follow_up', label: 'Generate Follow-up', icon: 'reply' as IconName, prompt: (e: Email) => `Write a short professional follow-up email for this freight inquiry.\n\nOriginal subject: ${e.subject}\nFrom: ${e.from}\n${e.snippet}` },
  { key: 'missing_quote', label: 'Ask for Missing Quote Info', icon: 'quote' as IconName, prompt: (e: Email) => `Write a professional email asking for missing info to provide a freight quote. Ask for: cargo type, weight, dimensions, incoterm, POL, POD, target date.\n\nBased on: ${e.subject}\n${e.body || e.snippet}` },
  { key: 'tracking_reply', label: 'Create Tracking Reply', icon: 'tracking' as IconName, prompt: (e: Email) => `Write a professional reply to this tracking inquiry. Acknowledge it and explain what you need to check status.\n\n${e.subject}\n${e.body || e.snippet}` },
  { key: 'booking_confirm', label: 'Draft Booking Confirmation', icon: 'booking' as IconName, prompt: (e: Email) => `Draft a professional booking confirmation based on this request:\n\nSubject: ${e.subject}\nFrom: ${e.from}\n${e.body || e.snippet}` },
];

const MERCANTE_INTENTS = new Set([
  'ce_mercante_consulta',
  'afrmm_status_check',
  'cargo_release_followup',
  'manifesto_consulta',
  'pendencia_documental_mercante',
]);

const MERCANTE_ACTIONS = [
  { key: 'ce_consult', label: 'Consult CE Mercante', icon: 'search' as IconName, action: 'consult' },
  { key: 'afrmm_check', label: 'Check AFRMM Status', icon: 'credit-card' as IconName, action: 'afrmm' },
  { key: 'bl_validate', label: 'Validate Linked BL', icon: 'link' as IconName, action: 'manifest' },
  { key: 'refresh', label: 'Refresh Mercante Data', icon: 'refresh' as IconName, action: 'refresh' },
  { key: 'client_summary', label: 'Generate Client Summary', icon: 'docs' as IconName, action: 'summary' },
  { key: 'request_missing', label: 'Request Missing Data', icon: 'note' as IconName, action: 'missing' },
  { key: 'escalate', label: 'Escalate to Operations', icon: 'alert' as IconName, action: 'escalate' },
];

// Gmail-like compose component
function ComposeModal({ onClose, onSend, darkMode, theme, userEmail }: {
  onClose: () => void;
  onSend: (to: string, cc: string, subject: string, body: string, signature: string) => void;
  darkMode: boolean;
  theme: any;
  userEmail: string;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signature, setSignature] = useState(() => localStorage.getItem('fw_signature') || `Best regards,\n${userEmail}`);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (tag: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.substring(start, end);
    const map: Record<string, string> = { bold: `**${selected}**`, italic: `_${selected}_`, underline: `__${selected}__` };
    const newText = body.substring(0, start) + (map[tag] || selected) + body.substring(end);
    setBody(newText);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + 2, end + 2); }, 0);
  };

  const saveSignature = () => {
    localStorage.setItem('fw_signature', signature);
    setShowSignatureEditor(false);
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    await onSend(to, cc, subject, body, signature);
    setSending(false);
  };

  const fullBody = body + (signature ? `\n\n--\n${signature}` : '');
  const fieldRow = 'flex flex-shrink-0 items-center gap-2 border-b border-app-line px-4 py-2';
  const fieldLabel = 'w-14 font-fw-mono text-app-mono-xs uppercase text-app-ink-3';
  const fieldInput = 'flex-1 bg-transparent text-app-ui text-app-ink placeholder:text-app-ink-3 focus:outline-none';
  const toolBtn = 'flex size-7 items-center justify-center rounded-fw-btn text-app-ui-sm text-app-ink-2 transition-colors hover:bg-app-raised hover:text-app-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-app-overlay p-4">
      <div className={`flex flex-col rounded-fw-card border border-app-line bg-app-card text-app-ink shadow-app-pop transition-all ${minimized ? 'h-12 w-80' : 'w-full max-w-2xl'}`}
        style={{ maxHeight: minimized ? '48px' : '85vh' }}>

        {/* Title bar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-app-line px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-app-ui font-semibold">
            <Icon name="compose" size={16} className="text-app-accent" />
            New Message
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" icon={minimized ? 'chevron-up' : 'minus'} onClick={() => setMinimized(!minimized)} aria-label={minimized ? 'Expand' : 'Minimize'} />
            <Button variant="ghost" size="icon-sm" icon="close" onClick={onClose} aria-label="Close" />
          </div>
        </div>

        {!minimized && (
          <>
            {/* To field */}
            <div className={fieldRow}>
              <span className={fieldLabel}>To</span>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="Recipients" aria-label="To" className={fieldInput} />
              <button onClick={() => setShowCc(!showCc)} className="px-1 font-fw-mono text-app-mono-xs uppercase text-app-ink-3 hover:text-app-accent">CC</button>
            </div>

            {/* CC field */}
            {showCc && (
              <div className={fieldRow}>
                <span className={fieldLabel}>CC</span>
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="CC recipients" aria-label="CC" className={fieldInput} />
              </div>
            )}

            {/* Subject */}
            <div className={fieldRow}>
              <span className={fieldLabel}>Subject</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className={`${fieldInput} font-medium`} />
            </div>

            {/* Formatting toolbar */}
            <div className="flex flex-shrink-0 items-center gap-0.5 border-b border-app-line px-3 py-1.5">
              {[
                { tag: 'bold', label: 'B', style: 'font-bold' },
                { tag: 'italic', label: 'I', style: 'italic' },
                { tag: 'underline', label: 'U', style: 'underline' },
              ].map(f => (
                <button key={f.tag} onClick={() => insertFormat(f.tag)} aria-label={f.tag} className={`${toolBtn} ${f.style}`}>
                  {f.label}
                </button>
              ))}
              <div className="mx-1 h-4 w-px bg-app-line" />
              <button onClick={() => setBody(b => b + '\n• ')} className={toolBtn} title="Bullet list" aria-label="Bullet list"><Icon name="list" size={15} /></button>
              <button onClick={() => setBody(b => b + '\n1. ')} className={toolBtn} title="Numbered list" aria-label="Numbered list"><Icon name="list-numbered" size={15} /></button>
              <div className="mx-1 h-4 w-px bg-app-line" />
              <button className={toolBtn} title="Attach file (coming soon)" aria-label="Attach file" onClick={() => alert('File attachment coming soon!')}><Icon name="attach" size={15} /></button>
              <button onClick={() => setShowSignatureEditor(!showSignatureEditor)}
                className={`${toolBtn} ${showSignatureEditor ? 'bg-app-selected text-app-accent' : ''}`}
                title="Edit signature" aria-label="Edit signature" aria-pressed={showSignatureEditor}><Icon name="signature" size={15} /></button>
            </div>

            {/* Signature editor */}
            {showSignatureEditor && (
              <div className="flex-shrink-0 border-b border-app-line bg-app-panel px-4 py-3">
                <DataLabel className="mb-2">Edit Signature</DataLabel>
                <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={3} className={`${textareaClass} text-app-ui-sm`} />
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" size="xs" onClick={saveSignature}>Save Signature</Button>
                  <Button size="xs" onClick={() => setShowSignatureEditor(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
                placeholder="Write your message..." aria-label="Message"
                className="flex-1 resize-none bg-transparent px-4 py-3 text-app-ui text-app-ink placeholder:text-app-ink-3 focus:outline-none"
                style={{ minHeight: '120px' }} />
              {/* Signature preview */}
              {signature && (
                <div className="border-t border-app-line px-4 pb-2">
                  <p className="mt-2 text-app-ui-sm text-app-ink-3">-- </p>
                  <pre className="whitespace-pre-wrap font-fw-sans text-app-ui-sm text-app-ink-3">{signature}</pre>
                </div>
              )}
            </div>

            {/* Send bar */}
            <div className="flex flex-shrink-0 items-center gap-3 border-t border-app-line px-4 py-3">
              <Button variant="primary" icon={sending ? undefined : 'send'} onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}>
                {sending ? <><Spinner className="size-3" /> Sending...</> : 'Send'}
              </Button>
              <span className="font-fw-mono text-app-mono-xs text-app-ink-3">{body.length} chars</span>
              <Button onClick={onClose} className="ml-auto">Discard</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Gmail-like reply box component
function ReplyBox({ email, darkMode, theme, session, onSent, onDraftSaved, language }: {
  email: Email;
  darkMode: boolean;
  theme: any;
  session: string | null;
  onSent: (status: { repliedAt: string | null; responseMinutes: number | null }) => void;
  onDraftSaved: (draft: { id: string; at: string; text: string }) => void;
  language: Language;
}) {
  // A draft saved in Gmail/Outlook (or here) is continued instead of the AI suggestion.
  const initialText = email.draft?.text || email.analysis?.suggested_reply || '';
  const [replyText, setReplyText] = useState(initialText);
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [signature, setSignature] = useState(() => localStorage.getItem('fw_signature') || '');
  const [expanded, setExpanded] = useState(false);
  const [replyLang, setReplyLang] = useState<Language>(language);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [translating, setTranslating] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const t = translations[language];

  const translateReply = async (targetLang: Language) => {
    if (targetLang === replyLang || !replyText.trim()) return;
    setTranslating(true);
    setShowLangPicker(false);
    try {
      const res = await fetch(`${API_URL}/api/translate?session=${session || ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText, targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (data.translated) { setReplyText(data.translated); setReplyLang(targetLang); }
    } catch {}
    setTranslating(false);
  };

  useEffect(() => { setReplyText(initialText); }, [email.id, email.draft?.id, email.analysis?.suggested_reply]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertFormat = (tag: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = replyText.substring(start, end);
    const map: Record<string, string> = { bold: `**${selected}**`, italic: `_${selected}_` };
    const newText = replyText.substring(0, start) + (map[tag] || selected) + replyText.substring(end);
    setReplyText(newText);
  };

  const to = email.from.match(/<(.+?)>/)?.[1] || email.from;

  const handleSend = async () => {
    if (!replyText.trim() || !session) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, subject: email.subject, body: replyText + (signature ? `\n\n--\n${signature}` : ''), threadId: email.threadId, emailId: email.id, draftId: email.draft?.id })
      });
      const data = await res.json();
      if (data.success) onSent({ repliedAt: data.repliedAt ?? new Date().toISOString(), responseMinutes: data.responseMinutes ?? null });
    } catch (e) {}
    setSending(false);
  };

  const handleSaveDraft = async () => {
    if (!replyText.trim() || !session) return;
    setSavingDraft(true);
    try {
      const res = await fetch(`${API_URL}/api/save-draft?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, subject: email.subject, body: replyText, threadId: email.threadId, emailId: email.id, draftId: email.draft?.id })
      });
      const data = await res.json();
      if (data.success && data.draft) onDraftSaved(data.draft);
    } catch (e) {}
    setSavingDraft(false);
  };

  if (!email.analysis?.suggested_reply && !email.draft) return null;

  const toolBtn = 'flex size-7 items-center justify-center rounded-fw-btn text-app-ui-sm text-app-ink-2 transition-colors hover:bg-app-raised hover:text-app-ink';

  return (
    <div className="flex-shrink-0 border-t border-app-line bg-app-card">
      {email.draft && (
        <p className="flex items-center gap-1.5 px-4 pt-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">
          <Icon name="draft" size={12} /> Draft · saved {new Date(email.draft.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}
      {/* Collapsed preview — click to expand */}
      {!expanded ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setExpanded(true)}
            className="flex-1 truncate rounded-fw-btn border border-app-line bg-app-panel px-3 py-2 text-left text-app-ui-sm text-app-ink-2 transition-colors hover:bg-app-raised">
            {replyText.substring(0, 80)}...
          </button>
          <Button variant="primary" icon={sending ? undefined : 'send'} onClick={handleSend} disabled={sending} className="flex-shrink-0">
            {sending ? <><Spinner className="size-3" /> Sending...</> : 'Send'}
          </Button>
        </div>
      ) : (
        <div>
          {/* To / CC row */}
          <div className="flex items-center gap-2 border-b border-app-line px-4 py-2">
            <span className="w-6 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">To</span>
            <span className="flex-1 truncate text-app-ui-sm text-app-ink-2">{to}</span>
            <button onClick={() => setShowCc(!showCc)} className="px-1 font-fw-mono text-app-mono-xs uppercase text-app-ink-3 hover:text-app-accent">CC</button>
            <Button variant="ghost" size="icon-sm" icon="chevron" onClick={() => setExpanded(false)} aria-label="Collapse" />
          </div>
          {showCc && (
            <div className="flex items-center gap-2 border-b border-app-line px-4 py-2">
              <span className="w-6 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">CC</span>
              <input value={cc} onChange={e => setCc(e.target.value)} placeholder="CC recipients" aria-label="CC"
                className="flex-1 bg-transparent text-app-ui-sm text-app-ink placeholder:text-app-ink-3 focus:outline-none" />
            </div>
          )}

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 border-b border-app-line px-3 py-1">
            <button onClick={() => insertFormat('bold')} className={`${toolBtn} font-bold`} aria-label="Bold">B</button>
            <button onClick={() => insertFormat('italic')} className={`${toolBtn} italic`} aria-label="Italic">I</button>
            <div className="mx-1 h-3.5 w-px bg-app-line" />
            <button onClick={() => setReplyText((prev: string) => prev + '\n• ')} className={toolBtn} aria-label="Bullet list"><Icon name="list" size={15} /></button>
            <button onClick={() => setReplyText((prev: string) => prev + '\n1. ')} className={toolBtn} aria-label="Numbered list"><Icon name="list-numbered" size={15} /></button>
            <div className="mx-1 h-3.5 w-px bg-app-line" />
            <button className={toolBtn} title="Attach (coming soon)" aria-label="Attach file" onClick={() => alert('File attachment coming soon!')}><Icon name="attach" size={15} /></button>
            <button onClick={() => setShowSignatureEditor(!showSignatureEditor)}
              className={`${toolBtn} ${showSignatureEditor ? 'bg-app-selected text-app-accent' : ''}`} title="Signature" aria-label="Signature" aria-pressed={showSignatureEditor}><Icon name="signature" size={15} /></button>
            <div className="mx-1 h-3.5 w-px bg-app-line" />
            {/* Reply language picker */}
            <div className="relative">
              <button onClick={() => setShowLangPicker(p => !p)} disabled={translating}
                title={t.translateReply} aria-label={t.translateReply} aria-expanded={showLangPicker}
                className={`flex h-7 items-center gap-1 rounded-fw-btn px-1.5 font-fw-mono text-app-mono-xs transition-colors disabled:opacity-50 ${showLangPicker ? 'bg-app-selected text-app-accent' : 'text-app-ink-2 hover:bg-app-raised hover:text-app-ink'}`}>
                {translating ? <Spinner className="size-3" /> : <Icon name="globe" size={14} />} {replyLang.toUpperCase()}
              </button>
              {showLangPicker && (
                <div className="absolute bottom-full left-0 z-50 mb-1 overflow-hidden rounded-fw-card border border-app-line bg-app-card shadow-app-pop">
                  {(['en', 'pt', 'nl'] as Language[]).map(l => (
                    <button key={l} onClick={() => translateReply(l)}
                      className={`block w-full whitespace-nowrap px-4 py-2 text-left text-app-ui-sm hover:bg-app-raised ${replyLang === l ? 'font-medium text-app-accent' : 'text-app-ink-2'}`}>
                      {l === 'en' ? 'English' : l === 'pt' ? 'Português' : 'Nederlands'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showSignatureEditor && (
            <div className="border-b border-app-line bg-app-panel px-4 py-2">
              <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={2} className={`${textareaClass} text-app-ui-sm`} />
              <Button variant="primary" size="xs" className="mt-1.5" onClick={() => { localStorage.setItem('fw_signature', signature); setShowSignatureEditor(false); }}>Save</Button>
            </div>
          )}

          {/* Body */}
          <textarea ref={bodyRef} value={replyText} onChange={e => setReplyText(e.target.value)} rows={6} aria-label="Reply"
            className="w-full resize-none bg-transparent px-4 py-3 text-app-ui text-app-ink focus:outline-none" />

          {signature && (
            <div className="border-t border-app-line px-4 pb-1">
              <p className="text-app-ui-sm text-app-ink-3">-- </p>
              <pre className="whitespace-pre-wrap font-fw-sans text-app-ui-sm text-app-ink-3">{signature}</pre>
            </div>
          )}

          {/* Send bar */}
          <div className="flex items-center gap-2 border-t border-app-line px-4 py-3">
            <Button variant="primary" icon={sending ? undefined : 'send'} onClick={handleSend} disabled={sending || !replyText.trim()}>
              {sending ? <><Spinner className="size-3" /> Sending...</> : 'Send'}
            </Button>
            <Button icon="draft" onClick={handleSaveDraft} disabled={savingDraft}>
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button variant="ghost" size="sm" iconRight="chevron" onClick={() => setExpanded(false)} className="ml-auto">Collapse</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  // Opened from an Overview card: emails come from /api/emails/waiting (server-side filter)
  const [serverView, setServerView] = useState<'awaiting' | 'urgent' | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  // Reply status changes from this page (sent, draft saved) before the next mailbox refresh
  const updateEmail = (id: string, patch: Partial<Email>) => {
    const apply = (e: Email) => ({ ...e, ...patch, analysis: e.analysis && 'repliedAt' in patch ? { ...e.analysis, replied_at: patch.repliedAt } : e.analysis });
    setEmails(prev => prev.map(e => (e.id === id ? apply(e) : e)));
    setSelected(prev => (prev?.id === id ? apply(prev) : prev));
  };
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; msg: string; sub?: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<FolderKey>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<FolderKey | null>(null);
  const [manualFolders, setManualFolders] = useState<Record<string, FolderKey>>({});
  const [trashedEmails, setTrashedEmails] = useState<Set<string>>(new Set());
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>([]);
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [createMode, setCreateMode] = useState<'folder' | 'label'>('folder');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [newLabelIcon, setNewLabelIcon] = useState<IconName>(LABEL_ICONS[0]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [emailListWidth, setEmailListWidth] = useState(300);
  const sidebarResizing = useRef(false);
  const listResizing = useRef(false);

  // Feature states
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowStatus>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assignRole, setAssignRole] = useState<'owner' | 'watcher' | 'queue'>('owner');
  const [assignInput, setAssignInput] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<'analysis' | 'timeline' | 'notes' | 'actions'>('analysis');
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [aiActionResult, setAiActionResult] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [mercanteStates, setMercanteStates] = useState<Record<string, MercanteState>>({});
  const [mercanteCardOpen, setMercanteCardOpen] = useState<Record<string, boolean>>({});
  const [shipmentMatchStates, setShipmentMatchStates] = useState<Record<string, boolean>>({});
  const [quoteBuilderInitial, setQuoteBuilderInitial] = useState<Quote | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [billingUrgent, setBillingUrgent] = useState(false);
  const [lowAnalysesToastShown, setLowAnalysesToastShown] = useState(false);

  const t = translations[language];

  // Semantic token classes; data-theme on the page root switches light/dark.
  const theme = {
    bg: 'bg-app-bg',
    bgGradient: 'bg-app-bg',
    card: 'bg-app-card',
    cardBorder: 'border-app-line',
    text: 'text-app-ink',
    textMuted: 'text-app-ink-2',
    textDim: 'text-app-ink-3',
    hover: 'hover:bg-app-raised',
    selected: 'bg-app-selected border-l-2 border-l-app-accent-fill',
    input: 'bg-app-card border-app-line-strong text-app-ink placeholder:text-app-ink-3',
    sidebar: 'bg-app-panel',
    iconFilter: {} as React.CSSProperties,
    divider: 'bg-app-line hover:bg-app-accent-fill',
  };

  const notify = (type: 'success' | 'error' | 'warning', msg: string, opts?: { sub?: string; duration?: number }) => {
    setNotification({ type, msg, sub: opts?.sub });
    setTimeout(() => setNotification(null), opts?.duration || 3000);
  };

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); sidebarResizing.current = true;
    const startX = e.clientX; const startW = sidebarWidth;
    const onMove = (me: MouseEvent) => { if (!sidebarResizing.current) return; setSidebarWidth(Math.max(48, Math.min(320, startW + (me.clientX - startX)))); };
    const onUp = () => { sidebarResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const startListResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); listResizing.current = true;
    const startX = e.clientX; const startW = emailListWidth;
    const onMove = (me: MouseEvent) => { if (!listResizing.current) return; setEmailListWidth(Math.max(200, Math.min(600, startW + (me.clientX - startX)))); };
    const onUp = () => { listResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [emailListWidth]);

  useEffect(() => {
    const closeAll = (e: MouseEvent) => {
      setContextMenu(null);
      // close assign panel if click outside
      const target = e.target as HTMLElement;
      if (!target.closest('[data-assign-panel]')) setShowAssignPanel(false);
    };
    window.addEventListener('click', closeAll);
    return () => window.removeEventListener('click', closeAll);
  }, []);

  useEffect(() => {
    const saved = { theme: localStorage.getItem('fw_theme'), lang: localStorage.getItem('fw_lang') as Language, labels: localStorage.getItem('fw_custom_labels'), manual: localStorage.getItem('fw_manual_folders'), trash: localStorage.getItem('fw_trash'), notes: localStorage.getItem('fw_notes'), statuses: localStorage.getItem('fw_workflow_statuses'), assignments: localStorage.getItem('fw_assignments') };
    if (saved.theme) setDarkMode(saved.theme === 'dark');
    if (saved.lang) setLanguage(saved.lang);
    if (saved.labels) try { setCustomLabels(JSON.parse(saved.labels)); } catch {}
    if (saved.manual) try { setManualFolders(JSON.parse(saved.manual)); } catch {}
    if (saved.trash) try { setTrashedEmails(new Set(JSON.parse(saved.trash))); } catch {}
    if (saved.notes) try { setNotes(JSON.parse(saved.notes)); } catch {}
    if (saved.statuses) try { setWorkflowStatuses(JSON.parse(saved.statuses)); } catch {}
    if (saved.assignments) try { setAssignments(JSON.parse(saved.assignments)); } catch {}
    // Filtered views opened from the Overview KPI cards
    const param = searchParams.get('view');
    const view = param === 'awaiting' || param === 'urgent' ? param : null;
    setServerView(view);
    setServerTotal(null);
    setActiveFolder(view === 'awaiting' ? 'not_replied' : view === 'urgent' ? 'urgent_high_waiting' : 'all');
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) { localStorage.setItem('fw_session', sid); setSession(sid); checkAuth(sid, view); }
    else setLoading(false);
  }, [searchParams]);


  useEffect(() => { localStorage.setItem('fw_custom_labels', JSON.stringify(customLabels)); }, [customLabels]);
  useEffect(() => { localStorage.setItem('fw_manual_folders', JSON.stringify(manualFolders)); }, [manualFolders]);
  useEffect(() => { localStorage.setItem('fw_trash', JSON.stringify(Array.from(trashedEmails))); }, [trashedEmails]);
  useEffect(() => { localStorage.setItem('fw_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('fw_workflow_statuses', JSON.stringify(workflowStatuses)); }, [workflowStatuses]);
  useEffect(() => { localStorage.setItem('fw_assignments', JSON.stringify(assignments)); }, [assignments]);
  useEffect(() => { setActiveDetailTab('analysis'); setAiActionResult(null); }, [selected?.id]);

  const checkAuth = async (sid: string, view: 'awaiting' | 'urgent' | null = serverView) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/status?session=${sid}`);
      const data = await res.json();
      if (data.authenticated) { setUser({ email: data.email, name: data.name }); await loadEmails(sid, view); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadEmails = async (sid: string, view: 'awaiting' | 'urgent' | null = serverView) => {
    try {
      const res = await fetch(view
        ? `${API_URL}/api/emails/waiting?session=${sid}&view=${view}`
        : `${API_URL}/api/emails?session=${sid}`);
      const data = await res.json();
      if (view) setServerTotal(typeof data.total === 'number' ? data.total : null);
      if (data.emails) setEmails(data.emails.map((e: any) => ({ ...e, analysis: e.analysis || null, isAnalyzing: false })));
    } catch (e) { console.error(e); }
  };

  const analyzeEmail = async (email: Email, opts: { force?: boolean; quiet?: boolean } = {}): Promise<AnalyzeOutcome> => {
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: true } : e));
    if (selected?.id === email.id) setSelected({ ...email, isAnalyzing: true });
    let outcome: AnalyzeOutcome = 'failed';
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, body: email.body || email.snippet, from: email.from, emailId: email.id, sessionId: session, language, force: !!opts.force })
      });
      // The upgrade modal is only for real plan limits. Anything else used to
      // fall back to "Monthly analysis limit reached", even a failed session lookup.
      const LIMIT_REASONS: Record<string, UpgradeReason> = { trial_expired: 'trial_expired', trial_limit_reached: 'trial_limit', monthly_limit_reached: 'analyses_limit' };
      if (res.status === 401 || res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: false } : e));
        const upgrade = res.status === 402 ? LIMIT_REASONS[data.reason] : undefined;
        if (upgrade) { setUpgradeReason(upgrade); return 'limit'; }
        notify('error', 'Your session could not be verified', { sub: 'Refresh the page or reconnect your email. No analysis was used.' });
        return 'auth';
      }
      const data = await res.json();
      if (!res.ok || !data.analysis) {
        if (!opts.quiet) notify('error', `Couldn't analyze "${email.subject}"`, { sub: 'No analysis was used. Try again in a moment.' });
      }
      if (data.analysis) {
        outcome = data.skipped === 'marketing' ? 'marketing' : 'analyzed';
        const updated = { ...email, analysis: data.analysis, isAnalyzing: false };
        setEmails(prev => prev.map(e => e.id === email.id ? updated : e));
        if (selected?.id === email.id) setSelected(updated);
        addTimelineEvent(email.id, 'analyzed', data.skipped === 'marketing' ? 'Marked as marketing (not sent to AI)' : 'AI Analysis completed');
        if (data.skipped !== 'marketing') matchShipment(email, data.analysis);

        if (typeof data.analyses_remaining === 'number' && data.analyses_remaining > 0 && data.analyses_remaining <= 5 && !lowAnalysesToastShown) {
          setLowAnalysesToastShown(true);
          notify('warning', `Only ${data.analyses_remaining} analyses remaining in your trial`, { sub: 'Upgrade to Professional for unlimited access', duration: 8000 });
        }
      }
    } catch (e) {
      console.error(e);
      if (!opts.quiet) notify('error', `Couldn't analyze "${email.subject}"`, { sub: 'No analysis was used. Try again in a moment.' });
    }
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: false } : e));
    return outcome;
  };

  const matchShipment = async (email: Email, analysis: any) => {
    const autoDetect = localStorage.getItem('fw_ai_autodetect');
    if (autoDetect === 'false') return;
    const ids = analysis.shipment_identifiers || {};
    if (!ids.reference && !ids.booking_number && !ids.container_number && !ids.bl_number && !analysis.shipment_status_hint) return;
    try {
      const res = await fetch(`${API_URL}/api/shipments/match?session=${session || ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session, emailId: email.id, emailSubject: email.subject, from: email.from, identifiers: ids, statusHint: analysis.shipment_status_hint }),
      });
      const data = await res.json();
      setShipmentMatchStates(prev => ({ ...prev, [email.id]: !!data.created }));
    } catch (e) { console.error(e); }
  };

  const analyzeAll = async () => {
    // Likely freight emails first (server triage score); newsletters last, where
    // they are labelled Marketing without using an analysis.
    const toAnalyze = filteredEmails
      .filter(e => !e.analysis && !e.isAnalyzing)
      .map((e, i) => ({ e, i }))
      .sort((a, b) => (b.e.triage?.score ?? 0) - (a.e.triage?.score ?? 0) || a.i - b.i)
      .map(x => x.e);
    if (!toAnalyze.length) return;
    setAnalyzing(true); setProgress({ current: 0, total: toAnalyze.length });
    const tally: Record<AnalyzeOutcome, number> = { analyzed: 0, marketing: 0, limit: 0, auth: 0, failed: 0 };
    for (let i = 0; i < toAnalyze.length; i++) {
      setProgress({ current: i + 1, total: toAnalyze.length });
      const outcome = await analyzeEmail(toAnalyze[i], { quiet: true });
      tally[outcome]++;
      if (outcome === 'limit' || outcome === 'auth') break; // modal or session error shown; stop the run
      await new Promise(r => setTimeout(r, 500));
    }
    setAnalyzing(false);
    const parts = [`${tally.analyzed} analyzed`];
    if (tally.marketing) parts.push(`${tally.marketing} marked as marketing (no analysis used)`);
    if (tally.failed) parts.push(`${tally.failed} failed`);
    if (tally.limit) parts.push('stopped at your plan limit');
    if (tally.auth) parts.push('stopped: session could not be verified');
    notify(tally.failed || tally.limit || tally.auth ? 'warning' : 'success', parts.join(' · '), tally.failed ? { sub: 'Failed emails used no analysis; run Analyze All again to retry them.' } : undefined);
  };

  const addTimelineEvent = (emailId: string, type: string, label: string) => {
    setNotes(prev => [...prev, { id: `evt_${Date.now()}`, emailId, text: `__event__:${type}:${label}`, author: user?.name || 'System', createdAt: new Date().toISOString() }]);
  };

  const getThreadTimeline = (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    const events: { type: string; label: string; time: string; icon: string }[] = [];
    if (email) events.push({ type: 'received', label: 'Inquiry received', time: email.date, icon: 'inbox' });
    notes.filter(n => n.emailId === emailId && n.text.startsWith('__event__:')).forEach(n => {
      const parts = n.text.replace('__event__:', '').split(':');
      const iconMap: Record<string, IconName> = {
        analyzed: 'sparkle', replied: 'reply', note: 'note', status: 'refresh', assigned: 'user', received: 'inbox',
        ce_queried: 'search', afrmm_checked: 'credit-card', ce_located: 'check', afrmm_paid: 'check',
        divergence: 'alert', missing_data_requested: 'note', mercante_refreshed: 'refresh',
      };
      events.push({ type: parts[0], label: parts.slice(1).join(':'), time: n.createdAt, icon: iconMap[parts[0]] || 'dot' });
    });
    return events;
  };

  const openQuoteBuilder = (email: Email) => {
    const a = email.analysis || {};
    setQuoteBuilderInitial({
      customer_name: email.from.split('<')[0].trim(),
      customer_email: email.from.match(/<(.+?)>/)?.[1] || email.from,
      origin: a.pol || '', destination: a.pod || '', mode: a.mode || '',
      commodity: a.cargo_type || '', container_type: a.container_type || '', weight: '',
      incoterm: a.incoterm || '', carrier: '', sell_rate: 0, currency: 'USD', transit_time: '',
      validity_date: '', notes: '', charges: [], status: 'draft',
      email_id: email.id, email_subject: email.subject,
    });
  };

  const isMercanteIntent = (intent: string | undefined) => !!intent && MERCANTE_INTENTS.has(intent);

  const getMercanteEntities = (email: Email): MercanteEntities => {
    const m = email.analysis?.mercante_entities;
    return { ce_number: m?.ce_number || null, bl_number: m?.bl_number || null, container_number: m?.container_number || null, vessel_name: m?.vessel_name || null, voyage: m?.voyage || null, discharge_port: m?.discharge_port || null, origin_port: m?.origin_port || null, carrier: m?.carrier || null, importer_cnpj: m?.importer_cnpj || null, shipment_date: m?.shipment_date || null };
  };

  const queryMercante = async (email: Email, action: string) => {
    const emailId = email.id;
    const entities = getMercanteEntities(email);
    setMercanteStates(prev => ({ ...prev, [emailId]: { ...prev[emailId], loading: true, error: null, lastAction: action, result: prev[emailId]?.result || null, rules: prev[emailId]?.rules || null } }));
    setMercanteCardOpen(prev => ({ ...prev, [emailId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/mercante/query?session=${session || ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities, action }),
      });
      if (!res.ok) throw new Error('Mercante query unavailable — manual check required');
      const data = await res.json();
      setMercanteStates(prev => ({ ...prev, [emailId]: { result: data.result || null, rules: data.rules || null, loading: false, error: data.error || null, lastAction: action } }));

      const eventMap: Record<string, { type: string; label: string }> = {
        consult: { type: 'ce_queried', label: `CE Mercante queried${data.result?.ce_number ? ': ' + data.result.ce_number : ''}` },
        afrmm: { type: 'afrmm_checked', label: `AFRMM status checked: ${data.afrmm?.afrmm_status || data.result?.afrmm_status || 'unknown'}` },
        manifest: { type: 'ce_queried', label: `Manifest validated${data.manifest?.manifesto ? ': ' + data.manifest.manifesto : ''}` },
        refresh: { type: 'mercante_refreshed', label: 'Mercante data refreshed' },
        missing: { type: 'missing_data_requested', label: 'Missing data requested from client' },
        escalate: { type: 'status', label: 'Escalated to Operations — marked high priority' },
      };
      const evt = eventMap[action];
      if (evt) addTimelineEvent(emailId, evt.type, evt.label);
      if (data.result?.afrmm_status === 'paid') addTimelineEvent(emailId, 'afrmm_paid', 'AFRMM confirmed as paid');
      if (data.rules?.alerts?.some((a: string) => a.startsWith('consistency_alert'))) addTimelineEvent(emailId, 'divergence', 'Divergence detected: CE found but not linked to BL');
    } catch (e: any) {
      setMercanteStates(prev => ({ ...prev, [emailId]: { result: null, rules: null, loading: false, error: e.message || 'Mercante query unavailable', lastAction: action } }));
      notify('error', 'Mercante query unavailable — manual check required');
    }
  };

  const runMercanteAction = async (email: Email, action: typeof MERCANTE_ACTIONS[0]) => {
    if (action.action === 'summary') {
      runAiAction({ key: 'mercante_summary', label: 'Generate Client Summary', icon: 'docs', prompt: (e: Email) => `Write a professional client status update email for this CE Mercante shipment inquiry. Include any CE number, AFRMM status, and operational status found. Subject: ${e.subject}\nFrom: ${e.from}\n${e.body || e.snippet}` });
      return;
    }
    if (action.action === 'missing') {
      runAiAction({ key: 'mercante_missing', label: 'Request Missing Data', icon: 'note', prompt: (e: Email) => `Write a professional reply asking the client for the CE Mercante number, BL/MBL/HBL number, and CNPJ of the importer so we can query Sistema Mercante.\n\nSubject: ${e.subject}\nFrom: ${e.from}\n${e.body || e.snippet}` });
      addTimelineEvent(email.id, 'missing_data_requested', 'Missing data requested from client');
      return;
    }
    if (action.action === 'escalate') {
      setWorkflowStatus(email.id, 'pending_docs');
      const currentAssignment = assignments[email.id] || { owner: '', watchers: [], queue: '' };
      setAssignments(prev => ({ ...prev, [email.id]: { ...currentAssignment, queue: 'Operations' } }));
      addTimelineEvent(email.id, 'status', 'Escalated to Operations — marked high priority');
      notify('success', 'Escalated to Operations');
      return;
    }
    await queryMercante(email, action.action);
  };

  const getEmailNotes = (emailId: string) => notes.filter(n => n.emailId === emailId && !n.text.startsWith('__event__:'));

  const addNote = () => {
    if (!newNote.trim() || !selected) return;
    const note: Note = { id: `note_${Date.now()}`, emailId: selected.id, text: newNote.trim(), author: user?.name || user?.email || 'Me', createdAt: new Date().toISOString() };
    setNotes(prev => [...prev, note]);
    addTimelineEvent(selected.id, 'note', `Note by ${note.author}`);
    setNewNote('');
    notify('success', 'Note added!');
  };

  const updateAssignment = (emailId: string, role: 'owner' | 'watcher' | 'queue', value: string) => {
    if (!value.trim()) return;
    setAssignments(prev => {
      const current = prev[emailId] || { owner: '', watchers: [], queue: '' };
      if (role === 'owner') return { ...prev, [emailId]: { ...current, owner: value.trim() } };
      if (role === 'watcher') return { ...prev, [emailId]: { ...current, watchers: [...(current.watchers || []).filter(w => w !== value.trim()), value.trim()] } };
      if (role === 'queue') return { ...prev, [emailId]: { ...current, queue: value.trim() } };
      return prev;
    });
    const labels = { owner: 'Owner', watcher: 'Watcher', queue: 'Queue' };
    addTimelineEvent(emailId, 'assigned', `${labels[role]}: ${value.trim()}`);
    notify('success', `${labels[role]} set!`);
    setAssignInput('');
  };

  const removeWatcher = (emailId: string, watcher: string) => {
    setAssignments(prev => { const c = prev[emailId]; if (!c) return prev; return { ...prev, [emailId]: { ...c, watchers: c.watchers.filter(w => w !== watcher) } }; });
  };

  const setWorkflowStatus = (emailId: string, status: WorkflowStatus) => {
    setWorkflowStatuses(prev => ({ ...prev, [emailId]: status }));
    addTimelineEvent(emailId, 'status', `Status → ${WORKFLOW_STATUSES.find(s => s.key === status)?.label}`);
    notify('success', 'Status updated!');
  };

  const runAiAction = async (action: { key: string; label: string; icon: string; prompt: (e: Email) => string }) => {
    if (!selected || !session) return;
    setAiActionLoading(action.key); setAiActionResult(null);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: `AI: ${action.label}`, body: action.prompt(selected), from: selected.from, emailId: selected.id, sessionId: session, language })
      });
      const data = await res.json();
      if (data.analysis?.suggested_reply) setAiActionResult(data.analysis.suggested_reply);
      else if (data.analysis?.summary) setAiActionResult(data.analysis.summary);
    } catch (e) { notify('error', 'AI action failed'); }
    setAiActionLoading(null);
  };

  const moveToTrash = (emailId: string) => { setTrashedEmails(prev => new Set([...Array.from(prev), emailId])); if (selected?.id === emailId) setSelected(null); notify('success', 'Moved to Trash'); setContextMenu(null); };
  const restoreFromTrash = (emailId: string) => { setTrashedEmails(prev => { const n = new Set(Array.from(prev)); n.delete(emailId); return n; }); notify('success', 'Restored'); };
  const deleteForever = (emailId: string) => { setTrashedEmails(prev => { const n = new Set(Array.from(prev)); n.delete(emailId); return n; }); setEmails(prev => prev.filter(e => e.id !== emailId)); if (selected?.id === emailId) setSelected(null); };
  const emptyTrash = () => { const ids = Array.from(trashedEmails); setEmails(prev => prev.filter(e => !ids.includes(e.id))); setTrashedEmails(new Set()); if (selected && ids.includes(selected.id)) setSelected(null); notify('success', 'Trash emptied'); };

  const createLabel = () => {
    if (!newLabelName.trim()) return;
    const key = `label_${Date.now()}`;
    setCustomLabels(prev => [...prev, { key, label: newLabelName.trim(), color: newLabelColor.value, icon: newLabelIcon, isFolder: createMode === 'folder' }]);
    setNewLabelName(''); setNewLabelIcon(LABEL_ICONS[0]); setNewLabelColor(LABEL_COLORS[0]); setShowCreateLabel(false);
    notify('success', `${createMode === 'folder' ? 'Folder' : 'Label'} created!`);
  };

  const deleteLabel = (key: string) => { setCustomLabels(prev => prev.filter(l => l.key !== key)); setManualFolders(prev => { const next = { ...prev }; Object.keys(next).forEach(id => { if (next[id] === key) delete next[id]; }); return next; }); if (activeFolder === key) setActiveFolder('all'); };
  const applyLabel = (emailId: string, labelKey: FolderKey) => { setManualFolders(prev => ({ ...prev, [emailId]: labelKey })); setContextMenu(null); notify('success', 'Applied!'); };
  const onDragStart = (e: React.DragEvent, emailId: string) => { e.dataTransfer.setData('emailId', emailId); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e: React.DragEvent, folderKey: FolderKey) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolder(folderKey); };
  const onDrop = (e: React.DragEvent, folderKey: FolderKey) => {
    e.preventDefault();
    const emailId = e.dataTransfer.getData('emailId');
    if (emailId) {
      if (folderKey === 'trash') { moveToTrash(emailId); }
      else { setManualFolders(prev => ({ ...prev, [emailId]: folderKey })); notify('success', `Moved to ${[...SYSTEM_FOLDERS, ...customLabels].find(f => f.key === folderKey)?.label}`); }
    }
    setDragOverFolder(null);
  };
  const handleContextMenu = (e: React.MouseEvent, emailId: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, emailId }); };

  const filteredEmails = useMemo(() => {
    if (!emails || emails.length === 0) return [];
    let result = [...emails];
    if (activeFolder === 'trash') return result.filter(e => trashedEmails.has(e.id));
    result = result.filter(e => !trashedEmails.has(e.id));
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); result = result.filter(e => e.subject?.toLowerCase().includes(q) || e.from?.toLowerCase().includes(q) || e.snippet?.toLowerCase().includes(q) || e.analysis?.summary?.toLowerCase().includes(q)); }
    if (activeFolder === 'all') { result = result.filter(e => { const k = manualFolders[e.id]; if (!k) return true; const l = customLabels.find(x => x.key === k); return !l || l.isFolder !== true; }); return result; }
    const isCustom = customLabels.some(l => l.key === activeFolder);
    if (isCustom) return result.filter(e => manualFolders[e.id] === activeFolder);
    result = result.filter(e => {
      if (manualFolders[e.id] === activeFolder) return true;
      if (manualFolders[e.id] && manualFolders[e.id] !== activeFolder) return false;
      return inSystemFolder(e, activeFolder);
    });
    return result;
  }, [emails, searchQuery, activeFolder, manualFolders, trashedEmails, customLabels]);

  const folderCounts = useMemo(() => {
    const nonTrashed = emails.filter(e => !trashedEmails.has(e.id));
    const counts: Record<string, number> = { all: nonTrashed.filter(e => { const k = manualFolders[e.id]; if (!k) return true; const l = customLabels.find(x => x.key === k); return !l || l.isFolder !== true; }).length, trash: trashedEmails.size };
    SYSTEM_FOLDERS.forEach(f => {
      if (f.key === 'all' || f.key === 'trash') return;
      counts[f.key] = nonTrashed.filter(e => {
        if (manualFolders[e.id] === f.key) return true;
        if (manualFolders[e.id] && manualFolders[e.id] !== f.key) return false;
        return inSystemFolder(e, f.key);
      }).length;
    });
    customLabels.forEach(l => { counts[l.key] = nonTrashed.filter(e => manualFolders[e.id] === l.key).length; });
    return counts;
  }, [emails, manualFolders, trashedEmails, customLabels]);

  const connect = () => window.location.href = `${API_URL}/auth/google`;
  const disconnect = () => { localStorage.removeItem('fw_session'); setSession(null); setUser(null); setEmails([]); setSelected(null); };
  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };
  const unanalyzedCount = filteredEmails.filter(e => !e.analysis && !e.isAnalyzing).length;
  const isNarrow = sidebarWidth < 100;

  const groups = [
    { label: null, folders: SYSTEM_FOLDERS.filter(f => f.group === 'main') },
    { label: t.groupPriority, folders: SYSTEM_FOLDERS.filter(f => f.group === 'priority') },
    { label: t.groupStatus, folders: SYSTEM_FOLDERS.filter(f => f.group === 'status') },
    { label: t.groupTransport, folders: SYSTEM_FOLDERS.filter(f => f.group === 'transport') },
    { label: t.groupIntent, folders: SYSTEM_FOLDERS.filter(f => f.group === 'intent') },
  ];

  const currentFolder = [...SYSTEM_FOLDERS, ...customLabels.map(l => ({ key: l.key, label: l.label, icon: l.icon, group: 'custom', iconStyle: undefined, color: undefined }))].find(f => f.key === activeFolder);
  
  const selectedAssignment = selected ? (assignments[selected.id] || { owner: '', watchers: [], queue: '' }) : { owner: '', watchers: [], queue: '' };
  const selectedWorkflow = selected ? (workflowStatuses[selected.id] || 'new') : 'new';
  const selectedWorkflowDef = WORKFLOW_STATUSES.find(s => s.key === selectedWorkflow);
  const selectedTimeline = selected ? getThreadTimeline(selected.id) : [];
  const selectedNotes = selected ? getEmailNotes(selected.id) : [];

  if (loading) return <div data-theme={darkMode ? 'dark' : 'light'} className={`${appRootClass} flex items-center justify-center`}><div className="size-8 animate-spin rounded-full border-2 border-app-accent-fill border-t-transparent"></div></div>;

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      {notification && (
        <div role="status" className="fixed right-4 top-14 z-50 flex max-w-sm items-start gap-2.5 rounded-fw-card border border-app-line bg-app-card px-4 py-3 shadow-app-pop">
          <Icon name={notification.type === 'success' ? 'check' : 'alert'} size={16}
            className={`mt-0.5 ${toneClass[notification.type === 'success' ? 'ok' : notification.type === 'warning' ? 'warn' : 'danger'].text}`} />
          <div>
            <p className="text-app-ui font-medium text-app-ink">{notification.msg}</p>
            {notification.sub && <p className="mt-0.5 text-app-ui-sm text-app-ink-2">{notification.sub}</p>}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed z-50 min-w-48 rounded-fw-card border border-app-line bg-app-card py-1 shadow-app-pop" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <p className="border-b border-app-line px-3 py-1.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Move to</p>
          {customLabels.map(label => (
            <button key={label.key} onClick={() => applyLabel(contextMenu.emailId, label.key)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-app-ui-sm text-app-ink hover:bg-app-raised">
              <Icon name={toIconName(label.icon)} size={15} className={toneClass[labelTone(label.color)].text} />
              <span className="flex-1 truncate">{label.label}</span>
              <Icon name={label.isFolder ? 'folder' : 'tag'} size={13} className="text-app-ink-3" />
            </button>
          ))}
          {customLabels.length === 0 && <p className="px-3 py-2 text-app-ui-sm text-app-ink-3">No folders yet</p>}
          <div className="mt-1 border-t border-app-line" />
          <button onClick={() => moveToTrash(contextMenu.emailId)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-app-ui-sm text-app-danger-ink hover:bg-app-danger-bg">
            <Icon name="trash" size={15} /> Move to Trash
          </button>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSend={async (to, cc, subject, body, sig) => {
            if (!session) return;
            try {
              const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, body: body + (sig ? `\n\n--\n${sig}` : '') })
              });
              const data = await res.json();
              if (data.success) { notify('success', 'Email sent!'); setShowCompose(false); }
              else notify('error', 'Failed to send');
            } catch { notify('error', 'Error'); }
          }}
          darkMode={darkMode}
          theme={theme}
          userEmail={user?.email || ''}
        />
      )}

      {/* Quote Builder Modal */}
      {quoteBuilderInitial && (
        <QuoteBuilderModal
          darkMode={darkMode}
          session={session}
          initial={quoteBuilderInitial}
          onClose={() => setQuoteBuilderInitial(null)}
          onSent={(q) => {
            if (q.email_id) { addTimelineEvent(q.email_id, 'status', 'Quote sent to customer'); setWorkflowStatus(q.email_id, 'quoted'); }
            setQuoteBuilderInitial(null);
          }}
        />
      )}

      {upgradeReason && <UpgradeModal reason={upgradeReason} session={session} darkMode={darkMode} onLogout={disconnect} />}

      {/* Create Folder/Label Modal */}
      {showCreateLabel && (
        <Modal title={createMode === 'folder' ? 'Create Folder' : 'Create Label'} icon={createMode === 'folder' ? 'folder-plus' : 'tag'} onClose={() => setShowCreateLabel(false)} size="sm">
          <div className="space-y-4 p-5">
            <div className="flex gap-1 rounded-fw-btn border border-app-line bg-app-panel p-1" role="group" aria-label="Type">
              {(['folder', 'label'] as const).map(mode => (
                <button key={mode} onClick={() => setCreateMode(mode)} aria-pressed={createMode === mode}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[2px] py-1.5 text-app-ui-sm transition-colors ${createMode === mode ? 'border border-app-line bg-app-card font-medium text-app-ink' : 'text-app-ink-2 hover:text-app-ink'}`}>
                  <Icon name={mode === 'folder' ? 'folder' : 'tag'} size={14} /> {mode === 'folder' ? 'Folder' : 'Label'}
                </button>
              ))}
            </div>
            <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
              placeholder={createMode === 'folder' ? 'Folder name...' : 'Label name...'}
              className={inputClass}
              onKeyDown={e => e.key === 'Enter' && createLabel()} autoFocus />
            <div>
              <p className="mb-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {LABEL_ICONS.map(icon => (
                  <button key={icon} onClick={() => setNewLabelIcon(icon)} aria-label={icon} aria-pressed={newLabelIcon === icon}
                    className={`flex size-8 items-center justify-center rounded-fw-btn border transition-colors ${newLabelIcon === icon ? 'border-app-accent-fill bg-app-selected text-app-accent' : 'border-app-line text-app-ink-2 hover:bg-app-raised'}`}>
                    <Icon name={icon} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLORS.map(color => (
                  <button key={color.name} onClick={() => setNewLabelColor(color)} aria-pressed={newLabelColor.name === color.name}
                    className={`inline-flex items-center gap-1.5 rounded-fw-btn border px-2 py-1 text-app-ui-sm transition-colors ${newLabelColor.name === color.name ? 'border-app-accent-fill bg-app-selected text-app-ink' : 'border-app-line text-app-ink-2 hover:bg-app-raised'}`}>
                    <span aria-hidden className={`size-2 rounded-full ${toneClass[labelTone(color.value)].dot}`} /> {color.name}
                  </button>
                ))}
              </div>
            </div>
            {newLabelName && (
              <div className="flex items-center gap-2 rounded-fw-btn border border-app-line px-3 py-2">
                <Icon name={newLabelIcon} size={16} className={toneClass[labelTone(newLabelColor.value)].text} />
                <span className="text-app-ui font-medium">{newLabelName}</span>
                <Icon name={createMode === 'folder' ? 'folder' : 'tag'} size={14} className="ml-auto text-app-ink-3" />
              </div>
            )}
            <Button variant="primary" onClick={createLabel} disabled={!newLabelName.trim()} className="w-full">
              {createMode === 'folder' ? 'Create Folder' : 'Create Label'}
            </Button>
          </div>
        </Modal>
      )}

      <TopBar
        session={session}
        user={user}
        darkMode={darkMode}
        language={language}
        onToggleTheme={toggleTheme}
        onChangeLanguage={changeLang}
        onDisconnect={disconnect}
        alert={billingUrgent}
      />

      <TrialBanner session={session} onSubscription={(sub) => setBillingUrgent(sub.plan === 'trial' && sub.trial_days_remaining < 3)} />

      <div className="p-4">
        {!user ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="max-w-md text-center">
              <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
                <Icon name="inbox" size={26} />
              </span>
              <h1 className="mb-3 font-fw-display text-app-title font-light">{t.connect}</h1>
              <p className="mb-8 text-app-ink-2">{t.connectDesc}</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="primary" size="lg" onClick={connect}>
                  <ImgIcon name="login_page_google logo" className="size-4" />{t.connectGmail}
                </Button>
                <Button size="lg" onClick={() => window.location.href = `${API_URL}/auth/outlook`}>
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/></svg>
                  {t.connectOutlook}
                </Button>
              </div>
            </div>
          </div>
        ) : (

          <div className="flex gap-0" style={{ height: 'calc(100vh - 88px)' }}>

            {/* ── LEFT SIDEBAR ── */}
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col transition-none">
              <div className="flex h-full flex-col overflow-y-auto rounded-fw-card border border-app-line bg-app-panel">
                <div className="flex-shrink-0 p-2">
                  <Button variant="primary" size="sm" icon="compose" onClick={() => setShowCompose(true)} className="w-full" title={isNarrow ? t.compose : undefined}>
                    {!isNarrow && t.compose}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {groups.map((group, gi) => (
                    <div key={gi} className="mb-1">
                      {group.label && !isNarrow && (
                        <p className="mb-1 mt-3 px-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{group.label}</p>
                      )}
                      {group.folders.map(folder => {
                        const count = folderCounts[folder.key] || 0;
                        const isActive = activeFolder === folder.key;
                        const isDragTarget = dragOverFolder === folder.key;
                        return (
                          <button key={folder.key} onClick={() => setActiveFolder(folder.key)}
                            onDragOver={(e) => onDragOver(e, folder.key)} onDrop={(e) => onDrop(e, folder.key)} onDragLeave={() => setDragOverFolder(null)}
                            className={`relative mb-px flex w-full items-center gap-2 rounded-fw-btn px-2 py-1.5 text-app-ui-sm transition-colors ${isDragTarget ? 'bg-app-selected ring-1 ring-app-accent-fill' : isActive ? 'bg-app-selected font-medium text-app-ink' : 'text-app-ink-2 hover:bg-app-raised hover:text-app-ink'}`}
                            title={isNarrow ? folder.label : ''}>
                            {isActive && <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-app-accent-fill" />}
                            {folder.group === 'priority' ? (
                              <span className="flex size-4 flex-none items-center justify-center">
                                <span aria-hidden className={`size-2 rounded-full ${toneClass[priorityTone(folder.key)].dot}`} />
                              </span>
                            ) : (
                              <Icon name={folder.icon} size={16} className={isActive ? 'text-app-accent' : 'text-app-ink-3'} />
                            )}
                            {!isNarrow && (
                              <>
                                <span className="flex-1 truncate text-left">{folder.label}</span>
                                {count > 0 && <span className={`font-fw-mono text-app-mono-xs ${isActive ? 'text-app-accent' : 'text-app-ink-3'}`}>{count}</span>}
                              </>
                            )}
                          </button>
                        );
                      })}
                      {gi < groups.length - 1 && group.label && !isNarrow && <div className="mx-2 my-2 border-b border-app-line" />}
                    </div>
                  ))}

                  {!isNarrow && (
                    <div className="mt-1">
                      <p className="mb-1 mt-3 px-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{t.foldersLabels}</p>
                      {customLabels.map(label => {
                        const count = folderCounts[label.key] || 0;
                        const isActive = activeFolder === label.key;
                        const isDragTarget = dragOverFolder === label.key;
                        return (
                          <div key={label.key} className="group relative">
                            <button onClick={() => setActiveFolder(label.key)}
                              onDragOver={(e) => onDragOver(e, label.key)} onDrop={(e) => onDrop(e, label.key)} onDragLeave={() => setDragOverFolder(null)}
                              className={`relative mb-px flex w-full items-center gap-2 rounded-fw-btn px-2 py-1.5 text-app-ui-sm transition-colors ${isDragTarget ? 'bg-app-selected ring-1 ring-app-accent-fill' : isActive ? 'bg-app-selected font-medium text-app-ink' : 'text-app-ink-2 hover:bg-app-raised hover:text-app-ink'}`}>
                              {isActive && <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-app-accent-fill" />}
                              <Icon name={toIconName(label.icon)} size={16} className={toneClass[labelTone(label.color)].text} />
                              <span className="flex-1 truncate text-left">{label.label}</span>
                              {label.isFolder && <Icon name="folder" size={12} className="text-app-ink-3" />}
                              {count > 0 && <span className={`font-fw-mono text-app-mono-xs ${isActive ? 'text-app-accent' : 'text-app-ink-3'}`}>{count}</span>}
                            </button>
                            <button onClick={() => deleteLabel(label.key)} aria-label={`Delete ${label.label}`}
                              className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-fw-btn bg-app-panel text-app-ink-3 opacity-0 transition hover:text-app-danger-ink group-hover:opacity-100">
                              <Icon name="close" size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <div className="mt-1 flex gap-1">
                        <button onClick={() => { setCreateMode('folder'); setShowCreateLabel(true); }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-fw-btn border border-dashed border-app-line-strong px-2 py-1.5 text-app-ui-sm text-app-ink-2 transition-colors hover:bg-app-raised hover:text-app-ink">
                          <Icon name="folder-plus" size={14} /> {t.folderBtn}
                        </button>
                        <button onClick={() => { setCreateMode('label'); setShowCreateLabel(true); }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-fw-btn border border-dashed border-app-line-strong px-2 py-1.5 text-app-ui-sm text-app-ink-2 transition-colors hover:bg-app-raised hover:text-app-ink">
                          <Icon name="tag" size={14} /> {t.labelBtn}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 border-t border-app-line pt-2">
                    <button onClick={() => setActiveFolder('trash')}
                      onDragOver={(e) => onDragOver(e, 'trash')} onDrop={(e) => onDrop(e, 'trash')} onDragLeave={() => setDragOverFolder(null)}
                      className={`relative flex w-full items-center gap-2 rounded-fw-btn px-2 py-1.5 text-app-ui-sm transition-colors ${dragOverFolder === 'trash' ? 'bg-app-danger-bg ring-1 ring-app-danger-dot' : activeFolder === 'trash' ? 'bg-app-danger-bg font-medium text-app-danger-ink' : 'text-app-ink-2 hover:bg-app-raised hover:text-app-ink'}`}>
                      <Icon name="trash" size={16} className={activeFolder === 'trash' ? 'text-app-danger-ink' : 'text-app-ink-3'} />
                      {!isNarrow && (
                        <>
                          <span className="flex-1 text-left">{t.trash}</span>
                          {trashedEmails.size > 0 && <span className="font-fw-mono text-app-mono-xs text-app-danger-ink">{trashedEmails.size}</span>}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar resize */}
            <div onMouseDown={startSidebarResize} className={`mx-1.5 w-1 flex-shrink-0 cursor-col-resize self-stretch transition-colors ${theme.divider}`} />

            {/* ── MIDDLE: Email List ── */}
            <div style={{ width: emailListWidth, flexShrink: 0 }} className="flex flex-col gap-2 transition-none">
              <label className="flex flex-shrink-0 items-center gap-2 rounded-fw-card border border-app-line bg-app-card px-3 py-2 focus-within:border-app-focus">
                <Icon name="search" size={16} className="text-app-ink-3" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.search} aria-label={t.search}
                  className="flex-1 bg-transparent text-app-ui text-app-ink placeholder:text-app-ink-3 focus:outline-none" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-app-ink-3 hover:text-app-ink"><Icon name="close" size={14} /></button>
                )}
              </label>

              <div className="flex flex-1 flex-col overflow-hidden rounded-fw-card border border-app-line bg-app-card">
                {serverView && (
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-app-line bg-app-selected px-3 py-2 text-app-ui-sm text-app-ink-2">
                    <span>
                      <span className="font-fw-mono font-medium text-app-ink">{serverTotal ?? '…'}</span>{' '}
                      {serverView === 'urgent' ? 'urgent & high, not replied' : 'not replied'} · last 30 days
                    </span>
                    <Button variant="ghost" size="xs" icon="close" onClick={() => router.replace(`/dashboard${session ? `?session=${session}` : ''}`)}>Show full inbox</Button>
                  </div>
                )}
                <div className="flex-shrink-0 border-b border-app-line px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="flex items-center gap-1.5 text-app-ui font-semibold">
                        {currentFolder && (currentFolder.group === 'priority'
                          ? <span aria-hidden className={`size-2 rounded-full ${toneClass[priorityTone(currentFolder.key)].dot}`} />
                          : <Icon name={toIconName(currentFolder.icon, 'mail')} size={15} className="text-app-accent" />)}
                        {currentFolder?.label}
                      </p>
                      <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{filteredEmails.length} emails</p>
                    </div>
                    <div className="flex gap-1">
                      {activeFolder === 'trash' && trashedEmails.size > 0 && <Button variant="danger" size="xs" onClick={emptyTrash}>Empty</Button>}
                      <Button size="icon-sm" icon="refresh" onClick={() => session && loadEmails(session)} aria-label="Refresh" title="Refresh" />
                    </div>
                  </div>
                  {activeFolder !== 'trash' && (
                    <Button variant="primary" size="xs" className="w-full" onClick={analyzeAll} disabled={analyzing || unanalyzedCount === 0} icon={analyzing ? undefined : 'sparkle'}>
                      {analyzing
                        ? <><Spinner className="size-3" /> <span className="font-fw-mono">{progress.current}/{progress.total}</span></>
                        : <>{t.analyzeAll} <span className="font-fw-mono">({unanalyzedCount})</span></>}
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredEmails.length === 0 ? (
                    <EmptyState icon={activeFolder === 'trash' ? 'trash' : 'inbox'} title={activeFolder === 'trash' ? t.trashEmpty : 'No emails here'} />
                  ) : filteredEmails.map(email => {
                    const isInTrash = trashedEmails.has(email.id);
                    const emailLabel = manualFolders[email.id] ? customLabels.find(l => l.key === manualFolders[email.id]) : null;
                    const emailStatusDef = workflowStatuses[email.id] ? WORKFLOW_STATUSES.find(s => s.key === workflowStatuses[email.id]) : null;
                    const emailOwner = assignments[email.id]?.owner;
                    const isSelected = selected?.id === email.id;
                    return (
                      <div key={email.id} draggable={!isInTrash} onDragStart={(e) => onDragStart(e, email.id)}
                        onClick={() => { setSelected(email); }}
                        onContextMenu={(e) => !isInTrash && handleContextMenu(e, email.id)}
                        className={`group relative border-b border-app-line p-3 transition-colors ${!isInTrash ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isSelected ? 'bg-app-selected' : 'hover:bg-app-raised'}`}>
                        {isSelected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-app-accent-fill" />}
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-app-ui-sm font-semibold text-app-ink">{decodeEntities(email.from.split('<')[0].trim())}</span>
                          <div className="flex flex-shrink-0 items-center gap-1">
                            {email.isAnalyzing && <Spinner className="size-3 text-app-accent" />}
                            {email.analysis && <PriorityTag priority={email.analysis.priority} />}
                            {!isInTrash && (
                              <button onClick={(e) => { e.stopPropagation(); moveToTrash(email.id); }} title="Trash" aria-label="Move to trash"
                                className="flex size-5 items-center justify-center rounded-fw-btn text-app-ink-3 opacity-0 transition hover:text-app-danger-ink focus-visible:opacity-100 group-hover:opacity-100">
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={`mb-0.5 truncate text-app-ui-sm text-app-ink ${isSelected ? 'font-medium' : ''}`}>{decodeEntities(email.subject)}</p>
                        <p className="truncate text-app-ui-sm text-app-ink-3">{decodeEntities(email.snippet)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {email.analysis && <Chip>{email.analysis.intent?.replace(/_/g, ' ')}</Chip>}
                          {isMercanteIntent(email.analysis?.intent) && <Tag tone="info" mono={false}>Mercante</Tag>}
                          {emailStatusDef && <WorkflowTag status={emailStatusDef.key} label={emailStatusDef.label} />}
                          {emailOwner && <Chip><Icon name="user" size={12} className="text-app-ink-3" />{emailOwner.split('@')[0]}</Chip>}
                          {emailLabel && <Chip><Icon name={toIconName(emailLabel.icon)} size={12} className={toneClass[labelTone(emailLabel.color)].text} />{emailLabel.label}</Chip>}
                          {isInTrash && <Tag tone="danger">Trash</Tag>}
                        </div>
                        {isInTrash && (
                          <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                            <Button size="xs" icon="restore" onClick={() => restoreFromTrash(email.id)}>{t.restore}</Button>
                            <Button variant="danger" size="xs" icon="trash" onClick={() => deleteForever(email.id)}>{t.deleteForever}</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* List resize */}
            <div onMouseDown={startListResize} className={`mx-1.5 w-1 flex-shrink-0 cursor-col-resize self-stretch transition-colors ${theme.divider}`} />

            {/* ── RIGHT: Email Detail ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-fw-card border border-app-line bg-app-card">
              {selected ? (
                <>
                  <div className="flex-1 overflow-y-auto">
                    {/* Email Header */}
                    <div className="sticky top-0 z-10 border-b border-app-line bg-app-card p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="mb-0.5 truncate text-[15px] font-semibold text-app-ink">{decodeEntities(selected.subject)}</h2>
                          <p className="truncate text-app-ui-sm text-app-ink-2">{decodeEntities(selected.from)}</p>
                          <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{selected.date}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {!trashedEmails.has(selected.id) && !selected.analysis && !selected.isAnalyzing && (
                            <Button variant="primary" size="sm" icon="sparkle" onClick={() => analyzeEmail(selected)}>{t.analyze}</Button>
                          )}
                          {selected.isAnalyzing && <span className="flex items-center gap-1.5 text-app-ui-sm text-app-accent"><Spinner className="size-3" /> Analyzing...</span>}
                          {!trashedEmails.has(selected.id) && selected.analysis?.intent === 'quote_request' && (
                            <Button size="sm" icon="quote" onClick={() => openQuoteBuilder(selected)}>Build Quote</Button>
                          )}
                          {!trashedEmails.has(selected.id) && (
                            <Button size="icon-sm" icon="clock" onClick={() => setShowReminderModal(true)} title="Set Reminder" aria-label="Set reminder" />
                          )}
                          {!trashedEmails.has(selected.id) && (
                            <Button variant="danger" size="icon-sm" icon="trash" onClick={() => moveToTrash(selected.id)} title="Move to Trash" aria-label="Move to trash" />
                          )}
                        </div>
                      </div>

                      {/* Workflow + Assignment row */}
                      {!trashedEmails.has(selected.id) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {WORKFLOW_STATUSES.map(s => {
                            const active = selectedWorkflow === s.key;
                            const tc = toneClass[workflowTone(s.key)];
                            return (
                              <button key={s.key} onClick={() => setWorkflowStatus(selected.id, s.key)} aria-pressed={active}
                                className={`inline-flex items-center gap-1.5 rounded-fw-btn border px-2 py-1 font-fw-mono text-app-mono-xs uppercase transition-colors ${active ? `border-transparent ${tc.tag}` : 'border-app-line text-app-ink-3 hover:border-app-line-strong hover:text-app-ink-2'}`}>
                                <span aria-hidden className={`size-1.5 rounded-full ${active ? tc.dot : 'bg-app-line-strong'}`} />
                                {s.label}
                              </button>
                            );
                          })}

                          {/* Assignment button */}
                          <div className="relative ml-auto" data-assign-panel>
                            <button onClick={(e) => { e.stopPropagation(); setShowAssignPanel(!showAssignPanel); }} aria-expanded={showAssignPanel}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-fw-btn border px-2.5 text-app-ui-sm transition-colors ${showAssignPanel ? 'border-app-accent-fill bg-app-selected text-app-ink' : 'border-app-line-strong text-app-ink-2 hover:bg-app-raised hover:text-app-ink'}`}>
                              <Icon name="user" size={15} /> {selectedAssignment.owner ? selectedAssignment.owner.split('@')[0] : 'Assign'}
                              {(selectedAssignment.watchers?.length > 0 || selectedAssignment.queue) && <span aria-hidden className="size-1.5 flex-shrink-0 rounded-full bg-app-accent-fill" />}
                            </button>

                            {showAssignPanel && (
                              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-fw-card border border-app-line bg-app-card p-4 shadow-app-pop"
                                onClick={e => e.stopPropagation()} data-assign-panel>
                                <p className="mb-3 flex items-center gap-2 text-app-ui font-semibold"><Icon name="team" size={16} className="text-app-accent" /> Assignment</p>

                                {/* Role selector */}
                                <div className="mb-3 flex gap-1 rounded-fw-btn border border-app-line bg-app-panel p-1" role="group" aria-label="Role">
                                  {([
                                    { key: 'owner', label: 'Owner', icon: 'owner' },
                                    { key: 'watcher', label: 'Watcher', icon: 'eye' },
                                    { key: 'queue', label: 'Queue', icon: 'queue' },
                                  ] as const).map(role => (
                                    <button key={role.key} onClick={() => setAssignRole(role.key)} aria-pressed={assignRole === role.key}
                                      className={`flex flex-1 items-center justify-center gap-1 rounded-[2px] py-1.5 text-app-ui-sm transition-colors ${assignRole === role.key ? 'border border-app-line bg-app-card font-medium text-app-ink' : 'text-app-ink-2 hover:text-app-ink'}`}>
                                      <Icon name={role.icon} size={13} /> {role.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Input */}
                                <div className="mb-3 flex gap-2">
                                  <input value={assignInput} onChange={e => setAssignInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && updateAssignment(selected.id, assignRole, assignInput)}
                                    placeholder={assignRole === 'queue' ? 'e.g. Rotterdam Team' : 'Email or name...'}
                                    className={`${inputClass} text-app-ui-sm`} />
                                  <Button variant="primary" size="sm" onClick={() => updateAssignment(selected.id, assignRole, assignInput)} disabled={!assignInput.trim()}>Set</Button>
                                </div>

                                {/* Summary */}
                                <div className="space-y-2">
                                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-2.5">
                                    <DataLabel className="mb-1 flex items-center gap-1"><Icon name="owner" size={12} /> Owner</DataLabel>
                                    {selectedAssignment.owner ? (
                                      <div className="flex items-center justify-between">
                                        <span className="text-app-ui-sm font-medium">{selectedAssignment.owner}</span>
                                        <button onClick={() => setAssignments(prev => ({ ...prev, [selected.id]: { ...prev[selected.id], owner: '' } }))} aria-label="Remove owner" className="text-app-ink-3 hover:text-app-danger-ink"><Icon name="close" size={13} /></button>
                                      </div>
                                    ) : <p className="text-app-ui-sm text-app-ink-3">No owner yet</p>}
                                  </div>

                                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-2.5">
                                    <DataLabel className="mb-1 flex items-center gap-1"><Icon name="eye" size={12} /> Watchers</DataLabel>
                                    {selectedAssignment.watchers?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {selectedAssignment.watchers.map(w => (
                                          <Chip key={w}>
                                            {w.split('@')[0]}
                                            <button onClick={() => removeWatcher(selected.id, w)} aria-label={`Remove ${w}`} className="hover:text-app-danger-ink"><Icon name="close" size={11} /></button>
                                          </Chip>
                                        ))}
                                      </div>
                                    ) : <p className="text-app-ui-sm text-app-ink-3">No watchers</p>}
                                  </div>

                                  <div className="rounded-fw-btn border border-app-line bg-app-panel p-2.5">
                                    <DataLabel className="mb-1 flex items-center gap-1"><Icon name="queue" size={12} /> Queue</DataLabel>
                                    {selectedAssignment.queue ? (
                                      <div className="flex items-center justify-between">
                                        <span className="text-app-ui-sm font-medium">{selectedAssignment.queue}</span>
                                        <button onClick={() => setAssignments(prev => ({ ...prev, [selected.id]: { ...prev[selected.id], queue: '' } }))} aria-label="Remove queue" className="text-app-ink-3 hover:text-app-danger-ink"><Icon name="close" size={13} /></button>
                                      </div>
                                    ) : <p className="text-app-ui-sm text-app-ink-3">Not in any queue</p>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detail Tabs */}
                    <div className="flex border-b border-app-line px-4" role="tablist">
                      {([
                        { key: 'analysis', label: 'Analysis', icon: 'sparkle' },
                        { key: 'timeline', label: 'Timeline', icon: 'timeline', count: selectedTimeline.length },
                        { key: 'notes', label: 'Notes', icon: 'note', count: selectedNotes.length },
                        { key: 'actions', label: 'Actions', icon: 'bolt' },
                      ] as { key: typeof activeDetailTab; label: string; icon: IconName; count?: number }[]).map(tab => {
                        const active = activeDetailTab === tab.key;
                        return (
                          <button key={tab.key} role="tab" aria-selected={active} onClick={() => setActiveDetailTab(tab.key)}
                            className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-app-ui-sm transition-colors ${active ? 'font-medium text-app-ink' : 'text-app-ink-3 hover:text-app-ink'}`}>
                            <Icon name={tab.icon} size={15} className={active ? 'text-app-accent' : ''} />
                            {tab.label}
                            {tab.count !== undefined && <span className="font-fw-mono text-app-mono-xs text-app-ink-3">{tab.count}</span>}
                            {active && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-app-accent-fill" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-4 p-4">
                      {/* ANALYSIS TAB */}
                      {activeDetailTab === 'analysis' && (
                        <>
                          {selected.analysis?.intent === 'marketing' && (
                            <Notice tone="neutral" icon="inbox" title="Marketing"
                              action={<Button size="sm" icon="sparkle" onClick={() => analyzeEmail(selected, { force: true })} disabled={selected.isAnalyzing}>Analyze anyway</Button>}>
                              {selected.analysis.summary}
                            </Notice>
                          )}
                          {selected.analysis && selected.analysis.intent !== 'marketing' && (
                            <div className="rounded-fw-card border border-app-line bg-app-panel p-4">
                              <h3 className="mb-3 flex items-center gap-2 text-app-ui font-semibold"><Icon name="sparkle" size={16} className="text-app-accent" /> {t.aiAnalysis}</h3>
                              <div className="mb-3 grid grid-cols-2 gap-3">
                                <div><DataLabel>{t.intent}</DataLabel><Chip className="mt-1">{selected.analysis.intent?.replace(/_/g, ' ')}</Chip></div>
                                <div><DataLabel>{t.priority}</DataLabel><PriorityTag priority={selected.analysis.priority} className="mt-1" /></div>
                                {selected.analysis.mode && (
                                  <div>
                                    <DataLabel>{t.mode}</DataLabel>
                                    <p className="mt-1 flex items-center gap-1.5 text-app-ui capitalize"><Icon name={MODE_ICON[selected.analysis.mode?.toLowerCase()] || 'tracking'} size={15} className="text-app-ink-3" />{selected.analysis.mode}</p>
                                  </div>
                                )}
                                {selected.analysis.pol && (
                                  <div>
                                    <DataLabel>{t.route}</DataLabel>
                                    <p className="mt-1 flex items-center gap-1.5 font-fw-mono text-app-mono text-app-ink">{selected.analysis.pol} <Icon name="arrow-right" size={13} className="text-app-ink-3" /> {selected.analysis.pod}</p>
                                  </div>
                                )}
                              </div>
                              {selected.analysis.summary && <div className="mb-3"><DataLabel className="mb-1">{t.summary}</DataLabel><p className="text-app-ui text-app-ink">{decodeEntities(selected.analysis.summary)}</p></div>}
                              {selected.analysis.missing_info?.length > 0 && (
                                <div>
                                  <DataLabel className="mb-1">{t.missingInfo}</DataLabel>
                                  <div className="flex flex-wrap gap-1">{selected.analysis.missing_info.map((info: string, i: number) => <Tag key={i} tone="warn" mono={false}>{info}</Tag>)}</div>
                                </div>
                              )}
                              {isMercanteIntent(selected.analysis?.intent) && !selected.analysis.mercante_entities?.ce_number && !selected.analysis.mercante_entities?.bl_number && (
                                <div className="mt-3">
                                  <Notice tone="warn" icon="alert" title={t.mercanteCannotQuery}
                                    action={<Button size="xs" icon="note" onClick={() => selected && runMercanteAction(selected, MERCANTE_ACTIONS.find(a => a.action === 'missing')!)}>{t.mercanteRequestMissing}</Button>}>
                                    {t.mercanteSuggestedAction}
                                  </Notice>
                                </div>
                              )}
                            </div>
                          )}

                          {/* MAPA ALERT (Brazil) */}
                          {selected?.analysis?.mapa_alert?.triggered && (
                            <Notice tone="warn" icon="alert" title="MAPA Alert"
                              action={<a href={selected.analysis.mapa_alert.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-app-ui-sm font-medium text-app-warn-ink hover:underline">MAPA Requirements <Icon name="external" size={13} /></a>}>
                              <p>{selected.analysis.mapa_alert.reason}</p>
                              <p className="text-app-ink-3">{selected.analysis.mapa_alert.action}</p>
                            </Notice>
                          )}

                          {/* EU TARIC LOOKUP */}
                          {selected?.analysis?.taric_lookup && (
                            <Notice tone="info" icon="globe" title="EU TARIC">
                              <p><span className="font-fw-mono">HS {selected.analysis.taric_lookup.hs_code}</span>: {selected.analysis.taric_lookup.description}</p>
                              <p className="text-app-ink-3">Duty: <span className="font-fw-mono">{selected.analysis.taric_lookup.duty_rate}</span> | VAT: <span className="font-fw-mono">{selected.analysis.taric_lookup.vat_rate}</span></p>
                              {selected.analysis.taric_lookup.restrictions?.length > 0 && (
                                <p className="mt-1 flex items-center gap-1 text-app-danger-ink"><Icon name="alert" size={13} /> {selected.analysis.taric_lookup.restrictions.join(', ')}</p>
                              )}
                            </Notice>
                          )}

                          {/* SHIPMENT MATCH FLAG */}
                          {selected && shipmentMatchStates[selected.id] && (
                            <Notice tone="accent" icon="tracking" title="Shipment update detected"
                              action={<Link href={`/shipments?session=${session}`} className="inline-flex items-center gap-1 text-app-ui-sm font-medium text-app-accent hover:underline">Review in Shipment Tracker <Icon name="arrow-right" size={13} /></Link>} />
                          )}

                          {/* MERCANTE STATUS CARD */}
                          {selected && isMercanteIntent(selected.analysis?.intent) && (() => {
                            const ms = mercanteStates[selected.id];
                            const isOpen = mercanteCardOpen[selected.id] ?? !!ms?.result;
                            const entities = getMercanteEntities(selected);
                            const afrmmTone: Tone = ms?.result?.afrmm_status === 'paid' ? 'ok' : ms?.result?.afrmm_status === 'pending' ? 'warn' : 'neutral';
                            return (
                              <div className="rounded-fw-card border border-app-line bg-app-panel">
                                {/* Card header */}
                                <button onClick={() => setMercanteCardOpen(prev => ({ ...prev, [selected.id]: !isOpen }))} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-2 px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Icon name="link" size={16} className="text-app-accent" />
                                    <span className="text-app-ui font-semibold text-app-ink">{t.mercanteStatus}</span>
                                    {ms?.loading && <Spinner className="size-3 text-app-accent" />}
                                    {/* Tier source badge */}
                                    {ms?.result?.tier === 'restricted' && <Tag tone="ok">{t.mercanteTierFull}</Tag>}
                                    {ms?.result?.tier === 'public' && <Tag tone="info">{t.mercanteTierBasic}</Tag>}
                                    {ms?.result?.tier === 'mock' && <Tag tone="warn">{t.mercanteTierMock}</Tag>}
                                    {ms?.result?.tier === 'missing_info' && <Tag tone="neutral">{t.mercanteTierNoData}</Tag>}
                                    {ms?.result?.afrmm_status && ms.result.tier !== 'missing_info' && <Tag tone={afrmmTone}>AFRMM {ms.result.afrmm_status}</Tag>}
                                    {ms?.error && !ms.result && <Tag tone="danger">{t.mercanteNotLocated}</Tag>}
                                  </div>
                                  <Icon name={isOpen ? 'chevron-up' : 'chevron'} size={14} className="flex-shrink-0 text-app-ink-3" />
                                </button>
                                {isOpen && (
                                  <div className="space-y-3 px-4 pb-4">
                                    {/* Tier 2 upgrade prompt */}
                                    {ms?.result?.tier === 'public' && (
                                      <Notice tone="info" icon="info"
                                        action={<a href={`/settings/integrations?session=${session}`} className="inline-flex items-center gap-1 text-app-ui-sm font-medium text-app-accent hover:underline">{t.mercanteSetUp}</a>}>
                                        {t.mercanteUpgradePrompt}
                                      </Notice>
                                    )}
                                    {/* Tier 3: missing info */}
                                    {ms?.result?.tier === 'missing_info' && (
                                      <div className="rounded-fw-btn border border-app-line bg-app-card p-3">
                                        <p className="mb-2 text-app-ui-sm text-app-ink-2">{t.mercanteMissingDesc}</p>
                                        <div className="mb-3 flex flex-wrap gap-1">
                                          {(ms.result.missingFields || []).map((f, i) => <Tag key={i} tone="danger" mono={false}>{f}</Tag>)}
                                        </div>
                                        <Button size="xs" icon="note" onClick={() => selected && runMercanteAction(selected, MERCANTE_ACTIONS.find(a => a.action === 'missing')!)}>{t.mercanteRequestClient}</Button>
                                      </div>
                                    )}
                                    {ms?.error && !ms.result && <p className="text-app-ui-sm text-app-danger-ink">{ms.error}</p>}
                                    {ms?.rules?.alerts && ms.rules.alerts.length > 0 && (
                                      <div className="space-y-1">
                                        {ms.rules.alerts.filter(a => !a.startsWith('info')).map((alert, i) => (
                                          <div key={i} className={`flex items-center gap-1.5 rounded-fw-btn px-2 py-1 text-app-ui-sm ${toneClass[alert.startsWith('critical') ? 'danger' : 'warn'].tag}`}>
                                            <Icon name="alert" size={13} /> {alert.replace(/^[^:]+: /, '')}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Data fields — greyed for tier 2 */}
                                    {ms?.result && ms.result.tier !== 'missing_info' && (
                                      <>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                                          {[
                                            [t.fieldCE, ms.result.ce_number || entities.ce_number || '—'],
                                            [t.fieldBL, ms.result.bl_number || entities.bl_number || '—'],
                                            [t.fieldManifesto, ms.result.manifesto || '—'],
                                            [t.fieldVessel, (ms.result.vessel || ms.result.vessel_name) && ms.result.voyage ? `${ms.result.vessel || ms.result.vessel_name} / ${ms.result.voyage}` : entities.vessel_name || '—'],
                                            [t.fieldDischargePort, ms.result.discharge_port || entities.discharge_port || '—'],
                                            [t.fieldCarrier, ms.result.carrier || entities.carrier || '—'],
                                          ].map(([label, value]) => (
                                            <div key={label}>
                                              <DataLabel>{label}</DataLabel>
                                              <p className="font-fw-mono text-app-mono text-app-ink">{value}</p>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="space-y-2 border-t border-app-line pt-3">
                                          <div className="flex items-center justify-between">
                                            <DataLabel>{t.fieldAfrmmStatus}</DataLabel>
                                            {ms.result.tier === 'public' ? (
                                              <span className="text-app-ui-sm italic text-app-ink-3">{t.fieldAfrmmAvailSerpro}</span>
                                            ) : (
                                              <Tag tone={afrmmTone}>{ms.result.afrmm_status}</Tag>
                                            )}
                                          </div>
                                          {ms.result.afrmm_value && ms.result.tier !== 'public' && (
                                            <div className="flex items-center justify-between">
                                              <DataLabel>{t.fieldAfrmmAmount}</DataLabel>
                                              <span className="font-fw-mono text-app-mono font-medium text-app-warn-ink">BRL {ms.result.afrmm_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between">
                                            <DataLabel>{t.fieldConfidence}</DataLabel>
                                            {(() => { const c = ms.result.confidence || ms.result.response_confidence; return <Tag tone={c === 'high' ? 'ok' : c === 'medium' ? 'warn' : 'neutral'}>{c}</Tag>; })()}
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <DataLabel>{t.fieldLastChecked}</DataLabel>
                                            <span className="font-fw-mono text-app-mono-xs text-app-ink-2">{new Date(ms.result.last_checked).toLocaleString()}</span>
                                          </div>
                                          {(ms.result.operational_status || ms.result.cargo_situation) && (
                                            <div>
                                              <DataLabel>{t.fieldOperationalStatus}</DataLabel>
                                              <p className="text-app-ui-sm font-medium">{ms.result.operational_status || ms.result.cargo_situation}</p>
                                            </div>
                                          )}
                                          {ms.result.pending_items.length > 0 && (
                                            <div>
                                              <DataLabel className="mb-1">{t.fieldPendingItems}</DataLabel>
                                              {ms.result.tier === 'public' ? (
                                                <span className="text-app-ui-sm italic text-app-ink-3">{t.fieldAfrmmAvailSerpro}</span>
                                              ) : (
                                                <div className="flex flex-wrap gap-1">{ms.result.pending_items.map((item, i) => <Tag key={i} tone="warn" mono={false}>{item}</Tag>)}</div>
                                              )}
                                            </div>
                                          )}
                                          <div className="rounded-fw-btn border border-app-line bg-app-card p-2">
                                            <DataLabel className="mb-0.5">{t.fieldSuggestedAction}</DataLabel>
                                            <p className="text-app-ui-sm font-medium text-app-accent">{ms.rules?.suggestedAction || ms.result.suggested_action}</p>
                                          </div>
                                          {ms.result.note && <p className="text-app-ui-sm italic text-app-ink-3">{ms.result.note}</p>}
                                          <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{t.fieldSource} {ms.result.source || 'Sistema Mercante'}</p>
                                        </div>
                                      </>
                                    )}
                                    {!ms?.result && !ms?.loading && !ms?.error && (
                                      <div className="py-4 text-center">
                                        <p className="mb-3 text-app-ui-sm text-app-ink-3">{t.mercanteQueryPrompt}</p>
                                        <Button size="sm" icon="search" onClick={() => queryMercante(selected, 'consult')}>{t.mercanteConsult}</Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="rounded-fw-card border border-app-line bg-app-panel p-4">
                            <pre className="whitespace-pre-wrap font-fw-sans text-app-ui leading-relaxed text-app-ink">{decodeEntities(selected.body || selected.snippet)}</pre>
                          </div>
                        {/* Reminder Modal */}
                        {showReminderModal && (
                          <Modal title="Set Reminder" icon="clock" size="sm" onClose={() => setShowReminderModal(false)}
                            footer={<>
                              <Button onClick={() => setShowReminderModal(false)}>Cancel</Button>
                              <Button variant="primary" onClick={() => { setShowReminderModal(false); notify('success', `Reminder set for ${reminderDate} ${reminderTime}`); }} disabled={!reminderDate || !reminderTime}>Set Reminder</Button>
                            </>}>
                            <div className="space-y-3 p-5">
                              <Field label="Date"><input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={inputClass} /></Field>
                              <Field label="Time"><input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={inputClass} /></Field>
                            </div>
                          </Modal>
                        )}
                        </>
                      )}

                      {/* TIMELINE TAB */}
                      {activeDetailTab === 'timeline' && (
                        <div>
                          <h3 className="mb-3 text-app-ui font-semibold">Thread Timeline</h3>
                          {selectedTimeline.length === 0 ? <p className="text-app-ui-sm text-app-ink-3">Analyze the email to start tracking.</p> : (
                            <ol className="relative">
                              <span aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-app-line" />
                              {selectedTimeline.map((event, i) => (
                                <li key={i} className="relative mb-4 flex items-start gap-3">
                                  <span className="z-10 flex size-8 flex-shrink-0 items-center justify-center rounded-fw-btn border border-app-line bg-app-card text-app-accent">
                                    <Icon name={toIconName(event.icon, 'dot')} size={15} />
                                  </span>
                                  <div className="flex-1 pt-1">
                                    <p className="text-app-ui font-medium">{event.label}</p>
                                    <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{new Date(event.time).toLocaleString()}</p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}

                      {/* NOTES TAB */}
                      {activeDetailTab === 'notes' && (
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-app-ui font-semibold">Internal Notes</h3>
                            <p className="text-app-ui-sm text-app-ink-3">Only visible to your team — never sent to customers.</p>
                          </div>
                          <div className="flex gap-2">
                            <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                              placeholder="Add context... (e.g. 'Use carrier X for this lane')" aria-label="New note"
                              className={inputClass} />
                            <Button variant="primary" onClick={addNote} disabled={!newNote.trim()}>Add</Button>
                          </div>
                          {selectedNotes.length === 0 ? <EmptyState icon="note" title="No notes yet." /> : (
                            <div className="space-y-2">
                              {selectedNotes.map(note => (
                                <div key={note.id} className="group rounded-fw-card border border-app-line bg-app-panel p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="flex-1 text-app-ui text-app-ink">{note.text}</p>
                                    <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))} aria-label="Delete note"
                                      className="flex-shrink-0 text-app-ink-3 opacity-0 transition hover:text-app-danger-ink focus-visible:opacity-100 group-hover:opacity-100"><Icon name="close" size={14} /></button>
                                  </div>
                                  <p className="mt-1 flex items-center gap-1 text-app-ui-sm text-app-ink-3"><Icon name="user" size={12} /> {note.author} · <span className="font-fw-mono text-app-mono-xs">{new Date(note.createdAt).toLocaleString()}</span></p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI ACTIONS TAB */}
                      {activeDetailTab === 'actions' && (
                        <div className="space-y-3">
                          {/* MERCANTE ACTIONS — shown only for Mercante intents */}
                          {selected && isMercanteIntent(selected.analysis?.intent) && (
                            <div>
                              <h3 className="mb-2 flex items-center gap-2 text-app-ui font-semibold"><Icon name="link" size={16} className="text-app-accent" /> CE Mercante Actions <Tag tone="info" mono={false}>Brazil</Tag></h3>
                              <div className="mb-4 grid grid-cols-1 gap-2">
                                {MERCANTE_ACTIONS.map(action => {
                                  const ms = mercanteStates[selected.id];
                                  const isLoading = ms?.loading && ms?.lastAction === action.action;
                                  return (
                                    <button key={action.key}
                                      onClick={() => runMercanteAction(selected, action)}
                                      disabled={ms?.loading || !!aiActionLoading}
                                      className={`flex items-center gap-3 rounded-fw-card border px-3 py-2.5 text-left text-app-ui transition-colors disabled:opacity-50 ${isLoading ? 'border-app-accent-fill bg-app-selected' : 'border-app-line bg-app-panel hover:bg-app-raised'}`}>
                                      <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-fw-btn border border-app-line text-app-accent"><Icon name={action.icon} size={16} /></span>
                                      <span className="flex-1 font-medium">{action.label}</span>
                                      {isLoading && <Spinner className="size-4 text-app-accent" />}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mb-3 h-px bg-app-line" />
                            </div>
                          )}
                          <h3 className="text-app-ui font-semibold">One-click AI Actions</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {AI_ACTIONS.map(action => (
                              <button key={action.key} onClick={() => runAiAction(action)} disabled={!!aiActionLoading}
                                className={`flex items-center gap-3 rounded-fw-card border px-3 py-2.5 text-left text-app-ui transition-colors disabled:opacity-50 ${aiActionLoading === action.key ? 'border-app-accent-fill bg-app-selected' : 'border-app-line bg-app-panel hover:bg-app-raised'}`}>
                                <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-fw-btn border border-app-line text-app-accent"><Icon name={action.icon} size={16} /></span>
                                <span className="flex-1 font-medium">{action.label}</span>
                                {aiActionLoading === action.key && <Spinner className="size-4 text-app-accent" />}
                              </button>
                            ))}
                          </div>
                          {aiActionResult && (
                            <div className="mt-4 rounded-fw-card border border-app-line bg-app-panel p-4">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="flex items-center gap-1.5 font-fw-mono text-app-mono-xs uppercase text-app-accent"><Icon name="sparkle" size={13} /> AI Result</p>
                                <Button size="xs" icon="copy" onClick={() => { navigator.clipboard.writeText(aiActionResult); notify('success', 'Copied!'); }}>Copy</Button>
                              </div>
                              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-fw-sans text-app-ui text-app-ink">{aiActionResult}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gmail-like Reply Box */}
                  {!trashedEmails.has(selected.id) && selected.analysis?.suggested_reply && (
                    <ReplyBox
                      email={selected}
                      darkMode={darkMode}
                      theme={theme}
                      session={session}
                      language={language}
                      onSent={(status) => { notify('success', 'Reply sent!'); addTimelineEvent(selected.id, 'replied', 'Reply sent'); setWorkflowStatus(selected.id, 'quoted'); updateEmail(selected.id, { ...status, draft: null }); }}
                      onDraftSaved={(draft) => { notify('success', 'Draft saved!'); updateEmail(selected.id, { draft }); }}
                    />
                  )}
                </>
              ) : (
                <EmptyState icon="mail" title={t.selectEmail} className="h-full" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}