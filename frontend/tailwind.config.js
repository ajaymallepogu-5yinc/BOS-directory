/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F8FAFC",
          100: "#F1F4F8",
          200: "#E2E8F0",
          400: "#94A3B8",
          600: "#475569",
          800: "#1E293B",
          900: "#0F172A",
        },
        brand: {
          DEFAULT: "#3730A7",
          light: "#4F46E5",
          dark: "#2A2470",
        },
      },
      fontFamily: {
        display: ["Manrope", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 8px rgba(15, 23, 42, 0.06)",
        cardHover: "0 4px 16px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
};
