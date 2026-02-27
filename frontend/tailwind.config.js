/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#135bec',
          50: '#e8f1ff',
          100: '#d5e4ff',
          200: '#b3ccff',
          300: '#85a9ff',
          400: '#5578ff',
          500: '#135bec',
          600: '#1147c9',
          700: '#0e3aa3',
          800: '#123185',
          900: '#142d6e',
        },
        sidebar: {
          DEFAULT: '#1a1f37',
          light: '#252b47',
        }
      },
      fontFamily: {
        sans: ['Lexend', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
