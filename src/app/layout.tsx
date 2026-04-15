import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Why Not Preloved — POS System",
  description: "Sistem POS untuk event preloved Why Not Preloved.",
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WNP POS" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
      </body>
    </html>
  );
}