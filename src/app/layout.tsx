// src/app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VC Intel India — Free Portfolio Intelligence',
  description: 'Track portfolio companies of Indian VC funds. Free, open-source, no API keys needed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0a0a0f; color: #e8e8e8; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: #0a0a0f; }
          ::-webkit-scrollbar-thumb { background: #2e2e3e; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #3e3e5e; }
          input::placeholder { color: #444; }
          a:hover { opacity: 0.85; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
