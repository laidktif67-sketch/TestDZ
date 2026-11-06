/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {50:"var(--tdz-primary-50)",100:"var(--tdz-primary-100)",200:"var(--tdz-primary-200)",300:"var(--tdz-primary-300)",400:"var(--tdz-primary-400)",500:"var(--tdz-primary-500)",600:"var(--tdz-primary-600)",700:"var(--tdz-primary-700)",800:"var(--tdz-primary-800)",900:"var(--tdz-primary-900)"},
        accent: {500:"var(--tdz-accent-500)",600:"var(--tdz-accent-600)"},
        bg:"var(--tdz-bg)",surface:"var(--tdz-surface)",border:"var(--tdz-border)",text:"var(--tdz-text)",muted:"var(--tdz-muted)",
        success:"var(--tdz-success)",warning:"var(--tdz-warning)",error:"var(--tdz-error)",info:"var(--tdz-info)"
      },
      spacing: {"1":"var(--tdz-space-1)","2":"var(--tdz-space-2)","3":"var(--tdz-space-3)","4":"var(--tdz-space-4)","5":"var(--tdz-space-5)","6":"var(--tdz-space-6)","8":"var(--tdz-space-8)","10":"var(--tdz-space-10)","12":"var(--tdz-space-12)","16":"var(--tdz-space-16)"},
      borderRadius:{sm:"var(--tdz-radius-sm)",md:"var(--tdz-radius-md)",lg:"var(--tdz-radius-lg)",xl:"var(--tdz-radius-xl)"},
      boxShadow:{sm:"var(--tdz-shadow-sm)",md:"var(--tdz-shadow-md)",lg:"var(--tdz-shadow-lg)",xl:"var(--tdz-shadow-xl)"},
      transitionDuration:{fast:"150ms",base:"200ms",slow:"300ms"}
    }
  },
  plugins: []
};
