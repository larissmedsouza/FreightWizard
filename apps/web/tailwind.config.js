const defaultTheme = require('tailwindcss/defaultTheme');
const plugin = require('tailwindcss/plugin');
const fw = require('./brand/tokens');

/** '#0B1B2B' -> '11 27 43' so Tailwind opacity modifiers work on CSS variables. */
const triplet = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

// App colours: one CSS variable per token, switched by data-theme on the page root.
const appColorNames = Object.keys(fw.app.light);
const appColors = Object.fromEntries(
  appColorNames.map((k) => [k, isHex(fw.app.light[k]) ? `rgb(var(--app-${k}) / <alpha-value>)` : `var(--app-${k})`]),
);
const appVars = (palette) =>
  Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--app-${k}`, isHex(v) ? triplet(v) : v]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        // Landing page + app (brand/tokens.js)
        'fw-display': fw.fontFamily.display,
        'fw-sans': fw.fontFamily.sans,
        'fw-mono': fw.fontFamily.mono,
      },
      colors: {
        fw: fw.colors,
        app: { ...appColors, ...fw.topbar, ...fw.indigo },
      },
      borderRadius: {
        'fw-btn': fw.radius.btn,
        'fw-card': fw.radius.card,
        'fw-frame': fw.radius.frame,
      },
      boxShadow: { 'fw-frame': fw.shadow.frame, 'app-pop': fw.shadow['app-pop'] },
      fontSize: {
        ...Object.fromEntries(Object.entries(fw.fontSize).map(([k, v]) => [`fw-${k}`, v])),
        ...Object.fromEntries(Object.entries(fw.appFontSize).map(([k, v]) => [`app-${k}`, v])),
      },
      transitionTimingFunction: { calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        '[data-theme="light"]': { ...appVars(fw.app.light), colorScheme: 'light' },
        '[data-theme="dark"]': { ...appVars(fw.app.dark), colorScheme: 'dark' },
      });
    }),
  ],
}
