import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from 'next/font/google';

// Sora (display), IBM Plex Sans (UI) and IBM Plex Mono (data), exposed as CSS
// variables. Every page root sets font-fw-sans; the body default matches.
const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '600'], variable: '--font-sora', display: 'swap' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'FreightWizard - AI-Powered Freight Email Management',
  description: 'Automate your freight forwarding inbox with AI. Analyze emails, extract shipment data, and generate smart replies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Marks JS as available so reveal-on-scroll can hide content first. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className={`${sora.variable} ${plexSans.variable} ${plexMono.variable} font-fw-sans`}>{children}</body>
    </html>
  );
}
