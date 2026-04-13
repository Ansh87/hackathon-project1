import type { Metadata } from 'next';
import { Header } from '@/components/header';
import './globals.css';

export const dynamic = 'force-dynamic';

const APP_NAME = 'FloodScore';
const APP_DESCRIPTION = 'Financial Transparency for Homebuyers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: `${APP_NAME} - ${APP_DESCRIPTION}`,
  description: APP_DESCRIPTION,
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: `${APP_NAME} - ${APP_DESCRIPTION}`,
    description: APP_DESCRIPTION,
    url: '/',
    siteName: APP_NAME,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} - ${APP_DESCRIPTION}`,
    description: APP_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
      </head>
      <body className="bg-gray-50 text-gray-900">
        <Header />
        <main className="min-h-screen">
          {children}
        </main>
        <footer className="bg-gray-900 text-gray-300 py-8 border-t border-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm">
              © {new Date().getFullYear()} FloodScore. Financial transparency for informed homebuying decisions.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
