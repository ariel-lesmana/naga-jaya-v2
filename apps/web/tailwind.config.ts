import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F7F5',
        surface: '#FFFFFF',
        border: '#E8E8E4',
        border2: '#D4D4CE',
        text: '#1A1A18',
        muted: '#6B6B65',
        green: '#1A7A4A',
        'green-bg': '#EAF5EF',
        amber: '#8A5C00',
        'amber-bg': '#FDF5E0',
        red: '#B03030',
        'red-bg': '#FBEAEA',
      },
    },
  },
  plugins: [],
};

export default config;
