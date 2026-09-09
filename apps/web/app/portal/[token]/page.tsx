import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface LiveEvent {
  event_type: string;
  description: string;
  location: string | null;
  event_at: string;
}

interface LiveTracking {
  vessel: string | null;
  eta: string | null;
  lastEventAt: string | null;
  events: LiveEvent[];
}

interface PortalData {
  title: string;
  message: string | null;
  reference: string;
  origin: string;
  destination: string;
  mode: string;
  commodity: string;
  container: string;
  status: string;
  etd: string;
  eta: string;
  carrier: string | null;
  rate: { amount: number; currency: string } | null;
  showDocuments: boolean;
  liveTracking: LiveTracking | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'at_destination', label: 'At Destination' },
  { key: 'delivered', label: 'Delivered' },
];

const MODE_ICONS: Record<string, string> = { ocean: '🚢', air: '✈️', road: '🚛', rail: '🚂', '': '📦' };
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_STEPS.map(s => [s.key, s.label]));

async function getPortalData(token: string): Promise<PortalData | null> {
  try {
    const res = await fetch(`${API_URL}/api/portal/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getPortalData(params.token);
  if (!data) {
    return { title: 'Shipment Tracking — FreightWizard', description: 'Track your freight shipment status.' };
  }
  const title = `${data.reference || 'Shipment'} — ${data.origin} → ${data.destination}`;
  const description = `Status: ${STATUS_LABEL[data.status] || data.status}${data.eta ? ` · ETA: ${data.eta}` : ''}`;
  return {
    title, description,
    openGraph: { title, description, siteName: 'FreightWizard' },
  };
}

export default async function PortalPage({ params }: { params: { token: string } }) {
  const data = await getPortalData(params.token);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-200 flex items-center justify-center text-3xl">🔒</div>
          <h1 className="text-lg font-bold mb-2">This tracking link is no longer active</h1>
          <p className="text-sm text-slate-500">Please contact your freight forwarder for the latest status on your shipment.</p>
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex(s => s.key === data.status);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className="h-6 w-6 object-contain brightness-0" />
          <span className="font-bold">FreightWizard</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-slate-500 text-sm">Shipment Tracking</span>
        </div>

        {data.message && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 border border-[#5200FF]/20">
            <p className="text-sm text-slate-700">{data.message}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Shipment Status</h2>
            {data.liveTracking && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">🟢 Live tracking active</span>
            )}
          </div>

          {data.liveTracking ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-5">
                {data.liveTracking.vessel && <p><span className="text-slate-500">Vessel:</span> <span className="font-medium">{data.liveTracking.vessel}</span></p>}
                {data.liveTracking.eta && <p><span className="text-slate-500">ETA:</span> <span className="font-medium">{new Date(data.liveTracking.eta).toLocaleDateString()}</span> <span className="text-green-600">(live)</span></p>}
              </div>
              <div className="space-y-4">
                {data.liveTracking.events.length === 0 && <p className="text-sm text-slate-400">No milestone events yet — check back soon.</p>}
                {data.liveTracking.events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 ${i === 0 ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF]' : 'bg-slate-300'}`} />
                      {i < data.liveTracking!.events.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-1">
                      <p className={`text-sm capitalize ${i === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{ev.description}</p>
                      <p className="text-xs text-slate-400">{ev.location ? `${ev.location} · ` : ''}{new Date(ev.event_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {data.liveTracking.lastEventAt && (
                <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">Last updated: {timeAgo(data.liveTracking.lastEventAt)}</p>
              )}
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start gap-0">
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const future = i > currentIndex;
                return (
                  <div key={step.key} className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2">
                    <div className="flex sm:flex-col items-center sm:w-full">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        active ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white shadow-[0_0_0_4px_rgba(158,20,251,0.2)]' :
                        done ? 'bg-[#9E14FB]/20 text-[#9E14FB]' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {done ? '✓' : i + 1}
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`hidden sm:block h-0.5 w-full mt-4 ${done ? 'bg-[#9E14FB]/40' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <p className={`text-xs sm:text-center sm:mt-1 ${active ? 'font-semibold text-slate-900' : future ? 'text-slate-400' : 'text-slate-600'}`}>{step.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shipment details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Shipment Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-medium">{data.reference || '—'}</span></div>
            <div className="flex justify-between">
              <span className="text-slate-500">Route</span>
              <span className="font-medium flex items-center gap-1.5">{MODE_ICONS[data.mode] || '📦'} {data.origin || '—'} → {data.destination || '—'}</span>
            </div>
            {data.commodity && <div className="flex justify-between"><span className="text-slate-500">Commodity</span><span className="font-medium">{data.commodity}</span></div>}
            {data.container && <div className="flex justify-between"><span className="text-slate-500">Container</span><span className="font-medium">{data.container}</span></div>}
            {data.etd && <div className="flex justify-between"><span className="text-slate-500">ETD</span><span className="font-medium">{data.etd}</span></div>}
            {data.eta && <div className="flex justify-between"><span className="text-slate-500">ETA</span><span className="font-medium">{data.eta}</span></div>}
            {data.carrier && <div className="flex justify-between"><span className="text-slate-500">Carrier</span><span className="font-medium">{data.carrier}</span></div>}
            {data.rate && <div className="flex justify-between"><span className="text-slate-500">Quoted Rate</span><span className="font-medium">{data.rate.currency} {Number(data.rate.amount).toFixed(2)}</span></div>}
          </div>

          {data.showDocuments && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documents</p>
              <p className="text-sm text-slate-400">No documents shared yet.</p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="text-center py-6">
          <p className="text-sm text-slate-500 mb-1">Questions about your shipment? Contact your freight forwarder.</p>
          <p className="text-xs text-slate-400">Powered by FreightWizard</p>
        </div>
      </div>
    </div>
  );
}
