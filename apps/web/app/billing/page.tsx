'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PLANS, PLAN_LABELS } from '../lib/plans';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

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

const STATUS_BADGE: Record<string, string> = {
  trialing: 'bg-[#9E14FB]/20 text-[#9E14FB]',
  active: 'bg-green-500/20 text-green-400',
  past_due: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  expired: 'bg-red-500/20 text-red-400',
};

function barColor(pct: number) {
  if (pct > 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('fw_theme') : null;
    if (savedTheme) setDarkMode(savedTheme === 'dark');

    const sid = searchParams.get('session') || (typeof window !== 'undefined' ? localStorage.getItem('fw_session') : null);
    if (!sid) { router.replace('/dashboard'); return; }
    setSession(sid);
  }, [searchParams, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/billing/subscription?session=${session}`).then(r => r.json()).then(d => { if (d.plan) setSub(d); });
    fetch(`${API_URL}/api/billing/usage?session=${session}`).then(r => r.json()).then(d => { if (d.analyses_this_month !== undefined) setUsage(d); });
  }, [session]);

  const theme = darkMode ? {
    bg: 'bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510]',
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/5', text: 'text-white', textMuted: 'text-gray-400', textDim: 'text-gray-500',
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm', cardBorder: 'border-slate-200/50', text: 'text-slate-900', textMuted: 'text-slate-600', textDim: 'text-slate-500',
  };

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

  if (!sub) return <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}><div className="w-8 h-8 border-4 border-[#5200FF] border-t-transparent rounded-full animate-spin" /></div>;

  const isPaid = sub.plan !== 'trial';
  const showUpgrade = sub.plan === 'trial' || sub.plan === 'starter';

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Billing</h1>
          <Link href={`/dashboard?session=${session}`} className={`text-sm ${theme.textMuted} hover:underline`}>← Back to Inbox</Link>
        </div>

        {/* Settings sub-nav */}
        <div className={`flex gap-1 p-1 mb-6 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl w-fit`}>
          <Link href={`/settings/integrations?session=${session}`} className={`px-4 py-1.5 text-sm rounded-lg font-medium ${theme.textMuted} hover:bg-white/5`}>Integrations</Link>
          <span className="px-4 py-1.5 text-sm rounded-lg font-medium bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white">Billing</span>
        </div>

        {/* Current Plan */}
        <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6 mb-4`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className={`text-xs ${theme.textDim} uppercase tracking-wide mb-1`}>Current Plan</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {PLAN_LABELS[sub.plan as keyof typeof PLAN_LABELS] || sub.plan}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[sub.status] || ''}`}>
                  {sub.status === 'past_due' ? 'Past Due' : sub.status[0].toUpperCase() + sub.status.slice(1)}
                </span>
              </p>
            </div>
            {isPaid && (
              <button onClick={openPortal} disabled={portalLoading}
                className={`px-4 py-2 border ${theme.cardBorder} rounded-xl text-sm font-medium hover:bg-white/5 disabled:opacity-50`}>
                {portalLoading ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </div>

          {!isPaid ? (
            <div className="mt-4 space-y-3">
              <p className={`text-sm ${theme.textMuted}`}>{sub.trial_days_remaining} days remaining · {sub.trial_analyses_remaining} analyses remaining</p>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className={theme.textDim}>Days</span><span>{14 - sub.trial_days_remaining}/14</span></div>
                <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${barColor(((14 - sub.trial_days_remaining) / 14) * 100)}`} style={{ width: `${Math.min(100, ((14 - sub.trial_days_remaining) / 14) * 100)}%` }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className={theme.textDim}>Analyses</span><span>{sub.trial_analyses_used}/30</span></div>
                <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${barColor((sub.trial_analyses_used / 30) * 100)}`} style={{ width: `${Math.min(100, (sub.trial_analyses_used / 30) * 100)}%` }} /></div>
              </div>
            </div>
          ) : (
            <p className={`mt-3 text-sm ${theme.textMuted}`}>
              {sub.cancel_at_period_end ? 'Cancels on ' : 'Renews on '}
              {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
            </p>
          )}
        </div>

        {/* Usage */}
        <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6 mb-4`}>
          <p className="font-semibold mb-3">Usage</p>
          {isPaid && sub.plan !== 'starter' ? (
            <div className="flex gap-2 flex-wrap">
              {['Analyses', 'Shipments', 'Quotes'].map(label => (
                <span key={label} className="text-xs px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 font-medium">{label}: Unlimited</span>
              ))}
            </div>
          ) : usage ? (
            <div className="space-y-3">
              {[
                { label: sub.plan === 'trial' ? 'Analyses' : 'Analyses this month', used: sub.plan === 'trial' ? sub.trial_analyses_used : usage.analyses_this_month, max: sub.plan === 'trial' ? 30 : 200 },
                { label: sub.plan === 'trial' ? 'Shipments' : 'Active shipments', used: usage.active_shipments, max: sub.plan === 'trial' ? 5 : 10 },
                { label: sub.plan === 'trial' ? 'Quotes' : 'Quotes this month', used: usage.quotes_this_month, max: sub.plan === 'trial' ? 5 : 20 },
              ].map(row => {
                const pct = Math.min(100, (row.used / row.max) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1"><span className={theme.textDim}>{row.label}</span><span>{row.used}/{row.max}</span></div>
                    <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p className={`text-sm ${theme.textDim}`}>Loading...</p>}
        </div>

        {/* Upgrade */}
        {showUpgrade && (
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6 mb-4`}>
            <p className="font-semibold mb-3">Upgrade your plan</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {PLANS.filter(p => p.key !== sub.plan).map(p => (
                <div key={p.key} className={`rounded-xl border ${p.popular ? 'border-[#9E14FB]/60' : theme.cardBorder} p-4`}>
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-xl font-bold">${p.price}<span className={`text-xs font-normal ${theme.textDim}`}>/mo</span></p>
                  <button onClick={() => upgrade(p.key)} disabled={checkoutLoading === p.key}
                    className="w-full mt-3 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-lg text-white text-xs font-medium disabled:opacity-50">
                    {checkoutLoading === p.key ? 'Loading...' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className={`text-center text-xs ${theme.textDim}`}>🔒 Powered by Stripe</p>
      </div>
    </div>
  );
}
