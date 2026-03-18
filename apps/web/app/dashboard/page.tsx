'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
    analytics: 'Analytics', search: 'Search emails...', allMail: 'All Mail',
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
    analytics: 'Analytics', search: 'Buscar emails...', allMail: 'Todos',
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
    analytics: 'Analytics', search: 'Emails zoeken...', allMail: 'Alle mail',
  },
};

type Language = 'en' | 'pt' | 'nl';
type FolderKey = 'all' | 'urgent' | 'high' | 'medium' | 'low' | 'replied' | 'draft_saved' | 'not_replied' | 'ocean' | 'air' | 'road' | 'rail' | 'quote_request' | 'booking_confirmation' | 'tracking_inquiry' | 'documentation_request';

interface FolderDef {
  key: FolderKey;
  label: string;
  icon: string;
  group: string;
  color?: string;
}

const FOLDERS: FolderDef[] = [
  { key: 'all', label: 'All Mail', icon: '📬', group: 'main', color: '' },
  // Priority
  { key: 'urgent', label: 'Urgent', icon: '🔴', group: 'priority', color: 'text-red-400' },
  { key: 'high', label: 'High', icon: '🟠', group: 'priority', color: 'text-orange-400' },
  { key: 'medium', label: 'Medium', icon: '🟡', group: 'priority', color: 'text-yellow-400' },
  { key: 'low', label: 'Low', icon: '🟢', group: 'priority', color: 'text-green-400' },
  // Status
  { key: 'not_replied', label: 'Not Replied', icon: '📭', group: 'status', color: 'text-blue-400' },
  { key: 'replied', label: 'Replied', icon: '✅', group: 'status', color: 'text-green-400' },
  { key: 'draft_saved', label: 'Drafts', icon: '📝', group: 'status', color: 'text-gray-400' },
  // Transport
  { key: 'ocean', label: 'Ocean', icon: '🚢', group: 'transport', color: 'text-blue-400' },
  { key: 'air', label: 'Air', icon: '✈️', group: 'transport', color: 'text-sky-400' },
  { key: 'road', label: 'Road', icon: '🚛', group: 'transport', color: 'text-yellow-400' },
  { key: 'rail', label: 'Rail', icon: '🚂', group: 'transport', color: 'text-purple-400' },
  // Intent
  { key: 'quote_request', label: 'Quote Requests', icon: '💰', group: 'intent', color: 'text-yellow-400' },
  { key: 'booking_confirmation', label: 'Bookings', icon: '📋', group: 'intent', color: 'text-green-400' },
  { key: 'tracking_inquiry', label: 'Tracking', icon: '📍', group: 'intent', color: 'text-blue-400' },
  { key: 'documentation_request', label: 'Documents', icon: '📄', group: 'intent', color: 'text-purple-400' },
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      localStorage.setItem('fw_session', sid);
      setSession(sid);
      checkAuth(sid);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const checkAuth = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/status?session=${sid}`);
      const data = await res.json();
      if (data.authenticated) {
        setUser({ email: data.email, name: data.name });
        await loadEmails(sid);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadEmails = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/emails?session=${sid}`);
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails.map((e: any) => ({ ...e, analysis: e.analysis || null, isAnalyzing: false })));
      }
    } catch (e) { console.error(e); }
  };

  const analyzeEmail = async (email: Email) => {
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: true } : e));
    if (selected?.id === email.id) setSelected({ ...email, isAnalyzing: true });
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, body: email.body || email.snippet, from: email.from, emailId: email.id, sessionId: session })
      });
      const data = await res.json();
      if (data.analysis) {
        const updated = { ...email, analysis: data.analysis, isAnalyzing: false };
        setEmails(prev => prev.map(e => e.id === email.id ? updated : e));
        if (selected?.id === email.id) setSelected(updated);
        return data.analysis;
      }
    } catch (e) { console.error(e); }
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isAnalyzing: false } : e));
  };

  const analyzeAll = async () => {
    const toAnalyze = filteredEmails.filter(e => !e.analysis && !e.isAnalyzing);
    if (!toAnalyze.length) return;
    setAnalyzing(true);
    setProgress({ current: 0, total: toAnalyze.length });
    for (let i = 0; i < toAnalyze.length; i++) {
      setProgress({ current: i + 1, total: toAnalyze.length });
      await analyzeEmail(toAnalyze[i]);
      await new Promise(r => setTimeout(r, 500));
    }
    setAnalyzing(false);
    notify('success', `Analyzed ${toAnalyze.length} emails!`);
  };

  const sendReply = async () => {
    if (!selected?.analysis?.suggested_reply || !session) return;
    const replyText = isEditing ? editedReply : selected.analysis.suggested_reply;
    const to = selected.from.match(/<(.+?)>/)?.[1] || selected.from;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: selected.subject, body: replyText, threadId: selected.threadId, emailId: selected.id })
      });
      const data = await res.json();
      notify(data.success ? 'success' : 'error', data.success ? 'Draft saved!' : 'Failed to save');
      if (data.success) setIsEditing(false);
    } catch (e) { notify('error', 'Error saving'); }
    setSavingDraft(false);
  };

  // Smart filtering
  const filteredEmails = useMemo(() => {
    let result = [...emails];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.subject?.toLowerCase().includes(q) ||
        e.from?.toLowerCase().includes(q) ||
        e.snippet?.toLowerCase().includes(q) ||
        e.analysis?.summary?.toLowerCase().includes(q)
      );
    }

    // Folder filter
    if (activeFolder !== 'all') {
      result = result.filter(e => {
        const a = e.analysis;
        switch (activeFolder) {
          case 'urgent': return a?.priority?.toLowerCase() === 'urgent';
          case 'high': return a?.priority?.toLowerCase() === 'high';
          case 'medium': return a?.priority?.toLowerCase() === 'medium';
          case 'low': return a?.priority?.toLowerCase() === 'low';
          case 'replied': return a?.replied_at != null;
          case 'draft_saved': return false; // could track separately
          case 'not_replied': return a && !a.replied_at;
          case 'ocean': return a?.mode?.toLowerCase() === 'ocean';
          case 'air': return a?.mode?.toLowerCase() === 'air';
          case 'road': return a?.mode?.toLowerCase() === 'road';
          case 'rail': return a?.mode?.toLowerCase() === 'rail';
          case 'quote_request': return a?.intent === 'quote_request';
          case 'booking_confirmation': return a?.intent === 'booking_confirmation';
          case 'tracking_inquiry': return a?.intent === 'tracking_inquiry';
          case 'documentation_request': return a?.intent === 'documentation_request';
          default: return true;
        }
      });
    }

    return result;
  }, [emails, searchQuery, activeFolder]);

  // Badge counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: emails.length };
    FOLDERS.forEach(f => {
      if (f.key === 'all') return;
      counts[f.key] = emails.filter(e => {
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
    return counts;
  }, [emails]);

  const getPriorityColor = (p?: string) => {
    const colors: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' };
    return colors[p?.toLowerCase() || ''] || 'bg-gray-500';
  };

  const connect = () => window.location.href = `${API_URL}/auth/google`;
  const disconnect = () => { localStorage.removeItem('fw_session'); setSession(null); setUser(null); setEmails([]); setSelected(null); };
  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  const analyzedCount = emails.filter(e => e.analysis).length;
  const unanalyzedCount = filteredEmails.filter(e => !e.analysis && !e.isAnalyzing).length;

  const groups = [
    { label: null, folders: FOLDERS.filter(f => f.group === 'main') },
    { label: 'Priority', folders: FOLDERS.filter(f => f.group === 'priority') },
    { label: 'Status', folders: FOLDERS.filter(f => f.group === 'status') },
    { label: 'Transport', folders: FOLDERS.filter(f => f.group === 'transport') },
    { label: 'Intent', folders: FOLDERS.filter(f => f.group === 'intent') },
  ];

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

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-4 flex items-center justify-between sticky top-0 z-40`}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
          <span className="text-lg font-bold">FreightWizard</span>
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <Link href={`/analytics?session=${session}`} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border border-[#5200FF]/30 ${theme.text} hover:border-[#5200FF]/50 transition`}>
              <Icon name="Dashboard_analyrtics_AI Insights" className="w-4 h-4" style={theme.iconFilter} />
              {t.analytics}
            </Link>
          )}
          {user && (
            <Link href={`/team?session=${session}`} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border border-[#5200FF]/30 ${theme.text} hover:border-[#5200FF]/50 transition`}>
              <Icon name="Dashboard_email_team" className="w-4 h-4" style={theme.iconFilter} />
              Team
            </Link>
          )}
          {user && (
            <Link href={`/documents?session=${session}`} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border border-[#5200FF]/30 ${theme.text} hover:border-[#5200FF]/50 transition`}>
              <Icon name="Dashboard_documents" className="w-4 h-4" style={theme.iconFilter} />
              Documents
            </Link>
          )}

          <div className="relative">
            <button onClick={() => setLangMenuOpen(!langMenuOpen)} className={`px-3 py-1.5 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover}`}>
              {langLabels[language]} ▼
            </button>
            {langMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 ${theme.card} border ${theme.cardBorder} rounded-lg shadow-xl z-50`}>
                {(['en', 'pt', 'nl'] as Language[]).map(l => (
                  <button key={l} onClick={() => changeLang(l)} className={`w-full px-4 py-2 text-left text-sm ${theme.hover}`}>{langLabels[l]}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}>
            {darkMode ? <Icon name="Dashboard_sun_light_mode" className="w-5 h-5" /> : <Icon name="Dashboard_moon_dark_mode" className="w-5 h-5" />}
          </button>

          {user && (
            <>
              <span className={`text-sm ${theme.textMuted}`}>{user.email}</span>
              <button onClick={disconnect} className="text-sm text-red-400 border border-red-400/30 px-3 py-1.5 rounded-full hover:bg-red-400/10">
                {t.disconnect}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4">
        {!user ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                <Icon name="login_page_Connect your Gmail" className="w-full h-full" />
              </div>
              <h1 className="text-2xl font-bold mb-4">{t.connect}</h1>
              <p className={`${theme.textMuted} mb-8`}>{t.connectDesc}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={connect} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium text-white shadow-lg shadow-[#5200FF]/25 hover:scale-105 transition-transform">
                  <Icon name="login_page_google logo" className="w-5 h-5" />
                  {t.connectGmail}
                </button>
                <button onClick={() => window.location.href = `${API_URL}/auth/outlook`} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#0078D4] to-[#00BCF2] rounded-full font-medium text-white shadow-lg shadow-[#0078D4]/25 hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/></svg>
                  {t.connectOutlook}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 h-[calc(100vh-88px)]">

            {/* LEFT SIDEBAR */}
            <div className={`${sidebarCollapsed ? 'w-12' : 'w-52'} flex-shrink-0 transition-all duration-300`}>
              <div className={`${theme.sidebar} border ${theme.cardBorder} rounded-2xl h-full overflow-y-auto p-2`}>
                {/* Collapse toggle */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-end'} p-2 mb-2 ${theme.textDim} ${theme.hover} rounded-xl`}
                >
                  <span className="text-xs">{sidebarCollapsed ? '▶' : '◀'}</span>
                </button>

                {groups.map((group, gi) => (
                  <div key={gi} className="mb-3">
                    {group.label && !sidebarCollapsed && (
                      <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider px-2 mb-1`}>{group.label}</p>
                    )}
                    {group.folders.map(folder => {
                      const count = folderCounts[folder.key] || 0;
                      const isActive = activeFolder === folder.key;
                      return (
                        <button
                          key={folder.key}
                          onClick={() => setActiveFolder(folder.key)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm transition mb-0.5 ${
                            isActive
                              ? 'bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 border border-[#5200FF]/30'
                              : theme.hover
                          }`}
                          title={sidebarCollapsed ? folder.label : ''}
                        >
                          <span className="text-base flex-shrink-0">{folder.icon}</span>
                          {!sidebarCollapsed && (
                            <>
                              <span className={`flex-1 text-left truncate ${isActive ? 'font-medium' : theme.textMuted} ${folder.color || ''}`}>
                                {folder.label}
                              </span>
                              {count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#5200FF]/30 text-[#9E14FB]' : darkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>
                                  {count}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                    {gi < groups.length - 1 && !sidebarCollapsed && group.label && (
                      <div className={`border-b ${theme.cardBorder} my-2`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* MIDDLE: Email List */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-3">
              {/* Search bar */}
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl px-4 py-3 flex items-center gap-3`}>
                <span className={theme.textDim}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search}
                  className={`flex-1 bg-transparent text-sm focus:outline-none ${theme.text} placeholder:${theme.textDim}`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={`text-xs ${theme.textDim} hover:text-white`}>✕</button>
                )}
              </div>

              {/* Email list */}
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-hidden flex flex-col flex-1`}>
                <div className={`p-3 border-b ${theme.cardBorder}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{FOLDERS.find(f => f.key === activeFolder)?.icon} {FOLDERS.find(f => f.key === activeFolder)?.label}</p>
                      <p className={`text-xs ${theme.textDim}`}>{filteredEmails.length} emails</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => session && loadEmails(session)} className={`text-xs ${theme.textMuted} ${theme.hover} px-2 py-1 border ${theme.cardBorder} rounded-lg`}>↻</button>
                    </div>
                  </div>
                  <button
                    onClick={analyzeAll}
                    disabled={analyzing || unanalyzedCount === 0}
                    className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${unanalyzedCount === 0 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white'}`}
                  >
                    {analyzing ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {progress.current}/{progress.total}</>
                    ) : (
                      <><Icon name="Dashboard_email_Analyze all bottom" className="w-4 h-4" />{t.analyzeAll} ({unanalyzedCount})</>
                    )}
                  </button>
                </div>

                <div className="overflow-y-auto flex-1">
                  {filteredEmails.length === 0 ? (
                    <div className={`p-6 text-center ${theme.textDim} text-sm`}>
                      {searchQuery ? 'No emails match your search' : 'No emails in this folder'}
                    </div>
                  ) : (
                    filteredEmails.map(email => (
                      <div
                        key={email.id}
                        onClick={() => { setSelected(email); setIsEditing(false); }}
                        className={`p-3 border-b ${theme.cardBorder} cursor-pointer ${theme.hover} ${selected?.id === email.id ? theme.selected : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate max-w-[130px]">{email.from.split('<')[0].trim()}</span>
                          {email.isAnalyzing && <div className="w-3 h-3 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin flex-shrink-0"></div>}
                          {email.analysis && <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white flex-shrink-0 ${getPriorityColor(email.analysis.priority)}`}>{email.analysis.priority}</span>}
                        </div>
                        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-slate-700'} truncate mb-1`}>{email.subject}</p>
                        <p className={`text-xs ${theme.textDim} truncate`}>{email.snippet}</p>
                        {email.analysis && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB] mt-1 inline-block">
                            {email.analysis.intent?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Email Detail */}
            <div className={`flex-1 ${theme.card} rounded-2xl border ${theme.cardBorder} overflow-hidden flex flex-col`}>
              {selected ? (
                <>
                  <div className={`p-5 border-b ${theme.cardBorder}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold mb-1">{selected.subject}</h2>
                        <p className={`text-sm ${theme.textMuted}`}>{t.from}: {selected.from}</p>
                        <p className={`text-xs ${theme.textDim}`}>{selected.date}</p>
                      </div>
                      {!selected.analysis && !selected.isAnalyzing && (
                        <button onClick={() => analyzeEmail(selected)} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white">
                          <Icon name="Dashboard_email_Analyze all bottom" className="w-4 h-4" />
                          {t.analyze}
                        </button>
                      )}
                      {selected.isAnalyzing && (
                        <div className="flex items-center gap-2 text-[#1BA1FF] flex-shrink-0">
                          <div className="w-4 h-4 border-2 border-[#1BA1FF] border-t-transparent rounded-full animate-spin"></div>
                          {t.analyzing}...
                        </div>
                      )}
                    </div>

                    {selected.analysis && (
                      <div className={`mt-4 ${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 via-[#5200FF]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50'} rounded-xl p-4 border ${theme.cardBorder}`}>
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                          <Icon name="Dashboard_analyrtics_AI Insights" className="w-4 h-4" style={theme.iconFilter} />
                          {t.aiAnalysis}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className={`text-xs ${theme.textDim}`}>{t.intent}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20 text-[#9E14FB]">{selected.analysis.intent?.replace(/_/g, ' ')}</span>
                          </div>
                          <div>
                            <p className={`text-xs ${theme.textDim}`}>{t.priority}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(selected.analysis.priority)}`}>{selected.analysis.priority}</span>
                          </div>
                          {selected.analysis.mode && <div><p className={`text-xs ${theme.textDim}`}>{t.mode}</p><p className="text-sm">{selected.analysis.mode}</p></div>}
                          {selected.analysis.pol && <div><p className={`text-xs ${theme.textDim}`}>{t.route}</p><p className="text-sm">{selected.analysis.pol} → {selected.analysis.pod}</p></div>}
                        </div>
                        {selected.analysis.summary && (
                          <div className="mb-3">
                            <p className={`text-xs ${theme.textDim} mb-1`}>{t.summary}</p>
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{selected.analysis.summary}</p>
                          </div>
                        )}
                        {selected.analysis.missing_info?.length > 0 && (
                          <div>
                            <p className={`text-xs ${theme.textDim} mb-1`}>{t.missingInfo}</p>
                            <div className="flex flex-wrap gap-1">
                              {selected.analysis.missing_info.map((info: string, i: number) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded-full">{info}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`flex-1 p-5 overflow-y-auto max-h-[200px] ${darkMode ? 'bg-[#050510]' : 'bg-slate-50/50'}`}>
                    <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                      {selected.body || selected.snippet}
                    </pre>
                  </div>

                  {selected.analysis?.suggested_reply && (
                    <div className={`p-5 border-t ${theme.cardBorder}`}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                        <Icon name="Dashboard_email_Suggested Reply" className="w-4 h-4" style={theme.iconFilter} />
                        {t.suggestedReply}
                      </h3>
                      <div className={`${theme.card} rounded-xl p-4 border ${theme.cardBorder} mb-3`}>
                        {isEditing ? (
                          <textarea value={editedReply} onChange={(e) => setEditedReply(e.target.value)} rows={4}
                            className={`w-full bg-transparent text-sm resize-none focus:outline-none ${darkMode ? 'text-gray-300' : 'text-slate-700'}`} />
                        ) : (
                          <pre className={`whitespace-pre-wrap font-sans text-sm ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                            {selected.analysis.suggested_reply}
                          </pre>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={sendReply} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white disabled:opacity-50">
                          {sending ? t.sending : t.sendReply}
                        </button>
                        {!isEditing ? (
                          <button onClick={() => { setEditedReply(selected.analysis?.suggested_reply || ''); setIsEditing(true); }} className={`px-4 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>
                            {t.editReply}
                          </button>
                        ) : (
                          <button onClick={() => setIsEditing(false)} className={`px-4 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm`}>
                            {t.cancel}
                          </button>
                        )}
                        <button onClick={saveDraft} disabled={savingDraft} className={`px-4 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-full text-sm disabled:opacity-50`}>
                          {savingDraft ? t.saving : t.saveDraft}
                        </button>
                      </div>
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