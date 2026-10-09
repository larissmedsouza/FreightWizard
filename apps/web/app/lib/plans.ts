// Shared pricing/plan data used by the Pricing page, Billing page, and
// UpgradeModal — kept in one place so the three don't drift out of sync.

export type PlanKey = 'trial' | 'starter' | 'professional' | 'enterprise';

export interface Plan {
  key: PlanKey;
  name: string;
  price: number; // monthly USD, 0 for trial
  popular?: boolean;
  users: string;
  /** Shown instead of the numeric price, e.g. 'From $399' */
  priceLabel?: string;
  /** Sales-led plan: show Contact sales instead of a Stripe checkout */
  contactSales?: boolean;
  features: { label: string; included: boolean }[];
}

// Sales address (confirmed 2026-10-09). Used by every Contact sales button
// (landing, /pricing, Billing, upgrade modal).
export const SALES_CONTACT = 'mailto:sales@freightwizard.app';

export const PLANS: Plan[] = [
  {
    key: 'starter', name: 'Starter', price: 79, users: '1 user',
    features: [
      { label: '200 AI email analyses/month', included: true },
      { label: '10 active shipments', included: true },
      { label: '20 quotes/month', included: true },
      { label: 'Quote builder + customer portal', included: true },
      { label: 'Rate card storage', included: true },
      { label: 'Document intelligence', included: false },
      { label: 'Team leaderboard', included: false },
      { label: 'Email support', included: true },
    ],
  },
  {
    key: 'professional', name: 'Professional', price: 179, popular: true, users: 'Up to 5 users',
    features: [
      { label: 'Unlimited AI email analyses', included: true },
      { label: 'Unlimited shipments', included: true },
      { label: 'Unlimited quotes', included: true },
      { label: 'Rate card storage', included: true },
      { label: 'Document intelligence', included: true },
      { label: 'Team leaderboard', included: true },
      { label: 'Priority support', included: true },
    ],
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 399, priceLabel: 'From $399', contactSales: true, users: '10 users included, extra seats by contract',
    features: [
      { label: 'Everything in Professional', included: true },
      { label: 'Container tracking (coming soon)', included: true },
      { label: 'Dedicated support', included: true },
    ],
  },
];

export const PLAN_LABELS: Record<PlanKey, string> = {
  trial: 'Free Trial', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
};

export function planByKey(key: string | undefined): Plan | undefined {
  return PLANS.find(p => p.key === key);
}
