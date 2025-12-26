/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Teams theme colors
        'teams-purple': '#6264A7',
        'teams-dark-bg': '#201F1F',
        'teams-dark-surface': '#292827',
        'teams-light-bg': '#F5F5F5',
        'teams-light-surface': '#FFFFFF',
        // Border color for shadcn/ui compatibility
        border: '#E5E7EB',
      },
      borderColor: {
        border: '#E5E7EB',
      },
    },
  },
  plugins: [],
};
