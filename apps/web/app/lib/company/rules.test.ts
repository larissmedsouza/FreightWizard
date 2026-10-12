// Company profile rules. Run: npx tsx --test app/lib/company/rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countrySchema, validCnpj, formatCnpj, validNipc, validKbo, validVat, validEori, luhn, validPhone } from './rules';
import { countryOptions, countryName, guessCountry, PRIORITY_COUNTRIES, DIAL_CODES } from './countries';

const keys = (c: string) => countrySchema(c).ids.map(f => f.key);

test('each country gets its own identifier fields', () => {
  assert.deepEqual(keys('BR'), ['cnpj']);
  for (const c of ['NL', 'PT', 'DE', 'BE', 'ES', 'IT', 'FR', 'AT', 'GR']) assert.deepEqual(keys(c), ['vat', 'eori', 'reg'], c);
  assert.deepEqual(keys('GB'), ['crn', 'vat', 'eori']);
  assert.deepEqual(keys('US'), ['ein']);
  assert.deepEqual(keys('JP'), ['tax_id', 'reg']);
  assert.deepEqual(keys('CH'), ['tax_id', 'reg']); // not in the EU
});

test('national register numbers use their local names', () => {
  const reg = (c: string) => countrySchema(c).ids.find(f => f.key === 'reg')!.label.en;
  assert.equal(reg('NL'), 'KvK number');
  assert.equal(reg('PT'), 'NIPC');
  assert.equal(reg('DE'), 'Handelsregister number');
  assert.equal(reg('BE'), 'KBO/BCE number');
  assert.equal(reg('ES'), 'NIF/CIF');
  assert.equal(reg('IT'), 'Partita IVA');
  assert.equal(reg('FR'), 'SIREN / SIRET');
  assert.equal(reg('AT'), 'Company registration number');
});

test('every example placeholder passes its own check', () => {
  for (const c of [...PRIORITY_COUNTRIES, 'AT', 'GR', 'IE']) {
    for (const f of countrySchema(c).ids) {
      if (f.placeholder) assert.ok(f.valid(f.placeholder), `${c} ${f.key} ${f.placeholder}`);
    }
  }
});

test('Brazilian labels, Mercante context and examples only for Brazil', () => {
  const br = countrySchema('BR'), nl = countrySchema('NL'), pt = countrySchema('PT');
  assert.equal(br.mercante, true);
  assert.equal(nl.mercante, false);
  assert.equal(pt.mercante, false);
  assert.equal(br.legalName.pt, 'Razão social');
  assert.equal(nl.tradeName.en, 'Trade name');
  assert.equal(nl.tradeName.pt, 'Nome fantasia');
  for (const c of ['NL', 'PT', 'DE', 'GB', 'US', 'JP']) {
    const ex = countrySchema(c).examples;
    assert.ok(!/João|\(11\)|\.com\.br/.test(JSON.stringify(ex)), `${c} has Brazilian examples`);
  }
});

test('CNPJ: numeric and the new alphanumeric format', () => {
  assert.ok(validCnpj('11.222.333/0001-81'));
  assert.ok(!validCnpj('11.222.333/0001-82'));
  assert.ok(!validCnpj('11.111.111/1111-11'));
  assert.ok(validCnpj('12.ABC.345/01DE-35')); // Receita Federal's published example
  assert.equal(formatCnpj('12abc34501de35'), '12.ABC.345/01DE-35');
});

test('VAT formats per country, with Greece as EL', () => {
  assert.ok(validVat('NL', 'NL123456789B01'));
  assert.ok(validVat('NL', 'nl 1234.56789 b01'));
  assert.ok(!validVat('NL', 'NL123456789')); // missing B01
  assert.ok(!validVat('NL', 'DE123456789')); // other country's prefix
  assert.ok(validVat('PT', 'PT501234560'));
  assert.ok(validVat('DE', 'DE123456789'));
  assert.ok(validVat('BE', 'BE0123456749'));
  assert.ok(validVat('GR', 'EL123456789'));
  assert.ok(!validVat('GR', 'GR123456789'));
  assert.ok(validVat('GB', 'GB123456789'));
});

test('EORI: the country prefix, GB/XI with 12 digits', () => {
  assert.ok(validEori('NL', 'NL123456789'));
  assert.ok(!validEori('NL', 'DE123456789'));
  assert.ok(!validEori('NL', 'NL'));
  assert.ok(!validEori('NL', 'NL12345')); // a Dutch EORI is NL + the 9-digit RSIN
  assert.ok(validEori('FR', 'FR12345678200010'));
  assert.ok(validEori('AT', 'ATEOS1000000001')); // no national rule: prefix + up to 15
  assert.ok(validEori('GB', 'GB123456789000'));
  assert.ok(validEori('GB', 'XI123456789000'));
  assert.ok(!validEori('GB', 'GB123456789'));
});

test('register checksums: NIPC, KBO, Luhn (Partita IVA, SIREN)', () => {
  assert.ok(validNipc('501234560'));
  assert.ok(!validNipc('501234561'));
  assert.ok(!validNipc('101234560')); // personal NIF, not a company
  assert.ok(validKbo('0123.456.749'));
  assert.ok(!validKbo('0123.456.748'));
  assert.ok(luhn('12345678903'));
  assert.ok(luhn('123456782'));
  assert.ok(!luhn('123456789'));
});

test('phone numbers: 4 to 14 digits', () => {
  assert.ok(validPhone('10 123 4567'));
  assert.ok(!validPhone('12'));
  assert.ok(!validPhone('123456789012345'));
});

test('country list: all countries, the ten first, no "Other"', () => {
  const { top, rest } = countryOptions('en');
  assert.deepEqual(top.map(c => c.code), [...PRIORITY_COUNTRIES]);
  assert.ok(rest.length > 200);
  assert.ok(!rest.some(c => c.code === 'BR' || c.code === 'NL'));
  assert.ok(![...top, ...rest].some(c => /other/i.test(c.name)));
  assert.equal(countryName('NL', 'pt'), 'Países Baixos');
  assert.equal(countryName('DE', 'nl'), 'Duitsland');
  assert.equal(DIAL_CODES.NL, '31');
  assert.equal(guessCountry('nl-NL'), 'NL');
  assert.equal(guessCountry('en'), 'BR');
});
