/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pins: {
          grey: '#9a9a9a',
          light: '#f2f2f2',
          muted: '#b8b8b8',
          accent: '#f2c94c',
          panel: '#d4d4d4',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      letterSpacing: {
        pins: '0.18em',
      },
      maxWidth: {
        site: '100%',
      },
    },
  },
  plugins: [],
};
