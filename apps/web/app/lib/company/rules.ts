// Company profile rules per country: which identifier fields apply, their
// local names, format checks and country-matched examples.
// Format checks only say a number *looks* right; checking it against the
// register (VIES, EORI) is the job of the verifiers in verify.ts.
// Covered by rules.test.ts.
import { EU_COUNTRIES, type Lang } from './countries';

type L = Record<Lang, string>;

/** A verifier the field can call once the EU tools register it (verify.ts). */
export type CheckKind = 'vies' | 'eori' | 'eori-gb';

export interface IdField {
  /** Stored as identifiers[country][key]. */
  key: string;
  label: L;
  placeholder: string;
  hint?: L;
  /** Applied while typing (masks, upper case). */
  format?: (v: string) => string;
  valid: (v: string) => boolean;
  /** "Valid" (a checksum passed) instead of "Format OK". */
  checksum?: boolean;
  check?: CheckKind;
}

export interface CountrySchema {
  country: string;
  kind: 'BR' | 'EU' | 'GB' | 'US' | 'OTHER';
  legalName: L;
  tradeName: L;
  ids: IdField[];
  /** Show a state/region line in the address. */
  region: L | null;
  /** Show the Mercante query context (Brazil only). */
  mercante: boolean;
  examples: Examples;
}

export interface Examples {
  legalName: string; tradeName: string; contactName: string; contactEmail: string; phone: string;
  line1: string; postalCode: string; city: string; region?: string;
}

// ---- Checks -------------------------------------------------------------------

const compact = (v: string) => v.toUpperCase().replace(/[\s.\-/]/g, '');
const upper = (v: string) => v.toUpperCase();

/** CNPJ, including the alphanumeric format used for new CNPJs from July 2026. */
export function validCnpj(v: string): boolean {
  const s = compact(v);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  const value = (ch: string) => ch.charCodeAt(0) - 48; // '0'-'9' → 0-9, 'A'-'Z' → 17-42
  const digit = (base: string, weights: number[]) => {
    const r = weights.reduce((sum, w, i) => sum + value(base[i]) * w, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit(s, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digit(s.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(s[12]) && d2 === Number(s[13]);
}

export function formatCnpj(v: string): string {
  const s = v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  const parts = [s.slice(0, 2), s.slice(2, 5), s.slice(5, 8), s.slice(8, 12), s.slice(12, 14)];
  return parts[0] + (parts[1] ? `.${parts[1]}` : '') + (parts[2] ? `.${parts[2]}` : '') + (parts[3] ? `/${parts[3]}` : '') + (parts[4] ? `-${parts[4]}` : '');
}

/** Luhn, as used by the Italian Partita IVA and French SIREN/SIRET. */
export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Portuguese NIPC (company tax number): 9 digits, mod-11 check digit. */
export function validNipc(v: string): boolean {
  const s = compact(v);
  if (!/^[5-9]\d{8}$/.test(s)) return false;
  const sum = [...s.slice(0, 8)].reduce((t, d, i) => t + Number(d) * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(s[8]);
}

/** Belgian KBO/BCE enterprise number: 10 digits, last two = 97 − (first eight mod 97). */
export function validKbo(v: string): boolean {
  const s = compact(v);
  if (!/^[01]\d{9}$/.test(s)) return false;
  return 97 - (Number(s.slice(0, 8)) % 97) === Number(s.slice(8));
}

export function formatKbo(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 10)].filter(Boolean).join('.');
}

export function formatEin(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 9);
  return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
}

/** EU VAT number formats (VIES), with the country prefix. Greece uses EL. */
const VAT_FORMATS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/, BE: /^BE[01]\d{9}$/, BG: /^BG\d{9,10}$/, CY: /^CY\d{8}[A-Z]$/, CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/, DK: /^DK\d{8}$/, EE: /^EE\d{9}$/, GR: /^EL\d{9}$/, ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/, FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/, HR: /^HR\d{11}$/, HU: /^HU\d{8}$/,
  IE: /^IE(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/, IT: /^IT\d{11}$/, LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/, LV: /^LV\d{11}$/, MT: /^MT\d{8}$/, NL: /^NL\d{9}B\d{2}$/, PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/, RO: /^RO\d{2,10}$/, SE: /^SE\d{12}$/, SI: /^SI\d{8}$/, SK: /^SK\d{10}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

export const vatPrefix = (country: string) => (country === 'GR' ? 'EL' : country);
export const validVat = (country: string, v: string) => !!VAT_FORMATS[country]?.test(compact(v));

/** National EORI formats where the number is built from a known register number. */
const EORI_FORMATS: Record<string, RegExp> = {
  NL: /^NL\d{9}$/,                       // RSIN
  PT: /^PT\d{9}$/,                       // NIF/NIPC
  BE: /^BE\d{10}$/,                      // KBO/BCE
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,       // NIF/CIF
  IT: /^IT(\d{11}|[A-Z0-9]{16})$/,       // Partita IVA or codice fiscale
  FR: /^FR\d{14}$/,                      // SIRET
  DE: /^DE\d{1,15}$/,
};

/** EORI: the issuing country's prefix + up to 15 characters (stricter where known); GB (and XI) + 12 digits. */
export function validEori(country: string, v: string): boolean {
  const s = compact(v);
  if (country === 'GB') return /^(GB|XI)\d{12}$/.test(s);
  if (EORI_FORMATS[country]) return EORI_FORMATS[country].test(s);
  const prefixes = country === 'GR' ? ['GR', 'EL'] : [country];
  return prefixes.includes(s.slice(0, 2)) && /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(s);
}

const anyId = (v: string) => /^[A-Z0-9][A-Z0-9 .\-/]{1,39}$/i.test(v.trim());

// ---- Labels -------------------------------------------------------------------

const LBL = {
  legal: { en: 'Legal name', pt: 'Razão social', nl: 'Statutaire naam' },
  trade: { en: 'Trade name', pt: 'Nome fantasia', nl: 'Handelsnaam' },
  vat: { en: 'VAT number', pt: 'Número de IVA (VAT)', nl: 'Btw-nummer' },
  eori: { en: 'EORI number', pt: 'Número EORI', nl: 'EORI-nummer' },
  reg: { en: 'Company registration number', pt: 'Número de registro da empresa', nl: 'Inschrijvingsnummer' },
  taxId: { en: 'Tax ID', pt: 'Identificação fiscal', nl: 'Fiscaal nummer' },
  regNo: { en: 'Registration number', pt: 'Número de registro', nl: 'Registratienummer' },
  region: { en: 'State / region', pt: 'Estado / região', nl: 'Staat / regio' },
} satisfies Record<string, L>;

const same = (s: string): L => ({ en: s, pt: s, nl: s });

/** The national company register number of the countries asked for by name. */
const NATIONAL_REG: Record<string, Omit<IdField, 'key'>> = {
  NL: { label: { en: 'KvK number', pt: 'Número KvK', nl: 'KvK-nummer' }, placeholder: '12345678', valid: v => /^\d{8}$/.test(compact(v)) },
  PT: {
    label: same('NIPC'), placeholder: '501234560', valid: validNipc, checksum: true,
    hint: { en: 'Your VAT number is PT + NIPC.', pt: 'O número de IVA é PT + NIPC.', nl: 'Het btw-nummer is PT + NIPC.' },
  },
  DE: {
    label: { en: 'Handelsregister number', pt: 'Número no Handelsregister', nl: 'Handelsregisternummer' }, placeholder: 'HRB 123456',
    format: upper, valid: v => /^(HRA|HRB|GNR|PR|VR|GSR)\s?\d{1,6}(\s?[A-Z]{1,2})?$/.test(v.trim().toUpperCase()),
    hint: { en: 'Register type and number, e.g. HRB 123456', pt: 'Tipo de registro e número, ex.: HRB 123456', nl: 'Registertype en nummer, bijv. HRB 123456' },
  },
  BE: { label: same('KBO/BCE number'), placeholder: '0123.456.749', format: formatKbo, valid: validKbo, checksum: true },
  ES: {
    label: same('NIF/CIF'), placeholder: 'B12345674', format: upper,
    valid: v => /^([ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/.test(compact(v)),
  },
  IT: { label: same('Partita IVA'), placeholder: '12345678903', valid: v => /^\d{11}$/.test(compact(v)) && luhn(compact(v)), checksum: true },
  FR: { label: same('SIREN / SIRET'), placeholder: '123456782', valid: v => /^(\d{9}|\d{14})$/.test(compact(v)) && luhn(compact(v)), checksum: true },
};

/** Example values: VAT and EORI for the countries asked for by name, else built from the prefix. */
const VAT_EXAMPLE: Record<string, string> = {
  NL: 'NL123456789B01', PT: 'PT501234560', DE: 'DE123456789', BE: 'BE0123456749', ES: 'ESB12345674',
  IT: 'IT12345678903', FR: 'FR11123456782', AT: 'ATU12345678', GR: 'EL123456789', IE: 'IE1234567T', GB: 'GB123456789',
};
const EORI_EXAMPLE: Record<string, string> = {
  NL: 'NL123456789', PT: 'PT501234560', DE: 'DE1234567', BE: 'BE0123456749', ES: 'ESB12345674',
  IT: 'IT12345678903', FR: 'FR12345678200010', GB: 'GB123456789000',
};

// ---- Examples -----------------------------------------------------------------

const EXAMPLES: Record<string, Examples> = {
  BR: { legalName: 'Empresa Logística Ltda.', tradeName: 'Exemplo Cargo', contactName: 'João Silva', contactEmail: 'joao@empresa.com.br', phone: '(11) 99999-9999', line1: 'Av. Paulista, 1000', postalCode: '01310-100', city: 'São Paulo', region: 'SP' },
  PT: { legalName: 'Transitários Exemplo, Lda.', tradeName: 'Exemplo Cargo', contactName: 'Ana Ferreira', contactEmail: 'ana@empresa.pt', phone: '912 345 678', line1: 'Rua Augusta, 100', postalCode: '1100-053', city: 'Lisboa' },
  NL: { legalName: 'Voorbeeld Logistics B.V.', tradeName: 'Voorbeeld Cargo', contactName: 'Sanne de Vries', contactEmail: 'sanne@bedrijf.nl', phone: '10 123 4567', line1: 'Wilhelminakade 1', postalCode: '3072 AP', city: 'Rotterdam' },
  DE: { legalName: 'Beispiel Logistik GmbH', tradeName: 'Beispiel Cargo', contactName: 'Lukas Müller', contactEmail: 'lukas@firma.de', phone: '40 1234567', line1: 'Am Sandtorkai 1', postalCode: '20457', city: 'Hamburg' },
  BE: { legalName: 'Voorbeeld Logistics BV', tradeName: 'Voorbeeld Cargo', contactName: 'Pieter Janssens', contactEmail: 'pieter@bedrijf.be', phone: '3 123 45 67', line1: 'Noorderlaan 1', postalCode: '2030', city: 'Antwerpen' },
  ES: { legalName: 'Ejemplo Logística S.L.', tradeName: 'Ejemplo Cargo', contactName: 'Lucía García', contactEmail: 'lucia@empresa.es', phone: '912 345 678', line1: 'Calle Mayor 1', postalCode: '28013', city: 'Madrid' },
  IT: { legalName: 'Esempio Logistica S.r.l.', tradeName: 'Esempio Cargo', contactName: 'Giulia Rossi', contactEmail: 'giulia@azienda.it', phone: '010 123 4567', line1: 'Via Roma 1', postalCode: '16121', city: 'Genova' },
  FR: { legalName: 'Exemple Logistique SAS', tradeName: 'Exemple Cargo', contactName: 'Camille Martin', contactEmail: 'camille@entreprise.fr', phone: '4 91 23 45 67', line1: '1 rue de la République', postalCode: '13002', city: 'Marseille' },
  GB: { legalName: 'Example Logistics Ltd', tradeName: 'Example Cargo', contactName: 'James Smith', contactEmail: 'james@company.co.uk', phone: '20 7946 0000', line1: '1 Dock Road', postalCode: 'E16 1AA', city: 'London' },
  US: { legalName: 'Example Logistics LLC', tradeName: 'Example Cargo', contactName: 'Emily Johnson', contactEmail: 'emily@company.com', phone: '(212) 555-0100', line1: '100 Main Street', postalCode: '10001', city: 'New York', region: 'NY' },
};

// Any other country: no made-up local names or addresses; the labels say what goes where.
const NEUTRAL: Examples = {
  legalName: 'Example Logistics Ltd.', tradeName: 'Example Cargo', contactName: '', contactEmail: 'name@company.com', phone: '',
  line1: '', postalCode: '', city: '',
};

// ---- Schema -------------------------------------------------------------------

export function countrySchema(country: string): CountrySchema {
  const base = { country, legalName: LBL.legal, tradeName: LBL.trade, region: null as L | null, mercante: false, examples: EXAMPLES[country] || NEUTRAL };

  if (country === 'BR') {
    return {
      ...base, kind: 'BR', region: { en: 'State (UF)', pt: 'Estado (UF)', nl: 'Staat (UF)' }, mercante: true,
      legalName: { en: 'Legal name (Razão social)', pt: 'Razão social', nl: 'Statutaire naam (Razão social)' },
      tradeName: { en: 'Trade name (Nome fantasia)', pt: 'Nome fantasia', nl: 'Handelsnaam (Nome fantasia)' },
      ids: [{ key: 'cnpj', label: same('CNPJ'), placeholder: '11.222.333/0001-81', format: formatCnpj, valid: validCnpj, checksum: true }],
    };
  }

  if (country === 'GB') {
    return {
      ...base, kind: 'GB',
      ids: [
        { key: 'crn', label: { en: 'Companies House number', pt: 'Número na Companies House', nl: 'Companies House-nummer' }, placeholder: '01234567', format: upper, valid: v => /^(\d{8}|[A-Z]{2}\d{6})$/.test(compact(v)) },
        { key: 'vat', label: LBL.vat, placeholder: VAT_EXAMPLE.GB, format: upper, valid: v => validVat('GB', v) },
        { key: 'eori', label: LBL.eori, placeholder: EORI_EXAMPLE.GB, format: upper, valid: v => validEori('GB', v), check: 'eori-gb' },
      ],
    };
  }

  if (country === 'US') {
    return {
      ...base, kind: 'US', region: { en: 'State', pt: 'Estado', nl: 'Staat' },
      ids: [{ key: 'ein', label: { en: 'EIN', pt: 'EIN (identificação fiscal dos EUA)', nl: 'EIN' }, placeholder: '12-3456789', format: formatEin, valid: v => /^\d{2}-?\d{7}$/.test(v.trim()) && !v.startsWith('00') }],
    };
  }

  if (EU_COUNTRIES.has(country)) {
    const prefix = vatPrefix(country);
    const reg: IdField = NATIONAL_REG[country]
      ? { key: 'reg', ...NATIONAL_REG[country] }
      : { key: 'reg', label: LBL.reg, placeholder: '', valid: anyId };
    return {
      ...base, kind: 'EU',
      ids: [
        { key: 'vat', label: LBL.vat, placeholder: VAT_EXAMPLE[country] || `${prefix}123456789`, format: upper, valid: v => validVat(country, v), check: 'vies',
          hint: { en: `Starts with ${prefix}`, pt: `Começa com ${prefix}`, nl: `Begint met ${prefix}` } },
        { key: 'eori', label: LBL.eori, placeholder: EORI_EXAMPLE[country] || `${country}123456789`, format: upper, valid: v => validEori(country, v), check: 'eori' },
        reg,
      ],
    };
  }

  return {
    ...base, kind: 'OTHER', region: LBL.region,
    ids: [
      { key: 'tax_id', label: LBL.taxId, placeholder: '', valid: anyId },
      { key: 'reg', label: LBL.regNo, placeholder: '', valid: anyId },
    ],
  };
}

/** Basic phone check: 4–14 digits after the country code. */
export const validPhone = (v: string) => { const d = v.replace(/\D/g, ''); return d.length >= 4 && d.length <= 14; };
export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
