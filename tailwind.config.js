const { fontFamily } = require('tailwindcss/defaultTheme')
const defaultTheme = require('tailwindcss/defaultTheme')
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    'app/**/*.{ts,tsx}',
    'app/**/*.{js,jsx}',
    'components/**/*.{ts,tsx}',
    'components/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
        xss: '325px',
        extraSm: '400px',
        tablet: '640px',
        laptop: '1024px',
        desktop: '1280px',
        ...defaultTheme.screens,
      },
    },
    extend: {
      scrollbar: {
        width: '4px',
        height: '8px',
        background: 'rgba(255, 255, 255, 0.4)',
        color: 'rgba(0, 0, 0, 0.5)',
      },
      colors: {
        p: '#00BFFF',
        s: '#1E90FF',
        blue: '#1fb6ff',
        pink: '#ff49db',
        orange: '#ff7849',
        green: {
          DEFAULT: 'hsl(var(--green))',
          foreground: 'hsl(var(--green-foreground))',
        },
        grayDark: '#273444',
        grayLight: '#d3dce6',
        moon: 'hsl(240, 60%, 50%)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
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
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      keyframes: {
        fadeIn: {
          '0%': {
            opacity: 0,
            transform: 'scale(0)',
          },
          '100%': {
            opacity: 1,
            transform: 'scale(2)',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        gradient: {
          '0%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
          '100%': {
            backgroundPosition: '0% 50%',
          },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'move-down-up': {
          '0%': {
            transform: 'translateY(0)',
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          },
          '30%': {
            transform: 'translateY(33.33%)',
          },
          '100%': {
            transform: 'translateY(0)',
          },
        },
        'spin-3-times': {
          '0%': {
            transform: 'rotate(0deg)',
          },
          '28%': {
            transform: 'rotate(360deg)',
          },
          '30%': {
            transform: 'rotate(360deg)',
          },
          '58%': {
            transform: 'rotate(720deg)',
          },
          '60%': {
            transform: 'rotate(720deg)',
          },
          '88%': {
            transform: 'rotate(1080deg)',
          },
          '100%': {
            transform: 'rotate(1080deg)',
          },
        },
        'hover-up-down': {
          '0%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-5%)',
          },
          '100%': {
            transform: 'translateY(0)',
          },
        },
        borderPulse: {
          '0%, 100%': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
          },
          '50%': {
            borderColor: 'rgba(255, 255, 255, 1)',
          },
        },
        'slow-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        fadeIn: 'fadeIn 0.4s ease-in',
        'gradient-x': 'gradient-x 15s ease infinite',
        'move-down-up': 'move-down-up 3s ease-in',
        'spin-3-times': 'spin-3-times 4.4s ease-in-out',
        'hover-up-down': 'hover-up-down 1s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        borderPulse: 'borderPulse 1.5s ease-in-out infinite',
        'slow-spin': 'slow-spin 20s linear infinite',
      },
    },
  },
  plugins: [require('tailwind-scrollbar'), require('tailwindcss-animate'), require('lucide-react')],
}
