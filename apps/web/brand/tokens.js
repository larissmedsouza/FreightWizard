/*
 * FreightWizard design tokens: the single source of truth for the public
 * landing page AND the logged-in app. Components must not contain raw hex
 * values; they use the Tailwind utilities generated from this file:
 *
 *   - Landing page: `fw-*`   (bg-fw-panel, text-fw-indigo-300, rounded-fw-card...)
 *   - App:          `app-*`  (bg-app-panel, text-app-ink, border-app-line...)
 *     App colours are CSS variables that switch with data-theme="light|dark"
 *     on the page root (see the plugin in tailwind.config.js).
 *
 * Contrast (WCAG 2.x) is noted next to every text colour. All text pairs
 * are >= 4.5:1. Status dots are decorative (always next to a text label).
 */

/* ---- Brand: indigo scale (shared) ------------------------------------- */
const indigo = {
  'indigo-600': '#4400D6', // primary hover; light-mode accent text (9.5 on white, white text 9.5)
  'indigo-500': '#5200FF', // primary fill, selected, light-mode focus (white text 7.5, 7.5 on white)
  'indigo-300': '#A995FF', // accent text/icons/active rule on dark (7.3 app bg, 8.1 landing canvas)
  'indigo-200': '#C8BBFF', // active labels on dark (10.4 app bg)
  'indigo-50': '#EEEAFF', // light-mode selected background (indigo-600 text 8.1)
};

/* ---- Landing page (dark only) ------------------------------------------ */
const colors = {
  ...indigo,
  canvas: '#050510', // page ground
  panel: '#0C0C1D', // cards, FAQ rows, popovers
  raised: '#14142B', // hover / menus
  line: 'rgb(255 255 255 / 0.10)',
  'line-strong': 'rgb(255 255 255 / 0.20)',
  ink: '#F4F4F8', // 18.5 canvas
  'ink-2': '#B4B4C7', // 9.9 canvas
  'ink-3': '#8E8EA6', // 6.3 canvas
  white: '#FFFFFF',
  'indigo-tint': '#190A46', // indigo-500 at 18% on panel: small status tags (indigo-200 text 10.2)

  /* Globe only (cobe shader + floating labels) */
  'globe-base': '#2A1499',
  'globe-marker': indigo['indigo-300'],
  'globe-arc': indigo['indigo-300'],
  'globe-glow': '#1CA1FF',
  'globe-label': '#0A0A1A',
  'globe-pyramid-1': indigo['indigo-200'],
  'globe-pyramid-2': indigo['indigo-300'],
  'globe-pyramid-3': indigo['indigo-500'],
  'globe-pyramid-4': indigo['indigo-600'],
};

/* ---- App: light / dark palettes ----------------------------------------- */
const app = {
  light: {
    bg: '#FFFFFF',
    panel: '#F7F8FA',
    raised: '#EEF1F5',
    card: '#FFFFFF', // cards on panel grounds
    line: '#E3E7EC',
    'line-strong': '#CBD2DA',
    ink: '#0B1B2B', // 17.4 bg / 16.4 panel / 15.4 raised
    'ink-2': '#42536A', // 7.8 / 7.4 / 6.9
    'ink-3': '#5C6B7D', // 5.4 / 5.1 / 4.8
    accent: indigo['indigo-600'], // accent text/icons: 9.5 / 8.9 / 8.4
    'accent-fill': indigo['indigo-500'], // primary button, selected marker
    'accent-hover': indigo['indigo-600'],
    selected: indigo['indigo-50'], // selected row/item bg (accent text 8.1)
    focus: indigo['indigo-500'], // focus ring 7.5 on white
    'on-accent': '#FFFFFF', // text on accent-fill 7.5, on hover 9.5
    overlay: 'rgb(7 23 38 / 0.45)', // modal scrim
    // Status tags: text / bg / dot
    'danger-ink': '#9B2C2C', 'danger-bg': '#FBEBEB', 'danger-dot': '#D64545', // 6.5
    'warn-ink': '#8A5A12', 'warn-bg': '#FBF1E3', 'warn-dot': '#D9962B', // 5.3
    'info-ink': '#1F5A80', 'info-bg': '#EAF3F9', 'info-dot': '#4A90C2', // 6.6
    'ok-ink': '#1F6B47', 'ok-bg': '#E5F3EC', 'ok-dot': '#2E9E6A', // 5.6
    'accent-ink': indigo['indigo-600'], 'accent-bg': indigo['indigo-50'], 'accent-dot': indigo['indigo-500'], // 8.1
    'neutral-ink': '#4B5B6B', 'neutral-bg': '#EEF1F5', 'neutral-dot': '#8C9DAE', // 6.2
  },
  dark: {
    bg: '#071726',
    panel: '#0C2134',
    raised: '#13304A',
    card: '#0C2134',
    line: 'rgb(255 255 255 / 0.10)',
    'line-strong': 'rgb(255 255 255 / 0.18)',
    ink: '#F2F5F8', // 16.6 bg / 15.0 panel / 12.4 raised
    'ink-2': '#B4C1CE', // 9.9 / 8.9 / 7.4
    'ink-3': '#8C9DAE', // 6.5 / 5.9 / 4.9
    accent: indigo['indigo-300'], // 7.3 / 6.6 / 5.4
    'accent-fill': indigo['indigo-500'],
    'accent-hover': indigo['indigo-600'],
    selected: '#191B59', // indigo-500 at 18% over panel (ink 14.3)
    focus: indigo['indigo-300'], // 7.3 on bg
    'on-accent': '#FFFFFF',
    overlay: 'rgb(0 0 0 / 0.6)',
    'danger-ink': '#F5A8A8', 'danger-bg': '#2C2737', 'danger-dot': '#D64545', // 7.6
    'warn-ink': '#F2C57C', 'warn-bg': '#2D3433', 'warn-dot': '#D9962B', // 7.9
    'info-ink': '#9CC9E8', 'info-bg': '#16334B', 'info-dot': '#4A90C2', // 7.4
    'ok-ink': '#7DD3A8', 'ok-bg': '#11353D', 'ok-dot': '#2E9E6A', // 7.3
    'accent-ink': '#C3B5FF', 'accent-bg': '#171C54', 'accent-dot': indigo['indigo-300'], // 8.5
    'neutral-ink': '#B4C1CE', 'neutral-bg': '#203548', 'neutral-dot': '#8C9DAE', // 6.9
  },
};

/* Top bar: dark navy in BOTH modes. Static (not theme-switched). */
const topbar = {
  'bar-bg': '#071726',
  'bar-ink': '#F2F5F8', // 16.6
  'bar-muted': '#A9B7C5', // 8.9
  'bar-line': 'rgb(255 255 255 / 0.10)',
  'bar-hover': 'rgb(255 255 255 / 0.06)',
  'bar-rule': indigo['indigo-300'], // active underline 7.3
};

const radius = {
  btn: '3px', // buttons, inputs
  card: '4px', // cards, panels, kanban columns
  frame: '8px', // framed screens (max)
};

const shadow = {
  // The one subtle shadow: menus, modals, popular plan.
  frame: '0 24px 48px -28px rgb(0 0 0 / 0.6)',
  'app-pop': '0 12px 32px -16px rgb(7 23 38 / 0.35)',
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

// App type scale (denser UI)
const appFontSize = {
  title: ['1.625rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // page titles (Sora)
  'title-sm': ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
  ui: ['0.875rem', { lineHeight: '1.45' }],
  'ui-sm': ['0.8125rem', { lineHeight: '1.45' }],
  kpi: ['1.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
  mono: ['0.8125rem', { lineHeight: '1.5' }],
  'mono-xs': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.06em' }],
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

module.exports = { indigo, colors, app, topbar, radius, shadow, fontSize, appFontSize, fontFamily, hexToRgb01 };
