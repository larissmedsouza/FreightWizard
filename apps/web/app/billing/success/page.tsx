'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { PLAN_LABELS } from '../../lib/plans';
import Icon from '../../components/ui/Icon';
import { appRootClass } from '../../components/ui/Panel';
import { buttonClass } from '../../components/ui/Button';

import { API_URL } from '@/app/lib/api';

export default function BillingSuccessPage() {
  const [session, setSession] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    const t = setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 } }), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('fw_theme') : null;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
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
    <div data-theme={darkMode ? 'dark' : 'light'} className={`${appRootClass} flex items-center justify-center p-6`}>
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-fw-card border border-app-line text-app-ok-ink">
          <Icon name="check" size={24} />
        </span>
        <h1 className="mb-2 font-fw-display text-app-title font-light">Welcome to FreightWizard {planLabel}!</h1>
        <p className="mb-6 text-app-ink-2">Your subscription is now active</p>
        <a href={`/dashboard${session ? `?session=${session}` : ''}`} className={buttonClass('primary', 'lg')}>
          Go to Dashboard
        </a>
        <p className="mt-4 text-app-ui-sm text-app-ink-3">Redirecting automatically in a few seconds...</p>
      </div>
    </div>
  );
}
