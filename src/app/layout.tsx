import type { Metadata } from 'next';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { SettingsProvider } from '@/lib/settings';
import './globals.css';

export const metadata: Metadata = { title: 'Life OS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-density="cozy" data-privacy="off">
        <SettingsProvider>
          <div className="app">
            <Sidebar />
            <div className="main">
              <Topbar />
              <div className="content">
                {children}
              </div>
            </div>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
