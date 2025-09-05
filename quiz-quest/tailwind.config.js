/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}", // This line scans all your component files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}