import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { heading, body } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'LOUISLUSO — Premium Eyewear',
  description: "The World's Lightest Frames",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
