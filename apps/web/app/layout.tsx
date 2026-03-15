import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FreightWizard - AI-Powered Freight Email Management',
  description: 'Automate your freight forwarding inbox with AI. Analyze emails, extract shipment data, and generate smart replies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
