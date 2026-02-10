/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Neutrals */
        surface: '#ffffff',
        'surface-hover': '#f5f5f7',
        ink: '#1d1d1f',
        'ink-secondary': '#6e6e73',
        'ink-tertiary': '#86868b',
        border: '#e5e5e7',
        'border-soft': '#f0f0f2',
        /* MC4 logo: warm brown / burnt orange + dark brown */
        brand: {
          DEFAULT: '#B85C38',
          dark: '#8B4513',
          light: '#D4845C',
          muted: '#F5EDE8',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
        card: '0 4px 24px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
      transitionDuration: {
        250: '250ms',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
