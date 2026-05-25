/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    'animate-fade-in-up',
    'animate-card-exit',
    'animate-btn-success',
    'animate-check-draw',
    'animate-drop-out-panel',
    'animate-drop-out-title',
    'animate-rise-in-title',
    'animate-rise-in-panel',
    'animate-drop-in-nav',
    'animate-drop-in-shell',
    'animate-drop-up-nav',
    'animate-drop-up-shell',
  ],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--bg-page) / <alpha-value>)',
        card: 'rgb(var(--bg-card) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        divider: 'rgb(var(--bg-divider) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          from: 'rgb(var(--accent-from) / <alpha-value>)',
          to: 'rgb(var(--accent-to) / <alpha-value>)',
        },
        cta: {
          DEFAULT: 'rgb(var(--cta) / <alpha-value>)',
          hover: 'rgb(var(--cta-hover) / <alpha-value>)',
          soft: 'rgb(var(--cta-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          hover: 'rgb(var(--success-hover) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          hover: 'rgb(var(--danger-hover) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Instrument Serif', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'card-exit': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.96) translateY(-8px)' },
        },
        'btn-success': {
          '0%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(3px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'check-draw': {
          '0%': { 'stroke-dashoffset': '20' },
          '100%': { 'stroke-dashoffset': '0' },
        },
        'drop-down-off': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(110vh)' },
        },
        'rise-up-in': {
          '0%':   { opacity: '0', transform: 'translateY(110vh)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'drop-down-in': {
          '0%':   { opacity: '0', transform: 'translateY(-115vh)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up-off': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-115vh)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'card-exit': 'card-exit 350ms cubic-bezier(0.4, 0, 1, 1) both',
        'btn-success': 'btn-success 350ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'check-draw': 'check-draw 350ms cubic-bezier(0.65, 0, 0.35, 1) 100ms both',
        'drop-out-panel': 'drop-down-off 380ms cubic-bezier(0.55, 0, 0.85, 0.2) both',
        'drop-out-title': 'drop-down-off 380ms cubic-bezier(0.55, 0, 0.85, 0.2) 120ms both',
        'rise-in-title':  'rise-up-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'rise-in-panel':  'rise-up-in 480ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both',
        'drop-in-shell':  'drop-down-in 520ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both',
        'drop-in-nav':    'drop-down-in 520ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both',
        'drop-up-nav':    'slide-up-off 380ms cubic-bezier(0.55, 0, 0.85, 0.2) both',
        'drop-up-shell':  'slide-up-off 380ms cubic-bezier(0.55, 0, 0.85, 0.2) 120ms both',
      },
    },
  },
  plugins: [],
}
