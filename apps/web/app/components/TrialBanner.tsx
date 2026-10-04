'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './ui/Icon';
import { toneClass, type Tone } from './ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface Subscription {
  plan: string;
  status: string;
  trial_days_remaining: number;
  trial_analyses_remaining: number;
}

/** Thin status strip under the top bar. Tone carries the urgency; text is always readable (>= 5.3:1). */
function Strip({ tone, icon, children, action, onDismiss }: { tone: Tone; icon: 'alert' | 'info' | 'clock'; children: React.ReactNode; action: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 border-b border-app-line px-4 py-2 font-fw-sans text-app-ui-sm ${toneClass[tone].tag}`}>
      <Icon name={icon} size={15} />
      <span className="font-medium">{children}</span>
      {action}
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

const linkClass = 'inline-flex h-7 items-center gap-1 rounded-fw-btn border border-app-line-strong px-2.5 font-medium hover:bg-app-card/40';

export default function TrialBanner({ session, onSubscription }: { session: string | null; onSubscription?: (sub: Subscription) => void }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session) return;
    try { setDismissed(sessionStorage.getItem('fw_trial_banner_dismissed') === 'true'); } catch {}
    fetch(`${API_URL}/api/billing/subscription?session=${session}`)
      .then(r => r.json())
      .then(d => { if (d.plan) { setSub(d); onSubscription?.(d); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!sub || sub.plan !== 'trial') return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('fw_trial_banner_dismissed', 'true'); } catch {}
  };

  const choosePlan = (
    <Link href={`/pricing?session=${session}`} className={linkClass}>
      Choose a plan <Icon name="arrow-right" size={13} />
    </Link>
  );

  if (sub.status === 'expired') {
    return <Strip tone="danger" icon="alert" action={choosePlan}>Your free trial has ended — choose a plan to continue</Strip>;
  }

  if (dismissed) return null;

  const warning = sub.trial_days_remaining < 3 || sub.trial_analyses_remaining < 5;

  return (
    <Strip tone={warning ? 'warn' : 'accent'} icon={warning ? 'alert' : 'clock'} action={choosePlan} onDismiss={dismiss}>
      Free trial — <span className="font-fw-mono">{sub.trial_days_remaining}</span> day{sub.trial_days_remaining === 1 ? '' : 's'} and{' '}
      <span className="font-fw-mono">{sub.trial_analyses_remaining}</span> analys{sub.trial_analyses_remaining === 1 ? 'is' : 'es'} remaining
    </Strip>
  );
}
