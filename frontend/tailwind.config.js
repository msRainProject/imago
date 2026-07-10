/** @type {import('tailwindcss').Config} */
// Hill Images — Material Design 3 inspired token system.
// All color values come from MD3 tonal palettes (m3.material.io).
// Reference: https://m3.material.io/styles/color/the-color-system/tokens-1d2c855a
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MD3 Primary — soft violet, brand-consistent
        primary: {
          DEFAULT: '#6750A4',
          on: '#FFFFFF',
          container: '#EADDFF',
          'on-container': '#21005D',
          50: '#F6F0FF',
          100: '#EADDFF',
          200: '#D5BBFF',
          300: '#BE98FF',
          400: '#A87BFF',
          500: '#9A66FF',
          600: '#7F4DD8',
          700: '#6750A4',
          800: '#4F378B',
          900: '#21005D',
        },
        // MD3 Secondary — muted lavender
        secondary: {
          DEFAULT: '#625B71',
          on: '#FFFFFF',
          container: '#E8DEF8',
          'on-container': '#1D192B',
        },
        // MD3 Tertiary — warm rose accent
        tertiary: {
          DEFAULT: '#7D5260',
          on: '#FFFFFF',
          container: '#FFD8E4',
          'on-container': '#31111D',
        },
        // MD3 Error
        error: {
          DEFAULT: '#B3261E',
          on: '#FFFFFF',
          container: '#F9DEDC',
          'on-container': '#410E0B',
        },
        // MD3 Success (extension — not part of MD3 spec but needed)
        success: {
          DEFAULT: '#0F7B3D',
          on: '#FFFFFF',
          container: '#C8F0D2',
          'on-container': '#0A2D17',
        },
        // MD3 Surface — page background, cards
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
        // MD3 Outline
        outline: {
          DEFAULT: '#79747E',
          variant: '#CAC4D0',
        },
        // Dark scheme (used when `.dark` class on <html>)
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
      // MD3 type scale (display/headline/title/body/label)
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
      // MD3 4dp grid spacing — values are multiples of 4
      spacing: {
        '0.5': '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        12: '48px',
        14: '56px',
        16: '64px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
      },
      // MD3 shape system — corner radius scale
      borderRadius: {
        none: '0',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px',
        '2xl': '32px',
        full: '9999px',
      },
      // MD3 elevation (1–5 dp)
      boxShadow: {
        'elev-0': 'none',
        'elev-1': '0 1px 2px 0 rgba(0,0,0,0.06), 0 1px 3px 0 rgba(0,0,0,0.10)',
        'elev-2': '0 1px 2px 0 rgba(0,0,0,0.06), 0 2px 6px 2px rgba(0,0,0,0.12)',
        'elev-3': '0 1px 3px 0 rgba(0,0,0,0.08), 0 4px 8px 3px rgba(0,0,0,0.12)',
        'elev-4': '0 2px 3px 0 rgba(0,0,0,0.08), 0 6px 10px 4px rgba(0,0,0,0.14)',
        'elev-5': '0 4px 4px 0 rgba(0,0,0,0.10), 0 8px 12px 6px rgba(0,0,0,0.14)',
        'md3-1': '0 1px 3px 1px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.08)',
      },
      // MD3 motion — emphasized easing
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
      },
      animation: {
        'md3-fade-in': 'md3-fade-in 200ms cubic-bezier(0.2, 0, 0, 1)',
        'md3-fade-out': 'md3-fade-out 200ms cubic-bezier(0.2, 0, 0, 1)',
        'md3-shimmer': 'md3-shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
