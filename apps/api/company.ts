// Company profile: one per company, stored in company_profiles.
//
// Until organizations exist (docs/multi-team-plan.md, phase 1) the company is
// keyed by owner_user_id: the manager of the user's team, or the user when
// they have no team. Phase 1 fills org_id and switches the key; no other
// change is needed here.
//
// Identifiers are stored per country (identifiers.NL.vat, identifiers.BR.cnpj),
// so switching country hides values but never deletes them. A value is only
// removed when the user clears it. Pure logic with an injected database;
// covered by company.test.ts.
import type { Db } from './overview';

export type Identifiers = Record<string, Record<string, string>>;
export interface Address { line1: string; line2: string; postalCode: string; city: string; region: string }

export interface CompanyProfile {
  country: string;
  legalName: string;
  tradeName: string;
  identifiers: Identifiers;
  /** Register checks (VIES, EORI), keyed "NL.vat". Written by the EU tools. */
  verifications: Record<string, unknown>;
  address: Address;
  contactName: string;
  contactEmail: string;
  phoneCountry: string;
  phoneNumber: string;
  updatedAt?: string | null;
}

export interface CompanyProfileRow {
  owner_user_id: string;
  org_id?: string | null;
  country: string;
  legal_name: string | null;
  trade_name: string | null;
  identifiers: Identifiers | null;
  verifications: Record<string, unknown> | null;
  address: Partial<Record<'line1' | 'line2' | 'postal_code' | 'city' | 'region', string>> | null;
  contact_name: string | null;
  contact_email: string | null;
  phone_country: string | null;
  phone_number: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

const COUNTRY = /^[A-Z]{2}$/;
const ID_KEY = /^[a-z][a-z_]{1,19}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export type CleanResult = { ok: true; value: CompanyProfile } | { ok: false; error: string };

/** Validates the shape of a profile sent by the browser (formats are checked in the UI). */
export function cleanProfileInput(body: any): CleanResult {
  const country = str(body?.country, 10).toUpperCase();
  if (!COUNTRY.test(country)) return { ok: false, error: 'country must be an ISO 3166 code such as NL' };

  const identifiers: Identifiers = {};
  for (const [c, fields] of Object.entries(body?.identifiers || {})) {
    if (!COUNTRY.test(c) || !fields || typeof fields !== 'object') return { ok: false, error: `invalid identifiers for ${c}` };
    identifiers[c] = {};
    for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
      if (!ID_KEY.test(k) || typeof v !== 'string') return { ok: false, error: `invalid identifier ${c}.${k}` };
      identifiers[c][k] = v.trim().slice(0, 40);
    }
  }

  const phoneCountry = str(body?.phoneCountry, 10).toUpperCase();
  if (phoneCountry && !COUNTRY.test(phoneCountry)) return { ok: false, error: 'invalid phone country' };
  const phoneNumber = str(body?.phoneNumber, 30);
  if (phoneNumber && !/^[0-9 ()+\-.]+$/.test(phoneNumber)) return { ok: false, error: 'phone number may only contain digits and spaces' };
  const contactEmail = str(body?.contactEmail, 200);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) return { ok: false, error: 'invalid contact email' };

  const a = body?.address || {};
  return {
    ok: true,
    value: {
      country, identifiers, verifications: {},
      legalName: str(body?.legalName, 200), tradeName: str(body?.tradeName, 200),
      address: { line1: str(a.line1, 200), line2: str(a.line2, 200), postalCode: str(a.postalCode, 20), city: str(a.city, 100), region: str(a.region, 100) },
      contactName: str(body?.contactName, 200), contactEmail, phoneCountry, phoneNumber,
    },
  };
}

/**
 * The row to store: incoming identifiers are merged into the stored ones per
 * country and key; an empty value removes that key. A changed or removed
 * identifier loses its register check.
 */
export function mergeProfile(stored: CompanyProfileRow | null, input: CompanyProfile, ownerUserId: string, userId: string, now: Date): CompanyProfileRow {
  const identifiers: Identifiers = structuredClone(stored?.identifiers || {});
  const verifications: Record<string, unknown> = { ...(stored?.verifications || {}) };
  for (const [c, fields] of Object.entries(input.identifiers)) {
    identifiers[c] = identifiers[c] || {};
    for (const [k, v] of Object.entries(fields)) {
      if ((identifiers[c][k] || '') === v) continue;
      if (v) identifiers[c][k] = v; else delete identifiers[c][k];
      delete verifications[`${c}.${k}`];
    }
    if (!Object.keys(identifiers[c]).length) delete identifiers[c];
  }
  return {
    owner_user_id: ownerUserId,
    org_id: stored?.org_id ?? null,
    country: input.country,
    legal_name: input.legalName,
    trade_name: input.tradeName,
    identifiers,
    verifications,
    address: { line1: input.address.line1, line2: input.address.line2, postal_code: input.address.postalCode, city: input.address.city, region: input.address.region },
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    phone_country: input.phoneCountry || null,
    phone_number: input.phoneNumber,
    updated_by: userId,
    updated_at: now.toISOString(),
  };
}

export function toApi(row: CompanyProfileRow): CompanyProfile {
  const a = row.address || {};
  return {
    country: row.country,
    legalName: row.legal_name || '', tradeName: row.trade_name || '',
    identifiers: row.identifiers || {}, verifications: row.verifications || {},
    address: { line1: a.line1 || '', line2: a.line2 || '', postalCode: a.postal_code || '', city: a.city || '', region: a.region || '' },
    contactName: row.contact_name || '', contactEmail: row.contact_email || '',
    phoneCountry: row.phone_country || '', phoneNumber: row.phone_number || '',
    updatedAt: row.updated_at || null,
  };
}

export interface CompanyOwner {
  /** Key of the company's profile until organizations exist. */
  ownerUserId: string;
  /** Owners and managers edit; members read (multi-team plan: org settings). */
  canEdit: boolean;
  teamName: string | null;
}

export async function companyOwner(db: Db, userId: string): Promise<CompanyOwner> {
  const { data: profiles } = await db.from('profiles').select('id, team_id, role').eq('id', userId);
  const me = profiles?.[0];
  if (!me?.team_id) return { ownerUserId: userId, canEdit: true, teamName: null };
  const { data: teams } = await db.from('teams').select('id, name, manager_id').eq('id', me.team_id);
  const team = teams?.[0];
  const ownerUserId = team?.manager_id || userId;
  return { ownerUserId, canEdit: ownerUserId === userId || me.role === 'manager', teamName: team?.name || null };
}

/** The Brazilian CNPJ, for SERPRO's certificate CNPJ default. */
export const profileCnpj = (row: Pick<CompanyProfileRow, 'identifiers'> | null) => row?.identifiers?.BR?.cnpj || '';
