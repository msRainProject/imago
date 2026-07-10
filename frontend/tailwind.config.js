/** @type {import('tailwindcss').Config} */
// Hill Images — shadcn/ui token system (brand palette derived from the
// original MD3 violet theme). Semantic tokens are defined as CSS variables
// in src/index.css and referenced here via hsl(var(--*)).
//
// Legacy MD3 tokens (surface/outline/type-scale) are kept during the
// migration and will be pruned in the cleanup phase.
import animate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- shadcn/ui semantic tokens -------------------------------
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          // Legacy MD3 aliases (transition period)
          on: 'hsl(var(--primary-foreground))',
          container: '#EADDFF',
          'on-container': '#21005D',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          // Legacy MD3 aliases
          on: '#FFFFFF',
          container: '#E8DEF8',
          'on-container': '#1D192B',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          // Legacy MD3 aliases
          on: '#FFFFFF',
          container: '#C8F0D2',
          'on-container': '#0A2D17',
        },
        // Chart palette
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        // ---- Legacy MD3 tokens (to be removed after migration) --------
        tertiary: {
          DEFAULT: '#7D5260',
          on: '#FFFFFF',
          container: '#FFD8E4',
          'on-container': '#31111D',
        },
        error: {
          DEFAULT: '#B3261E',
          on: '#FFFFFF',
          container: '#F9DEDC',
          'on-container': '#410E0B',
        },
        surface: {
          DEFAULT: '#FEF7FF',
          dim: '#DED8E1',
          bright: '#FFFBFE',
          container: '#F3EDF7',
          'container-high': '#ECE6F0',
          'container-highest': '#E6E0E9',
          variant: '#E7E0EC',
          'on-variant': '#49454F',
          on: '#1D1B20',
        },
        outline: {
          DEFAULT: '#79747E',
          variant: '#CAC4D0',
        },
        'surface-dark': {
          DEFAULT: '#141218',
          dim: '#141218',
          bright: '#3B383E',
          container: '#211F26',
          'container-high': '#2B2930',
          'container-highest': '#36343B',
          variant: '#49454F',
          on: '#E6E0E9',
        },
      },
      fontFamily: {
        sans: [
          'Roboto',
          '"Helvetica Neue"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'PingFang SC',
          'Hiragino Sans GB',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        display: ['Roboto', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Type scale (kept from MD3 — still used across pages)
      fontSize: {
        'display-lg': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: '400' }],
        'display-md': ['45px', { lineHeight: '52px', fontWeight: '400' }],
        'display-sm': ['36px', { lineHeight: '44px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', fontWeight: '400' }],
        'headline-sm': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '500' }],
        'title-md': ['16px', { lineHeight: '24px', letterSpacing: '0.15px', fontWeight: '500' }],
        'title-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '0.5px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0.25px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.4px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
      },
      // Shape scale — shadcn radius variable driven, MD3-compatible sizes
      borderRadius: {
        none: '0',
        xs: '4px',
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: '28px',
        '2xl': '32px',
        full: '9999px',
      },
      // Elevation (kept during migration)
      boxShadow: {
        'elev-0': 'none',
        'elev-1': '0 1px 2px 0 rgba(0,0,0,0.06), 0 1px 3px 0 rgba(0,0,0,0.10)',
        'elev-2': '0 1px 2px 0 rgba(0,0,0,0.06), 0 2px 6px 2px rgba(0,0,0,0.12)',
        'elev-3': '0 1px 3px 0 rgba(0,0,0,0.08), 0 4px 8px 3px rgba(0,0,0,0.12)',
        'elev-4': '0 2px 3px 0 rgba(0,0,0,0.08), 0 6px 10px 4px rgba(0,0,0,0.14)',
        'elev-5': '0 4px 4px 0 rgba(0,0,0,0.10), 0 8px 12px 6px rgba(0,0,0,0.14)',
        'md3-1': '0 1px 3px 1px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.08)',
      },
      // Motion easings (kept during migration)
      transitionTimingFunction: {
        'md3-standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'md3-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        'md3-emphasized-decel': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'md3-emphasized-accel': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
      },
      transitionDuration: {
        'md3-short1': '50ms',
        'md3-short2': '100ms',
        'md3-short3': '150ms',
        'md3-short4': '200ms',
        'md3-medium1': '250ms',
        'md3-medium2': '300ms',
        'md3-medium3': '350ms',
        'md3-medium4': '400ms',
        'md3-long1': '450ms',
        'md3-long2': '500ms',
      },
      keyframes: {
        'md3-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'md3-fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'md3-shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'md3-fade-in': 'md3-fade-in 200ms cubic-bezier(0.2, 0, 0, 1)',
        'md3-fade-out': 'md3-fade-out 200ms cubic-bezier(0.2, 0, 0, 1)',
        'md3-shimmer': 'md3-shimmer 2s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};
