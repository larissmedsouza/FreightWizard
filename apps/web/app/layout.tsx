import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter, Sora } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Marketing landing page fonts. Exposed as CSS variables only; the homepage
// wrapper opts in via font-fw-sans, so the dashboard keeps Inter.
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
      <body className={`${inter.variable} ${sora.variable} ${plexSans.variable} ${plexMono.variable} ${inter.className}`}>{children}</body>
    </html>
  );
}
