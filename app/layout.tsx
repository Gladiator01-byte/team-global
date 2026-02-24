import type { Metadata } from 'next';
import Link from 'next/link';

import { AppProviders } from '@/components/providers/app-providers';
import { ThemeToggle } from '@/components/ui/theme-toggle';

import './globals.css';

export const metadata: Metadata = {
  title: 'Team Global',
  description: 'Workforce platform starter',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <div className="min-h-screen bg-background">
            <header className="border-b">
              <div className="container flex h-14 items-center justify-between gap-4">
                <nav className="flex items-center gap-3 text-sm">
                  <Link className="font-semibold" href="/">
                    Team Global
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/sign-in">
                    Auth
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/employee/dashboard">
                    Employee
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/leader/dashboard">
                    Leader
                  </Link>
                </nav>
                <ThemeToggle />
              </div>
            </header>
            <main className="container py-6 sm:py-8 lg:py-10">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
