/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,tsx}'],
    theme: {
        extend: {},
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
    daisyui: {
        light: {
            primary: 'red', // Override primary color
            secondary: 'red', // Override secondary color
            accent: '#000063', // Example custom accent color
            neutral: '#3d4451',
            'base-100': '#ffffff',
            info: '#2094f3',
            success: '#009485',
            warning: '#ff9900',
            error: '#ff5724',
        },
    },
};
