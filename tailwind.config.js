/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nexora Design System (from Google Stitch)
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          dark: 'rgb(var(--c-primary-dark) / <alpha-value>)',
        },
        secondary: '#6366F1',
        base: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--c-ink) / <alpha-value>)',
          secondary: 'rgb(var(--c-ink-2) / <alpha-value>)',
          tertiary: 'rgb(var(--c-ink-3) / <alpha-value>)',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['28px', { fontWeight: '700' }],
        h2: ['22px', { fontWeight: '600' }],
        h3: ['18px', { fontWeight: '600' }],
        body: ['16px', { fontWeight: '400' }],
        'body-small': ['14px', { fontWeight: '400' }],
        caption: ['12px', { fontWeight: '500' }],
      },
      borderRadius: {
        card: '16px',
        button: '12px',
        input: '10px',
        chip: '20px',
        sheet: '24px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(var(--c-border)) inset, 0 4px 12px rgb(0 0 0 / var(--shadow-alpha))',
        glow: '0 0 24px rgb(var(--c-primary) / 0.15)',
      },
      transitionDuration: {
        fast: '200ms',
        DEFAULT: '300ms',
      },
    },
  },
  plugins: [],
}
