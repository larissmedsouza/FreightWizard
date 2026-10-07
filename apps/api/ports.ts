// Common UN/LOCODEs -> city name, so "Santos" and "BRSSZ" resolve to the same
// token. Pure substring matching can't know BRSSZ *means* Santos — token
// overlap alone isn't enough, this mapping is what actually makes port-code
// vs free-text lane entry match. Not exhaustive; covers common freight ports.
// Shared by rate-card lane matching (server.ts) and the Operations Overview.
export const PORT_LOCODES: Record<string, string> = {
  brssz: 'santos', nlrtm: 'rotterdam', cnsha: 'shanghai', cnngb: 'ningbo', cnszx: 'shenzhen',
  deham: 'hamburg', usnyc: 'new york', uslax: 'los angeles', uslgb: 'long beach',
  sgsin: 'singapore', gbfxt: 'felixstowe', beanr: 'antwerp', esvlc: 'valencia', itgoa: 'genoa',
  innsa: 'nhava sheva', aejea: 'jebel ali', krpus: 'busan', jptyo: 'tokyo', jpyok: 'yokohama',
  mypkg: 'port klang', thbkk: 'bangkok', vnsgn: 'ho chi minh', brrig: 'rio grande', brpnb: 'paranagua',
};

const CITY_TO_LOCODE: Record<string, string> = Object.fromEntries(
  Object.entries(PORT_LOCODES).map(([code, city]) => [city, code]),
);

/**
 * Resolve a stored port text ("Santos, BR", "BRSSZ", "Rotterdam") to its
 * UN/LOCODE using only the PORT_LOCODES table. Returns null when nothing in
 * the text matches the table — never guesses.
 */
export function portCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  const segments = lower.split(/[,;/()]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of [lower, ...segments]) {
    if (PORT_LOCODES[seg]) return seg.toUpperCase();
    if (CITY_TO_LOCODE[seg]) return CITY_TO_LOCODE[seg].toUpperCase();
  }
  for (const word of lower.split(/[\s,;/()]+/)) {
    if (word.length === 5 && PORT_LOCODES[word]) return word.toUpperCase();
  }
  return null;
}
