'use client';

import { useState } from 'react';
import { PLANS } from '../lib/plans';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

export type UpgradeReason = 'trial_expired' | 'trial_limit' | 'analyses_limit' | 'shipments_limit' | 'quotes_limit' | 'documents_blocked';

const REASON_COPY: Record<UpgradeReason, { icon: string; title: string }> = {
  trial_expired: { icon: '⏰', title: 'Your free trial has ended' },
  trial_limit: { icon: '📊', title: "You've used all 30 trial analyses" },
  analyses_limit: { icon: '📧', title: 'Monthly analysis limit reached' },
  shipments_limit: { icon: '🚢', title: 'Active shipment limit reached' },
  quotes_limit: { icon: '📋', title: 'Quote limit reached' },
  documents_blocked: { icon: '🔒', title: 'Document Intelligence requires Professional' },
};

interface UpgradeModalProps {
  reason: UpgradeReason;
  session: string | null;
  darkMode: boolean;
  onLogout?: () => void;
}

export default function UpgradeModal({ reason, session, darkMode, onLogout }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const copy = REASON_COPY[reason];

  const theme = darkMode ? {
    card: 'bg-[#0a0a1a]', cardBorder: 'border-white/10', text: 'text-white', textMuted: 'text-gray-400',
  } : {
    card: 'bg-white', cardBorder: 'border-slate-200', text: 'text-slate-900', textMuted: 'text-slate-600',
  };

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
      <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="text-center px-6 pt-8 pb-4">
          <div className="text-4xl mb-3">{copy.icon}</div>
          <h2 className={`text-xl font-bold ${theme.text}`}>{copy.title}</h2>
          <p className={`text-sm ${theme.textMuted} mt-1`}>Choose a plan to continue using FreightWizard</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 px-6 pb-6">
          {PLANS.map(p => (
            <div key={p.key} className={`rounded-xl border ${p.popular ? 'border-[#9E14FB]/60' : theme.cardBorder} p-4 flex flex-col`}>
              {p.popular && <span className="text-[10px] font-semibold text-[#9E14FB] mb-1">MOST POPULAR</span>}
              <p className={`font-bold ${theme.text}`}>{p.name}</p>
              <p className={`text-2xl font-bold ${theme.text} mb-1`}>${p.price}<span className={`text-xs font-normal ${theme.textMuted}`}>/mo</span></p>
              <p className={`text-xs ${theme.textMuted} mb-3`}>{p.users}</p>
              <button onClick={() => choosePlan(p.key)} disabled={loadingPlan === p.key}
                className="mt-auto w-full py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium disabled:opacity-50">
                {loadingPlan === p.key ? 'Loading...' : 'Choose this plan'}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center pb-6">
          <button onClick={logout} className={`text-xs ${theme.textMuted} hover:underline`}>Log out</button>
        </div>
      </div>
    </div>
  );
}
