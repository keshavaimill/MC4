import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MC4 AI Command Center',
  description: 'MC4 Forecasting and Planning System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
