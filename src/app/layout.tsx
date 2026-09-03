
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/hooks/use-theme';
import { PT_Sans } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase';
import { APP_VERSION } from '@/app/lib/version';

export const metadata: Metadata = {
  title: 'Scoodol',
  description: 'Scoodol - Dein smarter Begleiter für den Schulalltag.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#3B82F6',
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme) {
                    var parts = theme.split('-');
                    var mode = parts[0] === 'dark' ? 'dark' : 'light';
                    var color = parts.length > 1 ? parts[1] : 'default';
                    document.documentElement.classList.add(mode);
                    document.documentElement.setAttribute('data-theme', color);
                  } else {
                    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.classList.add(isDark ? 'dark' : 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${ptSans.variable} font-body antialiased`}>
        <FirebaseClientProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
