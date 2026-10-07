'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';
import Icon, { type IconName } from '../components/ui/Icon';
import TopBar, { type Language } from '../components/ui/TopBar';
import { appRootClass, EmptyState, Notice } from '../components/ui/Panel';
import { Button, ButtonLink, Spinner } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';
import { Toast, type ToastData, DataTable, th, td, tdMono, tr } from '../components/ui/Data';
import { shipmentTone, MODE_ICON } from '../components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface Row {
  id: string; reference: string; customer: string; origin: string; destination: string;
  originCode: string | null; destinationCode: string | null; mode: string; status: string; eta: string | null; mine: boolean;
}
interface Overview {
  generatedAt: string;
  scope: { kind: 'team' | 'user'; name: string | null; members: number };
  kpis: {
    activeShipments: number; arriving7d: number; inboxWaiting30d: number; urgentHighWaiting30d: number;
    avgReplyMinutes30d: number | null; aiSuggestions: number; bookings: number; inTransit: number; atDestination: number;
    quotesAwaiting: { count: number; valueByCurrency: Record<string, number> }; ratesExpiring30d: number;
  };
  suggestions: (Row & { emailSubject: string | null; isUpdate: boolean })[];
  shipments: Row[];
}

const STATUS_LABEL: Record<string, string> = {
  inquiry: 'Inquiry', quoted: 'Quoted', booked: 'Booked', in_transit: 'In Transit',
  at_destination: 'At Destination', delivered: 'Delivered', closed: 'Closed', cancelled: 'Cancelled',
};

const T = {
  en: {
    title: 'Operations Overview', team: 'Team', members: 'members', you: 'Your workspace',
    teamNote: 'Counts cover the whole team; linked pages show your own records.',
    active: 'Active shipments', arriving: 'Arriving', inbox: 'Customer inbox', urgent: 'Urgent and high waiting',
    avgReply: 'Avg reply time', suggestions: 'AI suggestions to review', bookings: 'Bookings', inTransit: 'In transit',
    atDest: 'At destination', quotes: 'Quotes awaiting answer', rates: 'Rates expiring',
    next7: 'Next 7 days', last30: 'Last 30 days', next30: 'Next 30 days', notReplied: 'Not replied', yours: 'Yours to review',
    noReplies: 'No replies yet', now: 'Now',
    sugTitle: 'AI suggestions', reviewAll: 'Review all', approve: 'Approve', edit: 'Edit', noSug: 'No AI suggestions waiting for review.',
    newShipment: 'New shipment', statusUpdate: 'Status update', fromEmail: 'From',
    tableTitle: 'Active shipments · soonest ETA first', viewAll: 'Open Shipment Tracker',
    file: 'File', route: 'Route', mode: 'Mode', status: 'Status', eta: 'ETA', customer: 'Customer',
    emptyShip: 'No active shipments', emptyShipText: 'Shipments you create or approve from email suggestions appear here.',
    loadError: "Couldn't load the overview", retry: 'Retry', approved: 'Shipment approved and added to tracker!', approveFail: 'Failed to approve shipment',
  },
  pt: {
    title: 'Visão Geral das Operações', team: 'Equipa', members: 'membros', you: 'O seu espaço',
    teamNote: 'Os totais incluem toda a equipa; as páginas ligadas mostram os seus próprios registos.',
    active: 'Embarques ativos', arriving: 'A chegar', inbox: 'Caixa de clientes', urgent: 'Urgentes e altos em espera',
    avgReply: 'Tempo médio de resposta', suggestions: 'Sugestões de IA para rever', bookings: 'Reservas', inTransit: 'Em trânsito',
    atDest: 'No destino', quotes: 'Cotações a aguardar resposta', rates: 'Tarifas a expirar',
    next7: 'Próximos 7 dias', last30: 'Últimos 30 dias', next30: 'Próximos 30 dias', notReplied: 'Sem resposta', yours: 'Para si rever',
    noReplies: 'Ainda sem respostas', now: 'Agora',
    sugTitle: 'Sugestões de IA', reviewAll: 'Rever todas', approve: 'Aprovar', edit: 'Editar', noSug: 'Nenhuma sugestão de IA à espera.',
    newShipment: 'Novo embarque', statusUpdate: 'Atualização de estado', fromEmail: 'De',
    tableTitle: 'Embarques ativos · ETA mais próxima primeiro', viewAll: 'Abrir Rastreador de Embarques',
    file: 'Processo', route: 'Rota', mode: 'Modo', status: 'Estado', eta: 'ETA', customer: 'Cliente',
    emptyShip: 'Sem embarques ativos', emptyShipText: 'Os embarques criados ou aprovados a partir de sugestões aparecem aqui.',
    loadError: 'Não foi possível carregar a visão geral', retry: 'Tentar novamente', approved: 'Embarque aprovado!', approveFail: 'Falha ao aprovar o embarque',
  },
  nl: {
    title: 'Operationeel Overzicht', team: 'Team', members: 'leden', you: 'Jouw werkruimte',
    teamNote: 'Aantallen gelden voor het hele team; gekoppelde pagina’s tonen je eigen gegevens.',
    active: 'Actieve zendingen', arriving: 'Aankomend', inbox: 'Klanteninbox', urgent: 'Urgent en hoog wachtend',
    avgReply: 'Gem. reactietijd', suggestions: 'AI-suggesties te beoordelen', bookings: 'Boekingen', inTransit: 'Onderweg',
    atDest: 'Op bestemming', quotes: 'Offertes wachtend op antwoord', rates: 'Tarieven die verlopen',
    next7: 'Komende 7 dagen', last30: 'Laatste 30 dagen', next30: 'Komende 30 dagen', notReplied: 'Niet beantwoord', yours: 'Voor jou',
    noReplies: 'Nog geen antwoorden', now: 'Nu',
    sugTitle: 'AI-suggesties', reviewAll: 'Alles bekijken', approve: 'Goedkeuren', edit: 'Bewerken', noSug: 'Geen AI-suggesties in afwachting.',
    newShipment: 'Nieuwe zending', statusUpdate: 'Statusupdate', fromEmail: 'Van',
    tableTitle: 'Actieve zendingen · vroegste ETA eerst', viewAll: 'Zending Tracker openen',
    file: 'Dossier', route: 'Route', mode: 'Modus', status: 'Status', eta: 'ETA', customer: 'Klant',
    emptyShip: 'Geen actieve zendingen', emptyShipText: 'Zendingen die je aanmaakt of goedkeurt uit suggesties verschijnen hier.',
    loadError: 'Overzicht kon niet worden geladen', retry: 'Opnieuw', approved: 'Zending goedgekeurd!', approveFail: 'Goedkeuren mislukt',
  },
};

const LOCALE: Record<Language, string> = { en: 'en-GB', pt: 'pt-PT', nl: 'nl-NL' };

const formatMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

/** Main KPI card: links to the matching filtered view. */
function KpiCard({ href, label, value, window, icon, attention = false }: { href: string; label: string; value: React.ReactNode; window: string; icon: IconName; attention?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col rounded-fw-card border border-app-line bg-app-card px-4 py-3 transition-colors hover:border-app-line-strong hover:bg-app-raised">
      <span className="flex items-start justify-between gap-2 text-app-ui-sm leading-snug text-app-ink-2">
        <span className="flex min-w-0 items-start gap-1.5"><Icon name={icon} size={14} className="mt-0.5 flex-none text-app-ink-3" /><span>{label}</span></span>
        <Icon name="arrow-right" size={13} className="flex-none text-app-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className={`mt-auto pt-1 font-fw-display text-app-kpi font-normal tabular-nums ${attention ? 'text-app-warn-ink' : 'text-app-ink'}`}>{value}</span>
      <span className="mt-0.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{window}</span>
    </Link>
  );
}

/** Compact secondary KPI. */
function KpiSmall({ href, label, value, extra, window }: { href: string; label: string; value: number; extra?: string; window?: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-fw-card border border-app-line bg-app-card px-3 py-2.5 transition-colors hover:border-app-line-strong hover:bg-app-raised">
      <span className="min-w-0">
        <span className="block truncate text-app-ui-sm text-app-ink-2">{label}</span>
        {(extra || window) && <span className="block font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{[extra, window].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className="font-fw-mono text-[1.0625rem] font-medium tabular-nums text-app-ink">{value}</span>
    </Link>
  );
}

function RouteCell({ r }: { r: Row }) {
  return (
    <div className="min-w-0">
      <span className="block truncate">{r.origin || '—'} <span className="text-app-ink-3">→</span> {r.destination || '—'}</span>
      {r.originCode && r.destinationCode && (
        <span className="block font-fw-mono text-app-mono-xs text-app-ink-3">{r.originCode} → {r.destinationCode}</span>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [notification, setNotification] = useState<ToastData>(null);
  const [now, setNow] = useState(() => new Date());

  const t = T[language];

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language | null;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    // No session: the Inbox page hosts the connect screen.
    if (!sid) { router.replace('/dashboard'); return; }
    localStorage.setItem('fw_session', sid);
    setSession(sid);
    fetch(`${API_URL}/api/auth/status?session=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser({ email: d.email, name: d.name }); else router.replace('/dashboard'); })
      .catch(() => {});
  }, [searchParams, router]);

  const load = useCallback(async (sid: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${API_URL}/api/overview?session=${sid}`);
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (session) load(session); }, [session, load]);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);

  const notify = (n: ToastData) => { setNotification(n); setTimeout(() => setNotification(null), 3000); };

  // Same endpoint the Shipment Tracker uses.
  const approve = async (id: string) => {
    if (!session) return;
    setApproving(id);
    try {
      const res = await fetch(`${API_URL}/api/shipments/${id}/approve?session=${session}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      notify({ type: 'success', msg: t.approved });
      await load(session);
    } catch {
      notify({ type: 'error', msg: t.approveFail });
    }
    setApproving(null);
  };

  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: Language) => { setLanguage(l); localStorage.setItem('fw_lang', l); };

  const link = (path: string, params: Record<string, string> = {}) =>
    `${path}?${new URLSearchParams({ ...(session ? { session } : {}), ...params }).toString()}`;

  const dateLine = `${now.toLocaleDateString(LOCALE[language], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${now.toLocaleTimeString(LOCALE[language], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;

  const k = data?.kpis;
  const quoteValue = k ? Object.entries(k.quotesAwaiting.valueByCurrency).map(([cur, v]) => `${cur} ${Math.round(v).toLocaleString(LOCALE[language])}`).join(' · ') : '';

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={user} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <TrialBanner session={session} />

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Date line, title, scope */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{dateLine}</p>
            <h1 className="mt-1 font-fw-display text-app-title font-light text-app-ink">{t.title}</h1>
          </div>
          {data && (
            <div className="text-right">
              <p className="inline-flex items-center gap-1.5 text-app-ui-sm text-app-ink-2">
                <Icon name={data.scope.kind === 'team' ? 'team' : 'user'} size={14} className="text-app-ink-3" />
                {data.scope.kind === 'team'
                  ? <>{t.team} · <span className="font-medium text-app-ink">{data.scope.name}</span> · <span className="font-fw-mono">{data.scope.members}</span> {t.members}</>
                  : t.you}
              </p>
              {data.scope.kind === 'team' && <p className="mt-0.5 text-app-ui-sm text-app-ink-3">{t.teamNote}</p>}
            </div>
          )}
        </div>

        {loading && !data ? (
          <div className="flex h-64 items-center justify-center"><Spinner className="size-6 text-app-accent" /></div>
        ) : loadError && !data ? (
          <Notice tone="danger" icon="alert" title={t.loadError}
            action={<Button size="sm" icon="refresh" onClick={() => session && load(session)}>{t.retry}</Button>} />
        ) : k && data ? (
          <>
            {/* Main KPI grid */}
            <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard href={link('/shipments')} icon="tracking" label={t.active} value={k.activeShipments} window={t.now} />
              <KpiCard href={link('/shipments', { view: 'arriving' })} icon="calendar" label={`${t.arriving}`} value={k.arriving7d} window={t.next7} />
              <KpiCard href={link('/dashboard', { view: 'awaiting' })} icon="inbox" label={t.inbox} value={k.inboxWaiting30d} window={`${t.notReplied} · ${t.last30}`} />
              <KpiCard href={link('/dashboard', { view: 'urgent' })} icon="flag" label={t.urgent} value={k.urgentHighWaiting30d} window={t.last30} attention={k.urgentHighWaiting30d > 0} />
              <KpiCard href={link('/analytics')} icon="clock" label={t.avgReply} value={k.avgReplyMinutes30d == null ? '—' : formatMinutes(k.avgReplyMinutes30d)} window={k.avgReplyMinutes30d == null ? `${t.noReplies} · ${t.last30}` : t.last30} />
              <KpiCard href={`${link('/shipments')}#suggestions`} icon="sparkle" label={t.suggestions} value={k.aiSuggestions} window={t.yours} />
            </section>

            {/* Secondary row */}
            <section aria-label="Pipeline" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              <KpiSmall href={link('/shipments', { status: 'booked' })} label={t.bookings} value={k.bookings} />
              <KpiSmall href={link('/shipments', { status: 'in_transit' })} label={t.inTransit} value={k.inTransit} />
              <KpiSmall href={link('/shipments', { status: 'at_destination' })} label={t.atDest} value={k.atDestination} />
              <KpiSmall href={link('/quotes', { status: 'sent' })} label={t.quotes} value={k.quotesAwaiting.count} extra={quoteValue || undefined} />
              <KpiSmall href={link('/rates', { filter: 'expiring' })} label={t.rates} value={k.ratesExpiring30d} window={t.next30} />
            </section>

            {/* Suggestions strip */}
            <section aria-label={t.sugTitle} className="mt-4 rounded-fw-card border border-app-line bg-app-panel">
              <div className="flex items-center justify-between gap-3 border-b border-app-line px-4 py-2.5">
                <p className="flex items-center gap-2 text-app-ui font-semibold">
                  <Tag tone="info">Review</Tag> {t.sugTitle}
                  <span className="font-fw-mono text-app-mono text-app-ink-3">{k.aiSuggestions}</span>
                </p>
                {k.aiSuggestions > 3 && (
                  <Link href={`${link('/shipments')}#suggestions`} className="inline-flex items-center gap-1 text-app-ui-sm font-medium text-app-accent hover:underline">
                    {t.reviewAll} · <span className="font-fw-mono">{k.aiSuggestions}</span> <Icon name="arrow-right" size={13} />
                  </Link>
                )}
              </div>
              {data.suggestions.length === 0 ? (
                <p className="px-4 py-3 text-app-ui-sm text-app-ink-3">{t.noSug}</p>
              ) : (
                <ul className="divide-y divide-app-line">
                  {data.suggestions.map(s => (
                    <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
                        <Tag tone={s.isUpdate ? 'accent' : 'info'}>{s.isUpdate ? `${t.statusUpdate} → ${STATUS_LABEL[s.status] || s.status}` : t.newShipment}</Tag>
                        <p className="min-w-0 truncate text-app-ui">
                          <span className="font-fw-mono text-app-mono font-medium">{s.reference || '—'}</span>
                          <span className="text-app-ink-3"> · </span>{s.customer || '—'}
                          <span className="text-app-ink-3"> · </span><span className="text-app-ink-2">{s.origin || '—'} → {s.destination || '—'}</span>
                          {s.originCode && s.destinationCode && <span className="ml-2 font-fw-mono text-app-mono-xs text-app-ink-3">{s.originCode} → {s.destinationCode}</span>}
                        </p>
                        {s.emailSubject && <p className="truncate text-app-ui-sm italic text-app-ink-3 lg:max-w-xs">{t.fromEmail}: “{s.emailSubject}”</p>}
                      </div>
                      <div className="flex flex-none gap-2">
                        <Button variant="primary" size="sm" icon={approving === s.id ? undefined : 'check'} onClick={() => approve(s.id)} disabled={!!approving}>
                          {approving === s.id && <Spinner className="size-3" />}{t.approve}
                        </Button>
                        <ButtonLink href={`${link('/shipments')}#suggestions`} size="sm" icon="edit">{t.edit}</ButtonLink>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Shipment table */}
            <section className="mt-4" aria-label={t.tableTitle}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{t.tableTitle}</p>
                <Link href={link('/shipments')} className="inline-flex items-center gap-1 text-app-ui-sm font-medium text-app-accent hover:underline">
                  {t.viewAll} <Icon name="arrow-right" size={13} />
                </Link>
              </div>
              {data.shipments.length === 0 ? (
                <div className="rounded-fw-card border border-app-line bg-app-card">
                  <EmptyState icon="tracking" title={t.emptyShip} text={t.emptyShipText}
                    action={<ButtonLink href={link('/shipments')} icon="arrow-right">{t.viewAll}</ButtonLink>} />
                </div>
              ) : (
                <DataTable label={t.tableTitle}>
                  <thead className="border-b border-app-line">
                    <tr>
                      <th scope="col" className={th}>{t.file}</th>
                      <th scope="col" className={th}>{t.route}</th>
                      <th scope="col" className={th}>{t.mode}</th>
                      <th scope="col" className={th}>{t.status}</th>
                      <th scope="col" className={th}>{t.eta}</th>
                      <th scope="col" className={`${th} hidden lg:table-cell`}>{t.customer}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shipments.map(r => (
                      <tr key={r.id} className={`${tr} cursor-pointer hover:bg-app-raised`} onClick={() => router.push(link('/shipments'))}>
                        <th scope="row" className={`${tdMono} text-left font-normal`}>
                          <Link href={link('/shipments')} className="hover:underline" onClick={e => e.stopPropagation()}>{r.reference || '—'}</Link>
                        </th>
                        <td className={`${td} max-w-xs`}><RouteCell r={r} /></td>
                        <td className={td}>
                          <span className="flex items-center gap-1.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-2">
                            <Icon name={MODE_ICON[r.mode] || 'container'} size={15} className="text-app-ink-3" />{r.mode || '—'}
                          </span>
                        </td>
                        <td className={td}><Tag tone={shipmentTone(r.status)}>{STATUS_LABEL[r.status] || r.status}</Tag></td>
                        <td className={tdMono}>{r.eta || '—'}</td>
                        <td className={`${td} hidden text-app-ink-2 lg:table-cell`}>{r.customer || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
