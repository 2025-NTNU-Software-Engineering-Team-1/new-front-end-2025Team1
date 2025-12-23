module.exports = {
  darkMode: ["class", "[data-theme=dark]"],
  plugins: [require("daisyui"), require("@tailwindcss/typography")],
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--p) / <alpha-value>)",
        "primary-focus": "hsl(var(--pf) / <alpha-value>)",
        "primary-content": "hsl(var(--pc) / <alpha-value>)",
        "base-100": "hsl(var(--b1) / <alpha-value>)",
        "base-200": "hsl(var(--b2) / <alpha-value>)",
        "base-300": "hsl(var(--b3) / <alpha-value>)",
        "base-content": "hsl(var(--bc) / <alpha-value>)",
      },
    },
  },
  daisyui: {
    themes: ["light", "dark"],
  },
};
