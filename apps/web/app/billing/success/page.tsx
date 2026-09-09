'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { PLAN_LABELS } from '../../lib/plans';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

export default function BillingSuccessPage() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    const t = setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 } }), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sid = typeof window !== 'undefined' ? localStorage.getItem('fw_session') : null;
    setSession(sid);
    if (sid) {
      fetch(`${API_URL}/api/billing/subscription?session=${sid}`).then(r => r.json()).then(d => { if (d.plan) setPlan(d.plan); });
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { window.location.href = `/dashboard${session ? `?session=${session}` : ''}`; }, 5000);
    return () => clearTimeout(t);
  }, [session]);

  const planLabel = plan ? PLAN_LABELS[plan as keyof typeof PLAN_LABELS] || plan : 'Pro';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510] text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Welcome to FreightWizard {planLabel}!</h1>
        <p className="text-gray-400 mb-6">Your subscription is now active</p>
        <a href={`/dashboard${session ? `?session=${session}` : ''}`}
          className="inline-block px-6 py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium">
          Go to Dashboard
        </a>
        <p className="text-xs text-gray-500 mt-4">Redirecting automatically in a few seconds...</p>
      </div>
    </div>
  );
}
