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
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'float-slow': 'float 8s ease-in-out 1s infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scroll-indicator': 'scroll-indicator 2s ease-in-out infinite',
        'border-spin': 'border-spin 3s linear infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(19,91,235,0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(19,91,235,0.3)' },
        },
        'scroll-indicator': {
          '0%': { opacity: '0', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(8px)' },
          '60%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(0)' },
        },
        'border-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundSize: {
        'gradient-x': '200% 200%',
      },
    },
  },
  plugins: [],
}
