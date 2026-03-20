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
  en: {
    inbox: 'Inbox', emails: 'emails', analyzed: 'analyzed', analyzeAll: 'Analyze All',
    analyzing: 'Analyzing', selectEmail: 'Select an email to view details',
    connect: 'Connect Your Email', connectDesc: 'Connect your Gmail or Outlook to analyze freight emails with AI',
    connectGmail: 'Connect Gmail', connectOutlook: 'Connect Outlook',
    disconnect: 'Disconnect', analyze: 'Analyze with AI', from: 'From',
    aiAnalysis: 'AI Analysis', intent: 'Intent', priority: 'Priority', mode: 'Mode',
    route: 'Route', summary: 'Summary', missingInfo: 'Missing Info',
    suggestedReply: 'Suggested Reply', sendReply: 'Send Reply', editReply: 'Edit',
    saveDraft: 'Save Draft', cancel: 'Cancel', sending: 'Sending...', saving: 'Saving...',
    analytics: 'Analytics', search: 'Search emails...', allMail: 'All Mail', compose: 'Compose',
    trash: 'Trash', labels: 'Labels', createLabel: '+ New Label', restore: 'Restore',
    deleteForever: 'Delete Forever', trashEmpty: 'Trash is empty',
  },
  pt: {
    inbox: 'Caixa de Entrada', emails: 'emails', analyzed: 'analisados', analyzeAll: 'Analisar Todos',
    analyzing: 'Analisando', selectEmail: 'Selecione um email para ver detalhes',
    connect: 'Conectar Seu Email', connectDesc: 'Conecte seu Gmail ou Outlook para analisar emails de frete com IA',
    connectGmail: 'Conectar Gmail', connectOutlook: 'Conectar Outlook',
    disconnect: 'Desconectar', analyze: 'Analisar com IA', from: 'De',
    aiAnalysis: 'Análise de IA', intent: 'Intenção', priority: 'Prioridade', mode: 'Modo',
    route: 'Rota', summary: 'Resumo', missingInfo: 'Info Faltando',
    suggestedReply: 'Resposta Sugerida', sendReply: 'Enviar', editReply: 'Editar',
    saveDraft: 'Salvar Rascunho', cancel: 'Cancelar', sending: 'Enviando...', saving: 'Salvando...',
    analytics: 'Analytics', search: 'Buscar emails...', allMail: 'Todos', compose: 'Escrever',
    trash: 'Lixeira', labels: 'Etiquetas', createLabel: '+ Nova Etiqueta', restore: 'Restaurar',
    deleteForever: 'Apagar Sempre', trashEmpty: 'Lixeira vazia',
  },
  nl: {
    inbox: 'Inbox', emails: 'emails', analyzed: 'geanalyseerd', analyzeAll: 'Analyseer Alles',
    analyzing: 'Analyseren', selectEmail: 'Selecteer een email om details te bekijken',
    connect: 'Verbind Je Email', connectDesc: 'Verbind je Gmail of Outlook om vracht-emails te analyseren met AI',
    connectGmail: 'Gmail Verbinden', connectOutlook: 'Outlook Verbinden',
    disconnect: 'Ontkoppelen', analyze: 'Analyseer met AI', from: 'Van',
    aiAnalysis: 'AI Analyse', intent: 'Intentie', priority: 'Prioriteit', mode: 'Modus',
    route: 'Route', summary: 'Samenvatting', missingInfo: 'Ontbrekende Info',
    suggestedReply: 'Voorgesteld Antwoord', sendReply: 'Verstuur', editReply: 'Bewerk',
    saveDraft: 'Concept Opslaan', cancel: 'Annuleren', sending: 'Versturen...', saving: 'Opslaan...',
    analytics: 'Analytics', search: 'Emails zoeken...', allMail: 'Alle mail', compose: 'Opstellen',
    trash: 'Prullenbak', labels: 'Labels', createLabel: '+ Nieuw Label', restore: 'Herstellen',
    deleteForever: 'Definitief Verwijderen', trashEmpty: 'Prullenbak is leeg',
  },
};

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

const NAV_ITEMS = [
  { href: '/dashboard', label: { en: 'Inbox', pt: 'Caixa de Entrada', nl: 'Inbox' }, icon: 'Dashboard_inbox' },
  { href: '/analytics', label: { en: 'Analytics', pt: 'Analytics', nl: 'Analytics' }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team', label: { en: 'Team', pt: 'Equipa', nl: 'Team' }, icon: 'Dashboard_email_team' },
  { href: '/documents', label: { en: 'Documents', pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

// Priority icon filters
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
  { key: 'not_replied', label: 'Not Replied', icon: 'Dashboad_not_replied', group: 'status', color: 'text-blue-400' },
  { key: 'replied', label: 'Replied', icon: 'Dashboard_replied', group: 'status', color: 'text-green-400' },
  { key: 'draft_saved', label: 'Drafts', icon: 'Dashboard_draft', group: 'status', color: 'text-gray-400' },
  { key: 'ocean', label: 'Ocean', icon: 'Dashboard_ocean', group: 'transport', color: 'text-blue-400' },
  { key: 'air', label: 'Air', icon: 'Dashboard_air', group: 'transport', color: 'text-sky-400' },
  { key: 'road', label: 'Road', icon: 'Dashboard_road', group: 'transport', color: 'text-yellow-400' },
  { key: 'rail', label: 'Rail', icon: 'Dashboard_rail', group: 'transport', color: 'text-purple-400' },
  { key: 'quote_request', label: 'Quote Requests', icon: 'Dashboard_quotation', group: 'intent', color: 'text-yellow-400' },
  { key: 'booking_confirmation', label: 'Bookings', icon: 'Dashboard_booking', group: 'intent', color: 'text-green-400' },
  { key: 'tracking_inquiry', label: 'Tracking', icon: 'Dashboard_tracking', group: 'intent', color: 'text-blue-400' },
  { key: 'documentation_request', label: 'Documents', icon: 'Dashboard_documents', group: 'intent', color: 'text-purple-400' },
];

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
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReply, setEditedReply] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<FolderKey>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
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
    selected: 'bg-white/10',
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
    selected: 'bg-blue-50',
    input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    sidebar: 'bg-white/60',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
    divider: 'bg-slate-300 hover:bg-[#5200FF]/50',
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    const startX = e.clientX; const startW = sidebarWidth;
    const onMove = (me: MouseEvent) => { if (!sidebarResizing.current) return; setSidebarWidth(Math.max(48, Math.min(320, startW + (me.clientX - startX)))); };
    const onUp = () => { sidebarResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const startListResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    listResizing.current = true;
    const startX = e.clientX; const startW = emailListWidth;
    const onMove = (me: MouseEvent) => { if (!listResizing.current) return; setEmailListWidth(Math.max(200, Math.min(600, startW + (me.clientX - startX)))); };
    const onUp = () => { listResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [emailListWidth]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    const savedLabels = localStorage.getItem('fw_custom_labels');
    const savedManual = localStorage.getItem('fw_manual_folders');
    const savedTrash = localStorage.getItem('fw_trash');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    if (savedLabels) setCustomLabels(JSON.parse(savedLabels));
    if (savedManual) setManualFolders(JSON.parse(savedManual));
    if (savedTrash) setTrashedEmails(new Set(JSON.parse(savedTrash)));
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) { localStorage.setItem('fw_session', sid); setSession(sid); checkAuth(sid); }
    else setLoading(false);
  }, [searchParams]);

  useEffect(() => { localStorage.setItem('fw_custom_labels', JSON.stringify(customLabels)); }, [customLabels]);
  useEffect(() => { localStorage.setItem('fw_manual_folders', JSON.stringify(manualFolders)); }, [manualFolders]);
  useEffect(() => { localStorage.setItem('fw_trash', JSON.stringify(Array.from(trashedEmails))); }, [trashedEmails]);

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
      }
    } catch (e) { console.error(e); }
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: false } : e));
  };

  const analyzeAll = async () => {
    const toAnalyze = (filteredEmails ?? []).filter(e => !e.analysis && !e.isAnalyzing);
    if (!toAnalyze.length) return;
    setAnalyzing(true); setProgress({ current: 0, total: toAnalyze.length });
    for (let i = 0; i < toAnalyze.length; i++) {
      setProgress({ current: i + 1, total: toAnalyze.length });
      await analyzeEmail(toAnalyze[i]);
      await new Promise(r => setTimeout(r, 500));
    }
    setAnalyzing(false); notify('success', `Analyzed ${toAnalyze.length} emails!`);
  };

  const sendReply = async () => {
    if (!selected?.analysis?.suggested_reply || !session) return;
    const replyText = isEditing ? editedReply : selected.analysis.suggested_reply;
    const to = selected.from.match(/<(.+?)>/)?.[1] || selected.from;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: selected.subject, body: replyText, threadId: selected.threadId, emailId: selected.id })
      });
      const data = await res.json();
      notify(data.success ? 'success' : 'error', data.success ? 'Reply sent!' : 'Failed to send');
      if (data.success) setIsEditing(false);
    } catch (e) { notify('error', 'Error sending'); }
    setSending(false);
  };

  const saveDraft = async () => {
    if (!selected?.analysis?.suggested_reply || !session) return;
    const replyText = isEditing ? editedReply : selected.analysis.suggested_reply;
    const to = selected.from.match(/<(.+?)>/)?.[1] || selected.from;
    setSavingDraft(true);
    try {
      const res = await fetch(`${API_URL}/api/save-draft?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: selected.subject, body: replyText, threadId: selected.threadId, emailId: selected.id })
      });
      const data = await res.json();
      notify(data.success ? 'success' : 'error', data.success ? 'Draft saved!' : 'Failed to save');
      if (data.success) setIsEditing(false);
    } catch (e) { notify('error', 'Error saving'); }
    setSavingDraft(false);
  };

  const sendCompose = async () => {
    if (!composeTo || !composeSubject || !composeBody || !session) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody })
      });
      const data = await res.json();
      if (data.success) { notify('success', 'Email sent!'); setShowCompose(false); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }
      else notify('error', 'Failed to send');
    } catch (e) { notify('error', 'Error sending'); }
    setSending(false);
  };

  const moveToTrash = (emailId: string) => {
    setTrashedEmails(prev => new Set([...Array.from(prev), emailId]));
    if (selected?.id === emailId) setSelected(null);
    notify('success', 'Email moved to Trash');
    setContextMenu(null);
  };

  const restoreFromTrash = (emailId: string) => {
    setTrashedEmails(prev => { const n = new Set(Array.from(prev)); n.delete(emailId); return n; });
    notify('success', 'Email restored');
  };

  const deleteForever = (emailId: string) => {
    setTrashedEmails(prev => { const n = new Set(Array.from(prev)); n.delete(emailId); return n; });
    setEmails(prev => prev.filter(e => e.id !== emailId));
    if (selected?.id === emailId) setSelected(null);
    notify('success', 'Email permanently deleted');
  };

  const emptyTrash = () => {
    const trashIds = Array.from(trashedEmails);
    setEmails(prev => prev.filter(e => !trashIds.includes(e.id)));
    setTrashedEmails(new Set());
    if (selected && trashIds.includes(selected.id)) setSelected(null);
    notify('success', 'Trash emptied');
  };

  const createLabel = () => {
    if (!newLabelName.trim()) return;
    const key = `label_${Date.now()}`;
    const newLabel: CustomLabel = { key, label: newLabelName.trim(), color: newLabelColor.value, icon: newLabelIcon, isFolder: createMode === 'folder' };
    setCustomLabels(prev => [...prev, newLabel]);
    setNewLabelName(''); setNewLabelIcon(LABEL_ICONS[0]); setNewLabelColor(LABEL_COLORS[0]);
    setShowCreateLabel(false);
    notify('success', `Label "${newLabel.label}" created!`);
  };

  const deleteLabel = (key: string) => {
    setCustomLabels(prev => prev.filter(l => l.key !== key));
    setManualFolders(prev => { const next = { ...prev }; Object.keys(next).forEach(id => { if (next[id] === key) delete next[id]; }); return next; });
    if (activeFolder === key) setActiveFolder('all');
  };

  const applyLabel = (emailId: string, labelKey: FolderKey) => {
    setManualFolders(prev => ({ ...prev, [emailId]: labelKey }));
    setContextMenu(null);
    notify('success', 'Label applied!');
  };

  const onDragStart = (e: React.DragEvent, emailId: string) => {
    e.dataTransfer.setData('emailId', emailId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, folderKey: FolderKey) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolder(folderKey);
  };

  const onDrop = (e: React.DragEvent, folderKey: FolderKey) => {
    e.preventDefault();
    const emailId = e.dataTransfer.getData('emailId');
    if (emailId) {
      if (folderKey === 'trash') { moveToTrash(emailId); }
      else {
        setManualFolders(prev => ({ ...prev, [emailId]: folderKey }));
        const allFolders = [...SYSTEM_FOLDERS, ...customLabels.map(l => ({ key: l.key, label: l.label }))];
        notify('success', `Email moved to ${allFolders.find(f => f.key === folderKey)?.label}`);
      }
    }
    setDragOverFolder(null);
  };

  const handleContextMenu = (e: React.MouseEvent, emailId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  };

  const filteredEmails = useMemo(() => {
    let result = [...emails];
    if (activeFolder === 'trash') return result.filter(e => trashedEmails.has(e.id));
    result = result.filter(e => !trashedEmails.has(e.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.subject?.toLowerCase().includes(q) || e.from?.toLowerCase().includes(q) || e.snippet?.toLowerCase().includes(q) || e.analysis?.summary?.toLowerCase().includes(q));
    }
    if (activeFolder === 'all') {
  result = result.filter(e => {
    const assignedKey = manualFolders[e.id];
    if (!assignedKey) return true;
    const assigned = customLabels.find(l => l.key === assignedKey);
    if (!assigned) return true;
    return assigned.isFolder !== true;
  });
}

if (activeFolder === 'all') {
  result = result.filter(e => {
    const assignedKey = manualFolders[e.id];
    if (!assignedKey) return true;
    const assigned = customLabels.find(l => l.key === assignedKey);
    return !assigned?.isFolder;
  });
}

}, [emails, searchQuery, activeFolder, manualFolders, trashedEmails, customLabels]);


  const folderCounts = useMemo(() => {
    const nonTrashed = emails.filter(e => !trashedEmails.has(e.id));
    const counts: Record<string, number> = { all: nonTrashed.length, trash: trashedEmails.size };
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

  const getPriorityColor = (p?: string) => {
    const colors: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' };
    return colors[p?.toLowerCase() || ''] || 'bg-gray-500';
  };

  const connect = () => window.location.href = `${API_URL}/auth/google`;
  const disconnect = () => { localStorage.removeItem('fw_session'); setSession(null); setUser(null); setEmails([]); setSelected(null); };
  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };
  const unanalyzedCount = (filteredEmails ?? []).filter(e => !e.analysis && !e.isAnalyzing).length;
  const isNarrow = sidebarWidth < 100;

  const groups = [
    { label: null, folders: SYSTEM_FOLDERS.filter(f => f.group === 'main') },
    { label: 'Priority', folders: SYSTEM_FOLDERS.filter(f => f.group === 'priority') },
    { label: 'Status', folders: SYSTEM_FOLDERS.filter(f => f.group === 'status') },
    { label: 'Transport', folders: SYSTEM_FOLDERS.filter(f => f.group === 'transport') },
    { label: 'Intent', folders: SYSTEM_FOLDERS.filter(f => f.group === 'intent') },
  ];

  const currentFolder = [...SYSTEM_FOLDERS, ...customLabels.map(l => ({ key: l.key, label: l.label, icon: l.icon }))].find(f => f.key === activeFolder);

  // Determine icon filter for sidebar folders in light mode
  const getFolderIconStyle = (folder: FolderDef, isActive: boolean): React.CSSProperties => {
    if (folder.iconStyle) return folder.iconStyle; // priority icons keep their color
    if (isActive) return darkMode ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter;
    return theme.iconFilter;
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgGradient} ${theme.text} flex items-center justify-center`}>
        <div className="w-10 h-10 border-4 border-[#5200FF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bgGradient} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className={`fixed z-50 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-2xl py-1 min-w-48`}
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <p className={`px-4 py-2 text-xs font-semibold ${theme.textDim} uppercase tracking-wider border-b ${theme.cardBorder}`}>Apply Label</p>
          {customLabels.map(label => (
            <button key={label.key} onClick={() => applyLabel(contextMenu.emailId, label.key)}
              className={`w-full px-4 py-2 text-sm text-left ${theme.hover} flex items-center gap-2 ${label.color}`}>
              {label.icon} {label.label}
            </button>
          ))}
          {customLabels.length === 0 && <p className={`px-4 py-2 text-xs ${theme.textDim}`}>No labels yet</p>}
          <div className={`border-t ${theme.cardBorder} mt-1`} />
          <button onClick={() => moveToTrash(contextMenu.emailId)}
            className={`w-full px-4 py-2 text-sm text-left ${theme.hover} flex items-center gap-2 text-red-400`}>
            <Icon name="Dashboard_trash" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
            Move to Trash
          </button>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-end p-6">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-lg shadow-2xl`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.cardBorder}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name="Dashboard_compose" className="w-5 h-5" style={theme.iconFilter} />
                New Message
              </h3>
              <button onClick={() => setShowCompose(false)} className={`${theme.textDim} hover:text-white text-lg`}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="To"
                className={`w-full px-4 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject"
                className={`w-full px-4 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your message..." rows={8}
                className={`w-full px-4 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none`} />
              <div className="flex gap-3">
                <button onClick={sendCompose} disabled={sending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
                  {sending ? 'Sending...' : 'Send'}
                </button>
                <button onClick={() => setShowCompose(false)}
                  className={`px-4 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm`}>Discard</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Label Modal */}
      {showCreateLabel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-sm shadow-2xl`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.cardBorder}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name="Dashboard_new_label" className="w-5 h-5" style={theme.iconFilter} />
                {createMode === 'folder' ? 'Create New Folder' : 'Create New Label'}
              </h3>
              <button onClick={() => setShowCreateLabel(false)} className={`${theme.textDim} hover:text-white text-lg`}>✕</button>
            </div>
            </div>

<div className={`flex gap-1 p-1 mx-5 mt-3 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl`}>
  <button onClick={() => setCreateMode('folder')}
    className={`flex-1 py-2 text-sm rounded-lg transition flex items-center justify-center gap-2 ${createMode === 'folder' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
    <Icon name="Dashboard_new_folder" className="w-4 h-4" style={createMode === 'folder' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter} />
    Folder
  </button>
  <button onClick={() => setCreateMode('label')}
    className={`flex-1 py-2 text-sm rounded-lg transition flex items-center justify-center gap-2 ${createMode === 'label' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}>
    <Icon name="Dashboard_new_label" className="w-4 h-4" style={createMode === 'label' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter} />
    Label
  </button>
</div>

<div className="p-4 space-y-4">
            <div className="p-4 space-y-4">
              <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                placeholder="Folder name (e.g. Others, Done, Follow up)"
                className={`w-full px-4 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}
                onKeyDown={e => e.key === 'Enter' && createLabel()} autoFocus />
              <div>
                <p className={`text-xs ${theme.textDim} mb-2`}>Icon</p>
                <div className="flex flex-wrap gap-2">
                  {LABEL_ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewLabelIcon(icon)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${newLabelIcon === icon ? 'bg-[#5200FF]/30 border border-[#5200FF]' : theme.hover}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`text-xs ${theme.textDim} mb-2`}>Color</p>
                <div className="flex flex-wrap gap-2">
                  {LABEL_COLORS.map(color => (
                    <button key={color.name} onClick={() => setNewLabelColor(color)}
                      className={`px-3 py-1 rounded-full text-xs border transition ${color.value} ${newLabelColor.name === color.name ? 'border-[#5200FF] bg-[#5200FF]/20' : `${theme.cardBorder} ${color.bg}`}`}>
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>
              {newLabelName && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${newLabelColor.bg} border ${theme.cardBorder}`}>
                  <span>{newLabelIcon}</span>
                  <span className={`text-sm font-medium ${newLabelColor.value}`}>{newLabelName}</span>
                </div>
              )}
              <button onClick={createLabel} disabled={!newLabelName.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
                {createMode === 'folder' ? 'Create Folder' : 'Create Label'}
              </button>
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                pathname?.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
                  ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/40'
                  : `border border-transparent ${darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`
              }`}>
              <Icon name={item.icon} className="w-3.5 h-3.5" style={theme.iconFilter} />
              {item.label[language]}
            </Link>
          ))}

          <div className={`w-px h-5 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} mx-1`} />

          <div className="relative">
            <button onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover} flex items-center gap-1`}>
              {langLabels[language]} <span className="text-xs">▼</span>
            </button>
            {langMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>
                {(['en', 'pt', 'nl'] as Language[]).map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    className={`w-full px-4 py-2 text-left text-sm ${theme.hover} ${language === l ? 'text-[#9E14FB] font-medium' : theme.textMuted}`}>
                    {langLabels[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
            {darkMode ? <Icon name="Dashboard_sun_light_mode" className="w-4 h-4" style={theme.iconFilter} /> : <Icon name="Dashboard_moon_dark_mode" className="w-4 h-4" style={theme.iconFilter} />}
          </button>

          {user && (
            <>
              <span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span>
              <button onClick={disconnect} className="text-sm text-red-400 border border-red-400/30 px-3 py-1.5 rounded-full hover:bg-red-400/10 transition">
                {language === 'pt' ? 'Desconectar' : language === 'nl' ? 'Ontkoppelen' : 'Disconnect'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="p-4">
        {!user ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                <Icon name="login_page_Connect your Gmail" className="w-full h-full" />
              </div>
              <h1 className="text-2xl font-bold mb-4">{t.connect}</h1>
              <p className={`${theme.textMuted} mb-8`}>{t.connectDesc}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={connect} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium text-white shadow-lg hover:scale-105 transition-transform">
                  <Icon name="login_page_google logo" className="w-5 h-5" />
                  {t.connectGmail}
                </button>
                <button onClick={() => window.location.href = `${API_URL}/auth/outlook`} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#0078D4] to-[#00BCF2] rounded-full font-medium text-white shadow-lg hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/></svg>
                  {t.connectOutlook}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-0" style={{ height: 'calc(100vh - 88px)' }}>

            {/* LEFT SIDEBAR */}
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col transition-none">
              <div className={`${theme.sidebar} border ${theme.cardBorder} rounded-2xl h-full overflow-y-auto flex flex-col`}>
                {/* Compose */}
                <div className="p-2 pt-3 flex-shrink-0">
                  <button onClick={() => setShowCompose(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                    <Icon name="Dashboard_compose" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                    {!isNarrow && t.compose}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {groups.map((group, gi) => (
                    <div key={gi} className="mb-2">
                      {group.label && !isNarrow && (
                        <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider px-2 mb-1 mt-2`}>{group.label}</p>
                      )}
                      {group.folders.map(folder => {
                        const count = folderCounts[folder.key] || 0;
                        const isActive = activeFolder === folder.key;
                        const isDragTarget = dragOverFolder === folder.key;
                        return (
                          <button key={folder.key} onClick={() => setActiveFolder(folder.key)}
                            onDragOver={(e) => onDragOver(e, folder.key)}
                            onDrop={(e) => onDrop(e, folder.key)}
                            onDragLeave={() => setDragOverFolder(null)}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm transition mb-0.5 ${
                              isDragTarget ? 'border-2 border-[#5200FF] bg-[#5200FF]/20 scale-105' :
                              isActive ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/30' :
                              theme.hover}`}
                            title={isNarrow ? folder.label : ''}>
                            <Icon name={folder.icon} className="w-4 h-4 flex-shrink-0"
                              style={getFolderIconStyle(folder, isActive)} />
                            {!isNarrow && (
                              <>
                                <span className={`flex-1 text-left truncate ${isActive ? 'font-medium' : ''} ${folder.group === 'priority' ? folder.color : (darkMode ? '!text-white' : '!text-[#7C0BFD]')}`}>
                                  {folder.label}
                                </span>
                                {count > 0 && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#5200FF]/30 text-[#9E14FB]' : darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>
                                    {count}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        );
                      })}
                      {gi < groups.length - 1 && group.label && !isNarrow && <div className={`border-b ${theme.cardBorder} my-2`} />}
                    </div>
                  ))}

                  {/* Custom Labels */}
                  {!isNarrow && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between px-2 mb-1">
                        <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider`}>{t.labels}</p>
                        <button onClick={() => setShowCreateLabel(true)} className={`text-xs ${theme.textDim} hover:text-[#9E14FB] transition`} title="Create label">
                          <Icon name="Dashboard_new_label" className="w-4 h-4" style={theme.iconFilter} />
                        </button>
                      </div>
                      {customLabels.map(label => {
                        const count = folderCounts[label.key] || 0;
                        const isActive = activeFolder === label.key;
                        const isDragTarget = dragOverFolder === label.key;
                        return (
                          <div key={label.key} className="group relative">
                            <button onClick={() => setActiveFolder(label.key)}
                              onDragOver={(e) => onDragOver(e, label.key)}
                              onDrop={(e) => onDrop(e, label.key)}
                              onDragLeave={() => setDragOverFolder(null)}
                              className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm transition mb-0.5 ${
                                isDragTarget ? 'border-2 border-[#5200FF] bg-[#5200FF]/20 scale-105' :
                                isActive ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/30' :
                                theme.hover}`}>
                              <span className="text-base flex-shrink-0">{label.icon}</span>
                              <span className={`flex-1 text-left truncate ${isActive ? 'font-medium' : ''} ${label.color}`}>{label.label}</span>
                              {count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#5200FF]/30 text-[#9E14FB]' : darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                              )}
                            </button>
                            <button onClick={() => deleteLabel(label.key)}
                              className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition ${darkMode ? 'bg-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'bg-slate-200 hover:bg-red-100 text-slate-400 hover:text-red-500'}`}>
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      <button onClick={() => setShowCreateLabel(true)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm ${theme.textDim} ${theme.hover} transition mt-1 border border-dashed ${theme.cardBorder}`}>
                        <Icon name="Dashboard_new_label" className="w-4 h-4" style={theme.iconFilter} />
                        <span className="text-xs">{t.createLabel}</span>
                        </button>
                        <button onClick={() => setShowCreateLabel(true)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm ${theme.textDim} ${theme.hover} transition mt-1 border border-dashed ${theme.cardBorder}`}>
                          <Icon name="Dashboard_new_folder" className="w-4 h-4" style={theme.iconFilter} />
                          <span className="text-xs">+ New Folder</span>
                      </button>
                    </div>
                  )}

                  {/* Trash */}
                  <div className={`border-t ${theme.cardBorder} mt-3 pt-2`}>
                    <button onClick={() => setActiveFolder('trash')}
                      onDragOver={(e) => onDragOver(e, 'trash')}
                      onDrop={(e) => onDrop(e, 'trash')}
                      onDragLeave={() => setDragOverFolder(null)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm transition ${
                        dragOverFolder === 'trash' ? 'border-2 border-red-500 bg-red-500/20 scale-105' :
                        activeFolder === 'trash' ? 'bg-red-500/10 border border-red-500/30' :
                        theme.hover}`}>
                      <Icon name="Dashboard_trash" className="w-4 h-4 flex-shrink-0"
                        style={{ filter: activeFolder === 'trash' ? 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' : theme.iconFilter.filter }} />
                      {!isNarrow && (
                        <>
                          <span className={`flex-1 text-left ${activeFolder === 'trash' ? 'font-medium text-red-400' : theme.textMuted}`}>{t.trash}</span>
                          {trashedEmails.size > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{trashedEmails.size}</span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar resize handle */}
            <div onMouseDown={startSidebarResize}
              className={`w-1.5 mx-1 rounded-full cursor-col-resize ${theme.divider} transition-colors flex-shrink-0 self-stretch`} />

            {/* MIDDLE: Email List */}
            <div style={{ width: emailListWidth, flexShrink: 0 }} className="flex flex-col gap-2 transition-none">
              {/* Search */}
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl px-4 py-3 flex items-center gap-3 flex-shrink-0`}>
                <Icon name="Dashboard_search_emails" className="w-4 h-4 flex-shrink-0" style={theme.iconFilter} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search} className={`flex-1 bg-transparent text-sm focus:outline-none ${theme.text}`} />
                {searchQuery && <button onClick={() => setSearchQuery('')} className={`text-xs ${theme.textDim}`}>✕</button>}
              </div>

              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-hidden flex flex-col flex-1`}>
                <div className={`p-3 border-b ${theme.cardBorder} flex-shrink-0`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {currentFolder && 'icon' in currentFolder && (
                          <Icon name={(currentFolder as FolderDef).icon} className="w-4 h-4"
                            style={getFolderIconStyle(currentFolder as FolderDef, true)} />
                        )}
                        {currentFolder?.label}
                      </p>
                      <p className={`text-xs ${theme.textDim}`}>{(filteredEmails ?? []).length} emails</p>
                    </div>
                    <div className="flex gap-1">
                      {activeFolder === 'trash' && trashedEmails.size > 0 && (
                        <button onClick={emptyTrash} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-400/10">Empty</button>
                      )}
                      <button onClick={() => session && loadEmails(session)}
                        className={`text-xs ${theme.textMuted} ${theme.hover} px-2 py-1 border ${theme.cardBorder} rounded-lg`}>↻</button>
                    </div>
                  </div>
                  {activeFolder !== 'trash' && (
                    <button onClick={analyzeAll} disabled={analyzing || unanalyzedCount === 0}
                      className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${unanalyzedCount === 0 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white'}`}>
                      {analyzing ? (
                        <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {progress.current}/{progress.total}</>
                      ) : (
                        <><Icon name="Dashboard_email_Analyze all bottom" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />{t.analyzeAll} ({unanalyzedCount})</>
                      )}
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {(filteredEmails ?? []).length === 0 ? (
                    <div className={`p-8 text-center ${theme.textDim}`}>
                      {activeFolder === 'trash' ? (
  <p className="text-3xl mb-2">🗑️</p>
) : (
  <div className="w-16 h-16 mx-auto mb-3">
    <Icon name="Dashboard_no_emails_here" className="w-full h-full" style={theme.iconFilter} />
  </div>
)}
<p className="text-sm">{activeFolder === 'trash' ? t.trashEmpty : 'No emails here'}</p>
                    </div>
                  ) : (filteredEmails ?? []).map(email => {
                    const isInTrash = trashedEmails.has(email.id);
                    const emailLabel = manualFolders[email.id] ? customLabels.find(l => l.key === manualFolders[email.id]) : null;
                    return (
                      <div key={email.id} draggable={!isInTrash} onDragStart={(e) => onDragStart(e, email.id)}
                        onClick={() => { setSelected(email); setIsEditing(false); }}
                        onContextMenu={(e) => !isInTrash && handleContextMenu(e, email.id)}
                        className={`p-3 border-b ${theme.cardBorder} ${!isInTrash ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${theme.hover} ${selected?.id === email.id ? theme.selected : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate max-w-[110px]">{email.from.split('<')[0].trim()}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {email.isAnalyzing && <div className="w-3 h-3 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div>}
                            {email.analysis && <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white ${getPriorityColor(email.analysis.priority)}`}>{email.analysis.priority}</span>}
                            {!isInTrash && (
                              <button onClick={(e) => { e.stopPropagation(); moveToTrash(email.id); }}
                                className={`w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition`}
                                title="Move to trash">
                                <Icon name="Dashboard_trash" className="w-3 h-3" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-slate-700'} truncate mb-1`}>{email.subject}</p>
                        <p className={`text-xs ${theme.textDim} truncate`}>{email.snippet}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {email.analysis && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB]">
                              {email.analysis.intent?.replace(/_/g, ' ')}
                            </span>
                          )}
                          {emailLabel && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${emailLabel.color} bg-white/5`}>
                              {emailLabel.icon} {emailLabel.label}
                            </span>
                          )}
                          {isInTrash && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">🗑️ Trash</span>}
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

            {/* List resize handle */}
            <div onMouseDown={startListResize}
              className={`w-1.5 mx-1 rounded-full cursor-col-resize ${theme.divider} transition-colors flex-shrink-0 self-stretch`} />

            {/* RIGHT: Email Detail */}
            <div className={`flex-1 min-w-0 ${theme.card} rounded-2xl border ${theme.cardBorder} overflow-hidden flex flex-col`}>
              {selected ? (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <div className={`p-5 border-b ${theme.cardBorder} sticky top-0 ${theme.card} z-10`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-semibold mb-1">{selected.subject}</h2>
                          <p className={`text-sm ${theme.textMuted}`}>{t.from}: {selected.from}</p>
                          <p className={`text-xs ${theme.textDim}`}>{selected.date}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!trashedEmails.has(selected.id) && (
                            <button onClick={() => moveToTrash(selected.id)}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-400/30 rounded-full hover:bg-red-400/10 transition">
                              <Icon name="Dashboard_trash" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
                              Delete
                            </button>
                          )}
                          {!selected.analysis && !selected.isAnalyzing && !trashedEmails.has(selected.id) && (
                            <button onClick={() => analyzeEmail(selected)}
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white">
                              <Icon name="Dashboard_email_Analyze all bottom" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                              {t.analyze}
                            </button>
                          )}
                          {selected.isAnalyzing && (
                            <div className="flex items-center gap-2 text-[#1BA1FF]">
                              <div className="w-4 h-4 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div>
                              {t.analyzing}...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {selected.analysis && (
                        <div className={`${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 via-[#5200FF]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50'} rounded-xl p-4 border ${theme.cardBorder}`}>
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <Icon name="Dashboard_analyrtics_AI Insights" className="w-4 h-4" style={theme.iconFilter} />
                            {t.aiAnalysis}
                          </h3>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div><p className={`text-xs ${theme.textDim}`}>{t.intent}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB]">{selected.analysis.intent?.replace(/_/g, ' ')}</span></div>
                            <div><p className={`text-xs ${theme.textDim}`}>{t.priority}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(selected.analysis.priority)}`}>{selected.analysis.priority}</span></div>
                            {selected.analysis.mode && <div><p className={`text-xs ${theme.textDim}`}>{t.mode}</p><p className="text-sm">{selected.analysis.mode}</p></div>}
                            {selected.analysis.pol && <div><p className={`text-xs ${theme.textDim}`}>{t.route}</p><p className="text-sm">{selected.analysis.pol} → {selected.analysis.pod}</p></div>}
                          </div>
                          {selected.analysis.summary && (
                            <div className="mb-3"><p className={`text-xs ${theme.textDim} mb-1`}>{t.summary}</p>
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{selected.analysis.summary}</p></div>
                          )}
                          {selected.analysis.missing_info?.length > 0 && (
                            <div><p className={`text-xs ${theme.textDim} mb-1`}>{t.missingInfo}</p>
                              <div className="flex flex-wrap gap-1">
                                {selected.analysis.missing_info.map((info: string, i: number) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded-full">{info}</span>
                                ))}
                              </div></div>
                          )}
                        </div>
                      )}

                      <div className={`rounded-xl p-4 ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                        <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'} leading-relaxed`}>
                          {selected.body || selected.snippet}
                        </pre>
                      </div>

                      {selected.analysis?.suggested_reply && !trashedEmails.has(selected.id) && (
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <Icon name="Dashboard_email_Suggested Reply" className="w-4 h-4" style={theme.iconFilter} />
                            {t.suggestedReply}
                          </h3>
                          <div className={`${theme.card} rounded-xl p-4 border ${theme.cardBorder}`}>
                            {isEditing ? (
                              <textarea value={editedReply} onChange={(e) => setEditedReply(e.target.value)} rows={8}
                                className={`w-full bg-transparent text-sm resize-none focus:outline-none ${darkMode ? 'text-gray-300' : 'text-slate-700'}`} />
                            ) : (
                              <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{selected.analysis.suggested_reply}</pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sticky Reply Bar */}
                  {selected.analysis?.suggested_reply && !trashedEmails.has(selected.id) && (
                    <div className={`flex-shrink-0 px-5 py-4 border-t ${theme.cardBorder} ${theme.card} flex gap-2 flex-wrap items-center`}>
                      <button onClick={sendReply} disabled={sending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white disabled:opacity-50">
                        {sending ? t.sending : t.sendReply}
                      </button>
                      {!isEditing ? (
                        <button onClick={() => { setEditedReply(selected.analysis?.suggested_reply || ''); setIsEditing(true); }}
                          className={`px-5 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>{t.editReply}</button>
                      ) : (
                        <button onClick={() => setIsEditing(false)}
                          className={`px-5 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>{t.cancel}</button>
                      )}
                      <button onClick={saveDraft} disabled={savingDraft}
                        className={`px-5 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm disabled:opacity-50`}>
                        {savingDraft ? t.saving : t.saveDraft}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={`h-full flex items-center justify-center ${theme.textMuted}`}>
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                      <Icon name="Dashboard_analytics_total email" className="w-full h-full" style={theme.iconFilter} />
                    </div>
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