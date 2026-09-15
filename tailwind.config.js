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
          DEFAULT: '#00D4AA',
          dark: '#00B894',
        },
        secondary: '#6366F1',
        base: {
          bg: '#0A0A0F',
          surface: '#161B22',
          elevated: '#1C2128',
          border: '#30363D',
        },
        ink: {
          primary: '#E6EDF3',
          secondary: '#8B949E',
          tertiary: '#484F58',
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
        card: '0 1px 0 0 #30363D inset, 0 4px 12px rgba(0,0,0,0.3)',
        glow: '0 0 24px rgba(0, 212, 170, 0.15)',
      },
      transitionDuration: {
        fast: '200ms',
        DEFAULT: '300ms',
      },
    },
  },
  plugins: [],
}
