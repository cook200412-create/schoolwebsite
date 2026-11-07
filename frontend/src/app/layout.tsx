import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import { AuthProvider } from '@/hooks/use-auth';
import '@/styles/globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Lora({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Sri Satya Sai Vidyanikethan', template: '%s | Sri Satya Sai Vidyanikethan' },
  description: 'Official website and smart school management platform of Sri Satya Sai Vidyanikethan.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c2552' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
