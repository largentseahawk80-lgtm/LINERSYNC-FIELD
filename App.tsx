@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@import "tailwindcss";
@import "leaflet/dist/leaflet.css";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  
  --color-construction-orange: #FF6B00;
  --color-safety-yellow: #FFC107;
  --color-industrial-gray: #1A1A1A;
  --color-industrial-border: #333333;
}

@layer base {
  body {
    @apply bg-[#0F0F0F] text-gray-200 antialiased;
  }
}

.technical-grid {
  background-image: radial-gradient(circle, #333 1px, transparent 1px);
  background-size: 20px 20px;
}

.industrial-card {
  @apply bg-industrial-gray border border-industrial-border rounded-none;
}

.industrial-header {
  @apply font-serif italic text-[11px] uppercase tracking-wider opacity-50;
}

