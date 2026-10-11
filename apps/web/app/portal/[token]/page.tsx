import type { Metadata } from 'next';
import Icon from '../../components/ui/Icon';
import { Tag } from '../../components/ui/Tag';
import { appRootClass } from '../../components/ui/Panel';
import { MODE_ICON } from '../../components/ui/tones';

import { API_URL } from '@/app/lib/api';

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

// Customer-facing page: always light, whatever the forwarder's own theme.
const shell = (children: React.ReactNode) => (
  <div data-theme="light" className={appRootClass}>
    <header className="bg-app-bar-bg">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <img src="/icons/freightwizard_logo_white.png" alt="FreightWizard" className="h-6 w-auto" />
        <span aria-hidden className="h-4 w-px bg-app-bar-muted/40" />
        <span className="text-app-ui-sm text-app-bar-muted">Shipment Tracking</span>
      </div>
    </header>
    {children}
  </div>
);

const sectionTitle = 'font-fw-mono text-app-mono-xs uppercase text-app-ink-3';

function DetailRow({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-app-line py-2.5 last:border-0">
      <dt className="text-app-ink-2">{label}</dt>
      <dd className={`text-right font-medium text-app-ink ${mono ? 'font-fw-mono text-app-mono' : ''}`}>{children}</dd>
    </div>
  );
}

export default async function PortalPage({ params }: { params: { token: string } }) {
  const data = await getPortalData(params.token);

  if (!data) {
    return shell(
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-fw-card border border-app-line bg-app-panel text-app-ink-3">
            <Icon name="lock" size={22} />
          </div>
          <h1 className="mb-2 font-fw-display text-app-title-sm text-app-ink">This tracking link is no longer active</h1>
          <p className="text-app-ui-sm text-app-ink-2">Please contact your freight forwarder for the latest status on your shipment.</p>
        </div>
      </main>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex(s => s.key === data.status);

  return shell(
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {data.message && (
        <div className="mb-6 rounded-fw-card border border-app-line border-l-2 border-l-app-accent-fill bg-app-panel p-4">
          <p className="text-app-ui text-app-ink-2">{data.message}</p>
        </div>
      )}

      {/* Timeline */}
      <section aria-labelledby="status-title" className="mb-4 rounded-fw-card border border-app-line bg-app-card p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="status-title" className={sectionTitle}>Shipment Status</h2>
          {data.liveTracking && <Tag tone="ok">Live tracking active</Tag>}
        </div>

        {data.liveTracking ? (
          <>
            <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 text-app-ui">
              {data.liveTracking.vessel && <p><span className="text-app-ink-2">Vessel:</span> <span className="font-medium">{data.liveTracking.vessel}</span></p>}
              {data.liveTracking.eta && <p><span className="text-app-ink-2">ETA:</span> <span className="font-fw-mono font-medium">{new Date(data.liveTracking.eta).toLocaleDateString()}</span> <span className="text-app-ok-ink">(live)</span></p>}
            </div>
            <ol className="space-y-4">
              {data.liveTracking.events.length === 0 && <li className="text-app-ui-sm text-app-ink-3">No milestone events yet — check back soon.</li>}
              {data.liveTracking.events.map((ev, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-shrink-0 flex-col items-center">
                    <span className={`mt-1.5 size-2.5 rounded-[2px] ${i === 0 ? 'bg-app-accent-fill' : 'bg-app-line-strong'}`} />
                    {i < data.liveTracking!.events.length - 1 && <span className="mt-1 w-px flex-1 bg-app-line" />}
                  </div>
                  <div className="pb-1">
                    <p className={`text-app-ui capitalize ${i === 0 ? 'font-semibold text-app-ink' : 'text-app-ink-2'}`}>{ev.description}</p>
                    <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{ev.location ? `${ev.location} · ` : ''}{new Date(ev.event_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
            {data.liveTracking.lastEventAt && (
              <p className="mt-4 border-t border-app-line pt-4 text-app-ui-sm text-app-ink-3">Last updated: {timeAgo(data.liveTracking.lastEventAt)}</p>
            )}
          </>
        ) : (
          <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              const future = i > currentIndex;
              return (
                <li key={step.key} aria-current={active ? 'step' : undefined} className="flex items-center gap-3 py-1 sm:flex-1 sm:flex-col sm:gap-2 sm:py-0">
                  <div className="flex items-center sm:w-full sm:flex-col">
                    <div className={`flex size-8 flex-shrink-0 items-center justify-center rounded-fw-btn border font-fw-mono text-app-mono-xs ${
                      active ? 'border-app-accent-fill bg-app-accent-fill text-app-on-accent' :
                      done ? 'border-app-accent-fill/40 bg-app-selected text-app-accent' : 'border-app-line bg-app-panel text-app-ink-3'
                    }`}>
                      {done ? <Icon name="check" size={14} /> : i + 1}
                    </div>
                    {/* Connector; the last step keeps an invisible one so every label lines up */}
                    <div aria-hidden className={`mt-4 hidden h-px w-full sm:block ${i === STATUS_STEPS.length - 1 ? 'invisible' : done ? 'bg-app-accent-fill/50' : 'bg-app-line'}`} />
                  </div>
                  <p className={`text-app-ui-sm sm:mt-1 sm:text-center ${active ? 'font-semibold text-app-ink' : future ? 'text-app-ink-3' : 'text-app-ink-2'}`}>{step.label}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Shipment details */}
      <section aria-labelledby="details-title" className="mb-4 rounded-fw-card border border-app-line bg-app-card p-6">
        <h2 id="details-title" className={`${sectionTitle} mb-2`}>Shipment Details</h2>
        <dl className="text-app-ui">
          <DetailRow label="Reference" mono>{data.reference || '—'}</DetailRow>
          <DetailRow label="Route">
            <span className="inline-flex items-center gap-1.5">
              <Icon name={MODE_ICON[data.mode] || 'container'} size={16} className="text-app-ink-3" />
              {data.origin || '—'} <span className="text-app-ink-3">→</span> {data.destination || '—'}
            </span>
          </DetailRow>
          {data.commodity && <DetailRow label="Commodity">{data.commodity}</DetailRow>}
          {data.container && <DetailRow label="Container" mono>{data.container}</DetailRow>}
          {data.etd && <DetailRow label="ETD" mono>{data.etd}</DetailRow>}
          {data.eta && <DetailRow label="ETA" mono>{data.eta}</DetailRow>}
          {data.carrier && <DetailRow label="Carrier">{data.carrier}</DetailRow>}
          {data.rate && <DetailRow label="Quoted Rate" mono>{data.rate.currency} {Number(data.rate.amount).toFixed(2)}</DetailRow>}
        </dl>

        {data.showDocuments && (
          <div className="mt-4 border-t border-app-line pt-4">
            <p className={`${sectionTitle} mb-2`}>Documents</p>
            <p className="text-app-ui-sm text-app-ink-3">No documents shared yet.</p>
          </div>
        )}
      </section>

      {/* Contact */}
      <footer className="py-6 text-center">
        <p className="mb-1 text-app-ui-sm text-app-ink-2">Questions about your shipment? Contact your freight forwarder.</p>
        <p className="font-fw-mono text-app-mono-xs text-app-ink-3">Powered by FreightWizard</p>
      </footer>
    </main>
  );
}
