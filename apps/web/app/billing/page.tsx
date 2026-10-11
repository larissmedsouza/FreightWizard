'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PLANS, PLAN_LABELS, SALES_CONTACT } from '../lib/plans';
import Icon, { type IconName } from '../components/ui/Icon';
import TopBar from '../components/ui/TopBar';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import SettingsTabs from '../components/ui/SettingsTabs';
import { appRootClass, PageHeader, SectionTitle, EmptyState, Notice } from '../components/ui/Panel';
import { Button, ButtonLink, Spinner, buttonClass } from '../components/ui/Button';
import { inputClass, selectClass, textareaClass, Field, DataLabel } from '../components/ui/Field';
import { Tag, Chip } from '../components/ui/Tag';
import { Toast, Stat, Segmented } from '../components/ui/Data';
import { toneClass, priorityTone, type Tone } from '../components/ui/tones';

import { API_URL } from '@/app/lib/api';

interface Subscription {
  plan: string;
  status: string;
  trial_days_remaining: number;
  trial_analyses_remaining: number;
  trial_analyses_used: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Usage {
  analyses_this_month: number;
  quotes_this_month: number;
  active_shipments: number;
}

const STATUS_TONE: Record<string, Tone> = {
  trialing: 'accent', active: 'ok', past_due: 'danger', cancelled: 'neutral', expired: 'danger',
};

function usageTone(pct: number): Tone {
  if (pct > 90) return 'danger';
  if (pct >= 70) return 'warn';
  return 'ok';
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<'en' | 'pt' | 'nl'>('en');
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('fw_theme') : null;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('fw_lang') as 'en' | 'pt' | 'nl' | null : null;
    if (savedLang) setLanguage(savedLang);

    const sid = searchParams.get('session') || (typeof window !== 'undefined' ? localStorage.getItem('fw_session') : null);
    if (!sid) { router.replace('/dashboard'); return; }
    setSession(sid);
  }, [searchParams, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/billing/subscription?session=${session}`).then(r => r.json()).then(d => { if (d.plan) setSub(d); });
    fetch(`${API_URL}/api/billing/usage?session=${session}`).then(r => r.json()).then(d => { if (d.analyses_this_month !== undefined) setUsage(d); });
  }, [session]);


  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const changeLang = (l: 'en' | 'pt' | 'nl') => { setLanguage(l); localStorage.setItem('fw_lang', l); };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/create-portal?session=${session}`, { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setPortalLoading(false);
  };

  const upgrade = async (planKey: string) => {
    setCheckoutLoading(planKey);
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setCheckoutLoading(null);
  };

  if (!sub) return <div data-theme={darkMode ? 'dark' : 'light'} className={`${appRootClass} flex items-center justify-center`}><Spinner className="size-8 text-app-accent" /></div>;

  const isPaid = sub.plan !== 'trial';
  const isInternal = sub.plan === 'internal'; // staff/test account: no limits, no Stripe billing
  const showUpgrade = sub.plan === 'trial' || sub.plan === 'starter';
  const usageBar = (label: string, used: number, max: number) => {
    const pct = Math.min(100, (used / max) * 100);
    return (
      <div key={label}>
        <div className="mb-1 flex justify-between text-app-ui-sm"><span className="text-app-ink-2">{label}</span><span className="font-fw-mono">{used}/{max}</span></div>
        <div className="h-1.5 bg-app-raised" aria-hidden><div className={`h-full ${toneClass[usageTone(pct)].dot}`} style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <TopBar session={session} user={null} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <ButtonLink href={`/dashboard?session=${session}`} variant="ghost" size="xs" icon="arrow-left">Back to Inbox</ButtonLink>
        <PageHeader title="Billing" />

        {/* Settings sub-nav */}
        <SettingsTabs active="billing" session={session} />

        {/* Current Plan */}
        <section className="rounded-fw-card border border-app-line bg-app-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DataLabel className="mb-1">Current Plan</DataLabel>
              <p className="flex items-center gap-2 font-fw-display text-app-title-sm font-normal">
                {isInternal ? 'Internal' : PLAN_LABELS[sub.plan as keyof typeof PLAN_LABELS] || sub.plan}
                <Tag tone={STATUS_TONE[sub.status] || 'neutral'}>{sub.status === 'past_due' ? 'Past Due' : sub.status[0].toUpperCase() + sub.status.slice(1)}</Tag>
              </p>
            </div>
            {isPaid && !isInternal && (
              <Button icon="external" onClick={openPortal} disabled={portalLoading}>{portalLoading ? 'Loading...' : 'Manage Subscription'}</Button>
            )}
          </div>

          {!isPaid ? (
            <div className="mt-4 space-y-3">
              <p className="text-app-ui text-app-ink-2"><span className="font-fw-mono">{sub.trial_days_remaining}</span> days remaining · <span className="font-fw-mono">{sub.trial_analyses_remaining}</span> analyses remaining</p>
              {usageBar('Days', 14 - sub.trial_days_remaining, 14)}
              {usageBar('Analyses', sub.trial_analyses_used, 30)}
            </div>
          ) : isInternal ? (
            <p className="mt-3 text-app-ui text-app-ink-2">Internal account: no plan limits and no billing.</p>
          ) : (
            <p className="mt-3 text-app-ui text-app-ink-2">
              {sub.cancel_at_period_end ? 'Cancels on ' : 'Renews on '}
              <span className="font-fw-mono">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}</span>
            </p>
          )}
        </section>

        {/* Usage */}
        <section className="rounded-fw-card border border-app-line bg-app-card p-5">
          <SectionTitle className="mb-3">Usage</SectionTitle>
          {isPaid && sub.plan !== 'starter' ? (
            <div className="flex flex-wrap gap-2">
              {['Analyses', 'Shipments', 'Quotes'].map(label => <Tag key={label} tone="ok">{label}: Unlimited</Tag>)}
            </div>
          ) : usage ? (
            <div className="space-y-3">
              {usageBar(sub.plan === 'trial' ? 'Analyses' : 'Analyses this month', sub.plan === 'trial' ? sub.trial_analyses_used : usage.analyses_this_month, sub.plan === 'trial' ? 30 : 200)}
              {usageBar(sub.plan === 'trial' ? 'Shipments' : 'Active shipments', usage.active_shipments, sub.plan === 'trial' ? 5 : 10)}
              {usageBar(sub.plan === 'trial' ? 'Quotes' : 'Quotes this month', usage.quotes_this_month, sub.plan === 'trial' ? 5 : 20)}
            </div>
          ) : <p className="flex items-center gap-2 text-app-ui-sm text-app-ink-3"><Spinner className="size-3" /> Loading...</p>}
        </section>

        {/* Upgrade */}
        {showUpgrade && (
          <section className="rounded-fw-card border border-app-line bg-app-card p-5">
            <SectionTitle className="mb-3">Upgrade your plan</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLANS.filter(p => p.key !== sub.plan).map(p => (
                <div key={p.key} className={`flex flex-col rounded-fw-card border p-4 ${p.popular ? 'border-app-accent-fill' : 'border-app-line'}`}>
                  <p className="text-app-ui font-semibold">{p.name}</p>
                  <p className="font-fw-display text-app-kpi font-normal">{p.priceLabel ?? `$${p.price}`}<span className="font-fw-mono text-app-mono-xs text-app-ink-3">/mo</span></p>
                  {p.contactSales ? (
                    <a href={SALES_CONTACT} className={buttonClass('secondary', 'sm', 'mt-3 w-full')}>Contact sales</a>
                  ) : (
                    <Button variant={p.popular ? 'primary' : 'secondary'} size="sm" className="mt-3 w-full" onClick={() => upgrade(p.key)} disabled={checkoutLoading === p.key}>
                      {checkoutLoading === p.key ? 'Loading...' : 'Upgrade'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-app-ui-sm text-app-ink-3"><Icon name="lock" size={13} /> Powered by Stripe</p>
      </main>
    </div>
  );
}
