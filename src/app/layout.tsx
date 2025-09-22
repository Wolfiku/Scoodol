
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/hooks/use-theme';
import { PT_Sans } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Scoodol',
  description: 'Scoodol - Dein smarter Begleiter für den Schulalltag.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/Favicon.svg', type: 'image/svg+xml' },
      { url: '/Favicon.png', type: 'image/png' },
    ],
    shortcut: '/Favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-pt-sans',
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${ptSans.variable} font-body antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
