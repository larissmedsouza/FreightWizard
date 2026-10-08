// Plan rules shared by the billing-aware endpoints. Pure functions, covered by
// billing.test.ts.
//
// Plans: trial, starter, professional, enterprise, plus 'internal' for
// staff/test accounts: no limits, no trial expiry, never upgrade prompts.
// Set it in Supabase:  update subscriptions set plan = 'internal', status = 'active' where user_email = '...';

export const TRIAL_ANALYSES = 30;
export const TRIAL_DAYS = 14;
export const STARTER_MONTHLY_ANALYSES = 200;

export interface Sub { plan: string; status?: string; trial_analyses_used?: number; trial_started_at?: string }

export const isInternal = (sub: Sub | null | undefined) => sub?.plan === 'internal';

export function isTrialExpired(sub: Sub, now: Date = new Date()): boolean {
  if (sub.plan !== 'trial') return false;
  const analysesExpired = (sub.trial_analyses_used || 0) >= TRIAL_ANALYSES;
  const daysExpired = now > new Date(new Date(sub.trial_started_at || now).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return analysesExpired || daysExpired;
}

export function getPlanLimits(plan: string) {
  const unlimited = { analyses: -1, shipments: -1, quotes: -1, users: -1, documents: true, rateCards: true };
  const limits: Record<string, any> = {
    trial: { analyses: TRIAL_ANALYSES, shipments: 5, quotes: 5, users: 1, documents: true, rateCards: true },
    starter: { analyses: STARTER_MONTHLY_ANALYSES, shipments: 10, quotes: 20, users: 1, documents: false, rateCards: true },
    professional: { analyses: -1, shipments: -1, quotes: -1, users: 5, documents: true, rateCards: true },
    enterprise: unlimited,
    internal: unlimited,
  };
  return limits[plan] || limits.trial;
}

/**
 * What an analysis request may do, before any AI call.
 *  - blocked:   refuse with a reason (402 for the frontend)
 *  - trial:     allowed; one trial analysis is charged after a successful result
 *  - monthly:   allowed if the month's count is below the limit (starter)
 *  - unlimited: allowed, nothing to charge (professional, enterprise, internal)
 */
export type AnalysisPolicy =
  | { kind: 'blocked'; reason: 'trial_limit_reached' | 'trial_expired' }
  | { kind: 'trial'; used: number }
  | { kind: 'monthly'; limit: number }
  | { kind: 'unlimited' };

export function analysisPolicy(sub: Sub): AnalysisPolicy {
  if (isInternal(sub)) return { kind: 'unlimited' };
  if (sub.status === 'expired') {
    // The expired flag covers both causes; report the specific one.
    if (sub.plan === 'trial' && (sub.trial_analyses_used || 0) >= TRIAL_ANALYSES) return { kind: 'blocked', reason: 'trial_limit_reached' };
    return { kind: 'blocked', reason: 'trial_expired' };
  }
  if (sub.plan === 'trial') {
    const used = sub.trial_analyses_used || 0;
    return used >= TRIAL_ANALYSES ? { kind: 'blocked', reason: 'trial_limit_reached' } : { kind: 'trial', used };
  }
  if (sub.plan === 'starter') return { kind: 'monthly', limit: STARTER_MONTHLY_ANALYSES };
  return { kind: 'unlimited' };
}
