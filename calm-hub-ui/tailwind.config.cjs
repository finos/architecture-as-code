/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,tsx}'],
    theme: {
        extend: {},
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
    daisyui: {
        themes: ['light', 'dark', 'emerald'],
    },
};