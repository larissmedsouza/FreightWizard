/**
 * Decode HTML entities in email text for display ("we&#39;d" -> "we'd",
 * "R&amp;D" -> "R&D"). Pure string function (no DOM), so it is safe during
 * server rendering and never interprets markup. Handles numeric entities
 * (&#39; &#x27;) and common named ones; unknown entities are left as-is.
 * One extra numeric pass covers double-encoded text such as "&amp;#39;".
 */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  bull: "•", middot: "·", euro: "€", pound: "£", copy: "©", reg: "®", trade: "™", deg: "°",
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä", ccedil: "ç",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", iacute: "í", icirc: "î", iuml: "ï",
  oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", uacute: "ú", ucirc: "û", uuml: "ü",
  ntilde: "ñ", szlig: "ß", Aacute: "Á", Atilde: "Ã", Ccedil: "Ç", Eacute: "É", Oacute: "Ó", Uuml: "Ü",
}

function decodeNumeric(code: string, match: string): string {
  const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
}

export function decodeEntities(input?: string | null): string {
  if (!input) return ""
  const once = input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, code: string) =>
    code[0] === "#" ? decodeNumeric(code, match) : NAMED[code] ?? match,
  )
  return once.includes("&#") ? once.replace(/&(#x[0-9a-f]+|#\d+);/gi, (match, code: string) => decodeNumeric(code, match)) : once
}
