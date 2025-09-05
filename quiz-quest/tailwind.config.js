/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{components,services,src}/**/*.{js,ts,jsx,tsx}", // More specific patterns
    "./App.tsx" // Specifically include App.tsx
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}