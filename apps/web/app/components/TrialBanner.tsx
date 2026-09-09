'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

interface Subscription {
  plan: string;
  status: string;
  trial_days_remaining: number;
  trial_analyses_remaining: number;
}

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

  if (sub.status === 'expired') {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm flex-wrap">
        <span className="font-medium">Your free trial has ended — choose a plan to continue</span>
        <Link href={`/pricing?session=${session}`} className="px-3 py-1 bg-white text-red-600 rounded-full text-xs font-semibold hover:bg-red-50">
          Choose a plan →
        </Link>
      </div>
    );
  }

  if (dismissed) return null;

  const warning = sub.trial_days_remaining < 3 || sub.trial_analyses_remaining < 5;

  return (
    <div className={`px-4 py-2.5 flex items-center justify-center gap-3 text-sm flex-wrap text-white ${
      warning ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF]'
    }`}>
      <span className="font-medium">
        {warning ? '⚠️' : '🎉'} Free trial — {sub.trial_days_remaining} day{sub.trial_days_remaining === 1 ? '' : 's'} and {sub.trial_analyses_remaining} analys{sub.trial_analyses_remaining === 1 ? 'is' : 'es'} remaining
      </span>
      <Link href={`/pricing?session=${session}`} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold">
        Choose a plan →
      </Link>
      <button onClick={dismiss} className="text-white/70 hover:text-white text-xs ml-1" aria-label="Dismiss">✕</button>
    </div>
  );
}
