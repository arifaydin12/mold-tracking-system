/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-in',
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-up': 'slideUp 0.6s ease-out',
            },
            keyframes: {
                fadeIn: {
                    'from': { opacity: '0', transform: 'translateY(-10px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                slideIn: {
                    'from': { transform: 'translateX(-20px)', opacity: '0' },
                    'to': { transform: 'translateX(0)', opacity: '1' },
                },
                slideUp: {
                    'from': { opacity: '0', transform: 'translateY(30px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' }
                }
            }
        },
    },
    plugins: [],
}
