import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-geist-mono)", "Geist Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
      },
      colors: {
        bg: "var(--color-bg)",
        "bg-muted": "var(--color-bg-muted)",
        fg: "var(--color-fg)",
        "fg-muted": "var(--color-fg-muted)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
      },
    },
  },
  plugins: [],
};

export default config;
