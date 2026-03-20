'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
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
}

interface CustomLabel {
  key: string;
  label: string;
  color: string;
  icon: string;
  isFolder?: boolean;
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
  icon: string;
  iconStyle?: React.CSSProperties;
  group: string;
  color?: string;
}

const WORKFLOW_STATUSES: { key: WorkflowStatus; label: string; color: string; bg: string }[] = [
  { key: 'new', label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { key: 'quoted', label: 'Quoted', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { key: 'booked', label: 'Booked', color: 'text-green-400', bg: 'bg-green-500/20' },
  { key: 'pending_docs', label: 'Pending Docs', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { key: 'waiting_customer', label: 'Waiting', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { key: 'closed', label: 'Closed', color: 'text-gray-400', bg: 'bg-gray-500/20' },
];

const LABEL_COLORS = [
  { name: 'Purple', value: 'text-purple-400', bg: 'bg-purple-500/20' },
  { name: 'Blue', value: 'text-blue-400', bg: 'bg-blue-500/20' },
  { name: 'Green', value: 'text-green-400', bg: 'bg-green-500/20' },
  { name: 'Yellow', value: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { name: 'Red', value: 'text-red-400', bg: 'bg-red-500/20' },
  { name: 'Pink', value: 'text-pink-400', bg: 'bg-pink-500/20' },
  { name: 'Cyan', value: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { name: 'Orange', value: 'text-orange-400', bg: 'bg-orange-500/20' },
];

const LABEL_ICONS = ['🏷️', '📌', '⭐', '🔖', '📎', '🗂️', '✅', '🔔', '💼', '🌟'];

const translations = {
  en: { inbox: 'Inbox', analyzeAll: 'Analyze All', analyzing: 'Analyzing', selectEmail: 'Select an email to view details', connect: 'Connect Your Email', connectDesc: 'Connect your Gmail or Outlook to analyze freight emails with AI', connectGmail: 'Connect Gmail', connectOutlook: 'Connect Outlook', disconnect: 'Disconnect', analyze: 'Analyze with AI', from: 'From', aiAnalysis: 'AI Analysis', intent: 'Intent', priority: 'Priority', mode: 'Mode', route: 'Route', summary: 'Summary', missingInfo: 'Missing Info', suggestedReply: 'Suggested Reply', sendReply: 'Send', editReply: 'Edit', saveDraft: 'Save Draft', cancel: 'Cancel', sending: 'Sending...', saving: 'Saving...', search: 'Search emails...', allMail: 'All Mail', compose: 'Compose', trash: 'Trash', restore: 'Restore', deleteForever: 'Delete Forever', trashEmpty: 'Trash is empty' },
  pt: { inbox: 'Caixa de Entrada', analyzeAll: 'Analisar Todos', analyzing: 'Analisando', selectEmail: 'Selecione um email para ver detalhes', connect: 'Conectar Seu Email', connectDesc: 'Conecte seu Gmail ou Outlook para analisar emails de frete com IA', connectGmail: 'Conectar Gmail', connectOutlook: 'Conectar Outlook', disconnect: 'Desconectar', analyze: 'Analisar com IA', from: 'De', aiAnalysis: 'Análise de IA', intent: 'Intenção', priority: 'Prioridade', mode: 'Modo', route: 'Rota', summary: 'Resumo', missingInfo: 'Info Faltando', suggestedReply: 'Resposta Sugerida', sendReply: 'Enviar', editReply: 'Editar', saveDraft: 'Salvar Rascunho', cancel: 'Cancelar', sending: 'Enviando...', saving: 'Salvando...', search: 'Buscar emails...', allMail: 'Todos', compose: 'Escrever', trash: 'Lixeira', restore: 'Restaurar', deleteForever: 'Apagar', trashEmpty: 'Lixeira vazia' },
  nl: { inbox: 'Inbox', analyzeAll: 'Analyseer Alles', analyzing: 'Analyseren', selectEmail: 'Selecteer een email', connect: 'Verbind Je Email', connectDesc: 'Verbind je Gmail of Outlook', connectGmail: 'Gmail Verbinden', connectOutlook: 'Outlook Verbinden', disconnect: 'Ontkoppelen', analyze: 'Analyseer met AI', from: 'Van', aiAnalysis: 'AI Analyse', intent: 'Intentie', priority: 'Prioriteit', mode: 'Modus', route: 'Route', summary: 'Samenvatting', missingInfo: 'Ontbrekende Info', suggestedReply: 'Voorgesteld Antwoord', sendReply: 'Verstuur', editReply: 'Bewerk', saveDraft: 'Concept Opslaan', cancel: 'Annuleren', sending: 'Versturen...', saving: 'Opslaan...', search: 'Emails zoeken...', allMail: 'Alle mail', compose: 'Opstellen', trash: 'Prullenbak', restore: 'Herstellen', deleteForever: 'Verwijderen', trashEmpty: 'Prullenbak leeg' },
};

const NAV_ITEMS = [
  { href: '/dashboard', label: { en: 'Inbox', pt: 'Inbox', nl: 'Inbox' }, icon: 'Dashboard_inbox' },
  { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' }, icon: 'Dashboard_email_team' },
  { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

const PRIORITY_FILTERS: Record<string, string> = {
  urgent: 'brightness(0) saturate(100%) invert(29%) sepia(96%) saturate(2000%) hue-rotate(340deg)',
  high: 'brightness(0) saturate(100%) invert(60%) sepia(80%) saturate(800%) hue-rotate(5deg)',
  medium: 'brightness(0) saturate(100%) invert(85%) sepia(60%) saturate(800%) hue-rotate(5deg)',
  low: 'brightness(0) saturate(100%) invert(65%) sepia(60%) saturate(500%) hue-rotate(80deg)',
};

const SYSTEM_FOLDERS: FolderDef[] = [
  { key: 'all', label: 'All Mail', icon: 'Dashboard_all_mail', group: 'main' },
  { key: 'urgent', label: 'Urgent', icon: 'Dashboard_priority', iconStyle: { filter: PRIORITY_FILTERS.urgent }, group: 'priority', color: 'text-red-400' },
  { key: 'high', label: 'High', icon: 'Dashboard_priority', iconStyle: { filter: PRIORITY_FILTERS.high }, group: 'priority', color: 'text-orange-400' },
  { key: 'medium', label: 'Medium', icon: 'Dashboard_priority', iconStyle: { filter: PRIORITY_FILTERS.medium }, group: 'priority', color: 'text-yellow-400' },
  { key: 'low', label: 'Low', icon: 'Dashboard_priority', iconStyle: { filter: PRIORITY_FILTERS.low }, group: 'priority', color: 'text-green-400' },
  { key: 'not_replied', label: 'Not Replied', icon: 'Dashboad_not_replied', group: 'status' },
  { key: 'replied', label: 'Replied', icon: 'Dashboard_replied', group: 'status' },
  { key: 'draft_saved', label: 'Drafts', icon: 'Dashboard_draft', group: 'status' },
  { key: 'ocean', label: 'Ocean', icon: 'Dashboard_ocean', group: 'transport' },
  { key: 'air', label: 'Air', icon: 'Dashboard_air', group: 'transport' },
  { key: 'road', label: 'Road', icon: 'Dashboard_road', group: 'transport' },
  { key: 'rail', label: 'Rail', icon: 'Dashboard_rail', group: 'transport' },
  { key: 'quote_request', label: 'Quote Requests', icon: 'Dashboard_quotation', group: 'intent' },
  { key: 'booking_confirmation', label: 'Bookings', icon: 'Dashboard_booking', group: 'intent' },
  { key: 'tracking_inquiry', label: 'Tracking', icon: 'Dashboard_tracking', group: 'intent' },
  { key: 'documentation_request', label: 'Documents', icon: 'Dashboard_documents', group: 'intent' },
];

const AI_ACTIONS = [
  { key: 'summarize', label: 'Summarize Thread', icon: '📋', prompt: (e: Email) => `Summarize this freight email in 3 bullet points:\nSubject: ${e.subject}\n\n${e.body || e.snippet}` },
  { key: 'follow_up', label: 'Generate Follow-up', icon: '🔁', prompt: (e: Email) => `Write a short professional follow-up email for this freight inquiry.\n\nOriginal subject: ${e.subject}\nFrom: ${e.from}\n${e.snippet}` },
  { key: 'missing_quote', label: 'Ask for Missing Quote Info', icon: '❓', prompt: (e: Email) => `Write a professional email asking for missing info to provide a freight quote. Ask for: cargo type, weight, dimensions, incoterm, POL, POD, target date.\n\nBased on: ${e.subject}\n${e.body || e.snippet}` },
  { key: 'tracking_reply', label: 'Create Tracking Reply', icon: '📍', prompt: (e: Email) => `Write a professional reply to this tracking inquiry. Acknowledge it and explain what you need to check status.\n\n${e.subject}\n${e.body || e.snippet}` },
  { key: 'booking_confirm', label: 'Draft Booking Confirmation', icon: '✅', prompt: (e: Email) => `Draft a professional booking confirmation based on this request:\n\nSubject: ${e.subject}\nFrom: ${e.from}\n${e.body || e.snippet}` },
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-end p-4">
      <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl shadow-2xl flex flex-col transition-all ${minimized ? 'w-80 h-12' : 'w-full max-w-2xl'}`}
        style={{ maxHeight: minimized ? '48px' : '85vh' }}>

        {/* Title bar */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.cardBorder} flex-shrink-0 ${minimized ? 'rounded-2xl' : 'rounded-t-2xl'}`}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Icon name="Dashboard_compose" className="w-4 h-4" style={theme.iconFilter} />
            New Message
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setMinimized(!minimized)} className={`${theme.textDim} hover:text-white text-lg w-6 h-6 flex items-center justify-center`}>—</button>
            <button onClick={onClose} className={`${theme.textDim} hover:text-white text-lg w-6 h-6 flex items-center justify-center`}>✕</button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* To field */}
            <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme.cardBorder} flex-shrink-0`}>
              <span className={`text-xs ${theme.textDim} w-6`}>To</span>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="Recipients"
                className={`flex-1 bg-transparent text-sm focus:outline-none ${theme.text}`} />
              <button onClick={() => setShowCc(!showCc)} className={`text-xs ${theme.textDim} hover:text-[#9E14FB] px-1`}>CC</button>
            </div>

            {/* CC field */}
            {showCc && (
              <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme.cardBorder} flex-shrink-0`}>
                <span className={`text-xs ${theme.textDim} w-6`}>CC</span>
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="CC recipients"
                  className={`flex-1 bg-transparent text-sm focus:outline-none ${theme.text}`} />
              </div>
            )}

            {/* Subject */}
            <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme.cardBorder} flex-shrink-0`}>
              <span className={`text-xs ${theme.textDim} w-10`}>Subject</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
                className={`flex-1 bg-transparent text-sm focus:outline-none font-medium ${theme.text}`} />
            </div>

            {/* Formatting toolbar */}
            <div className={`flex items-center gap-1 px-4 py-1.5 border-b ${theme.cardBorder} flex-shrink-0`}>
              {[
                { tag: 'bold', label: 'B', style: 'font-bold' },
                { tag: 'italic', label: 'I', style: 'italic' },
                { tag: 'underline', label: 'U', style: 'underline' },
              ].map(f => (
                <button key={f.tag} onClick={() => insertFormat(f.tag)}
                  className={`w-7 h-7 rounded-lg text-xs ${f.style} ${theme.hover} ${theme.textMuted} transition flex items-center justify-center`}>
                  {f.label}
                </button>
              ))}
              <div className={`w-px h-4 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />
              {/* Bullet list */}
              <button onClick={() => setBody(b => b + '\n• ')} className={`w-7 h-7 rounded-lg text-xs ${theme.hover} ${theme.textMuted} transition flex items-center justify-center`} title="Bullet list">☰</button>
              {/* Numbered list */}
              <button onClick={() => setBody(b => b + '\n1. ')} className={`w-7 h-7 rounded-lg text-xs ${theme.hover} ${theme.textMuted} transition flex items-center justify-center`} title="Numbered list">#</button>
              <div className={`w-px h-4 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />
              {/* Attach file placeholder */}
              <button className={`w-7 h-7 rounded-lg text-xs ${theme.hover} ${theme.textMuted} transition flex items-center justify-center`} title="Attach file (coming soon)" onClick={() => alert('File attachment coming soon!')}>📎</button>
              {/* Signature */}
              <button onClick={() => setShowSignatureEditor(!showSignatureEditor)}
                className={`w-7 h-7 rounded-lg text-xs ${showSignatureEditor ? 'bg-[#9E14FB]/20 text-[#9E14FB]' : `${theme.hover} ${theme.textMuted}`} transition flex items-center justify-center`}
                title="Edit signature">✍️</button>
            </div>

            {/* Signature editor */}
            {showSignatureEditor && (
              <div className={`px-4 py-3 border-b ${theme.cardBorder} flex-shrink-0 ${darkMode ? 'bg-white/3' : 'bg-slate-50'}`}>
                <p className={`text-xs font-medium ${theme.textDim} mb-2`}>Edit Signature</p>
                <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={3}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-xs resize-none focus:outline-none focus:border-[#5200FF]`} />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveSignature} className="px-3 py-1.5 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-lg text-white text-xs">Save Signature</button>
                  <button onClick={() => setShowSignatureEditor(false)} className={`px-3 py-1.5 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} rounded-lg text-xs`}>Cancel</button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
                placeholder="Write your message..."
                className={`flex-1 px-4 py-3 bg-transparent text-sm focus:outline-none resize-none ${theme.text}`}
                style={{ minHeight: '120px' }} />
              {/* Signature preview */}
              {signature && (
                <div className={`px-4 pb-2 border-t ${theme.cardBorder}`}>
                  <p className={`text-xs ${theme.textDim} mt-2`}>-- </p>
                  <pre className={`text-xs ${theme.textDim} whitespace-pre-wrap`}>{signature}</pre>
                </div>
              )}
            </div>

            {/* Send bar */}
            <div className={`flex items-center gap-3 px-4 py-3 border-t ${theme.cardBorder} flex-shrink-0`}>
              <button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white disabled:opacity-50">
                {sending ? 'Sending...' : '📤 Send'}
              </button>
              <span className={`text-xs ${theme.textDim}`}>{body.length} chars</span>
              <button onClick={onClose} className={`ml-auto px-4 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>Discard</button>
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
  onSent: () => void;
  onDraftSaved: () => void;
  language: Language;
}) {
  const [replyText, setReplyText] = useState(email.analysis?.suggested_reply || '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [signature, setSignature] = useState(() => localStorage.getItem('fw_signature') || '');
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setReplyText(email.analysis?.suggested_reply || ''); }, [email.analysis?.suggested_reply]);

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
        body: JSON.stringify({ to, cc, subject: email.subject, body: replyText + (signature ? `\n\n--\n${signature}` : ''), threadId: email.threadId, emailId: email.id })
      });
      const data = await res.json();
      if (data.success) onSent();
    } catch (e) {}
    setSending(false);
  };

  const handleSaveDraft = async () => {
    if (!replyText.trim() || !session) return;
    setSavingDraft(true);
    try {
      await fetch(`${API_URL}/api/save-draft?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: email.subject, body: replyText, threadId: email.threadId, emailId: email.id })
      });
      onDraftSaved();
    } catch (e) {}
    setSavingDraft(false);
  };

  if (!email.analysis?.suggested_reply) return null;

  return (
    <div className={`border-t ${theme.cardBorder} ${theme.card} flex-shrink-0`}>
      {/* Collapsed preview — click to expand */}
      {!expanded ? (
        <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(true)}>
          <div className={`flex-1 px-4 py-2.5 rounded-xl border ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} text-sm ${theme.textMuted} truncate transition`}>
            {replyText.substring(0, 80)}...
          </div>
          <button onClick={e => { e.stopPropagation(); handleSend(); }} disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white disabled:opacity-50 flex-shrink-0">
            {sending ? 'Sending...' : '📤 Send'}
          </button>
        </div>
      ) : (
        <div>
          {/* To / CC row */}
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme.cardBorder}`}>
            <span className={`text-xs ${theme.textDim} w-4`}>To</span>
            <span className={`text-xs ${theme.textMuted} flex-1 truncate`}>{to}</span>
            <button onClick={() => setShowCc(!showCc)} className={`text-xs ${theme.textDim} hover:text-[#9E14FB] px-1`}>CC</button>
            <button onClick={() => setExpanded(false)} className={`text-xs ${theme.textDim} hover:text-white`}>▼</button>
          </div>
          {showCc && (
            <div className={`flex items-center gap-2 px-4 py-2 border-b ${theme.cardBorder}`}>
              <span className={`text-xs ${theme.textDim} w-4`}>CC</span>
              <input value={cc} onChange={e => setCc(e.target.value)} placeholder="CC recipients"
                className={`flex-1 bg-transparent text-xs focus:outline-none ${theme.text}`} />
            </div>
          )}

          {/* Formatting toolbar */}
          <div className={`flex items-center gap-1 px-4 py-1.5 border-b ${theme.cardBorder}`}>
            <button onClick={() => insertFormat('bold')} className={`w-6 h-6 rounded text-xs font-bold ${theme.hover} ${theme.textMuted} transition`}>B</button>
            <button onClick={() => insertFormat('italic')} className={`w-6 h-6 rounded text-xs italic ${theme.hover} ${theme.textMuted} transition`}>I</button>
            <div className={`w-px h-3 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />
            <button onClick={() => setReplyText(t => t + '\n• ')} className={`w-6 h-6 rounded text-xs ${theme.hover} ${theme.textMuted} transition`}>☰</button>
            <button onClick={() => setReplyText(t => t + '\n1. ')} className={`w-6 h-6 rounded text-xs ${theme.hover} ${theme.textMuted} transition`}>#</button>
            <div className={`w-px h-3 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />
            <button className={`w-6 h-6 rounded text-xs ${theme.hover} ${theme.textMuted} transition`} title="Attach (coming soon)" onClick={() => alert('File attachment coming soon!')}>📎</button>
            <button onClick={() => setShowSignatureEditor(!showSignatureEditor)}
              className={`w-6 h-6 rounded text-xs ${showSignatureEditor ? 'text-[#9E14FB]' : `${theme.hover} ${theme.textMuted}`} transition`} title="Signature">✍️</button>
          </div>

          {showSignatureEditor && (
            <div className={`px-4 py-2 border-b ${theme.cardBorder} ${darkMode ? 'bg-white/3' : 'bg-slate-50'}`}>
              <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={2}
                className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-xs resize-none focus:outline-none focus:border-[#5200FF]`} />
              <button onClick={() => { localStorage.setItem('fw_signature', signature); setShowSignatureEditor(false); }}
                className="mt-1 px-3 py-1 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-lg text-white text-xs">Save</button>
            </div>
          )}

          {/* Body */}
          <textarea ref={bodyRef} value={replyText} onChange={e => setReplyText(e.target.value)} rows={6}
            className={`w-full px-4 py-3 bg-transparent text-sm focus:outline-none resize-none ${theme.text}`} />

          {signature && (
            <div className={`px-4 pb-1 border-t ${theme.cardBorder}`}>
              <p className={`text-xs ${theme.textDim}`}>-- </p>
              <pre className={`text-xs ${theme.textDim} whitespace-pre-wrap`}>{signature}</pre>
            </div>
          )}

          {/* Send bar */}
          <div className={`flex items-center gap-2 px-4 py-3 border-t ${theme.cardBorder}`}>
            <button onClick={handleSend} disabled={sending || !replyText.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white disabled:opacity-50">
              {sending ? 'Sending...' : '📤 Send'}
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft}
              className={`px-4 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={() => setExpanded(false)} className={`ml-auto text-xs ${theme.textDim} hover:text-white`}>Collapse ▼</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
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
  const [newLabelIcon, setNewLabelIcon] = useState(LABEL_ICONS[0]);
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

  const t = translations[language];

  const theme = darkMode ? {
    bg: 'bg-[#050510]',
    bgGradient: 'bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510]',
    card: 'bg-[#0a0a1a]',
    cardBorder: 'border-white/5',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hover: 'hover:bg-white/5',
    selected: 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/15 border-l-2 border-l-[#9E14FB]',
    input: 'bg-[#0a0a1a] border-white/10 text-white placeholder-gray-600',
    sidebar: 'bg-[#080814]',
    iconFilter: { filter: 'brightness(0) invert(1)' },
    divider: 'bg-white/10 hover:bg-[#5200FF]/50',
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    bgGradient: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm',
    cardBorder: 'border-slate-200/50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50',
    selected: 'bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border-l-2 border-l-[#9E14FB]',
    input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    sidebar: 'bg-white/60',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
    divider: 'bg-slate-300 hover:bg-[#5200FF]/50',
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };

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
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) { localStorage.setItem('fw_session', sid); setSession(sid); checkAuth(sid); }
    else setLoading(false);
  }, [searchParams]);

  useEffect(() => { localStorage.setItem('fw_custom_labels', JSON.stringify(customLabels)); }, [customLabels]);
  useEffect(() => { localStorage.setItem('fw_manual_folders', JSON.stringify(manualFolders)); }, [manualFolders]);
  useEffect(() => { localStorage.setItem('fw_trash', JSON.stringify(Array.from(trashedEmails))); }, [trashedEmails]);
  useEffect(() => { localStorage.setItem('fw_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('fw_workflow_statuses', JSON.stringify(workflowStatuses)); }, [workflowStatuses]);
  useEffect(() => { localStorage.setItem('fw_assignments', JSON.stringify(assignments)); }, [assignments]);
  useEffect(() => { setActiveDetailTab('analysis'); setAiActionResult(null); }, [selected?.id]);

  const checkAuth = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/status?session=${sid}`);
      const data = await res.json();
      if (data.authenticated) { setUser({ email: data.email, name: data.name }); await loadEmails(sid); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadEmails = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/emails?session=${sid}`);
      const data = await res.json();
      if (data.emails) setEmails(data.emails.map((e: any) => ({ ...e, analysis: e.analysis || null, isAnalyzing: false })));
    } catch (e) { console.error(e); }
  };

  const analyzeEmail = async (email: Email) => {
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: true } : e));
    if (selected?.id === email.id) setSelected({ ...email, isAnalyzing: true });
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, body: email.body || email.snippet, from: email.from, emailId: email.id, sessionId: session, language })
      });
      const data = await res.json();
      if (data.analysis) {
        const updated = { ...email, analysis: data.analysis, isAnalyzing: false };
        setEmails(prev => prev.map(e => e.id === email.id ? updated : e));
        if (selected?.id === email.id) setSelected(updated);
        addTimelineEvent(email.id, 'analyzed', 'AI Analysis completed');
      }
    } catch (e) { console.error(e); }
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: false } : e));
  };

  const analyzeAll = async () => {
    const toAnalyze = filteredEmails.filter(e => !e.analysis && !e.isAnalyzing);
    if (!toAnalyze.length) return;
    setAnalyzing(true); setProgress({ current: 0, total: toAnalyze.length });
    for (let i = 0; i < toAnalyze.length; i++) {
      setProgress({ current: i + 1, total: toAnalyze.length });
      await analyzeEmail(toAnalyze[i]);
      await new Promise(r => setTimeout(r, 500));
    }
    setAnalyzing(false); notify('success', `Analyzed ${toAnalyze.length} emails!`);
  };

  const addTimelineEvent = (emailId: string, type: string, label: string) => {
    setNotes(prev => [...prev, { id: `evt_${Date.now()}`, emailId, text: `__event__:${type}:${label}`, author: user?.name || 'System', createdAt: new Date().toISOString() }]);
  };

  const getThreadTimeline = (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    const events: { type: string; label: string; time: string; icon: string }[] = [];
    if (email) events.push({ type: 'received', label: 'Inquiry received', time: email.date, icon: '📨' });
    notes.filter(n => n.emailId === emailId && n.text.startsWith('__event__:')).forEach(n => {
      const parts = n.text.replace('__event__:', '').split(':');
      const iconMap: Record<string, string> = { analyzed: '🤖', replied: '✉️', note: '📝', status: '🔄', assigned: '👤', received: '📨' };
      events.push({ type: parts[0], label: parts.slice(1).join(':'), time: n.createdAt, icon: iconMap[parts[0]] || '•' });
    });
    return events;
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

  const runAiAction = async (action: typeof AI_ACTIONS[0]) => {
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
      const a = e.analysis;
      switch (activeFolder) {
        case 'urgent': return a?.priority?.toLowerCase() === 'urgent';
        case 'high': return a?.priority?.toLowerCase() === 'high';
        case 'medium': return a?.priority?.toLowerCase() === 'medium';
        case 'low': return a?.priority?.toLowerCase() === 'low';
        case 'replied': return a?.replied_at != null;
        case 'not_replied': return a && !a.replied_at;
        case 'draft_saved': return a?.draft_saved === true;
        case 'ocean': return a?.mode?.toLowerCase() === 'ocean';
        case 'air': return a?.mode?.toLowerCase() === 'air';
        case 'road': return a?.mode?.toLowerCase() === 'road';
        case 'rail': return a?.mode?.toLowerCase() === 'rail';
        case 'quote_request': return a?.intent === 'quote_request';
        case 'booking_confirmation': return a?.intent === 'booking_confirmation';
        case 'tracking_inquiry': return a?.intent === 'tracking_inquiry';
        case 'documentation_request': return a?.intent === 'documentation_request';
        default: return false;
      }
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
        const a = e.analysis;
        switch (f.key) {
          case 'urgent': return a?.priority?.toLowerCase() === 'urgent';
          case 'high': return a?.priority?.toLowerCase() === 'high';
          case 'medium': return a?.priority?.toLowerCase() === 'medium';
          case 'low': return a?.priority?.toLowerCase() === 'low';
          case 'replied': return a?.replied_at != null;
          case 'not_replied': return a && !a.replied_at;
          case 'ocean': return a?.mode?.toLowerCase() === 'ocean';
          case 'air': return a?.mode?.toLowerCase() === 'air';
          case 'road': return a?.mode?.toLowerCase() === 'road';
          case 'rail': return a?.mode?.toLowerCase() === 'rail';
          case 'quote_request': return a?.intent === 'quote_request';
          case 'booking_confirmation': return a?.intent === 'booking_confirmation';
          case 'tracking_inquiry': return a?.intent === 'tracking_inquiry';
          case 'documentation_request': return a?.intent === 'documentation_request';
          default: return false;
        }
      }).length;
    });
    customLabels.forEach(l => { counts[l.key] = nonTrashed.filter(e => manualFolders[e.id] === l.key).length; });
    return counts;
  }, [emails, manualFolders, trashedEmails, customLabels]);

  const getPriorityColor = (p?: string) => ({ urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }[p?.toLowerCase() || ''] || 'bg-gray-500');
  const connect = () => window.location.href = `${API_URL}/auth/google`;
  const disconnect = () => { localStorage.removeItem('fw_session'); setSession(null); setUser(null); setEmails([]); setSelected(null); };
  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };
  const unanalyzedCount = filteredEmails.filter(e => !e.analysis && !e.isAnalyzing).length;
  const isNarrow = sidebarWidth < 100;

  const groups = [
    { label: null, folders: SYSTEM_FOLDERS.filter(f => f.group === 'main') },
    { label: 'PRIORITY', folders: SYSTEM_FOLDERS.filter(f => f.group === 'priority') },
    { label: 'STATUS', folders: SYSTEM_FOLDERS.filter(f => f.group === 'status') },
    { label: 'TRANSPORT', folders: SYSTEM_FOLDERS.filter(f => f.group === 'transport') },
    { label: 'INTENT', folders: SYSTEM_FOLDERS.filter(f => f.group === 'intent') },
  ];

  const currentFolder = [...SYSTEM_FOLDERS, ...customLabels.map(l => ({ key: l.key, label: l.label, icon: l.icon, group: 'custom', iconStyle: undefined, color: undefined }))].find(f => f.key === activeFolder);
  const getFolderIconStyle = (folder: FolderDef): React.CSSProperties => folder.iconStyle || theme.iconFilter;

  const selectedAssignment = selected ? (assignments[selected.id] || { owner: '', watchers: [], queue: '' }) : { owner: '', watchers: [], queue: '' };
  const selectedWorkflow = selected ? (workflowStatuses[selected.id] || 'new') : 'new';
  const selectedWorkflowDef = WORKFLOW_STATUSES.find(s => s.key === selectedWorkflow);
  const selectedTimeline = selected ? getThreadTimeline(selected.id) : [];
  const selectedNotes = selected ? getEmailNotes(selected.id) : [];

  if (loading) return <div className={`min-h-screen ${theme.bgGradient} ${theme.text} flex items-center justify-center`}><div className="w-10 h-10 border-4 border-[#5200FF] border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className={`min-h-screen ${theme.bgGradient} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{notification.msg}</div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className={`fixed z-50 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-2xl py-1 min-w-48`} style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <p className={`px-4 py-1.5 text-xs font-semibold ${theme.textDim} uppercase tracking-wider border-b ${theme.cardBorder}`}>Move to</p>
          {customLabels.map(label => (
            <button key={label.key} onClick={() => applyLabel(contextMenu.emailId, label.key)} className={`w-full px-4 py-2 text-sm text-left ${theme.hover} flex items-center gap-2 ${label.color}`}>
              {label.icon} {label.label} {label.isFolder ? '📁' : '🏷️'}
            </button>
          ))}
          {customLabels.length === 0 && <p className={`px-4 py-2 text-xs ${theme.textDim}`}>No folders yet</p>}
          <div className={`border-t ${theme.cardBorder} mt-1`} />
          <button onClick={() => moveToTrash(contextMenu.emailId)} className={`w-full px-4 py-2 text-sm text-left ${theme.hover} flex items-center gap-2 text-red-400`}>
            <Icon name="Dashboard_trash" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} /> Move to Trash
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

      {/* Create Folder/Label Modal */}
      {showCreateLabel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-sm shadow-2xl`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.cardBorder}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name={createMode === 'folder' ? 'Dashboard_new_folder' : 'Dashboard_new_label'} className="w-5 h-5" style={theme.iconFilter} />
                {createMode === 'folder' ? 'Create Folder' : 'Create Label'}
              </h3>
              <button onClick={() => setShowCreateLabel(false)} className={`${theme.textDim} hover:text-white text-lg`}>✕</button>
            </div>
            <div className={`flex gap-1 p-1 mx-5 mt-4 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl`}>
              <button onClick={() => setCreateMode('folder')} className={`flex-1 py-1.5 text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${createMode === 'folder' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
                <Icon name="Dashboard_new_folder" className="w-3.5 h-3.5" style={createMode === 'folder' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter} /> Folder
              </button>
              <button onClick={() => setCreateMode('label')} className={`flex-1 py-1.5 text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${createMode === 'label' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
                <Icon name="Dashboard_new_label" className="w-3.5 h-3.5" style={createMode === 'label' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter} /> Label
              </button>
            </div>
            <div className="p-5 space-y-4">
              <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                placeholder={createMode === 'folder' ? 'Folder name...' : 'Label name...'}
                className={`w-full px-4 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}
                onKeyDown={e => e.key === 'Enter' && createLabel()} autoFocus />
              <div><p className={`text-xs ${theme.textDim} mb-2`}>Icon</p><div className="flex flex-wrap gap-2">{LABEL_ICONS.map(icon => (<button key={icon} onClick={() => setNewLabelIcon(icon)} className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center ${newLabelIcon === icon ? 'bg-[#5200FF]/30 border border-[#5200FF]' : theme.hover}`}>{icon}</button>))}</div></div>
              <div><p className={`text-xs ${theme.textDim} mb-2`}>Color</p><div className="flex flex-wrap gap-2">{LABEL_COLORS.map(color => (<button key={color.name} onClick={() => setNewLabelColor(color)} className={`px-3 py-1 rounded-full text-xs border ${color.value} ${newLabelColor.name === color.name ? 'border-[#5200FF] bg-[#5200FF]/20' : `${theme.cardBorder} ${color.bg}`}`}>{color.name}</button>))}</div></div>
              {newLabelName && <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${newLabelColor.bg} border ${theme.cardBorder}`}><span>{newLabelIcon}</span><span className={`text-sm font-medium ${newLabelColor.value}`}>{newLabelName}</span><span className={`text-xs ${theme.textDim} ml-auto`}>{createMode === 'folder' ? '📁' : '🏷️'}</span></div>}
              <button onClick={createLabel} disabled={!newLabelName.trim()} className="w-full py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">{createMode === 'folder' ? 'Create Folder' : 'Create Label'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-3 flex items-center justify-between sticky top-0 z-40`}>
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
          <span className="text-base font-bold">FreightWizard</span>
        </Link>
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={`${item.href}?session=${session}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${pathname?.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard') ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/40' : `border border-transparent ${darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}`}>
              <Icon name={item.icon} className="w-3.5 h-3.5" style={theme.iconFilter} />
              {item.label[language]}
            </Link>
          ))}
          <div className={`w-px h-5 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />
          <div className="relative">
            <button onClick={() => setLangMenuOpen(!langMenuOpen)} className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover} flex items-center gap-1`}>{langLabels[language]} <span className="text-xs">▼</span></button>
            {langMenuOpen && (<div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>{(['en', 'pt', 'nl'] as Language[]).map(l => (<button key={l} onClick={() => changeLang(l)} className={`w-full px-4 py-2 text-left text-sm ${theme.hover} ${language === l ? 'text-[#9E14FB] font-medium' : theme.textMuted}`}>{langLabels[l]}</button>))}</div>)}
          </div>
          <button onClick={toggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
            {darkMode ? <Icon name="Dashboard_sun_light_mode" className="w-4 h-4" style={theme.iconFilter} /> : <Icon name="Dashboard_moon_dark_mode" className="w-4 h-4" style={theme.iconFilter} />}
          </button>
          {user && (<><span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span><button onClick={disconnect} className="text-sm text-red-400 border border-red-400/30 px-3 py-1.5 rounded-full hover:bg-red-400/10 transition">{language === 'pt' ? 'Desconectar' : language === 'nl' ? 'Ontkoppelen' : 'Disconnect'}</button></>)}
        </div>
      </header>

      <div className="p-4">
        {!user ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20"><Icon name="login_page_Connect your Gmail" className="w-full h-full" /></div>
              <h1 className="text-2xl font-bold mb-4">{t.connect}</h1>
              <p className={`${theme.textMuted} mb-8`}>{t.connectDesc}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={connect} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium text-white shadow-lg hover:scale-105 transition-transform"><Icon name="login_page_google logo" className="w-5 h-5" />{t.connectGmail}</button>
                <button onClick={() => window.location.href = `${API_URL}/auth/outlook`} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#0078D4] to-[#00BCF2] rounded-full font-medium text-white shadow-lg hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/></svg>
                  {t.connectOutlook}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-0" style={{ height: 'calc(100vh - 88px)' }}>

            {/* ── LEFT SIDEBAR ── */}
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col transition-none">
              <div className={`${theme.sidebar} border ${theme.cardBorder} rounded-2xl h-full overflow-y-auto flex flex-col`}>
                <div className="p-2 pt-2.5 flex-shrink-0">
                  <button onClick={() => setShowCompose(true)} className="w-full py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                    <Icon name="Dashboard_compose" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                    {!isNarrow && t.compose}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {groups.map((group, gi) => (
                    <div key={gi} className="mb-1">
                      {group.label && !isNarrow && (
                        <p className={`text-[10px] font-semibold ${theme.textDim} uppercase tracking-wider px-2 mb-0.5 mt-2`}>{group.label}</p>
                      )}
                      {group.folders.map(folder => {
                        const count = folderCounts[folder.key] || 0;
                        const isActive = activeFolder === folder.key;
                        const isDragTarget = dragOverFolder === folder.key;
                        return (
                          <button key={folder.key} onClick={() => setActiveFolder(folder.key)}
                            onDragOver={(e) => onDragOver(e, folder.key)} onDrop={(e) => onDrop(e, folder.key)} onDragLeave={() => setDragOverFolder(null)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition mb-0.5 ${isDragTarget ? 'border-2 border-[#5200FF] bg-[#5200FF]/20 scale-105' : isActive ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/30' : theme.hover}`}
                            title={isNarrow ? folder.label : ''}>
                            <Icon name={folder.icon} className="w-3.5 h-3.5 flex-shrink-0" style={getFolderIconStyle(folder)} />
                            {!isNarrow && (
                              <>
                                <span className={`flex-1 text-left truncate ${isActive ? 'font-medium' : ''} ${folder.group === 'priority' ? (folder.color || '') : (darkMode ? '!text-white' : '!text-[#7C0BFD]')}`}>{folder.label}</span>
                                {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#5200FF]/30 text-[#9E14FB]' : darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
                              </>
                            )}
                          </button>
                        );
                      })}
                      {gi < groups.length - 1 && group.label && !isNarrow && <div className={`border-b ${theme.cardBorder} my-1.5`} />}
                    </div>
                  ))}

                  {!isNarrow && (
                    <div className="mt-1.5">
                      <p className={`text-[10px] font-semibold ${theme.textDim} uppercase tracking-wider px-2 mb-0.5 mt-2`}>Folders & Labels</p>
                      {customLabels.map(label => {
                        const count = folderCounts[label.key] || 0;
                        const isActive = activeFolder === label.key;
                        const isDragTarget = dragOverFolder === label.key;
                        return (
                          <div key={label.key} className="group relative">
                            <button onClick={() => setActiveFolder(label.key)}
                              onDragOver={(e) => onDragOver(e, label.key)} onDrop={(e) => onDrop(e, label.key)} onDragLeave={() => setDragOverFolder(null)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition mb-0.5 ${isDragTarget ? 'border-2 border-[#5200FF] bg-[#5200FF]/20 scale-105' : isActive ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/30' : theme.hover}`}>
                              <span className="flex-shrink-0">{label.icon}</span>
                              <span className={`flex-1 text-left truncate ${isActive ? 'font-medium' : ''} ${label.color}`}>{label.label}</span>
                              {label.isFolder && <span className={`text-[9px] ${theme.textDim}`}>📁</span>}
                              {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#5200FF]/30 text-[#9E14FB]' : darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
                            </button>
                            <button onClick={() => deleteLabel(label.key)} className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition ${darkMode ? 'bg-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'bg-slate-200 hover:bg-red-100 text-slate-400 hover:text-red-500'}`}>✕</button>
                          </div>
                        );
                      })}
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => { setCreateMode('folder'); setShowCreateLabel(true); }} className={`flex-1 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] ${theme.textDim} ${theme.hover} transition border border-dashed ${theme.cardBorder}`}>
                          <Icon name="Dashboard_new_folder" className="w-3 h-3" style={theme.iconFilter} /> Folder
                        </button>
                        <button onClick={() => { setCreateMode('label'); setShowCreateLabel(true); }} className={`flex-1 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] ${theme.textDim} ${theme.hover} transition border border-dashed ${theme.cardBorder}`}>
                          <Icon name="Dashboard_new_label" className="w-3 h-3" style={theme.iconFilter} /> Label
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`border-t ${theme.cardBorder} mt-2 pt-1.5`}>
                    <button onClick={() => setActiveFolder('trash')}
                      onDragOver={(e) => onDragOver(e, 'trash')} onDrop={(e) => onDrop(e, 'trash')} onDragLeave={() => setDragOverFolder(null)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition ${dragOverFolder === 'trash' ? 'border-2 border-red-500 bg-red-500/20 scale-105' : activeFolder === 'trash' ? 'bg-red-500/10 border border-red-500/30' : theme.hover}`}>
                      <Icon name="Dashboard_trash" className="w-3.5 h-3.5 flex-shrink-0" style={{ filter: activeFolder === 'trash' ? 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' : (darkMode ? 'brightness(0) invert(1)' : 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)') }} />
                      {!isNarrow && (
                        <>
                          <span className={`flex-1 text-left ${activeFolder === 'trash' ? 'font-medium text-red-400' : (darkMode ? 'text-white' : 'text-[#7C0BFD]')}`}>{t.trash}</span>
                          {trashedEmails.size > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{trashedEmails.size}</span>}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar resize */}
            <div onMouseDown={startSidebarResize} className={`w-1.5 mx-1 rounded-full cursor-col-resize ${theme.divider} transition-colors flex-shrink-0 self-stretch`} />

            {/* ── MIDDLE: Email List ── */}
            <div style={{ width: emailListWidth, flexShrink: 0 }} className="flex flex-col gap-2 transition-none">
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-shrink-0`}>
                <Icon name="Dashboard_search_emails" className="w-4 h-4 flex-shrink-0" style={theme.iconFilter} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.search} className={`flex-1 bg-transparent text-sm focus:outline-none ${theme.text}`} />
                {searchQuery && <button onClick={() => setSearchQuery('')} className={`text-xs ${theme.textDim}`}>✕</button>}
              </div>

              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-hidden flex flex-col flex-1`}>
                <div className={`px-3 py-2.5 border-b ${theme.cardBorder} flex-shrink-0`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {currentFolder && <Icon name={currentFolder.icon} className="w-3.5 h-3.5" style={getFolderIconStyle(currentFolder as FolderDef)} />}
                        {currentFolder?.label}
                      </p>
                      <p className={`text-xs ${theme.textDim}`}>{filteredEmails.length} emails</p>
                    </div>
                    <div className="flex gap-1">
                      {activeFolder === 'trash' && trashedEmails.size > 0 && <button onClick={emptyTrash} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-400/10">Empty</button>}
                      <button onClick={() => session && loadEmails(session)} className={`text-xs ${theme.textMuted} ${theme.hover} px-2 py-1 border ${theme.cardBorder} rounded-lg`}>↻</button>
                    </div>
                  </div>
                  {activeFolder !== 'trash' && (
                    <button onClick={analyzeAll} disabled={analyzing || unanalyzedCount === 0}
                      className={`w-full py-1.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 ${unanalyzedCount === 0 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white'}`}>
                      {analyzing ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {progress.current}/{progress.total}</> : <><Icon name="Dashboard_email_Analyze all bottom" className="w-3.5 h-3.5" style={{ filter: 'brightness(0) invert(1)' }} />{t.analyzeAll} ({unanalyzedCount})</>}
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {filteredEmails.length === 0 ? (
                    <div className={`p-8 text-center ${theme.textDim}`}>
                      {activeFolder === 'trash' ? <p className="text-3xl mb-2">🗑️</p> : <div className="w-16 h-16 mx-auto mb-3"><Icon name="Dashboard_no_emails_here" className="w-full h-full" style={theme.iconFilter} /></div>}
                      <p className="text-sm">{activeFolder === 'trash' ? t.trashEmpty : 'No emails here'}</p>
                    </div>
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
                        className={`p-3 border-b ${theme.cardBorder} ${!isInTrash ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all ${isSelected ? `${theme.selected} shadow-sm` : theme.hover}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold truncate max-w-[120px] ${isSelected ? 'text-white' : ''}`}>{email.from.split('<')[0].trim()}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {email.isAnalyzing && <div className="w-3 h-3 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div>}
                            {email.analysis && <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white ${getPriorityColor(email.analysis.priority)}`}>{email.analysis.priority}</span>}
                            {!isInTrash && <button onClick={(e) => { e.stopPropagation(); moveToTrash(email.id); }} className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition" title="Trash"><Icon name="Dashboard_trash" className="w-3 h-3" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} /></button>}
                          </div>
                        </div>
                        <p className={`text-xs truncate mb-0.5 ${isSelected ? 'text-white font-medium' : (darkMode ? 'text-gray-300' : 'text-slate-700')}`}>{email.subject}</p>
                        <p className={`text-xs truncate ${isSelected ? 'text-white/60' : theme.textDim}`}>{email.snippet}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {email.analysis && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB]'}`}>{email.analysis.intent?.replace(/_/g, ' ')}</span>}
                          {emailStatusDef && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${emailStatusDef.bg} ${emailStatusDef.color}`}>{emailStatusDef.label}</span>}
                          {emailOwner && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-500'}`}>👑 {emailOwner.split('@')[0]}</span>}
                          {emailLabel && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${emailLabel.color} bg-white/5`}>{emailLabel.icon} {emailLabel.label}</span>}
                          {isInTrash && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">🗑️</span>}
                        </div>
                        {isInTrash && (
                          <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => restoreFromTrash(email.id)} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">{t.restore}</button>
                            <button onClick={() => deleteForever(email.id)} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">{t.deleteForever}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* List resize */}
            <div onMouseDown={startListResize} className={`w-1.5 mx-1 rounded-full cursor-col-resize ${theme.divider} transition-colors flex-shrink-0 self-stretch`} />

            {/* ── RIGHT: Email Detail ── */}
            <div className={`flex-1 min-w-0 ${theme.card} rounded-2xl border ${theme.cardBorder} overflow-hidden flex flex-col`}>
              {selected ? (
                <>
                  <div className="flex-1 overflow-y-auto">
                    {/* Email Header */}
                    <div className={`p-4 border-b ${theme.cardBorder} sticky top-0 ${theme.card} z-10`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold mb-0.5 truncate">{selected.subject}</h2>
                          <p className={`text-xs ${theme.textMuted}`}>{selected.from}</p>
                          <p className={`text-xs ${theme.textDim}`}>{selected.date}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!trashedEmails.has(selected.id) && !selected.analysis && !selected.isAnalyzing && (
                            <button onClick={() => analyzeEmail(selected)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-xs font-medium text-white">
                              <Icon name="Dashboard_email_Analyze all bottom" className="w-3.5 h-3.5" style={{ filter: 'brightness(0) invert(1)' }} /> {t.analyze}
                            </button>
                          )}
                          {selected.isAnalyzing && <div className="flex items-center gap-1.5 text-[#1BA1FF] text-xs"><div className="w-3 h-3 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div> Analyzing...</div>}
                          {!trashedEmails.has(selected.id) && <button onClick={() => moveToTrash(selected.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-full hover:bg-red-400/10"><Icon name="Dashboard_trash" className="w-3 h-3" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} /></button>}
                        </div>
                      </div>

                      {/* Workflow + Assignment row */}
                      {!trashedEmails.has(selected.id) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {WORKFLOW_STATUSES.map(s => (
                            <button key={s.key} onClick={() => setWorkflowStatus(selected.id, s.key)}
                              className={`text-[10px] px-2 py-1 rounded-full border transition ${selectedWorkflow === s.key ? `${s.bg} ${s.color} border-current font-medium` : `${darkMode ? 'border-white/10 text-gray-500 hover:border-white/20' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}`}>
                              {s.label}
                            </button>
                          ))}

                          {/* Assignment button */}
                          <div className="relative ml-auto" data-assign-panel>
                            <button onClick={(e) => { e.stopPropagation(); setShowAssignPanel(!showAssignPanel); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition ${showAssignPanel ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border-[#5200FF]/40 text-white' : `${darkMode ? 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}`}>
                              👤 {selectedAssignment.owner ? selectedAssignment.owner.split('@')[0] : 'Assign'}
                              {(selectedAssignment.watchers?.length > 0 || selectedAssignment.queue) && <span className="w-1.5 h-1.5 rounded-full bg-[#9E14FB] flex-shrink-0" />}
                            </button>

                            {showAssignPanel && (
                              <div className={`absolute top-full right-0 mt-2 w-72 ${theme.card} border ${theme.cardBorder} rounded-2xl shadow-2xl z-50 p-4`}
                                onClick={e => e.stopPropagation()} data-assign-panel>
                                <p className="text-sm font-semibold mb-3 flex items-center gap-2">👥 Assignment</p>

                                {/* Role selector */}
                                <div className={`flex gap-1 p-1 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl mb-3`}>
                                  {([
                                    { key: 'owner', label: '👑 Owner', desc: 'Responsible' },
                                    { key: 'watcher', label: '👁 Watcher', desc: 'In the loop' },
                                    { key: 'queue', label: '📋 Queue', desc: 'Team queue' },
                                  ] as const).map(role => (
                                    <button key={role.key} onClick={() => setAssignRole(role.key)}
                                      className={`flex-1 py-1.5 text-[10px] rounded-lg transition ${assignRole === role.key ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
                                      {role.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Input */}
                                <div className="flex gap-2 mb-3">
                                  <input value={assignInput} onChange={e => setAssignInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && updateAssignment(selected.id, assignRole, assignInput)}
                                    placeholder={assignRole === 'queue' ? 'e.g. Rotterdam Team' : 'Email or name...'}
                                    className={`flex-1 px-3 py-2 rounded-xl border ${theme.input} text-xs focus:outline-none focus:border-[#5200FF]`} />
                                  <button onClick={() => updateAssignment(selected.id, assignRole, assignInput)} disabled={!assignInput.trim()}
                                    className="px-3 py-2 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-xl text-white text-xs disabled:opacity-40">Set</button>
                                </div>

                                {/* Summary */}
                                <div className="space-y-2">
                                  <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-2.5`}>
                                    <p className={`text-[10px] font-semibold ${theme.textDim} mb-1`}>👑 Owner</p>
                                    {selectedAssignment.owner ? (
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">{selectedAssignment.owner}</span>
                                        <button onClick={() => setAssignments(prev => ({ ...prev, [selected.id]: { ...prev[selected.id], owner: '' } }))} className={`text-xs ${theme.textDim} hover:text-red-400`}>✕</button>
                                      </div>
                                    ) : <p className={`text-xs ${theme.textDim}`}>No owner yet</p>}
                                  </div>

                                  <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-2.5`}>
                                    <p className={`text-[10px] font-semibold ${theme.textDim} mb-1`}>👁 Watchers</p>
                                    {selectedAssignment.watchers?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {selectedAssignment.watchers.map(w => (
                                          <span key={w} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                                            {w.split('@')[0]}
                                            <button onClick={() => removeWatcher(selected.id, w)} className="hover:text-red-400 text-[10px]">✕</button>
                                          </span>
                                        ))}
                                      </div>
                                    ) : <p className={`text-xs ${theme.textDim}`}>No watchers</p>}
                                  </div>

                                  <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-2.5`}>
                                    <p className={`text-[10px] font-semibold ${theme.textDim} mb-1`}>📋 Queue</p>
                                    {selectedAssignment.queue ? (
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">{selectedAssignment.queue}</span>
                                        <button onClick={() => setAssignments(prev => ({ ...prev, [selected.id]: { ...prev[selected.id], queue: '' } }))} className={`text-xs ${theme.textDim} hover:text-red-400`}>✕</button>
                                      </div>
                                    ) : <p className={`text-xs ${theme.textDim}`}>Not in any queue</p>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detail Tabs */}
                    <div className={`flex border-b ${theme.cardBorder} px-4 pt-1`}>
                      {[
                        { key: 'analysis', label: '🤖 Analysis' },
                        { key: 'timeline', label: `⏱ Timeline (${selectedTimeline.length})` },
                        { key: 'notes', label: `📝 Notes (${selectedNotes.length})` },
                        { key: 'actions', label: '⚡ Actions' },
                      ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveDetailTab(tab.key as any)}
                          className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${activeDetailTab === tab.key ? 'border-[#9E14FB] text-[#9E14FB]' : `border-transparent ${theme.textDim}`}`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* ANALYSIS TAB */}
                      {activeDetailTab === 'analysis' && (
                        <>
                          {selected.analysis && (
                            <div className={`${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 via-[#5200FF]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50'} rounded-xl p-4 border ${theme.cardBorder}`}>
                              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Icon name="Dashboard_analyrtics_AI Insights" className="w-4 h-4" style={theme.iconFilter} /> {t.aiAnalysis}</h3>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div><p className={`text-xs ${theme.textDim}`}>{t.intent}</p><span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB]">{selected.analysis.intent?.replace(/_/g, ' ')}</span></div>
                                <div><p className={`text-xs ${theme.textDim}`}>{t.priority}</p><span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(selected.analysis.priority)}`}>{selected.analysis.priority}</span></div>
                                {selected.analysis.mode && <div><p className={`text-xs ${theme.textDim}`}>{t.mode}</p><p className="text-sm">{selected.analysis.mode}</p></div>}
                                {selected.analysis.pol && <div><p className={`text-xs ${theme.textDim}`}>{t.route}</p><p className="text-sm">{selected.analysis.pol} → {selected.analysis.pod}</p></div>}
                              </div>
                              {selected.analysis.summary && <div className="mb-3"><p className={`text-xs ${theme.textDim} mb-1`}>{t.summary}</p><p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{selected.analysis.summary}</p></div>}
                              {selected.analysis.missing_info?.length > 0 && <div><p className={`text-xs ${theme.textDim} mb-1`}>{t.missingInfo}</p><div className="flex flex-wrap gap-1">{selected.analysis.missing_info.map((info: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded-full">{info}</span>)}</div></div>}
                            </div>
                          )}
                          <div className={`rounded-xl p-4 ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                            <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'} leading-relaxed`}>{selected.body || selected.snippet}</pre>
                          </div>
                        </>
                      )}

                      {/* TIMELINE TAB */}
                      {activeDetailTab === 'timeline' && (
                        <div className="space-y-1">
                          <h3 className="font-semibold text-sm mb-3">Thread Timeline</h3>
                          {selectedTimeline.length === 0 ? <p className={`text-sm ${theme.textDim}`}>Analyze the email to start tracking.</p> : (
                            <div className="relative">
                              <div className={`absolute left-4 top-0 bottom-0 w-px ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
                              {selectedTimeline.map((event, i) => (
                                <div key={i} className="flex items-start gap-3 mb-4 relative">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-sm ${darkMode ? 'bg-[#0f0f1f]' : 'bg-white'} border ${theme.cardBorder}`}>{event.icon}</div>
                                  <div className="flex-1 pt-1">
                                    <p className="text-sm font-medium">{event.label}</p>
                                    <p className={`text-xs ${theme.textDim}`}>{new Date(event.time).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* NOTES TAB */}
                      {activeDetailTab === 'notes' && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-sm">Internal Notes</h3>
                          <p className={`text-xs ${theme.textDim}`}>Only visible to your team — never sent to customers.</p>
                          <div className="flex gap-2">
                            <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                              placeholder="Add context... (e.g. 'Use carrier X for this lane')"
                              className={`flex-1 px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
                            <button onClick={addNote} disabled={!newNote.trim()} className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-xl text-white text-sm disabled:opacity-50">Add</button>
                          </div>
                          {selectedNotes.length === 0 ? <div className={`p-6 text-center ${theme.textDim} text-sm`}>No notes yet.</div> : (
                            <div className="space-y-2">
                              {selectedNotes.map(note => (
                                <div key={note.id} className={`${darkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border rounded-xl p-3 group`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'} flex-1`}>{note.text}</p>
                                    <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))} className={`opacity-0 group-hover:opacity-100 text-xs ${theme.textDim} hover:text-red-400 transition flex-shrink-0`}>✕</button>
                                  </div>
                                  <p className={`text-xs ${theme.textDim} mt-1`}>👤 {note.author} · {new Date(note.createdAt).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI ACTIONS TAB */}
                      {activeDetailTab === 'actions' && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-sm">One-click AI Actions</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {AI_ACTIONS.map(action => (
                              <button key={action.key} onClick={() => runAiAction(action)} disabled={!!aiActionLoading}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition border ${aiActionLoading === action.key ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border-[#5200FF]/40' : `${darkMode ? 'bg-white/5 hover:bg-white/10 border-white/5' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`} disabled:opacity-50`}>
                                <span className="text-xl">{action.icon}</span>
                                <span className="font-medium flex-1">{action.label}</span>
                                {aiActionLoading === action.key && <div className="w-4 h-4 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div>}
                              </button>
                            ))}
                          </div>
                          {aiActionResult && (
                            <div className={`mt-4 ${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border-[#5200FF]/30' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4`}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-[#9E14FB]">AI Result</p>
                                <div className="flex gap-2">
                                  <button onClick={() => { navigator.clipboard.writeText(aiActionResult); notify('success', 'Copied!'); }} className={`text-xs px-2 py-1 rounded-lg ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'}`}>Copy</button>
                                </div>
                              </div>
                              <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'} max-h-64 overflow-y-auto`}>{aiActionResult}</pre>
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
                      onSent={() => { notify('success', 'Reply sent!'); addTimelineEvent(selected.id, 'replied', 'Reply sent'); setWorkflowStatus(selected.id, 'quoted'); }}
                      onDraftSaved={() => notify('success', 'Draft saved!')}
                    />
                  )}
                </>
              ) : (
                <div className={`h-full flex items-center justify-center ${theme.textMuted}`}>
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20"><Icon name="Dashboard_analytics_total email" className="w-full h-full" style={theme.iconFilter} /></div>
                    <p>{t.selectEmail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}