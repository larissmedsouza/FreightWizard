'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PLANS } from '../lib/plans';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes, cancel from your billing page anytime. No questions asked.' },
  { q: 'What happens after 14 days?', a: 'Your account will be locked until you choose a plan. Your data is safe.' },
  { q: 'Do I need a credit card for the trial?', a: 'No credit card required to start your free trial.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Yes, you can change plans anytime from your billing page.' },
  { q: 'Do you offer refunds?', a: "We offer a 7-day refund on your first payment if you're not satisfied." },
];

const ALL_FEATURES = [
  'AI email analyses', 'Active shipments', 'Quotes', 'Quote builder + customer portal',
  'Rate card storage', 'Document intelligence', 'Team leaderboard', 'Support level',
];

const FEATURE_MATRIX: Record<string, [string, string, string]> = {
  'AI email analyses': ['200/month', 'Unlimited', 'Unlimited'],
  'Active shipments': ['10', 'Unlimited', 'Unlimited'],
  'Quotes': ['20/month', 'Unlimited', 'Unlimited'],
  'Quote builder + customer portal': ['✓', '✓', '✓'],
  'Rate card storage': ['✓', '✓', '✓'],
  'Document intelligence': ['✗', '✓', '✓'],
  'Team leaderboard': ['✗', '✓', '✓'],
  'Support level': ['Email', 'Priority', 'Dedicated'],
};

export default function PricingPage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const sid = searchParams.get('session') || (typeof window !== 'undefined' ? localStorage.getItem('fw_session') : null);
    if (sid) {
      setSession(sid);
      fetch(`${API_URL}/api/billing/subscription?session=${sid}`)
        .then(r => r.json())
        .then(d => { if (d.plan) setCurrentPlan(d.plan); })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleChoose = async (planKey: string) => {
    if (!session) { window.location.href = '/dashboard'; return; }
    if (currentPlan === 'trial' || !currentPlan) {
      setLoadingPlan(planKey);
      try {
        const res = await fetch(`${API_URL}/api/billing/create-checkout?session=${session}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planKey }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } catch {}
      setLoadingPlan(null);
    } else if (currentPlan !== planKey) {
      setLoadingPlan(planKey);
      try {
        const res = await fetch(`${API_URL}/api/billing/create-portal?session=${session}`, { method: 'POST' });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } catch {}
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510] text-white">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className="h-6 w-6 object-contain" />
          <span className="font-bold">FreightWizard</span>
        </Link>
        {session ? (
          <Link href={`/billing?session=${session}`} className="text-sm text-gray-400 hover:text-white">Billing</Link>
        ) : (
          <Link href="/dashboard" className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium">Start Free Trial</Link>
        )}
      </header>

      {/* Hero */}
      <div className="text-center px-6 pt-12 pb-10 max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-gray-400 text-lg">Start free for 14 days — no credit card required</p>

        <div className="inline-flex items-center gap-3 mt-8 p-1 bg-white/5 rounded-full">
          <button onClick={() => setAnnual(false)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${!annual ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : 'text-gray-400'}`}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-2 ${annual ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : 'text-gray-400'}`}>
            Annual <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Save 2 months</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-6 grid sm:grid-cols-3 gap-5 mb-16">
        {PLANS.map(p => {
          const price = annual ? p.price * 10 : p.price;
          const isCurrent = currentPlan === p.key;
          return (
            <div key={p.key} className={`relative rounded-2xl border p-6 flex flex-col ${p.popular ? 'border-[#9E14FB]/60 bg-[#9E14FB]/5' : 'border-white/10 bg-white/[0.02]'}`}>
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white">
                  MOST POPULAR
                </span>
              )}
              <h3 className="font-bold text-lg mt-2">{p.name}</h3>
              <p className="text-3xl font-bold mt-2">${price}<span className="text-sm font-normal text-gray-400">/{annual ? 'year' : 'mo'}</span></p>
              <p className="text-sm text-gray-400 mb-4">{p.users}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map(f => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    <span className={f.included ? 'text-green-400' : 'text-gray-600'}>{f.included ? '✓' : '✗'}</span>
                    <span className={f.included ? 'text-gray-200' : 'text-gray-500'}>{f.label}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/10 text-gray-400 cursor-not-allowed">Current Plan</button>
              ) : !session ? (
                <Link href="/dashboard" className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white text-center block">
                  Start Free Trial
                </Link>
              ) : (
                <button onClick={() => handleChoose(p.key)} disabled={loadingPlan === p.key}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white disabled:opacity-50">
                  {loadingPlan === p.key ? 'Loading...' : currentPlan && currentPlan !== 'trial' ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="max-w-5xl mx-auto px-6 mb-16 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4 text-center">Compare all features</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="text-left py-3 font-medium">Feature</th>
              <th className="text-center py-3 font-medium">Starter</th>
              <th className="text-center py-3 font-medium">Professional</th>
              <th className="text-center py-3 font-medium">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {ALL_FEATURES.map(f => (
              <tr key={f} className="border-b border-white/5">
                <td className="py-3 text-gray-300">{f}</td>
                {FEATURE_MATRIX[f].map((v, i) => (
                  <td key={i} className={`py-3 text-center ${v === '✓' ? 'text-green-400' : v === '✗' ? 'text-gray-600' : 'text-gray-200'}`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-bold mb-6 text-center">Frequently asked questions</h2>
        <div className="space-y-4">
          {FAQS.map(f => (
            <div key={f.q} className="border border-white/10 rounded-xl p-4">
              <p className="font-semibold text-sm mb-1">{f.q}</p>
              <p className="text-sm text-gray-400">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
