const defaultTheme = require('tailwindcss/defaultTheme');
const fw = require('./brand/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        // Marketing landing page (brand/tokens.js)
        'fw-display': fw.fontFamily.display,
        'fw-sans': fw.fontFamily.sans,
        'fw-mono': fw.fontFamily.mono,
      },
      colors: { fw: fw.colors },
      borderRadius: {
        'fw-btn': fw.radius.btn,
        'fw-card': fw.radius.card,
        'fw-frame': fw.radius.frame,
      },
      boxShadow: { 'fw-frame': fw.shadow.frame },
      fontSize: Object.fromEntries(Object.entries(fw.fontSize).map(([k, v]) => [`fw-${k}`, v])),
      transitionTimingFunction: { calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    },
  },
  plugins: [],
}
