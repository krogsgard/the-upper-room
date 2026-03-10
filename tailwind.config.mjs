/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  '#fdf8f0',
          100: '#f8eddb',
          200: '#f0d9b0',
          300: '#e5c07e',
          400: '#d4a054',
          500: '#c4873a',
          600: '#a86c2e',
          700: '#8a5225',
          800: '#6e3f1f',
          900: '#5a311a',
        },
        gold: {
          400: '#d4a017',
          500: '#b8860b',
          600: '#9a7209',
        },
        brown: {
          800: '#3d2b1f',
          900: '#2a1a10',
          950: '#1a0f08',
        },
        cream: '#faf4e8',
        lent: '#6b2d3e',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        'prose-wide': '75ch',
        'prose-xl': '90ch',
      },
      backgroundImage: {
        'parchment-texture': "url('/the-upper-room/images/parchment-texture.svg')",
      },
    },
  },
  plugins: [],
};
