'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PLANS, SALES_CONTACT } from '../lib/plans';
import { ButtonLink, buttonClass } from '../components/marketing/Button';
import { SectionHeader } from '../components/marketing/Section';
import FwIcon from '../components/ui/Icon';
import RevealObserver from '../components/marketing/RevealObserver';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes, cancel from your billing page anytime. No questions asked.' },
  { q: 'What happens after 14 days?', a: 'Your account will be locked until you choose a plan. Your data is safe.' },
  { q: 'Do I need a credit card for the trial?', a: 'No credit card required to start your free trial.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Yes, you can change plans anytime from your billing page.' },
  { q: 'Do you have a plan for larger teams?', a: 'Yes. Enterprise starts from $399/month with 10 users included; extra seats are arranged by contract. Contact sales to set it up.' },
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

  const statusTag = 'rounded-fw-btn bg-fw-indigo-tint px-2 py-0.5 font-fw-mono text-fw-data-xs uppercase text-fw-indigo-200';
  const yes = <><FwIcon name="check" size={16} className="text-fw-indigo-300" /><span className="sr-only">Included</span></>;
  const no = <><FwIcon name="minus" size={16} className="text-fw-ink-3" /><span className="sr-only">Not included</span></>;

  return (
    <div className="min-h-screen bg-fw-canvas font-fw-sans text-fw-body text-fw-ink antialiased selection:bg-fw-indigo-500 selection:text-fw-white [&_:focus-visible]:rounded-[2px] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-fw-indigo-300">
      <RevealObserver />
      <header className="border-b border-fw-line bg-fw-canvas">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-10">
          <Link href="/" className="flex items-center">
            <img src="/icons/freightwizard_logo_white.png" alt="FreightWizard" className="h-7 w-auto" />
          </Link>
          {session ? (
            <Link href={`/billing?session=${session}`} className="text-fw-small text-fw-ink-2 transition-colors hover:text-fw-ink">Billing</Link>
          ) : (
            <ButtonLink href="/dashboard">Start Free Trial</ButtonLink>
          )}
        </div>
      </header>

      {/* Hero */}
      <section aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 pb-10 pt-16 md:px-10 md:pt-24">
        <SectionHeader id="pricing-title" eyebrow="Pricing" title="Simple, transparent pricing" intro={<p>Start free for 14 days — no credit card required</p>} />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div role="group" aria-label="Billing period" className="inline-flex rounded-fw-btn border border-fw-line bg-fw-panel p-1">
            {[{ label: 'Monthly', value: false }, { label: 'Annual', value: true }].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={annual === opt.value}
                onClick={() => setAnnual(opt.value)}
                className={`min-h-[2.25rem] rounded-[2px] px-4 text-fw-small transition-colors ${annual === opt.value ? 'bg-fw-raised text-fw-ink' : 'text-fw-ink-3 hover:text-fw-ink'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className={statusTag}>Save 2 months</span>
        </div>
      </section>

      {/* Plan cards */}
      <section aria-label="Plans" className="mx-auto mb-16 grid max-w-5xl items-stretch gap-4 px-4 md:grid-cols-3 md:gap-6 md:px-10">
        {PLANS.map(p => {
          const price = annual ? p.price * 10 : p.price;
          const isCurrent = currentPlan === p.key;
          return (
            <div key={p.key} className={`flex flex-col rounded-fw-card border bg-fw-panel p-6 ${p.popular ? 'border-fw-indigo-500 shadow-fw-frame' : 'border-fw-line'}`}>
              {/* Tag row reserved on every card from md up so prices line up */}
              <div className={`mb-3 h-5 ${p.popular ? '' : 'hidden md:block'}`}>
                {p.popular && <span className={statusTag}>MOST POPULAR</span>}
              </div>
              <h3 className="font-fw-display text-fw-h3 font-semibold text-fw-ink">{p.name}</h3>
              <div className="mb-2 mt-4 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-fw-display text-fw-price font-semibold text-fw-ink">{p.priceLabel ?? `$${price}`}</span>
                <span className="font-fw-mono text-fw-data text-fw-ink-3">/{p.priceLabel || !annual ? 'mo' : 'year'}</span>
              </div>
              <p className="mb-6 text-fw-small text-fw-ink-2">{p.users}</p>

              <ul className="mb-6 flex-1 space-y-3 border-t border-fw-line pt-5">
                {p.features.map(f => (
                  <li key={f.label} className={`flex items-start gap-2.5 font-fw-mono text-fw-data ${f.included ? 'text-fw-ink-2' : 'text-fw-ink-3'}`}>
                    <span className="mt-[3px] flex flex-none">{f.included ? yes : no}</span>
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              {p.contactSales && !isCurrent ? (
                <a href={SALES_CONTACT} className={buttonClass(p.popular ? 'primary' : 'secondary', 'mt-auto w-full')}>Contact Sales</a>
              ) : isCurrent ? (
                <button disabled className={buttonClass('secondary', 'mt-auto w-full cursor-not-allowed text-fw-ink-3 hover:border-fw-line-strong hover:bg-transparent')}>Current Plan</button>
              ) : !session ? (
                <ButtonLink href="/dashboard" variant={p.popular ? 'primary' : 'secondary'} className="mt-auto w-full">
                  Start Free Trial
                </ButtonLink>
              ) : (
                <button onClick={() => handleChoose(p.key)} disabled={loadingPlan === p.key}
                  className={buttonClass(p.popular ? 'primary' : 'secondary', 'mt-auto w-full disabled:cursor-wait disabled:opacity-60')}>
                  {loadingPlan === p.key ? 'Loading...' : currentPlan && currentPlan !== 'trial' ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Comparison table */}
      <section aria-labelledby="compare-title" className="border-t border-fw-line">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-10 md:py-20">
          <SectionHeader id="compare-title" eyebrow="Plans" title="Compare all features" className="mb-8" />
          <div className="overflow-x-auto rounded-fw-card border border-fw-line" role="region" aria-label="Feature comparison" tabIndex={0}>
            <table className="w-full min-w-[34rem] border-collapse text-fw-small">
              <thead>
                <tr className="border-b border-fw-line bg-fw-panel">
                  <th scope="col" className="px-4 py-3 text-left font-fw-mono text-fw-data-xs font-normal uppercase text-fw-ink-3">Feature</th>
                  <th scope="col" className="px-4 py-3 text-center font-fw-mono text-fw-data-xs font-normal uppercase text-fw-ink-3">Starter</th>
                  <th scope="col" className="px-4 py-3 text-center font-fw-mono text-fw-data-xs font-normal uppercase text-fw-indigo-300">Professional</th>
                  <th scope="col" className="px-4 py-3 text-center font-fw-mono text-fw-data-xs font-normal uppercase text-fw-ink-3">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURES.map(f => (
                  <tr key={f} className="border-b border-fw-line last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal text-fw-ink-2">{f}</th>
                    {FEATURE_MATRIX[f].map((v, i) => (
                      <td key={i} className="px-4 py-3 text-center font-fw-mono text-fw-data text-fw-ink">
                        {v === '✓' || v === '✗' ? <span className="inline-flex">{v === '✓' ? yes : no}</span> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="border-t border-fw-line">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-10 md:py-20">
          <SectionHeader id="faq-title" eyebrow="FAQ" title="Frequently asked questions" className="mb-8" />
          <div className="divide-y divide-fw-line rounded-fw-card border border-fw-line bg-fw-panel">
            {FAQS.map(f => (
              <div key={f.q} className="p-5">
                <h3 className="mb-1 font-fw-display text-fw-body font-semibold text-fw-ink">{f.q}</h3>
                <p className="text-fw-small text-fw-ink-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
