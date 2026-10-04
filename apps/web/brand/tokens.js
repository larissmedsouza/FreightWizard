/*
 * FreightWizard marketing design tokens.
 * Single source of truth for every colour, radius, shadow and type size used by
 * the public landing page (app/page.tsx and app/components/marketing/*) and the
 * hero globe. Exposed to Tailwind under the `fw` namespace (bg-fw-panel,
 * text-fw-violet-300, rounded-fw-card...) so the dashboard's styles are untouched.
 * Components must not contain raw hex values.
 *
 * Contrast (WCAG 2.x) measured against canvas / panel:
 *   ink 18.5 / 17.6 · ink-2 9.9 / 9.5 · ink-3 6.3 / 6.1
 *   violet-300 9.2 / 8.8 · violet-400 7.0 / 6.6
 *   violet-500 3.8 / 3.6 -> fills, rules and large text only, never small text
 *   white on violet-500 5.3 · white on violet-600 6.8 · violet-200 on violet-tint 11.0
 */

const colors = {
  /* Grounds */
  canvas: '#050510', // page ground
  panel: '#0C0C1D', // cards, FAQ rows, popovers
  raised: '#14142B', // hover / menus
  /* Hairlines: white at 10% / 20% */
  line: 'rgb(255 255 255 / 0.10)',
  'line-strong': 'rgb(255 255 255 / 0.20)',

  /* Text */
  ink: '#F4F4F8', // headings, primary text
  'ink-2': '#B4B4C7', // body copy
  'ink-3': '#8E8EA6', // tertiary, footer, captions
  white: '#FFFFFF', // text on violet fills

  /* Brand violet */
  'violet-200': '#D9C2FF', // status-tag text on violet-tint
  'violet-300': '#C69BFF', // eyebrows, small purple labels
  'violet-400': '#B57AFF', // headline key phrase, icons, checks, focus ring
  'violet-500': '#9E14FB', // brand: button fills, eyebrow rule, globe markers/arcs
  'violet-600': '#8710D9', // button hover fill
  'violet-tint': '#220D3E', // violet-500 at 15% on panel: small status tags

  /* Globe only (cobe shader + floating labels) */
  'globe-base': '#4D0080',
  'globe-glow': '#1CA1FF',
  'globe-label': '#0A0A1A',
  'globe-pyramid-1': '#9E14FB',
  'globe-pyramid-2': '#7B0ED4',
  'globe-pyramid-3': '#5200FF',
  'globe-pyramid-4': '#3D00CC',
};

const radius = {
  btn: '3px',
  card: '4px',
  frame: '8px',
};

const shadow = {
  // The one subtle shadow: framed/raised surfaces only (menus, popular plan).
  frame: '0 24px 48px -28px rgb(0 0 0 / 0.6)',
};

// [size, { lineHeight, letterSpacing }] — Tailwind fontSize tuples.
const fontSize = {
  h1: ['clamp(2.5rem, 5.4vw, 4.25rem)', { lineHeight: '1.06', letterSpacing: '-0.04em' }],
  h2: ['clamp(1.875rem, 3.4vw, 2.75rem)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
  h3: ['1.1875rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
  lead: ['1.1875rem', { lineHeight: '1.6' }],
  body: ['1.0625rem', { lineHeight: '1.6' }],
  small: ['0.9375rem', { lineHeight: '1.55' }],
  price: ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
  eyebrow: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.08em' }],
  data: ['0.8125rem', { lineHeight: '1.6' }],
  'data-xs': ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.06em' }],
};

const fontFamily = {
  display: ['var(--font-sora)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  sans: ['var(--font-plex-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
};

/**
 * '#9E14FB' -> [0.62, 0.08, 0.98] for the cobe WebGL shader.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

module.exports = { colors, radius, shadow, fontSize, fontFamily, hexToRgb01 };
