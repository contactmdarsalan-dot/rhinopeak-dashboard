import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'RhinoPeak Business Dashboard',
  description: 'All-in-one business intelligence dashboard for modern Nepali businesses - built by RhinoPeak Labs.',
  keywords: ['business dashboard', 'sales analytics', 'inventory', 'RhinoPeak'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
