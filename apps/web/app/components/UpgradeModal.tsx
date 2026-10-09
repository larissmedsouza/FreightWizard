'use client';

import { useState } from 'react';
import { PLANS, SALES_CONTACT } from '../lib/plans';
import Icon, { type IconName } from './ui/Icon';
import { Button, Spinner, buttonClass } from './ui/Button';
import { Tag } from './ui/Tag';

import { API_URL } from '@/app/lib/api';

export type UpgradeReason = 'trial_expired' | 'trial_limit' | 'analyses_limit' | 'shipments_limit' | 'quotes_limit' | 'documents_blocked';

const REASON_COPY: Record<UpgradeReason, { icon: IconName; title: string }> = {
  trial_expired: { icon: 'clock', title: 'Your free trial has ended' },
  trial_limit: { icon: 'analytics', title: "You've used all 30 trial analyses" },
  analyses_limit: { icon: 'mail', title: 'Monthly analysis limit reached' },
  shipments_limit: { icon: 'tracking', title: 'Active shipment limit reached' },
  quotes_limit: { icon: 'quote', title: 'Quote limit reached' },
  documents_blocked: { icon: 'lock', title: 'Document Intelligence requires Professional' },
};

interface UpgradeModalProps {
  reason: UpgradeReason;
  session: string | null;
  darkMode: boolean;
  onLogout?: () => void;
}

/** Blocking plan picker. Renders inside the page root, so it follows the page's data-theme. */
export default function UpgradeModal({ reason, session, onLogout }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const copy = REASON_COPY[reason];

  const choosePlan = async (planKey: string) => {
    if (!session) return;
    setLoadingPlan(planKey);
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout?session=${session}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoadingPlan(null);
  };

  const logout = () => {
    if (onLogout) { onLogout(); return; }
    try { localStorage.removeItem('fw_session'); } catch {}
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4" onClick={e => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="upgrade-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-fw-card border border-app-line bg-app-card font-fw-sans text-app-ink shadow-app-pop">
        <div className="px-6 pb-4 pt-8 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
            <Icon name={copy.icon} size={20} />
          </span>
          <h2 id="upgrade-title" className="font-fw-display text-app-title-sm font-normal">{copy.title}</h2>
          <p className="mt-1 text-app-ui text-app-ink-2">Choose a plan to continue using Freightwizard</p>
        </div>

        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.key} className={`flex flex-col rounded-fw-card border p-4 ${p.popular ? 'border-app-accent-fill' : 'border-app-line'}`}>
              <div className="mb-2 h-5">{p.popular && <Tag tone="accent">Most popular</Tag>}</div>
              <p className="text-app-ui font-semibold">{p.name}</p>
              <p className="mb-1 font-fw-display text-app-kpi font-normal">{p.priceLabel ?? `$${p.price}`}<span className="font-fw-mono text-app-mono-xs text-app-ink-3">/mo</span></p>
              <p className="mb-4 text-app-ui-sm text-app-ink-2">{p.users}</p>
              {p.contactSales ? (
                <a href={SALES_CONTACT} className={buttonClass('secondary', 'md', 'mt-auto w-full')}>Contact sales</a>
              ) : (
                <Button variant={p.popular ? 'primary' : 'secondary'} className="mt-auto w-full" onClick={() => choosePlan(p.key)} disabled={loadingPlan === p.key}>
                  {loadingPlan === p.key ? <><Spinner className="size-3.5" /> Loading...</> : 'Choose this plan'}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="pb-6 text-center">
          <button onClick={logout} className="text-app-ui-sm text-app-ink-2 hover:underline">Log out</button>
        </div>
      </div>
    </div>
  );
}
