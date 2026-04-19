import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import Link from 'next/link';
import { Providers } from './providers';
import { NavActions } from '@/components/NavActions';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Daftar Harga',
  description: 'Product price management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-[family-name:var(--font-dm-sans)] min-h-screen">
        <Providers>
          <nav className="sticky top-0 z-50 bg-surface border-b border-border px-6 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="font-[family-name:var(--font-dm-mono)] text-sm tracking-tight text-text"
            >
              daftar_harga
            </Link>
            <NavActions />
          </nav>
          <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
