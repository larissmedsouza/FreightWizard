import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from 'next/font/google';

// Sora (display), IBM Plex Sans (UI) and IBM Plex Mono (data), exposed as CSS
// variables. Every page root sets font-fw-sans; the body default matches.
const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '600'], variable: '--font-sora', display: 'swap' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://freightwizard.app';
const TITLE = 'Freightwizard: AI copilot for freight forwarding';
const DESCRIPTION = 'Automate your freight forwarding inbox with AI. Analyze emails, extract shipment data, and generate smart replies.';
const OG_IMAGE = { url: '/brand/og-image.png', width: 1200, height: 630, alt: 'Freightwizard' };

// Favicon and app icons come from app/favicon.ico, app/icon.png and
// app/apple-icon.png (W mark on navy), picked up by Next.js automatically.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Freightwizard',
  openGraph: { type: 'website', siteName: 'Freightwizard', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
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
