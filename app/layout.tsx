import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { heading, body } from '@/lib/fonts';
import { Navigation } from '@/app/components/Navigation';
import { Footer } from '@/app/components/Footer';
import { CartProvider } from '@/app/components/CartProvider';
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
          <CartProvider>
            <Navigation />
            {children}
            <Footer />
          </CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
