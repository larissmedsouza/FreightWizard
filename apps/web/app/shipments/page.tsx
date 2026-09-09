'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

type Language = 'en' | 'pt' | 'nl';

type ShipmentStatus =
  | 'inquiry'
  | 'quoted'
  | 'booked'
  | 'in_transit'
  | 'at_destination'
  | 'delivered'
  | 'closed'
  | 'cancelled';

interface Shipment {
  id: string;
  status: ShipmentStatus;
  reference: string;
  customer: string;
  origin: string;
  destination: string;
  mode: 'ocean' | 'air' | 'road' | 'rail' | '';
  commodity: string;
  weight: string;
  container: string;
  incoterm: string;
  eta: string;
  etd: string;
  carrier: string;
  notes: string;
  emailId?: string;
  emailSubject?: string;
  createdAt: string;
  updatedAt: string;
  aiGenerated?: boolean;
  approved?: boolean;
  updateTarget?: { id: string; reference: string; customer: string } | null;
  containerNumber?: string;
  t49TrackingActive?: boolean;
  t49Status?: string | null;
  t49Vessel?: string | null;
  t49Voyage?: string | null;
  t49PodEta?: string | null;
  t49LastEvent?: string | null;
  t49LastEventAt?: string | null;
}

interface PendingShipment extends Shipment {
  aiGenerated: true;
  approved: false;
}

interface ShipmentEvent {
  id: string;
  event_type: string;
  description: string;
  location: string | null;
  event_at: string;
}

interface Portal {
  id: string;
  token: string;
  shipment_id: string;
  title: string;
  show_carrier: boolean;
  show_rate: boolean;
  show_documents: boolean;
  message: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  url: string;
  shipment?: { reference: string; customer: string; origin: string; destination: string } | null;
}

const STATUSES: { key: ShipmentStatus; label: string; color: string; bg: string; border: string }[] = [
  { key: 'inquiry',        label: 'Inquiry',        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { key: 'quoted',         label: 'Quoted',          color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { key: 'booked',         label: 'Booked',          color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { key: 'in_transit',     label: 'In Transit',      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30' },
  { key: 'at_destination', label: 'At Destination',  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { key: 'delivered',      label: 'Delivered',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  { key: 'closed',         label: 'Closed',          color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30' },
  { key: 'cancelled',      label: 'Cancelled',       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
];

const MODE_ICONS: Record<string, string> = {
  ocean: '🚢', air: '✈️', road: '🚛', rail: '🚂', '': '📦',
};

const NAV_ITEMS = [
  { href: '/dashboard',  label: { en: 'Inbox',      pt: 'Inbox',      nl: 'Inbox'      }, icon: 'Dashboard_inbox' },
  { href: '/shipments',  label: { en: 'Shipments',  pt: 'Embarques',  nl: 'Zendingen'  }, icon: 'Dashboard_tracking' },
  { href: '/quotes',     label: { en: 'Quotes',     pt: 'Cotações',   nl: 'Offertes'   }, icon: 'Dashboard_quotation' },
  { href: '/rates',      label: { en: 'Rates',      pt: 'Tarifas',    nl: 'Tarieven'   }, icon: 'Dashboard_quotation' },
  { href: '/analytics',  label: { en: 'Analytics',  pt: 'Analytics',  nl: 'Analytics'  }, icon: 'Dashboard_analyrtics_AI Insights' },
  { href: '/team',       label: { en: 'Team',       pt: 'Equipa',     nl: 'Team'       }, icon: 'Dashboard_email_team' },
  { href: '/documents',  label: { en: 'Documents',  pt: 'Documentos', nl: 'Documenten' }, icon: 'Dashboard_documents' },
];

// Carriers Terminal49 can resolve to a SCAC on our backend — matches CARRIER_SCAC in server.ts
const CARRIERS = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'COSCO', 'Evergreen', 'ONE', 'Yang Ming', 'HMM', 'ZIM', 'OOCL'];

const EMPTY_FORM: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'> = {
  status: 'inquiry', reference: '', customer: '', origin: '', destination: '',
  mode: '', commodity: '', weight: '', container: '', incoterm: '', eta: '', etd: '',
  carrier: '', notes: '', aiGenerated: false, approved: true,
};

function mapApiShipment(row: any): Shipment {
  return {
    id: row.id,
    status: row.status,
    reference: row.reference || '',
    customer: row.customer || '',
    origin: row.origin || '',
    destination: row.destination || '',
    mode: row.mode || '',
    commodity: row.commodity || '',
    weight: row.weight || '',
    container: row.container || '',
    incoterm: row.incoterm || '',
    eta: row.eta || '',
    etd: row.etd || '',
    carrier: row.carrier || '',
    notes: row.notes || '',
    emailId: row.email_id || undefined,
    emailSubject: row.email_subject || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    aiGenerated: !!row.ai_generated,
    approved: !!row.approved,
    updateTarget: row.updateTarget || null,
    containerNumber: row.container_number || undefined,
    t49TrackingActive: !!row.t49_tracking_active,
    t49Status: row.t49_status || null,
    t49Vessel: row.t49_vessel || null,
    t49Voyage: row.t49_voyage || null,
    t49PodEta: row.t49_pod_eta || null,
    t49LastEvent: row.t49_last_event || null,
    t49LastEventAt: row.t49_last_event_at || null,
  };
}

export default function ShipmentsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [pending, setPending] = useState<PendingShipment[]>([]);
  const [aiAutoDetect, setAiAutoDetect] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedCard, setSelectedCard] = useState<Shipment | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [dragOver, setDragOver] = useState<ShipmentStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [portals, setPortals] = useState<Portal[]>([]);
  const [shareShipment, setShareShipment] = useState<Shipment | null>(null);
  const [sharePortal, setSharePortal] = useState<Portal | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareSaving, setShareSaving] = useState(false);
  const [shareSending, setShareSending] = useState(false);
  const [billingUrgent, setBillingUrgent] = useState(false);

  const [trackShipment, setTrackShipment] = useState<Shipment | null>(null);
  const [trackContainerNumber, setTrackContainerNumber] = useState('');
  const [trackBlNumber, setTrackBlNumber] = useState('');
  const [trackCarrier, setTrackCarrier] = useState('');
  const [trackSaving, setTrackSaving] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<Record<string, ShipmentEvent[]>>({});

  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<Record<string, string | null>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Record<string, number>>({});
  const [justUpdated, setJustUpdated] = useState<Record<string, boolean>>({});
  const [refreshCooldown, setRefreshCooldown] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());

  const theme = darkMode ? {
    bg: 'bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510]',
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white',
    textMuted: 'text-gray-400', textDim: 'text-gray-500',
    hover: 'hover:bg-white/5', input: 'bg-[#0f0f1f] border-white/10 text-white placeholder-gray-600',
    iconFilter: { filter: 'brightness(0) invert(1)' },
    colBg: 'bg-[#080814]',
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50', text: 'text-slate-900',
    textMuted: 'text-slate-600', textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50', input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
    colBg: 'bg-white/40',
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load theme/lang prefs + session
  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    const savedAutoDetect = localStorage.getItem('fw_ai_autodetect');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    if (savedAutoDetect !== null) setAiAutoDetect(savedAutoDetect === 'true');

    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      setSession(sid);
      // Load user info
      fetch(`${API_URL}/api/auth/status?session=${sid}`)
        .then(r => r.json())
        .then(d => { if (d.authenticated) setUser({ email: d.email, name: d.name }); })
        .catch(() => {});
    }
  }, [searchParams]);

  const loadShipments = useCallback((sid: string) => {
    fetch(`${API_URL}/api/shipments?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.shipments) setShipments(d.shipments.map(mapApiShipment)); })
      .catch(() => {});
    fetch(`${API_URL}/api/shipments/pending?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.pending) setPending(d.pending.map(mapApiShipment) as PendingShipment[]); })
      .catch(() => {});
  }, []);

  const loadPortals = useCallback((sid: string) => {
    fetch(`${API_URL}/api/portals?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.portals) setPortals(d.portals); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (session) { loadShipments(session); loadPortals(session); } }, [session, loadShipments, loadPortals]);

  useEffect(() => { localStorage.setItem('fw_ai_autodetect', String(aiAutoDetect)); }, [aiAutoDetect]);

  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); setLangMenuOpen(false); };
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  // Create or update shipment
  const saveShipment = async () => {
    if (!form.reference.trim() || !form.customer.trim()) {
      notify('error', 'Reference and Customer are required');
      return;
    }
    try {
      if (editingId) {
        await fetch(`${API_URL}/api/shipments/${editingId}?session=${session}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        notify('success', 'Shipment updated!');
      } else {
        await fetch(`${API_URL}/api/shipments?session=${session}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        notify('success', 'Shipment created!');
      }
      if (session) loadShipments(session);
    } catch (e) { notify('error', 'Failed to save shipment'); }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (s: Shipment) => {
    setForm({ status: s.status, reference: s.reference, customer: s.customer, origin: s.origin, destination: s.destination, mode: s.mode, commodity: s.commodity, weight: s.weight, container: s.container, incoterm: s.incoterm, eta: s.eta, etd: s.etd, carrier: s.carrier, notes: s.notes, emailId: s.emailId, emailSubject: s.emailSubject, aiGenerated: s.aiGenerated || false, approved: s.approved ?? true });
    setEditingId(s.id);
    setShowForm(true);
    setSelectedCard(null);
  };

  const deleteShipment = async (id: string) => {
    setShipments(prev => prev.filter(s => s.id !== id));
    if (selectedCard?.id === id) setSelectedCard(null);
    try {
      await fetch(`${API_URL}/api/shipments/${id}?session=${session}`, { method: 'DELETE' });
      notify('success', 'Shipment deleted');
    } catch (e) { notify('error', 'Failed to delete shipment'); }
  };

  const moveStatus = async (id: string, newStatus: ShipmentStatus) => {
    setShipments(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, updatedAt: new Date().toISOString() } : s));
    try {
      await fetch(`${API_URL}/api/shipments/${id}?session=${session}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) { notify('error', 'Failed to update status'); }
  };

  // Approve pending AI shipment
  const approvePending = async (p: PendingShipment) => {
    try {
      await fetch(`${API_URL}/api/shipments/${p.id}/approve?session=${session}`, { method: 'POST' });
      setPending(prev => prev.filter(x => x.id !== p.id));
      if (session) loadShipments(session);
      notify('success', 'Shipment approved and added to tracker!');
    } catch (e) { notify('error', 'Failed to approve shipment'); }
  };

  const rejectPending = async (id: string) => {
    setPending(prev => prev.filter(x => x.id !== id));
    try {
      await fetch(`${API_URL}/api/shipments/${id}?session=${session}`, { method: 'DELETE' });
      notify('success', 'Suggestion dismissed');
    } catch (e) { notify('error', 'Failed to dismiss suggestion'); }
  };

  // Customer portal sharing
  const openShare = async (shipment: Shipment) => {
    setShareShipment(shipment);
    setSharePortal(null);
    setShareEmail('');
    try {
      const res = await fetch(`${API_URL}/api/portals?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: shipment.id }),
      });
      const data = await res.json();
      if (data.portal) {
        setSharePortal({ ...data.portal, url: data.url });
        if (session) loadPortals(session);
      } else notify('error', 'Failed to create share link');
    } catch (e) { notify('error', 'Failed to create share link'); }
  };

  const saveShareSettings = async () => {
    if (!sharePortal) return;
    setShareSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/portals/${sharePortal.id}?session=${session}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_carrier: sharePortal.show_carrier, show_rate: sharePortal.show_rate, message: sharePortal.message, expires_at: sharePortal.expires_at || null }),
      });
      const data = await res.json();
      if (data.portal) { setSharePortal(data.portal); if (session) loadPortals(session); notify('success', 'Share settings saved!'); }
    } catch (e) { notify('error', 'Failed to save settings'); }
    setShareSaving(false);
  };

  const copyPortalLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => notify('success', 'Link copied!')).catch(() => notify('error', 'Failed to copy link'));
  };

  const sendPortalByEmail = async () => {
    if (!sharePortal || !shareEmail.trim()) { notify('error', 'Customer email is required'); return; }
    setShareSending(true);
    try {
      const body = `Hi,\n\nYou can track your shipment here: ${sharePortal.url}\n${sharePortal.message ? `\n${sharePortal.message}\n` : ''}\nBest regards`;
      const res = await fetch(`${API_URL}/api/send-reply?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: shareEmail, subject: `Track your shipment${shareShipment?.reference ? ` — ${shareShipment.reference}` : ''}`, body }),
      });
      const data = await res.json();
      if (data.success) notify('success', 'Tracking link sent!'); else notify('error', 'Failed to send email');
    } catch (e) { notify('error', 'Failed to send email'); }
    setShareSending(false);
  };

  const togglePortalActive = async (p: Portal) => {
    setPortals(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    try {
      await fetch(`${API_URL}/api/portals/${p.id}?session=${session}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !p.is_active }),
      });
    } catch (e) { notify('error', 'Failed to update portal'); }
  };

  const deletePortal = async (id: string) => {
    setPortals(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`${API_URL}/api/portals/${id}?session=${session}`, { method: 'DELETE' });
      notify('success', 'Portal removed');
    } catch (e) { notify('error', 'Failed to remove portal'); }
  };

  // Container tracking (Terminal49)
  const openTrack = (shipment: Shipment) => {
    setTrackShipment(shipment);
    setTrackContainerNumber(shipment.containerNumber || '');
    setTrackBlNumber('');
    setTrackCarrier(shipment.carrier && CARRIERS.includes(shipment.carrier) ? shipment.carrier : '');
    setTrackError(null);
  };

  const startTracking = async () => {
    if (!trackShipment) return;
    setTrackSaving(true);
    setTrackError(null);
    try {
      const res = await fetch(`${API_URL}/api/shipments/${trackShipment.id}/track?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: trackContainerNumber.toUpperCase().trim(), bl_number: trackBlNumber.trim(), carrier: trackCarrier }),
      });
      const data = await res.json();
      if (!res.ok || !data.shipment) { setTrackError(data.error || 'Failed to start tracking'); setTrackSaving(false); return; }
      const updated = mapApiShipment(data.shipment);
      setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (selectedCard?.id === updated.id) setSelectedCard(updated);
      notify('success', 'Live tracking started!');
      setTrackShipment(null);
    } catch (e) { setTrackError('Failed to start tracking'); }
    setTrackSaving(false);
  };

  const stopTracking = async (shipment: Shipment) => {
    try {
      const res = await fetch(`${API_URL}/api/shipments/${shipment.id}/track?session=${session}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.shipment) {
        const updated = mapApiShipment(data.shipment);
        setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
        if (selectedCard?.id === updated.id) setSelectedCard(updated);
        notify('success', 'Tracking stopped');
      }
    } catch (e) { notify('error', 'Failed to stop tracking'); }
  };

  const loadShipmentEvents = useCallback(async (shipmentId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/shipments/${shipmentId}/events?session=${session}`);
      const data = await res.json();
      if (data.events) setShipmentEvents(prev => ({ ...prev, [shipmentId]: data.events }));
    } catch (e) {}
  }, [session]);

  // Refresh live tracking (manual button + auto-refresh on panel open).
  // Always fetches live from Terminal49 regardless of cooldown state — the
  // cooldown only disables the *button* on the frontend to prevent spamming.
  const refreshTracking = useCallback(async (shipmentId: string) => {
    setRefreshing(prev => ({ ...prev, [shipmentId]: true }));
    setRefreshError(prev => ({ ...prev, [shipmentId]: null }));
    try {
      const res = await fetch(`${API_URL}/api/shipments/${shipmentId}/refresh-tracking?session=${session}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(prev => ({ ...prev, [shipmentId]: data.error || 'Failed to refresh tracking' }));
      } else if (data.shipment) {
        const updated = mapApiShipment(data.shipment);
        setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
        setSelectedCard(prev => (prev && prev.id === updated.id ? updated : prev));
        setLastRefreshedAt(prev => ({ ...prev, [shipmentId]: Date.now() }));
        setJustUpdated(prev => ({ ...prev, [shipmentId]: true }));
        setTimeout(() => setJustUpdated(prev => ({ ...prev, [shipmentId]: false })), 5000);
        loadShipmentEvents(shipmentId);
      }
    } catch (e) {
      setRefreshError(prev => ({ ...prev, [shipmentId]: 'Failed to refresh tracking' }));
    }
    setRefreshing(prev => ({ ...prev, [shipmentId]: false }));
    setRefreshCooldown(prev => ({ ...prev, [shipmentId]: true }));
    setTimeout(() => setRefreshCooldown(prev => ({ ...prev, [shipmentId]: false })), 10000);
  }, [session, loadShipmentEvents]);

  // Auto-refresh once when a live-tracked shipment is opened — keyed only on
  // the id so it fires on selection change, not on every re-render.
  useEffect(() => {
    if (selectedCard?.t49TrackingActive) refreshTracking(selectedCard.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard?.id]);

  // Relative "Last refreshed" / "Last updated" timestamps tick every 30s.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (ts: number) => {
    const mins = Math.floor((now - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  // Drag and drop
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('shipmentId', id);
    setDraggingId(id);
  };
  const onDragOver = (e: React.DragEvent, status: ShipmentStatus) => { e.preventDefault(); setDragOver(status); };
  const onDrop = (e: React.DragEvent, status: ShipmentStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('shipmentId');
    if (id) moveStatus(id, status);
    setDragOver(null);
    setDraggingId(null);
  };

  // Filter shipments
  const filtered = shipments.filter(s => {
    const matchMode = !filterMode || s.mode === filterMode;
    const matchSearch = !searchQuery || [s.reference, s.customer, s.origin, s.destination, s.commodity].some(f => f?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchMode && matchSearch;
  });

  const byStatus = (status: ShipmentStatus) => filtered.filter(s => s.status === status);

  const totalActive = shipments.filter(s => !['delivered', 'closed', 'cancelled'].includes(s.status)).length;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white text-sm ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
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
                pathname === item.href
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
              {langLabels[language]} <span className="text-xs">▾</span>
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
            {darkMode
              ? <Icon name="Dashboard_sun_light_mode" className="w-4 h-4" style={theme.iconFilter} />
              : <Icon name="Dashboard_moon_dark_mode" className="w-4 h-4" style={theme.iconFilter} />
            }
          </button>

          {user && (
            <Link href={`/billing?session=${session}`} className={`relative text-sm ${theme.textMuted} border ${theme.cardBorder} px-3 py-1.5 rounded-full ${theme.hover} transition`}>
              Billing
              {billingUrgent && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </Link>
          )}
          {user && <span className={`text-sm ${theme.textMuted} hidden lg:block max-w-36 truncate`}>{user.email}</span>}
        </div>
      </header>

      <TrialBanner session={session} onSubscription={(sub) => setBillingUrgent(sub.plan === 'trial' && sub.trial_days_remaining < 3)} />

      <div className="p-4">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon name="Dashboard_tracking" className="w-7 h-7" style={theme.iconFilter} />
              Shipment Tracker
            </h1>
            <p className={`text-sm ${theme.textMuted} mt-0.5`}>{totalActive} active shipments</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.cardBorder} ${theme.card}`}>
              <Icon name="Dashboard_search_emails" className="w-4 h-4" style={theme.iconFilter} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search shipments..."
                className={`bg-transparent text-sm focus:outline-none ${theme.text} w-40`} />
            </div>

            {/* Mode filter */}
            <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
              className={`px-3 py-2 rounded-xl border ${theme.cardBorder} ${theme.card} ${theme.text} text-sm focus:outline-none focus:border-[#5200FF] cursor-pointer`}>
              <option value="">All modes</option>
              <option value="ocean">🚢 Ocean</option>
              <option value="air">✈️ Air</option>
              <option value="road">🚛 Road</option>
              <option value="rail">🚂 Rail</option>
            </select>

            {/* AI Auto-detect toggle */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.cardBorder} ${theme.card}`}>
              <span className={`text-xs ${theme.textMuted}`}>🤖 AI auto-detect</span>
              <button onClick={() => setAiAutoDetect(!aiAutoDetect)} type="button"
                className={`relative flex-shrink-0 w-9 h-5 rounded-full border-0 p-0 transition-colors ${aiAutoDetect ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF]' : (darkMode ? 'bg-white/20' : 'bg-slate-300')}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiAutoDetect ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* New shipment */}
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium">
              + New Shipment
            </button>
          </div>
        </div>

        {/* Pending AI suggestions */}
        {pending.length > 0 && (
          <div className={`mb-4 p-4 rounded-2xl border-2 border-[#9E14FB]/40 ${darkMode ? 'bg-[#9E14FB]/5' : 'bg-purple-50'}`}>
            <h2 className="text-sm font-semibold text-[#9E14FB] mb-3 flex items-center gap-2">
              🤖 AI Detected {pending.length} shipment{pending.length > 1 ? 's' : ''} from your emails — review before adding
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map(p => (
                <div key={p.id} className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold">{p.reference}</p>
                      <p className={`text-xs ${theme.textMuted}`}>{p.customer}</p>
                    </div>
                    <span className="text-lg">{MODE_ICONS[p.mode]}</span>
                  </div>
                  {p.updateTarget ? (
                    <p className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9E14FB]/20 text-[#9E14FB] inline-block mb-2">
                      Status update → {STATUSES.find(s => s.key === p.status)?.label || p.status}
                    </p>
                  ) : (
                    <p className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 inline-block mb-2">New shipment</p>
                  )}
                  <p className={`text-xs ${theme.textDim} mb-1`}>{p.origin} → {p.destination}</p>
                  {p.emailSubject && <p className={`text-xs ${theme.textDim} mb-3 italic truncate`}>From: "{p.emailSubject}"</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    {p.commodity && <div><span className={theme.textDim}>Cargo:</span> {p.commodity}</div>}
                    {p.container && <div><span className={theme.textDim}>Container:</span> {p.container}</div>}
                    {p.weight && <div><span className={theme.textDim}>Weight:</span> {p.weight}</div>}
                    {p.incoterm && <div><span className={theme.textDim}>Incoterm:</span> {p.incoterm}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approvePending(p)}
                      className="flex-1 py-1.5 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-lg text-white text-xs font-medium">
                      ✓ Approve
                    </button>
                    {!p.updateTarget && (
                      <button onClick={() => { /* open edit with pre-filled */ setForm({ status: p.status, reference: p.reference, customer: p.customer, origin: p.origin, destination: p.destination, mode: p.mode, commodity: p.commodity, weight: p.weight, container: p.container, incoterm: p.incoterm, eta: p.eta, etd: p.etd, carrier: p.carrier, notes: p.notes, emailId: p.emailId, emailSubject: p.emailSubject, aiGenerated: true, approved: false }); setEditingId(null); setShowForm(true); rejectPending(p.id); }}
                        className={`flex-1 py-1.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-lg text-xs`}>
                        ✏️ Edit
                      </button>
                    )}
                    <button onClick={() => rejectPending(p.id)}
                      className="py-1.5 px-2 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STATUSES.map(status => {
              const cards = byStatus(status.key);
              const isDragTarget = dragOver === status.key;
              return (
                <div key={status.key}
                  onDragOver={(e) => onDragOver(e, status.key)}
                  onDrop={(e) => onDrop(e, status.key)}
                  onDragLeave={() => setDragOver(null)}
                  className={`w-64 flex-shrink-0 rounded-2xl transition-all ${isDragTarget ? 'ring-2 ring-[#9E14FB] scale-[1.01]' : ''}`}>

                  {/* Column header */}
                  <div className={`${status.bg} border ${status.border} rounded-t-2xl px-3 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.color} border ${status.border}`}>
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className={`${theme.colBg} border-x border-b ${theme.cardBorder} rounded-b-2xl min-h-32 p-2 space-y-2`}>
                    {cards.length === 0 && (
                      <div className={`text-center py-6 text-xs ${theme.textDim} ${isDragTarget ? 'opacity-100' : 'opacity-50'}`}>
                        {isDragTarget ? '📥 Drop here' : 'No shipments'}
                      </div>
                    )}
                    {cards.map(s => (
                      <div key={s.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onClick={() => setSelectedCard(selectedCard?.id === s.id ? null : s)}
                        className={`${theme.card} border ${theme.cardBorder} rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-[#5200FF]/40 hover:shadow-lg ${draggingId === s.id ? 'opacity-50' : ''} ${selectedCard?.id === s.id ? 'border-[#9E14FB]/60 shadow-[0_0_12px_rgba(158,20,251,0.2)]' : ''}`}>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{s.reference}</p>
                            <p className={`text-xs ${theme.textMuted} truncate`}>{s.customer}</p>
                          </div>
                          <span className="text-base flex-shrink-0">{MODE_ICONS[s.mode]}</span>
                        </div>
                        <p className={`text-xs ${theme.textDim} mb-2 truncate`}>{s.origin} → {s.destination}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {s.container && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>{s.container}</span>}
                          {s.incoterm && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>{s.incoterm}</span>}
                          {s.aiGenerated && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9E14FB]/20 text-[#9E14FB]">🤖 AI</span>}
                          {s.t49TrackingActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">🟢 Live</span>}
                        </div>
                        {s.etd && <p className={`text-[10px] ${theme.textDim} mt-1.5`}>ETD: {s.etd}</p>}
                        {s.eta && <p className={`text-[10px] ${theme.textDim}`}>ETA: {s.eta}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel for selected card */}
        {selectedCard && (
          <div className={`fixed right-4 top-20 bottom-4 w-80 ${theme.card} border ${theme.cardBorder} rounded-2xl shadow-2xl z-30 overflow-y-auto flex flex-col`}>
            <div className={`p-4 border-b ${theme.cardBorder} flex items-center justify-between`}>
              <h3 className="font-bold text-sm">{selectedCard.reference}</h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selectedCard)} className={`text-xs px-2 py-1 rounded-lg ${theme.hover} ${theme.textMuted}`}>✏️ Edit</button>
                <button onClick={() => deleteShipment(selectedCard.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">🗑️</button>
                <button onClick={() => setSelectedCard(null)} className={`${theme.textDim} hover:text-white w-6 h-6 flex items-center justify-center`}>✕</button>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1">
              {/* Status change */}
              <div>
                <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-2`}>Status</p>
                <div className="grid grid-cols-2 gap-1">
                  {STATUSES.map(s => (
                    <button key={s.key} onClick={() => { moveStatus(selectedCard.id, s.key); setSelectedCard(prev => prev ? { ...prev, status: s.key } : null); }}
                      className={`text-xs px-2 py-1.5 rounded-lg border transition ${selectedCard.status === s.key ? `${s.bg} ${s.color} ${s.border} font-medium` : `${theme.cardBorder} ${theme.textDim} ${theme.hover}`}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`border-t ${theme.cardBorder} pt-3 space-y-2`}>
                {[
                  { label: 'Customer', value: selectedCard.customer },
                  { label: 'Route', value: `${selectedCard.origin} → ${selectedCard.destination}` },
                  { label: 'Mode', value: `${MODE_ICONS[selectedCard.mode]} ${selectedCard.mode || '—'}` },
                  { label: 'Commodity', value: selectedCard.commodity || '—' },
                  { label: 'Weight', value: selectedCard.weight || '—' },
                  { label: 'Container', value: selectedCard.container || '—' },
                  { label: 'Incoterm', value: selectedCard.incoterm || '—' },
                  { label: 'Carrier', value: selectedCard.carrier || '—' },
                  { label: 'ETD', value: selectedCard.etd || '—' },
                  { label: 'ETA', value: selectedCard.eta || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className={`text-xs ${theme.textDim}`}>{label}</span>
                    <span className="text-xs font-medium text-right truncate max-w-40">{value}</span>
                  </div>
                ))}
              </div>

              {selectedCard.notes && (
                <div className={`border-t ${theme.cardBorder} pt-3`}>
                  <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-1`}>Notes</p>
                  <p className={`text-xs ${theme.textMuted}`}>{selectedCard.notes}</p>
                </div>
              )}

              {selectedCard.emailSubject && (
                <div className={`border-t ${theme.cardBorder} pt-3`}>
                  <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-1`}>Source Email</p>
                  <p className={`text-xs ${theme.textMuted} italic`}>"{selectedCard.emailSubject}"</p>
                  {session && selectedCard.emailId && (
                    <Link href={`/dashboard?session=${session}`}
                      className="text-xs text-[#9E14FB] hover:underline mt-1 block">
                      → View in inbox
                    </Link>
                  )}
                </div>
              )}

              <div className={`border-t ${theme.cardBorder} pt-3`}>
                <p className={`text-xs ${theme.textDim}`}>Created {new Date(selectedCard.createdAt).toLocaleDateString()}</p>
                <p className={`text-xs ${theme.textDim}`}>Updated {new Date(selectedCard.updatedAt).toLocaleDateString()}</p>
                {selectedCard.aiGenerated && <p className="text-xs text-[#9E14FB] mt-1">🤖 Created by AI from email</p>}
              </div>

              <div className={`border-t ${theme.cardBorder} pt-3`}>
                <button onClick={() => openShare(selectedCard)}
                  className="w-full py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-lg text-white text-xs font-medium">
                  🔗 Share with Customer
                </button>

                {portals.filter(p => p.shipment_id === selectedCard.id).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider`}>Shared Links</p>
                    {portals.filter(p => p.shipment_id === selectedCard.id).map(p => (
                      <div key={p.id} className={`border ${theme.cardBorder} rounded-lg p-2 space-y-1.5`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`text-[10px] ${theme.textDim}`}>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => copyPortalLink(p.url)} className={`flex-1 py-1 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded text-[10px]`}>Copy Link</button>
                          <button onClick={() => togglePortalActive(p)} className={`flex-1 py-1 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded text-[10px]`}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={() => deletePortal(p.id)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] hover:bg-red-500/30">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Container Tracking (Terminal49) */}
              <div className={`border-t ${theme.cardBorder} pt-3`}>
                <p className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-2`}>Container Tracking</p>
                {!selectedCard.t49TrackingActive ? (
                  <div className={`rounded-lg border border-[#9E14FB]/20 p-3 opacity-80`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🛰️</span>
                      <div>
                        <p className={`text-xs font-semibold ${theme.text}`}>Live Container Tracking</p>
                        <p className="text-[10px] text-[#9E14FB] font-medium">Coming Soon</p>
                      </div>
                    </div>
                    <p className={`text-[11px] ${theme.textDim} leading-snug mb-2`}>
                      Real-time milestone updates powered by Terminal49 — vessel departures, arrivals, customs clearance and more. Available in an upcoming update.
                    </p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>Powered by Terminal49</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">● Live Tracking Active</span>
                        <button onClick={() => refreshTracking(selectedCard.id)} disabled={refreshing[selectedCard.id] || refreshCooldown[selectedCard.id]}
                          title="Refresh" className={`text-[10px] px-1.5 py-0.5 rounded-full border ${theme.cardBorder} ${theme.hover} ${theme.textMuted} disabled:opacity-40 flex items-center gap-1`}>
                          {refreshing[selectedCard.id]
                            ? <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : '🔄'} Refresh
                        </button>
                      </div>
                      <button onClick={() => stopTracking(selectedCard)} className="text-[10px] text-red-400 hover:underline">Stop Tracking</button>
                    </div>

                    {justUpdated[selectedCard.id] && <p className="text-[10px] text-green-400 transition-opacity">✓ Updated just now</p>}
                    {refreshError[selectedCard.id] && <p className="text-[10px] text-red-400">{refreshError[selectedCard.id]}</p>}
                    {lastRefreshedAt[selectedCard.id] && (
                      <p className={`text-[10px] ${theme.textDim}`}>Last refreshed: {timeAgo(lastRefreshedAt[selectedCard.id])}</p>
                    )}

                    {selectedCard.t49LastEvent && (
                      <div>
                        <p className={`text-xs ${theme.textMuted}`}>{selectedCard.t49LastEvent}</p>
                        {selectedCard.t49LastEventAt && <p className={`text-[10px] ${theme.textDim}`}>{new Date(selectedCard.t49LastEventAt).toLocaleString()}</p>}
                      </div>
                    )}
                    {selectedCard.t49PodEta && (
                      <p className="text-xs"><span className={theme.textDim}>ETA:</span> {new Date(selectedCard.t49PodEta).toLocaleDateString()} <span className="text-green-400">(live)</span></p>
                    )}
                    {selectedCard.t49Vessel && <p className="text-xs"><span className={theme.textDim}>Vessel:</span> {selectedCard.t49Vessel}</p>}

                    {/* Event timeline */}
                    {shipmentEvents[selectedCard.id]?.length > 0 ? (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                        {shipmentEvents[selectedCard.id].map(ev => (
                          <div key={ev.id} className="flex gap-2 text-xs">
                            <span className="text-[#1BA1FF] mt-0.5">●</span>
                            <div className="min-w-0">
                              <p className={theme.text}>{ev.description}</p>
                              <p className={`text-[10px] ${theme.textDim}`}>{ev.location ? `${ev.location} · ` : ''}{new Date(ev.event_at).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : lastRefreshedAt[selectedCard.id] && !refreshing[selectedCard.id] && (
                      <p className={`text-xs ${theme.textDim}`}>No tracking data available yet — Terminal49 may still be processing this container.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.cardBorder} sticky top-0 ${theme.card} z-10`}>
              <h2 className="font-bold text-lg">{editingId ? 'Edit Shipment' : 'New Shipment'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }} className={`${theme.textDim} hover:text-white text-xl`}>✕</button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              {/* Reference */}
              <div className="col-span-2 sm:col-span-1">
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Reference *</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. FW-2024-001"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Customer */}
              <div className="col-span-2 sm:col-span-1">
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Customer *</label>
                <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                  placeholder="Customer name"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Origin */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Origin (POL)</label>
                <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                  placeholder="e.g. Santos, BR"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Destination */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Destination (POD)</label>
                <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g. Rotterdam, NL"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Mode */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Mode</label>
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as any }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="">Select mode</option>
                  <option value="ocean">🚢 Ocean</option>
                  <option value="air">✈️ Air</option>
                  <option value="road">🚛 Road</option>
                  <option value="rail">🚂 Rail</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ShipmentStatus }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>

              {/* Commodity */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Commodity</label>
                <input value={form.commodity} onChange={e => setForm(f => ({ ...f, commodity: e.target.value }))}
                  placeholder="e.g. General Cargo"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Weight */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Weight</label>
                <input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="e.g. 12,500 KG"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Container */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Container</label>
                <input value={form.container} onChange={e => setForm(f => ({ ...f, container: e.target.value }))}
                  placeholder="e.g. 1x40HC"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Incoterm */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Incoterm</label>
                <select value={form.incoterm} onChange={e => setForm(f => ({ ...f, incoterm: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="">Select incoterm</option>
                  {['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Carrier */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Carrier</label>
                <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                  placeholder="e.g. Maersk"
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* ETD */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>ETD</label>
                <input type="date" value={form.etd} onChange={e => setForm(f => ({ ...f, etd: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* ETA */}
              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>ETA</label>
                <input type="date" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              {/* Notes */}
              <div className="col-span-2">
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-xl border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none`} />
              </div>
            </div>

            <div className={`flex gap-3 px-6 py-4 border-t ${theme.cardBorder}`}>
              <button onClick={saveShipment}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium">
                {editingId ? 'Save Changes' : 'Create Shipment'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
                className={`px-6 py-2.5 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Settings Modal */}
      {shareShipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-md shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.cardBorder}`}>
              <h2 className="font-bold text-lg">🔗 Share with Customer</h2>
              <button onClick={() => { setShareShipment(null); setSharePortal(null); }} className={`${theme.textDim} hover:text-white text-xl`}>✕</button>
            </div>

            <div className="p-6 space-y-4">
              {!sharePortal ? (
                <p className={`text-sm ${theme.textDim}`}>Generating share link...</p>
              ) : (
                <>
                  <div>
                    <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Tracking Link</label>
                    <div className="flex gap-2">
                      <input readOnly value={sharePortal.url} className={`flex-1 px-3 py-2 rounded-lg border ${theme.input} text-xs`} />
                      <button onClick={() => copyPortalLink(sharePortal.url)} className={`px-3 py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-lg text-xs font-medium`}>Copy Link</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show carrier name</span>
                    <button onClick={() => setSharePortal(p => p ? { ...p, show_carrier: !p.show_carrier } : p)} type="button"
                      className={`relative flex-shrink-0 w-9 h-5 rounded-full border-0 p-0 transition-colors ${sharePortal.show_carrier ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF]' : (darkMode ? 'bg-white/20' : 'bg-slate-300')}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${sharePortal.show_carrier ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show quoted rate</span>
                    <button onClick={() => setSharePortal(p => p ? { ...p, show_rate: !p.show_rate } : p)} type="button"
                      className={`relative flex-shrink-0 w-9 h-5 rounded-full border-0 p-0 transition-colors ${sharePortal.show_rate ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF]' : (darkMode ? 'bg-white/20' : 'bg-slate-300')}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${sharePortal.show_rate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div>
                    <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Personal Message (optional)</label>
                    <textarea value={sharePortal.message || ''} onChange={e => setSharePortal(p => p ? { ...p, message: e.target.value } : p)} rows={2}
                      placeholder="e.g. Thanks for your business! Track your shipment below."
                      className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF] resize-none`} />
                  </div>

                  <div>
                    <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Expiry Date (optional)</label>
                    <input type="date" value={sharePortal.expires_at ? sharePortal.expires_at.slice(0, 10) : ''} onChange={e => setSharePortal(p => p ? { ...p, expires_at: e.target.value || null } : p)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
                  </div>

                  <button onClick={saveShareSettings} disabled={shareSaving}
                    className={`w-full py-2 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-lg text-sm font-medium disabled:opacity-50`}>
                    {shareSaving ? 'Saving...' : 'Save Settings'}
                  </button>

                  <div className={`border-t ${theme.cardBorder} pt-4`}>
                    <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Send by Email</label>
                    <div className="flex gap-2">
                      <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="customer@example.com"
                        className={`flex-1 px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
                      <button onClick={sendPortalByEmail} disabled={shareSending}
                        className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-lg text-white text-sm font-medium disabled:opacity-50">
                        {shareSending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Track Container Modal */}
      {trackShipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-sm shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.cardBorder}`}>
              <h2 className="font-bold text-lg">🔍 Track Container</h2>
              <button onClick={() => setTrackShipment(null)} className={`${theme.textDim} hover:text-white text-xl`}>✕</button>
            </div>

            <div className="p-6 space-y-4">
              {trackError && <div className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs">{trackError}</div>}

              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Container Number *</label>
                <input value={trackContainerNumber} onChange={e => setTrackContainerNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. MSCU1234567"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>BL Number (optional)</label>
                <input value={trackBlNumber} onChange={e => setTrackBlNumber(e.target.value)}
                  placeholder="e.g. MAEU221876618"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`} />
              </div>

              <div>
                <label className={`text-xs font-medium ${theme.textDim} mb-1 block`}>Carrier *</label>
                <select value={trackCarrier} onChange={e => setTrackCarrier(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm focus:outline-none focus:border-[#5200FF]`}>
                  <option value="">Select carrier</option>
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <button onClick={startTracking} disabled={trackSaving || !trackContainerNumber || !trackCarrier}
                className="w-full py-2.5 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
                {trackSaving ? 'Starting...' : 'Start Tracking'}
              </button>

              <p className={`text-[10px] ${theme.textDim} text-center`}>Powered by Terminal49 — supports 33+ shipping lines</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
