
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/hooks/use-theme';
import { PT_Sans } from 'next/font/google';

const calendarIconSvg = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="hsl(210 13% 50%)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <rect width="4" height="4" x="7" y="14" rx="0.5" fill="hsl(210 13% 50%)" />
  </svg>
`;

const faviconHref = `data:image/svg+xml,${encodeURIComponent(calendarIconSvg)}`;


export const metadata: Metadata = {
  // Disables the default favicon handling.
  // See: https://nextjs.org/docs/app/api-reference/functions/generate-metadata#icons
  metadataBase: null,
  title: 'Scoodol',
  description: 'Scoodol - Dein smarter Begleiter für den Schulalltag.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: faviconHref,
    apple: faviconHref,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
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
