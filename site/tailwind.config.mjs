import { themeColors } from './src/styles/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: themeColors.surface,
        border: themeColors.border,
        content: themeColors.text,
        accent: themeColors.accent,
        status: themeColors.status,
        country: themeColors.country,
        budget: themeColors.budget,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
