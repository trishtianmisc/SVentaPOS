/** @type {import('tailwindcss').Config} */

// Token-backed palette: rgb(var(--token) / alpha) so opacity modifiers
// (bg-primary-soft/50, ring-primary, …) keep working. Values live in
// src/styles/index.css :root — edit there, not here.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  // Class strategy only: dark: utilities are inert unless <html class="dark">
  // (no toggle sets it anymore — prevents OS prefers-color-scheme dark UI).
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: token('--color-primary'),
          hover: token('--color-primary-hover'),
          soft: token('--color-primary-soft'),
          ink: token('--color-primary-ink'),
        },
        success: {
          DEFAULT: token('--color-success'),
          soft: token('--color-success-soft'),
        },
        warning: {
          DEFAULT: token('--color-warning'),
          soft: token('--color-warning-soft'),
        },
        danger: {
          DEFAULT: token('--color-error'),
          soft: token('--color-error-soft'),
        },
      },
    },
  },
  plugins: [],
};
