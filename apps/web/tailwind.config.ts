import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14231f',
        paper: '#f5f0e8',
        canvas: '#e6dfd3',
        accent: '#0f766e',
        signal: '#b45309',
        danger: '#b91c1c'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Segoe UI"', 'sans-serif'],
        serif: ['"Spectral"', 'Georgia', 'serif']
      },
      boxShadow: {
        panel: '0 10px 30px rgba(20, 35, 31, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
