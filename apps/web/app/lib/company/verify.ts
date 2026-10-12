// Hook for checking identifiers against the official registers (EU tools,
// BACKLOG.md): VIES for EU VAT numbers, the EU EORI service, HMRC for GB EORI.
//
// Nothing is registered yet. To add a check:
//   1. Add an API endpoint that calls the register, e.g. POST /api/verify/vies.
//   2. Register it here: VERIFIERS.vies = (value, country, session) => ...
// Fields whose `check` (rules.ts) has a registered verifier get a "Check"
// button in the Company Profile. The result is stored with the profile
// (company_profiles.verifications["NL.vat"]) and dropped by the API when the
// number changes, so a stale result never shows next to a new number.
import type { CheckKind } from './rules';

/** Three states, as decided for the EU tools badges. */
export interface VerifyResult {
  status: 'valid' | 'invalid' | 'unavailable';
  /** Name and address returned by the register, when it gives them. */
  name?: string;
  address?: string;
  checkedAt: string;
  source: CheckKind;
}

export type Verifier = (value: string, country: string, session: string) => Promise<VerifyResult>;

export const VERIFIERS: Partial<Record<CheckKind, Verifier>> = {};

/** Key under which a field's last check result is stored. */
export const verificationKey = (country: string, fieldKey: string) => `${country}.${fieldKey}`;
