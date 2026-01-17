/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#137fec',
        'primary-dark': '#1d4ed8',
        'background-light': '#f6f7f8',
        'background-dark': '#101922',
        'surface-light': '#ffffff',
        'surface-dark': '#1e2936',
      },
      fontFamily: {
        display: ['Inter', 'Noto Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};

