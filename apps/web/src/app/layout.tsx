import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from './providers';
import { ThemeInitializer } from './theme-sync';

export const metadata: Metadata = {
  title: 'Cusic',
  description: 'Mobile-first AI music player with an embedded DJ assistant',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>
          <ThemeInitializer />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
