'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';
import Icon from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import { appRootClass, PageHeader, EmptyState, Notice, ColumnHeader } from '../components/ui/Panel';
import { Button, Spinner } from '../components/ui/Button';
import { inputClass, selectClass, selectInlineClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, Chip } from '../components/ui/Tag';
import { Toast, Stat, Segmented, DataTable, SearchField, Route, th, td, tdMono, tr } from '../components/ui/Data';
import { toneClass, shipmentTone, quoteTone, MODE_ICON, type Tone } from '../components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

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

// Tag/dot colours come from shipmentTone() (components/ui/tones.ts).
const STATUSES: { key: ShipmentStatus; label: string }[] = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'at_destination', label: 'At Destination' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
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

  const [trackShipment, setTrackShipment] = useState<Shipment | null>(null);
  const [trackContainerNumber, setTrackContainerNumber] = useState('');
  const [trackBlNumber, setTrackBlNumber] = useState('');
  const [trackCarrier, setTrackCarrier] = useState('');
  const [trackSaving, setTrackSaving] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<Record<string, ShipmentEvent[]>>({});
  const [portbaseConfigured, setPortbaseConfigured] = useState(false);
  const [portbaseStatus, setPortbaseStatus] = useState<Record<string, any>>({});
  const [portbaseLoading, setPortbaseLoading] = useState<Record<string, boolean>>({});

  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<Record<string, string | null>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Record<string, number>>({});
  const [justUpdated, setJustUpdated] = useState<Record<string, boolean>>({});
  const [refreshCooldown, setRefreshCooldown] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());


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

  // Check once whether Portbase (Netherlands) is configured, to decide
  // whether to show the "Check Portbase Status" button at all.
  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/integrations?session=${session}`)
      .then(r => r.json())
      .then(d => setPortbaseConfigured(!!d.integrations?.some((i: any) => i.country_code === 'NL' && i.integration_key === 'portbase' && i.is_active)))
      .catch(() => {});
  }, [session]);

  const isDutchPort = (text: string | undefined) => !!text && /rotterdam|nlrtm|amsterdam|nlams/i.test(text);

  const checkPortbaseStatus = async (shipmentId: string, containerNumber: string) => {
    setPortbaseLoading(prev => ({ ...prev, [shipmentId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/integrations/portbase/container/${containerNumber}?session=${session}`);
      const data = await res.json();
      setPortbaseStatus(prev => ({ ...prev, [shipmentId]: res.ok ? data : { error: data.message || 'Portbase lookup failed' } }));
    } catch (e) {
      setPortbaseStatus(prev => ({ ...prev, [shipmentId]: { error: 'Portbase lookup failed' } }));
    }
    setPortbaseLoading(prev => ({ ...prev, [shipmentId]: false }));
  };

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

  const fieldInput = inputClass;
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); };
  const sideLabel = 'mb-2 font-fw-mono text-app-mono-xs uppercase text-app-ink-3';

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={user} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <TrialBanner session={session} />

      <main className="p-4 lg:p-6">
        <PageHeader
          className="mb-5"
          title="Shipment Tracker"
          description={<><span className="font-fw-mono">{totalActive}</span> active shipments</>}
          actions={<>
            <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search shipments..." className="w-56" />
            <select value={filterMode} onChange={e => setFilterMode(e.target.value)} aria-label="Filter by mode" className={selectInlineClass}>
              <option value="">All modes</option>
              <option value="ocean">Ocean</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
            </select>
            <div className="flex h-9 items-center gap-2 rounded-fw-btn border border-app-line-strong bg-app-card px-3">
              <Icon name="sparkle" size={14} className="text-app-accent" />
              <span className="text-app-ui-sm text-app-ink-2">AI auto-detect</span>
              <Toggle checked={aiAutoDetect} onChange={setAiAutoDetect} label="AI auto-detect" />
            </div>
            <Button variant="primary" icon="plus" onClick={() => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); }}>New Shipment</Button>
          </>}
        />

        {/* Pending AI suggestions */}
        {pending.length > 0 && (
          <section className="mb-5 rounded-fw-card border border-app-line bg-app-panel p-4" aria-label="AI suggestions">
            <h2 className="mb-3 flex items-center gap-2 text-app-ui font-semibold text-app-ink">
              <Tag tone="accent">AI</Tag>
              Detected <span className="font-fw-mono">{pending.length}</span> shipment{pending.length > 1 ? 's' : ''} from your emails — review before adding
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map(p => (
                <div key={p.id} className="rounded-fw-card border border-app-line bg-app-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-fw-mono text-app-mono font-medium text-app-ink">{p.reference}</p>
                      <p className="truncate text-app-ui-sm text-app-ink-2">{p.customer}</p>
                    </div>
                    <Icon name={MODE_ICON[p.mode] || 'container'} size={18} className="flex-shrink-0 text-app-ink-3" />
                  </div>
                  <div className="mb-2">
                    {p.updateTarget
                      ? <Tag tone="accent">Status update → {STATUSES.find(s => s.key === p.status)?.label || p.status}</Tag>
                      : <Tag tone="info">New shipment</Tag>}
                  </div>
                  <Route from={p.origin} to={p.destination} className="mb-1 text-app-ink-2" />
                  {p.emailSubject && <p className="mb-3 truncate text-app-ui-sm italic text-app-ink-3">From: "{p.emailSubject}"</p>}
                  <dl className="mb-3 grid grid-cols-2 gap-2">
                    {p.commodity && <div><DataLabel>Cargo</DataLabel><dd className="text-app-ui-sm">{p.commodity}</dd></div>}
                    {p.container && <div><DataLabel>Container</DataLabel><dd className="font-fw-mono text-app-mono">{p.container}</dd></div>}
                    {p.weight && <div><DataLabel>Weight</DataLabel><dd className="font-fw-mono text-app-mono">{p.weight}</dd></div>}
                    {p.incoterm && <div><DataLabel>Incoterm</DataLabel><dd className="font-fw-mono text-app-mono">{p.incoterm}</dd></div>}
                  </dl>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" icon="check" className="flex-1" onClick={() => approvePending(p)}>Approve</Button>
                    {!p.updateTarget && (
                      <Button size="sm" icon="edit" className="flex-1" onClick={() => { /* open edit with pre-filled */ setForm({ status: p.status, reference: p.reference, customer: p.customer, origin: p.origin, destination: p.destination, mode: p.mode, commodity: p.commodity, weight: p.weight, container: p.container, incoterm: p.incoterm, eta: p.eta, etd: p.etd, carrier: p.carrier, notes: p.notes, emailId: p.emailId, emailSubject: p.emailSubject, aiGenerated: true, approved: false }); setEditingId(null); setShowForm(true); rejectPending(p.id); }}>
                        Edit
                      </Button>
                    )}
                    <Button variant="danger" size="icon-sm" icon="close" onClick={() => rejectPending(p.id)} aria-label="Dismiss suggestion" title="Dismiss" className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-3">
            {STATUSES.map(status => {
              const cards = byStatus(status.key);
              const isDragTarget = dragOver === status.key;
              return (
                <div key={status.key}
                  onDragOver={(e) => onDragOver(e, status.key)}
                  onDrop={(e) => onDrop(e, status.key)}
                  onDragLeave={() => setDragOver(null)}
                  className={`flex w-64 flex-shrink-0 flex-col gap-2 rounded-fw-card transition-shadow ${isDragTarget ? 'ring-2 ring-app-accent-fill' : ''}`}>

                  <ColumnHeader label={status.label} count={cards.length} tone={shipmentTone(status.key)} />

                  {/* Cards */}
                  <div className="min-h-32 space-y-2 rounded-fw-card border border-app-line bg-app-panel p-2">
                    {cards.length === 0 && (
                      <div className={`flex items-center justify-center gap-1.5 py-6 text-app-ui-sm text-app-ink-3 ${isDragTarget ? '' : 'opacity-70'}`}>
                        {isDragTarget ? <><Icon name="download" size={14} /> Drop here</> : 'No shipments'}
                      </div>
                    )}
                    {cards.map(s => (
                      <div key={s.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onClick={() => setSelectedCard(selectedCard?.id === s.id ? null : s)}
                        className={`cursor-grab rounded-fw-card border bg-app-card p-3 transition-colors active:cursor-grabbing ${draggingId === s.id ? 'opacity-50' : ''} ${selectedCard?.id === s.id ? 'border-app-accent-fill' : 'border-app-line hover:border-app-line-strong'}`}>
                        <div className="mb-1.5 flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="truncate font-fw-mono text-app-mono font-medium text-app-ink">{s.reference}</p>
                            <p className="truncate text-app-ui-sm text-app-ink-2">{s.customer}</p>
                          </div>
                          <Icon name={MODE_ICON[s.mode] || 'container'} size={16} className="flex-shrink-0 text-app-ink-3" />
                        </div>
                        <Route from={s.origin} to={s.destination} className="mb-2 max-w-full text-app-mono-xs text-app-ink-2" />
                        <div className="flex flex-wrap items-center gap-1">
                          {s.container && <Chip className="font-fw-mono text-app-mono-xs">{s.container}</Chip>}
                          {s.incoterm && <Chip className="font-fw-mono text-app-mono-xs">{s.incoterm}</Chip>}
                          {s.aiGenerated && <Tag tone="accent">AI</Tag>}
                          {s.t49TrackingActive && <Tag tone="ok">Live</Tag>}
                        </div>
                        {(s.etd || s.eta) && (
                          <p className="mt-1.5 font-fw-mono text-app-mono-xs text-app-ink-3">
                            {s.etd && <span className="whitespace-nowrap">ETD {s.etd}</span>}{s.etd && s.eta && ' · '}{s.eta && <span className="whitespace-nowrap">ETA {s.eta}</span>}
                          </p>
                        )}
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
          <aside className="fixed bottom-4 right-4 top-16 z-30 flex w-80 flex-col overflow-y-auto rounded-fw-card border border-app-line bg-app-card shadow-app-pop" aria-label="Shipment details">
            <div className="flex items-center justify-between border-b border-app-line p-4">
              <h3 className="font-fw-mono text-app-mono font-semibold">{selectedCard.reference}</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" icon="edit" onClick={() => openEdit(selectedCard)}>Edit</Button>
                <Button variant="danger" size="icon-sm" icon="trash" onClick={() => deleteShipment(selectedCard.id)} aria-label="Delete shipment" title="Delete" />
                <Button variant="ghost" size="icon-sm" icon="close" onClick={() => setSelectedCard(null)} aria-label="Close" />
              </div>
            </div>
            <div className="flex-1 space-y-4 p-4">
              {/* Status change */}
              <div>
                <p className={sideLabel}>Status</p>
                <div className="grid grid-cols-2 gap-1">
                  {STATUSES.map(s => {
                    const active = selectedCard.status === s.key;
                    const tc = toneClass[shipmentTone(s.key)];
                    return (
                      <button key={s.key} onClick={() => { moveStatus(selectedCard.id, s.key); setSelectedCard(prev => prev ? { ...prev, status: s.key } : null); }} aria-pressed={active}
                        className={`flex items-center gap-1.5 rounded-fw-btn border px-2 py-1.5 text-left text-app-ui-sm transition-colors ${active ? `border-transparent font-medium ${tc.tag}` : 'border-app-line text-app-ink-2 hover:bg-app-raised'}`}>
                        <span aria-hidden className={`size-1.5 flex-none rounded-full ${active ? tc.dot : 'bg-app-line-strong'}`} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <dl className="space-y-2 border-t border-app-line pt-3">
                {[
                  { label: 'Customer', value: selectedCard.customer, mono: false },
                  { label: 'Route', value: `${selectedCard.origin} → ${selectedCard.destination}`, mono: true },
                  { label: 'Mode', value: selectedCard.mode || '—', mono: false },
                  { label: 'Commodity', value: selectedCard.commodity || '—', mono: false },
                  { label: 'Weight', value: selectedCard.weight || '—', mono: true },
                  { label: 'Container', value: selectedCard.container || '—', mono: true },
                  { label: 'Incoterm', value: selectedCard.incoterm || '—', mono: true },
                  { label: 'Carrier', value: selectedCard.carrier || '—', mono: false },
                  { label: 'ETD', value: selectedCard.etd || '—', mono: true },
                  { label: 'ETA', value: selectedCard.eta || '—', mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-app-ui-sm text-app-ink-3">{label}</dt>
                    <dd className={`max-w-44 truncate text-right capitalize ${mono ? 'font-fw-mono text-app-mono normal-case' : 'text-app-ui-sm font-medium'}`}>{value}</dd>
                  </div>
                ))}
              </dl>

              {selectedCard.notes && (
                <div className="border-t border-app-line pt-3">
                  <p className={sideLabel}>Notes</p>
                  <p className="text-app-ui-sm text-app-ink-2">{selectedCard.notes}</p>
                </div>
              )}

              {selectedCard.emailSubject && (
                <div className="border-t border-app-line pt-3">
                  <p className={sideLabel}>Source Email</p>
                  <p className="text-app-ui-sm italic text-app-ink-2">"{selectedCard.emailSubject}"</p>
                  {session && selectedCard.emailId && (
                    <Link href={`/dashboard?session=${session}`} className="mt-1 inline-flex items-center gap-1 text-app-ui-sm text-app-accent hover:underline">
                      View in inbox <Icon name="arrow-right" size={12} />
                    </Link>
                  )}
                </div>
              )}

              <div className="border-t border-app-line pt-3 font-fw-mono text-app-mono-xs text-app-ink-3">
                <p>Created {new Date(selectedCard.createdAt).toLocaleDateString()}</p>
                <p>Updated {new Date(selectedCard.updatedAt).toLocaleDateString()}</p>
                {selectedCard.aiGenerated && <p className="mt-1.5 flex items-center gap-1 font-fw-sans text-app-ui-sm text-app-accent"><Icon name="sparkle" size={13} /> Created by AI from email</p>}
              </div>

              <div className="border-t border-app-line pt-3">
                <Button variant="primary" size="sm" icon="link" className="w-full" onClick={() => openShare(selectedCard)}>Share with Customer</Button>

                {portals.filter(p => p.shipment_id === selectedCard.id).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className={sideLabel}>Shared Links</p>
                    {portals.filter(p => p.shipment_id === selectedCard.id).map(p => (
                      <div key={p.id} className="space-y-1.5 rounded-fw-btn border border-app-line p-2">
                        <div className="flex items-center justify-between gap-2">
                          <Tag tone={p.is_active ? 'ok' : 'neutral'}>{p.is_active ? 'Active' : 'Inactive'}</Tag>
                          <span className="font-fw-mono text-app-mono-xs text-app-ink-3">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="xs" icon="copy" className="flex-1" onClick={() => copyPortalLink(p.url)}>Copy Link</Button>
                          <Button size="xs" className="flex-1" onClick={() => togglePortalActive(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</Button>
                          <Button variant="danger" size="icon-sm" icon="trash" onClick={() => deletePortal(p.id)} aria-label="Remove link" title="Remove link" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Container Tracking (Terminal49) */}
              <div className="border-t border-app-line pt-3">
                <p className={sideLabel}>Container Tracking</p>
                {!selectedCard.t49TrackingActive ? (
                  <div className="rounded-fw-btn border border-dashed border-app-line-strong p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon name="tracking" size={16} className="text-app-ink-3" />
                      <p className="text-app-ui-sm font-semibold text-app-ink">Live Container Tracking</p>
                      <Tag tone="neutral" className="ml-auto">Coming soon</Tag>
                    </div>
                    <p className="mb-2 text-app-ui-sm leading-snug text-app-ink-3">
                      Real-time milestone updates powered by Terminal49 — vessel departures, arrivals, customs clearance and more. Available in an upcoming update.
                    </p>
                    <span className="font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Powered by Terminal49</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tag tone="ok">Live tracking</Tag>
                        <Button size="xs" icon={refreshing[selectedCard.id] ? undefined : 'refresh'} onClick={() => refreshTracking(selectedCard.id)} disabled={refreshing[selectedCard.id] || refreshCooldown[selectedCard.id]} title="Refresh">
                          {refreshing[selectedCard.id] && <Spinner className="size-3" />} Refresh
                        </Button>
                      </div>
                      <button onClick={() => stopTracking(selectedCard)} className="text-app-ui-sm text-app-danger-ink hover:underline">Stop Tracking</button>
                    </div>

                    {justUpdated[selectedCard.id] && <p className="flex items-center gap-1 text-app-ui-sm text-app-ok-ink"><Icon name="check" size={13} /> Updated just now</p>}
                    {refreshError[selectedCard.id] && <p className="text-app-ui-sm text-app-danger-ink">{refreshError[selectedCard.id]}</p>}
                    {lastRefreshedAt[selectedCard.id] && (
                      <p className="text-app-ui-sm text-app-ink-3">Last refreshed: {timeAgo(lastRefreshedAt[selectedCard.id])}</p>
                    )}

                    {selectedCard.t49LastEvent && (
                      <div>
                        <p className="text-app-ui-sm text-app-ink-2">{selectedCard.t49LastEvent}</p>
                        {selectedCard.t49LastEventAt && <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{new Date(selectedCard.t49LastEventAt).toLocaleString()}</p>}
                      </div>
                    )}
                    {selectedCard.t49PodEta && (
                      <p className="text-app-ui-sm"><span className="text-app-ink-3">ETA:</span> <span className="font-fw-mono">{new Date(selectedCard.t49PodEta).toLocaleDateString()}</span> <span className="text-app-ok-ink">(live)</span></p>
                    )}
                    {selectedCard.t49Vessel && <p className="text-app-ui-sm"><span className="text-app-ink-3">Vessel:</span> <span className="font-fw-mono">{selectedCard.t49Vessel}</span></p>}

                    {/* Event timeline */}
                    {shipmentEvents[selectedCard.id]?.length > 0 ? (
                      <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                        {shipmentEvents[selectedCard.id].map(ev => (
                          <li key={ev.id} className="flex gap-2 text-app-ui-sm">
                            <span aria-hidden className="mt-1.5 size-1.5 flex-none rounded-full bg-app-info-dot" />
                            <div className="min-w-0">
                              <p className="text-app-ink">{ev.description}</p>
                              <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{ev.location ? `${ev.location} · ` : ''}{new Date(ev.event_at).toLocaleString()}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : lastRefreshedAt[selectedCard.id] && !refreshing[selectedCard.id] && (
                      <p className="text-app-ui-sm text-app-ink-3">No tracking data available yet — Terminal49 may still be processing this container.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Portbase Status (Netherlands) */}
              {portbaseConfigured && selectedCard.containerNumber && (isDutchPort(selectedCard.origin) || isDutchPort(selectedCard.destination)) && (
                <div className="border-t border-app-line pt-3">
                  <p className={sideLabel}>Portbase Status</p>
                  {!portbaseStatus[selectedCard.id] ? (
                    <Button size="sm" icon={portbaseLoading[selectedCard.id] ? undefined : 'search'} className="w-full" onClick={() => checkPortbaseStatus(selectedCard.id, selectedCard.containerNumber!)} disabled={portbaseLoading[selectedCard.id]}>
                      {portbaseLoading[selectedCard.id] ? 'Checking...' : 'Check Portbase Status (NL)'}
                    </Button>
                  ) : portbaseStatus[selectedCard.id].error ? (
                    <p className="text-app-ui-sm text-app-danger-ink">{portbaseStatus[selectedCard.id].error}</p>
                  ) : (
                    <dl className="space-y-1.5 text-app-ui-sm">
                      {portbaseStatus[selectedCard.id].status && <p><span className="text-app-ink-3">Status:</span> {portbaseStatus[selectedCard.id].status}</p>}
                      {portbaseStatus[selectedCard.id].terminal && <p><span className="text-app-ink-3">Terminal:</span> {portbaseStatus[selectedCard.id].terminal}</p>}
                      {portbaseStatus[selectedCard.id].customs_status && <p><span className="text-app-ink-3">Customs:</span> {portbaseStatus[selectedCard.id].customs_status}</p>}
                      {portbaseStatus[selectedCard.id].release_status && <p><span className="text-app-ink-3">Release:</span> {portbaseStatus[selectedCard.id].release_status}</p>}
                    </dl>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <Modal title={editingId ? 'Edit Shipment' : 'New Shipment'} icon="tracking" size="lg" onClose={closeForm}
          footer={<>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" onClick={saveShipment}>{editingId ? 'Save Changes' : 'Create Shipment'}</Button>
          </>}>
          <div className="grid grid-cols-2 gap-4 p-5">
            <Field label="Reference *" className="col-span-2 sm:col-span-1">
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. FW-2024-001" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Customer *" className="col-span-2 sm:col-span-1">
              <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="Customer name" className={fieldInput} />
            </Field>
            <Field label="Origin (POL)">
              <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} placeholder="e.g. Santos, BR" className={fieldInput} />
            </Field>
            <Field label="Destination (POD)">
              <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Rotterdam, NL" className={fieldInput} />
            </Field>
            <Field label="Mode">
              <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as any }))} className={selectClass}>
                <option value="">Select mode</option>
                <option value="ocean">Ocean</option>
                <option value="air">Air</option>
                <option value="road">Road</option>
                <option value="rail">Rail</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ShipmentStatus }))} className={selectClass}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Commodity">
              <input value={form.commodity} onChange={e => setForm(f => ({ ...f, commodity: e.target.value }))} placeholder="e.g. General Cargo" className={fieldInput} />
            </Field>
            <Field label="Weight">
              <input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="e.g. 12,500 KG" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Container">
              <input value={form.container} onChange={e => setForm(f => ({ ...f, container: e.target.value }))} placeholder="e.g. 1x40HC" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Incoterm">
              <select value={form.incoterm} onChange={e => setForm(f => ({ ...f, incoterm: e.target.value }))} className={selectClass}>
                <option value="">Select incoterm</option>
                {['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Carrier">
              <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. Maersk" className={fieldInput} />
            </Field>
            <Field label="ETD">
              <input type="date" value={form.etd} onChange={e => setForm(f => ({ ...f, etd: e.target.value }))} className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="ETA">
              <input type="date" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={3} className={textareaClass} />
            </Field>
          </div>
        </Modal>
      )}

      {/* Share Settings Modal */}
      {shareShipment && (
        <Modal title="Share with Customer" icon="link" onClose={() => { setShareShipment(null); setSharePortal(null); }}>
          <div className="space-y-4 p-5">
            {!sharePortal ? (
              <p className="flex items-center gap-2 text-app-ui text-app-ink-3"><Spinner className="size-3.5" /> Generating share link...</p>
            ) : (
              <>
                <Field label="Tracking Link">
                  <div className="flex gap-2">
                    <input readOnly value={sharePortal.url} className={`${fieldInput} font-fw-mono text-app-mono`} />
                    <Button icon="copy" onClick={() => copyPortalLink(sharePortal.url)}>Copy Link</Button>
                  </div>
                </Field>

                <div className="flex items-center justify-between">
                  <span className="text-app-ui">Show carrier name</span>
                  <Toggle checked={sharePortal.show_carrier} onChange={() => setSharePortal(p => p ? { ...p, show_carrier: !p.show_carrier } : p)} label="Show carrier name" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-app-ui">Show quoted rate</span>
                  <Toggle checked={sharePortal.show_rate} onChange={() => setSharePortal(p => p ? { ...p, show_rate: !p.show_rate } : p)} label="Show quoted rate" />
                </div>

                <Field label="Personal Message (optional)">
                  <textarea value={sharePortal.message || ''} onChange={e => setSharePortal(p => p ? { ...p, message: e.target.value } : p)} rows={2}
                    placeholder="e.g. Thanks for your business! Track your shipment below." className={textareaClass} />
                </Field>

                <Field label="Expiry Date (optional)">
                  <input type="date" value={sharePortal.expires_at ? sharePortal.expires_at.slice(0, 10) : ''} onChange={e => setSharePortal(p => p ? { ...p, expires_at: e.target.value || null } : p)}
                    className={`${fieldInput} font-fw-mono`} />
                </Field>

                <Button className="w-full" onClick={saveShareSettings} disabled={shareSaving}>{shareSaving ? 'Saving...' : 'Save Settings'}</Button>

                <div className="border-t border-app-line pt-4">
                  <Field label="Send by Email">
                    <div className="flex gap-2">
                      <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="customer@example.com" className={fieldInput} />
                      <Button variant="primary" icon={shareSending ? undefined : 'send'} onClick={sendPortalByEmail} disabled={shareSending}>{shareSending ? 'Sending...' : 'Send'}</Button>
                    </div>
                  </Field>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Track Container Modal */}
      {trackShipment && (
        <Modal title="Track Container" icon="container" size="sm" onClose={() => setTrackShipment(null)}>
          <div className="space-y-4 p-5">
            {trackError && <Notice tone="danger" icon="alert">{trackError}</Notice>}
            <Field label="Container Number *">
              <input value={trackContainerNumber} onChange={e => setTrackContainerNumber(e.target.value.toUpperCase())} placeholder="e.g. MSCU1234567" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="BL Number (optional)">
              <input value={trackBlNumber} onChange={e => setTrackBlNumber(e.target.value)} placeholder="e.g. MAEU221876618" className={`${fieldInput} font-fw-mono`} />
            </Field>
            <Field label="Carrier *">
              <select value={trackCarrier} onChange={e => setTrackCarrier(e.target.value)} className={selectClass}>
                <option value="">Select carrier</option>
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Button variant="primary" className="w-full" onClick={startTracking} disabled={trackSaving || !trackContainerNumber || !trackCarrier}>
              {trackSaving ? 'Starting...' : 'Start Tracking'}
            </Button>
            <p className="text-center font-fw-mono text-app-mono-xs text-app-ink-3">Powered by Terminal49 — supports 33+ shipping lines</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
