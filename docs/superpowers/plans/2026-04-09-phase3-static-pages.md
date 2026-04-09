# Phase 3: Static Pages & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared navigation, footer, homepage, content pages, and form pages — establishing the LOUISLUSO visual identity across the entire site.

**Architecture:** Design system (fonts, colors) configured in layout.tsx and globals.css. Navigation and footer are Server Components in the shared layout. Content pages are static. Form pages use client components for interactivity with server-side API routes for submission (Gmail API for contact, Zoho CRM for partner applications).

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS 4, Cormorant Garamond + DM Sans (next/font), Heroicons, Zod, Gmail API (googleapis), Zoho CRM API

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `lib/fonts.ts` | Font configuration (Cormorant Garamond + DM Sans via next/font) |
| `lib/gmail.ts` | Gmail API send function for contact/partner forms |
| `lib/schemas/contact.ts` | Zod schema for contact form validation |
| `lib/schemas/partner.ts` | Zod schema for partner application form validation |
| `app/components/Navigation.tsx` | Top bar + main nav bar (Server Component) |
| `app/components/MobileMenu.tsx` | Slide-out mobile menu (Client Component) |
| `app/components/MegaMenu.tsx` | Eyeglasses collection dropdown (Client Component) |
| `app/components/Footer.tsx` | Site footer |
| `app/components/forms/TextInput.tsx` | Reusable form input (Client Component) |
| `app/components/forms/TextArea.tsx` | Reusable textarea (Client Component) |
| `app/components/forms/Select.tsx` | Reusable dropdown (Client Component) |
| `app/components/forms/FileUpload.tsx` | PDF upload with drag-and-drop (Client Component) |
| `app/components/forms/SubmitButton.tsx` | Button with loading state (Client Component) |
| `app/why-louisluso/page.tsx` | Why LOUISLUSO content page |
| `app/about/page.tsx` | About Us content page |
| `app/contact/page.tsx` | Contact form page (Client Component) |
| `app/become-a-partner/page.tsx` | Partner application form page (Client Component) |
| `app/privacy/page.tsx` | Privacy policy (placeholder) |
| `app/terms/page.tsx` | Terms of service (placeholder) |
| `app/api/contact/route.ts` | Contact form API route |
| `app/api/become-a-partner/route.ts` | Partner application API route |
| `__tests__/lib/schemas/contact.test.ts` | Contact schema tests |
| `__tests__/lib/schemas/partner.test.ts` | Partner schema tests |
| `__tests__/app/api/contact.test.ts` | Contact API route tests |
| `__tests__/app/api/become-a-partner.test.ts` | Partner API route tests |

### Modified files

| File | Changes |
|---|---|
| `app/layout.tsx` | Add fonts, Navigation, Footer |
| `app/globals.css` | Add custom Tailwind theme (colors, fonts) |
| `app/page.tsx` | Replace placeholder with full homepage |

---

## Task 1: Design System (Fonts + CSS Theme)

Configure the visual foundation that all pages depend on.

**Files:**
- Create: `lib/fonts.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create font configuration**

```ts
// lib/fonts.ts
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

export const heading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
  display: "swap",
});

export const body = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
```

- [ ] **Step 2: Update globals.css with theme**

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-bronze: #8B6F4E;
  --color-bronze-light: #C4A882;
  --color-off-white: #FAFAF9;
  --color-warm-bg: #F0ECE6;

  --font-heading: var(--font-heading);
  --font-body: var(--font-body);
}

body {
  font-family: var(--font-body), system-ui, sans-serif;
  color: #1A1A1A;
  background: #FFFFFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 3: Update layout.tsx with fonts and body classes**

```tsx
// app/layout.tsx
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
```

- [ ] **Step 4: Verify fonts load**

Run: `pnpm dev`
Visit: `http://localhost:3000`
Expected: Body text renders in DM Sans. Inspect element confirms `--font-heading` and `--font-body` CSS variables are set.

- [ ] **Step 5: Commit**

```bash
git add lib/fonts.ts app/globals.css app/layout.tsx
git commit -m "feat: add design system with Cormorant Garamond + DM Sans fonts"
```

---

## Task 2: Navigation

Server Component with a client-side MobileMenu and MegaMenu.

**Files:**
- Create: `app/components/Navigation.tsx`
- Create: `app/components/MobileMenu.tsx`
- Create: `app/components/MegaMenu.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install Heroicons**

```bash
pnpm add @heroicons/react
```

- [ ] **Step 2: Create MegaMenu client component**

```tsx
// app/components/MegaMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/catalog/collections";

interface MegaMenuProps {
  collections: Collection[];
  label: string;
  basePath: string;
}

export function MegaMenu({
  collections,
  label,
  basePath,
}: MegaMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
      >
        {label}
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute left-0 top-full z-50 mt-2 w-[500px] border border-gray-200 bg-white p-6 shadow-lg"
        >
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {collections.map((c) => (
              <Link
                key={c.slug}
                href={`${basePath}/${c.slug}`}
                onClick={() => setOpen(false)}
                className="text-sm text-gray-600 transition-colors hover:text-bronze"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Link
              href={basePath}
              onClick={() => setOpen(false)}
              className="text-xs font-medium uppercase tracking-[2px] text-bronze"
            >
              View All {label} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create MobileMenu client component**

```tsx
// app/components/MobileMenu.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Collection } from "@/lib/catalog/collections";

interface MobileMenuProps {
  eyeglassesCollections: Collection[];
  sunglassesCollections: Collection[];
}

export function MobileMenu({
  eyeglassesCollections,
  sunglassesCollections,
}: MobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function toggleSection(section: string): void {
    setExpandedSection(expandedSection === section ? null : section);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-6 w-6 text-gray-700" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto bg-white p-6">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-heading text-xl tracking-[3px]">
                LOUISLUSO
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <XMarkIcon className="h-6 w-6 text-gray-700" />
              </button>
            </div>

            <nav className="space-y-4">
              <div>
                <button
                  onClick={() => toggleSection("eyeglasses")}
                  className="w-full text-left text-sm font-medium uppercase tracking-[1.5px] text-gray-700"
                >
                  Eyeglasses {expandedSection === "eyeglasses" ? "−" : "+"}
                </button>
                {expandedSection === "eyeglasses" && (
                  <div className="mt-2 space-y-2 pl-4">
                    {eyeglassesCollections.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/eyeglasses/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block text-sm text-gray-500 hover:text-bronze"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => toggleSection("sunglasses")}
                  className="w-full text-left text-sm font-medium uppercase tracking-[1.5px] text-gray-700"
                >
                  Sunglasses {expandedSection === "sunglasses" ? "−" : "+"}
                </button>
                {expandedSection === "sunglasses" && (
                  <div className="mt-2 space-y-2 pl-4">
                    {sunglassesCollections.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/sunglasses/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block text-sm text-gray-500 hover:text-bronze"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/accessories"
                onClick={() => setOpen(false)}
                className="block text-sm font-medium uppercase tracking-[1.5px] text-gray-700 hover:text-bronze"
              >
                Accessories
              </Link>
              <Link
                href="/find-a-dealer"
                onClick={() => setOpen(false)}
                className="block text-sm font-medium uppercase tracking-[1.5px] text-gray-700 hover:text-bronze"
              >
                Find a Dealer
              </Link>

              <div className="border-t border-gray-200 pt-4">
                <Link
                  href="/become-a-partner"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-gray-500 hover:text-bronze"
                >
                  Become a Partner
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="mt-2 block text-sm text-gray-500 hover:text-bronze"
                >
                  Contact Us
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Create Navigation server component**

```tsx
// app/components/Navigation.tsx
import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/outline";
import { getCollectionsByCategory } from "@/lib/catalog/collections";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";

export function Navigation(): React.ReactElement {
  const eyeglasses = getCollectionsByCategory("eyeglasses");
  const sunglasses = getCollectionsByCategory("sunglasses");

  return (
    <header>
      {/* Top bar */}
      <div className="bg-[#0a0a0a] px-4 py-1.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-bronze">
            The World&apos;s Lightest Frames
          </span>
          <div className="flex gap-3">
            <a
              href="https://www.facebook.com/louisluso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 transition-colors hover:text-gray-300"
            >
              FB
            </a>
            <a
              href="https://www.instagram.com/louisluso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 transition-colors hover:text-gray-300"
            >
              IG
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          {/* Left: nav links (desktop) */}
          <div className="hidden items-center gap-7 lg:flex">
            <MegaMenu
              collections={eyeglasses}
              label="Eyeglasses"
              basePath="/eyeglasses"
            />
            <Link
              href="/sunglasses"
              className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
            >
              Sunglasses
            </Link>
            <Link
              href="/accessories"
              className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
            >
              Accessories
            </Link>
          </div>

          {/* Center: Logo */}
          <Link
            href="/"
            className="font-heading text-2xl tracking-[4px] text-[#0a0a0a]"
          >
            LOUISLUSO
          </Link>

          {/* Right: utility links (desktop) */}
          <div className="hidden items-center gap-6 lg:flex">
            <Link
              href="/find-a-dealer"
              className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
            >
              Find a Dealer
            </Link>
            <Link href="/portal" aria-label="Favorites">
              <HeartIcon className="h-5 w-5 text-gray-500 transition-colors hover:text-bronze" />
            </Link>
            <Link
              href="/portal"
              className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
            >
              Login
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <MobileMenu
            eyeglassesCollections={eyeglasses}
            sunglassesCollections={sunglasses}
          />
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 5: Add Navigation to layout.tsx**

Update `app/layout.tsx` — add `<Navigation />` inside the ClerkProvider, before `{children}`:

```tsx
import { Navigation } from '@/app/components/Navigation';

// ... in the return:
<ClerkProvider>
  <Navigation />
  {children}
</ClerkProvider>
```

- [ ] **Step 6: Verify navigation renders**

Run: `pnpm dev`
Visit: `http://localhost:3000`
Expected: Dark top bar with bronze tagline, white nav bar with centered LOUISLUSO logo, nav links, mega-menu on Eyeglasses hover. Mobile: hamburger icon at < 1024px.

- [ ] **Step 7: Commit**

```bash
git add lib/fonts.ts app/components/Navigation.tsx app/components/MobileMenu.tsx app/components/MegaMenu.tsx app/layout.tsx
git commit -m "feat: add navigation with mega-menu and mobile drawer"
```

---

## Task 3: Footer

**Files:**
- Create: `app/components/Footer.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create Footer component**

```tsx
// app/components/Footer.tsx
import Link from "next/link";

const shopLinks = [
  { label: "Eyeglasses", href: "/eyeglasses" },
  { label: "Sunglasses", href: "/sunglasses" },
  { label: "Accessories", href: "/accessories" },
];

const companyLinks = [
  { label: "Why LOUISLUSO", href: "/why-louisluso" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

const connectLinks = [
  { label: "Find a Dealer", href: "/find-a-dealer" },
  { label: "Become a Partner", href: "/become-a-partner" },
  {
    label: "Facebook",
    href: "https://www.facebook.com/louisluso",
    external: true,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/louisluso",
    external: true,
  },
];

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}): React.ReactElement {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-gray-400">
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-gray-500 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer(): React.ReactElement {
  return (
    <footer className="bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Logo + tagline */}
        <div className="mb-12">
          <Link href="/" className="font-heading text-2xl tracking-[4px] text-white">
            LOUISLUSO
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[1.5px] text-bronze">
            The World&apos;s Lightest Frames
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <FooterLinkGroup title="Shop" links={shopLinks} />
          <FooterLinkGroup title="Company" links={companyLinks} />
          <FooterLinkGroup title="Connect" links={connectLinks} />
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} LOUISLUSO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Add Footer to layout.tsx**

```tsx
import { Footer } from '@/app/components/Footer';

// ... in the return:
<ClerkProvider>
  <Navigation />
  {children}
  <Footer />
</ClerkProvider>
```

- [ ] **Step 3: Verify footer renders**

Run: `pnpm dev`
Expected: Dark footer with logo, tagline in bronze, 3-column link grid, copyright.

- [ ] **Step 4: Commit**

```bash
git add app/components/Footer.tsx app/layout.tsx
git commit -m "feat: add site footer"
```

---

## Task 4: Homepage

Replace the placeholder homepage with the full design.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement full homepage**

```tsx
// app/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import {
  ScaleIcon,
  ShieldCheckIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "LOUISLUSO — The World's Lightest Frames",
  description:
    "Premium eyewear crafted from ULTEM — lighter than titanium, stronger than steel. Trusted by 500+ optical stores.",
};

export default function HomePage(): React.ReactElement {
  return (
    <main>
      {/* Hero */}
      <section className="flex min-h-[70vh] items-center justify-center bg-warm-bg px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a] sm:text-6xl lg:text-7xl">
            Engineered for Comfort
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-gray-600">
            Premium eyewear crafted from ULTEM — lighter than titanium, stronger
            than steel. Every frame weighs under 10 grams.
          </p>
          <Link
            href="/eyeglasses"
            className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Explore the Collection
          </Link>
        </div>
      </section>

      {/* Featured Collections */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Link href="/eyeglasses/signature-series" className="group block">
              <div className="aspect-[3/2] w-full overflow-hidden bg-gray-100">
                <div className="flex h-full items-center justify-center text-gray-400">
                  <span className="font-heading text-2xl">Signature Series</span>
                </div>
              </div>
              <h2 className="mt-4 font-heading text-2xl text-gray-900">
                Signature Series
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Our flagship ULTEM collection — vibrant colors that never fade.
              </p>
              <span className="mt-2 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze group-hover:underline">
                Shop Now →
              </span>
            </Link>

            <Link href="/eyeglasses/london-collection" className="group block">
              <div className="aspect-[3/2] w-full overflow-hidden bg-gray-100">
                <div className="flex h-full items-center justify-center text-gray-400">
                  <span className="font-heading text-2xl">London Collection</span>
                </div>
              </div>
              <h2 className="mt-4 font-heading text-2xl text-gray-900">
                London Collection
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Wagner metal meets ULTEM — traditional yet modern design.
              </p>
              <span className="mt-2 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze group-hover:underline">
                Shop Now →
              </span>
            </Link>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/eyeglasses"
              className="text-[13px] font-medium uppercase tracking-[2px] text-bronze hover:underline"
            >
              View All Collections →
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Promise */}
      <section className="bg-off-white px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-3">
          <div className="text-center">
            <ScaleIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">Ultra-Lightweight</h3>
            <p className="mt-2 text-sm text-gray-600">
              Crafted from ULTEM — a space-grade polymer. Every frame weighs
              under 10 grams, 50% lighter than metal.
            </p>
          </div>
          <div className="text-center">
            <ShieldCheckIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">Premium Quality</h3>
            <p className="mt-2 text-sm text-gray-600">
              FDA-approved and ECO-certified. Hypoallergenic, flexible, and
              built to last with Korean precision engineering.
            </p>
          </div>
          <div className="text-center">
            <MapPinIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">500+ Dealers</h3>
            <p className="mt-2 text-sm text-gray-600">
              Trusted by optical stores nationwide. Find a dealer near you or
              become a partner.
            </p>
          </div>
        </div>
      </section>

      {/* Why LOUISLUSO Teaser */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-4xl text-gray-900">
              The World&apos;s Lightest Frames
            </h2>
            <p className="mt-6 text-gray-600 leading-relaxed">
              ULTEM is a high-tech thermoplastic used in aerospace and medical
              devices. It&apos;s feather-light yet exceptionally durable, flexible,
              and hypoallergenic — ideal for everyday wear. Temperature resistant
              from -30&deg;C to 230&deg;C.
            </p>
            <Link
              href="/why-louisluso"
              className="mt-6 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze hover:underline"
            >
              Learn More →
            </Link>
          </div>
          <div className="aspect-[4/3] bg-gray-100">
            <div className="flex h-full items-center justify-center text-gray-400">
              <span className="text-sm uppercase tracking-wide">
                Product Photography
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section className="bg-[#0a0a0a] px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-4xl text-white">Partner With Us</h2>
          <p className="mt-4 text-gray-400">
            Join 500+ optical stores carrying LOUISLUSO frames. Competitive
            wholesale pricing, dedicated support, and a product your customers
            will love.
          </p>
          <Link
            href="/become-a-partner"
            className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Apply Now
          </Link>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify homepage**

Run: `pnpm dev`
Visit: `http://localhost:3000`
Expected: Hero with warm background, 2 featured collection cards, brand promise strip, why teaser, partner CTA. All typography in Cormorant Garamond (headings) and DM Sans (body).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add homepage with hero, featured collections, and CTAs"
```

---

## Task 5: Content Pages (Why, About, Privacy, Terms)

Static content pages — no interactivity.

**Files:**
- Create: `app/why-louisluso/page.tsx`
- Create: `app/about/page.tsx`
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`

- [ ] **Step 1: Create Why LOUISLUSO page**

```tsx
// app/why-louisluso/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why LOUISLUSO — The World's Lightest Frames",
  description:
    "Discover ULTEM — the aerospace-grade material that makes LOUISLUSO frames 50% lighter than metal.",
};

export default function WhyLouislusoPage(): React.ReactElement {
  return (
    <main>
      {/* Hero */}
      <section className="bg-warm-bg px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a]">
            Why LOUISLUSO?
          </h1>
          <p className="mt-4 text-gray-600">
            The lightest and most comfortable frames, while never sacrificing
            strength and style.
          </p>
        </div>
      </section>

      {/* ULTEM Material */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl">The ULTEM Advantage</h2>
          <p className="mt-6 leading-relaxed text-gray-600">
            ULTEM is a high-performance thermoplastic originally developed for
            aerospace and medical applications. It delivers seemingly
            contradictory qualities — feather-light yet exceptionally durable,
            flexible yet strong. Our frames weigh under 10 grams, making them
            up to 50% lighter than traditional metal frames.
          </p>

          {/* Specs grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                Ultra-Lightweight
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Under 10g per frame — 50% lighter than metal. You&apos;ll forget
                you&apos;re wearing them.
              </p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                Flexible &amp; Durable
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Exceptional mechanical strength with remarkable bendability.
                Built to withstand daily wear.
              </p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                Hypoallergenic
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Safe for sensitive skin. No nickel, no irritation — comfortable
                for all-day wear.
              </p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                FDA &amp; ECO Certified
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Meets FDA standards and manufactured using environmentally
                conscious processes.
              </p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                Temperature Resistant
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Functions from -30&deg;C to 230&deg;C. Engineered for any
                environment.
              </p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                Aerospace Grade
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                The same material used in advanced medical devices and aerospace
                components.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Material Comparison */}
      <section className="bg-off-white px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl">How ULTEM Compares</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-[1px] text-gray-500">
                    Property
                  </th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-bronze">
                    ULTEM
                  </th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">
                    Acetate
                  </th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">
                    Metal
                  </th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">
                    Titanium
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-200">
                  <td className="py-3">Weight</td>
                  <td className="py-3 text-center font-medium text-bronze">Lightest</td>
                  <td className="py-3 text-center">Heavy</td>
                  <td className="py-3 text-center">Heavy</td>
                  <td className="py-3 text-center">Light</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3">Flexibility</td>
                  <td className="py-3 text-center font-medium text-bronze">Excellent</td>
                  <td className="py-3 text-center">Poor</td>
                  <td className="py-3 text-center">Moderate</td>
                  <td className="py-3 text-center">Good</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3">Hypoallergenic</td>
                  <td className="py-3 text-center font-medium text-bronze">Yes</td>
                  <td className="py-3 text-center">Yes</td>
                  <td className="py-3 text-center">No</td>
                  <td className="py-3 text-center">Yes</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3">Durability</td>
                  <td className="py-3 text-center font-medium text-bronze">Excellent</td>
                  <td className="py-3 text-center">Moderate</td>
                  <td className="py-3 text-center">Good</td>
                  <td className="py-3 text-center">Excellent</td>
                </tr>
                <tr>
                  <td className="py-3">Price</td>
                  <td className="py-3 text-center font-medium text-bronze">$$</td>
                  <td className="py-3 text-center">$$</td>
                  <td className="py-3 text-center">$</td>
                  <td className="py-3 text-center">$$$</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl">Experience the Difference</h2>
          <p className="mt-4 text-gray-600">
            Visit a dealer to try LOUISLUSO frames, or explore our collections
            online.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/find-a-dealer"
              className="inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
            >
              Find a Dealer
            </Link>
            <Link
              href="/eyeglasses"
              className="inline-block px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-gray-600 transition-colors hover:text-bronze"
            >
              Explore Collections →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create About page**

```tsx
// app/about/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us — LOUISLUSO",
  description:
    "Q-Vision Optics — creating the world's lightest frames from Arlington Heights, Illinois.",
};

export default function AboutPage(): React.ReactElement {
  return (
    <main>
      <section className="bg-warm-bg px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a]">
            About LOUISLUSO
          </h1>
          <p className="mt-4 text-gray-600">
            Creating exceptionally light eyewear that combines functionality
            with personal style.
          </p>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-16">
          {/* Mission */}
          <div>
            <h2 className="font-heading text-3xl">Our Mission</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              LOUISLUSO creates exceptionally light eyewear frames using ULTEM —
              a material that is 50% lighter than metal yet incredibly durable
              and flexible. We combine functionality with personal style and
              quality craftsmanship, because your eyewear should be as
              comfortable as it is beautiful.
            </p>
          </div>

          {/* Vision */}
          <div>
            <h2 className="font-heading text-3xl">Our Vision</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              To become a recognized global leader in eyewear, known for
              innovative, lightweight frames that reflect individual style while
              making positive environmental impacts through eco-conscious
              manufacturing.
            </p>
          </div>

          {/* Values */}
          <div>
            <h2 className="font-heading text-3xl">Our Values</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                  Innovation
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Continuously developing new materials and technologies to
                  create unique, high-quality eyewear.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                  Customer Oriented
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Understanding customer needs and delivering exceptional
                  service and satisfaction.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">
                  Comfort
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Lightweight design with universal fit through flexible ULTEM
                  material for every wearer.
                </p>
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div className="border-t border-gray-200 pt-16 text-center">
            <p className="font-heading text-2xl text-gray-900">
              Trusted by 500+ optical stores across North America
            </p>
            <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">
              Q-Vision Optics, Inc. &middot; 3413 N. Kennicott Ave, Ste B,
              Arlington Heights, IL
            </p>
            <Link
              href="/become-a-partner"
              className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
            >
              Become a Partner
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create Privacy page**

```tsx
// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LOUISLUSO",
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Privacy Policy</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <p>
            This privacy policy describes how LOUISLUSO / Q-Vision Optics, Inc.
            collects, uses, and protects your personal information when you visit
            our website or interact with our services.
          </p>
          <p>
            <em className="text-gray-400">
              Full privacy policy content will be provided by the company. This
              is placeholder text.
            </em>
          </p>
          <p>
            For questions about our privacy practices, contact us at{" "}
            <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
              cs@louisluso.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create Terms page**

```tsx
// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — LOUISLUSO",
};

export default function TermsPage(): React.ReactElement {
  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Terms of Service</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <p>
            These terms of service govern your use of the LOUISLUSO website and
            services provided by Q-Vision Optics, Inc.
          </p>
          <p>
            <em className="text-gray-400">
              Full terms of service content will be provided by the company. This
              is placeholder text.
            </em>
          </p>
          <p>
            For questions, contact us at{" "}
            <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
              cs@louisluso.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify all content pages**

Run: `pnpm dev`
Visit each page: `/why-louisluso`, `/about`, `/privacy`, `/terms`
Expected: All render with correct typography, bronze accents, consistent spacing.

- [ ] **Step 6: Commit**

```bash
git add app/why-louisluso/page.tsx app/about/page.tsx app/privacy/page.tsx app/terms/page.tsx
git commit -m "feat: add content pages (why, about, privacy, terms)"
```

---

## Task 6: Form Components

Reusable client components for the contact and partner forms.

**Files:**
- Create: `app/components/forms/TextInput.tsx`
- Create: `app/components/forms/TextArea.tsx`
- Create: `app/components/forms/Select.tsx`
- Create: `app/components/forms/FileUpload.tsx`
- Create: `app/components/forms/SubmitButton.tsx`

- [ ] **Step 1: Create TextInput**

```tsx
// app/components/forms/TextInput.tsx
"use client";

interface TextInputProps {
  label: string;
  name: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TextInput({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  value,
  onChange,
  error,
}: TextInputProps): React.ReactElement {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-[1px] text-gray-500"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-bronze ${
          error ? "border-red-400" : "border-gray-200"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create TextArea**

```tsx
// app/components/forms/TextArea.tsx
"use client";

interface TextAreaProps {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TextArea({
  label,
  name,
  required = false,
  placeholder,
  rows = 5,
  value,
  onChange,
  error,
}: TextAreaProps): React.ReactElement {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-[1px] text-gray-500"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <textarea
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-bronze ${
          error ? "border-red-400" : "border-gray-200"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create Select**

```tsx
// app/components/forms/Select.tsx
"use client";

interface SelectProps {
  label: string;
  name: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function Select({
  label,
  name,
  required = false,
  options,
  value,
  onChange,
  error,
}: SelectProps): React.ReactElement {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-[1px] text-gray-500"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-bronze ${
          error ? "border-red-400" : "border-gray-200"
        }`}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create FileUpload**

```tsx
// app/components/forms/FileUpload.tsx
"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  label: string;
  name: string;
  accept?: string;
  maxSizeMB?: number;
  required?: boolean;
  onFileSelect: (file: File | null) => void;
  error?: string;
}

export function FileUpload({
  label,
  name,
  accept = ".pdf",
  maxSizeMB = 20,
  required = false,
  onFileSelect,
  error,
}: FileUploadProps): React.ReactElement {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null): void {
    if (!file) {
      setFileName(null);
      onFileSelect(null);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setFileName(null);
      onFileSelect(null);
      return;
    }
    setFileName(file.name);
    onFileSelect(file);
  }

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-[1px] text-gray-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-8 transition-colors ${
          dragOver
            ? "border-bronze bg-warm-bg"
            : error
              ? "border-red-400"
              : "border-gray-200 hover:border-gray-400"
        }`}
      >
        {fileName ? (
          <p className="text-sm text-gray-700">{fileName}</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Drop a file here or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PDF only, max {maxSizeMB}MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create SubmitButton**

```tsx
// app/components/forms/SubmitButton.tsx
"use client";

interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SubmitButton({
  label,
  loading = false,
  disabled = false,
}: SubmitButtonProps): React.ReactElement {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full border border-bronze bg-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Submitting..." : label}
    </button>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/components/forms/
git commit -m "feat: add reusable form components"
```

---

## Task 7: Gmail Send Utility

Server-side function to send emails via Gmail API using env var credentials.

**Files:**
- Create: `lib/gmail.ts`

- [ ] **Step 1: Create Gmail send utility**

```ts
// lib/gmail.ts
import { google } from "googleapis";
import { env } from "@/lib/env";

function getGmailClient(): ReturnType<typeof google.gmail> {
  const auth = new google.auth.OAuth2(
    env.GMAIL_CLIENT_ID,
    env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: "v1", auth });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const gmail = getGmailClient();

  const headers = [
    `To: ${options.to}`,
    `From: cs@louisluso.com`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`);
  }

  const message = [...headers, "", options.body].join("\r\n");
  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gmail.ts
git commit -m "feat: add Gmail send utility for contact forms"
```

---

## Task 8: Form Validation Schemas + API Routes

Zod schemas and API routes for contact and partner forms.

**Files:**
- Create: `lib/schemas/contact.ts`
- Create: `lib/schemas/partner.ts`
- Create: `app/api/contact/route.ts`
- Create: `app/api/become-a-partner/route.ts`
- Test: `__tests__/lib/schemas/contact.test.ts`
- Test: `__tests__/lib/schemas/partner.test.ts`
- Test: `__tests__/app/api/contact.test.ts`
- Test: `__tests__/app/api/become-a-partner.test.ts`

- [ ] **Step 1: Write contact schema tests**

```ts
// __tests__/lib/schemas/contact.test.ts
import { describe, it, expect } from "vitest";
import { contactSchema } from "@/lib/schemas/contact";

describe("contactSchema", () => {
  it("validates a complete contact form", () => {
    const result = contactSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
      subject: "General Inquiry",
      message: "Hello, I have a question.",
    });
    expect(result.success).toBe(true);
  });

  it("allows phone to be empty", () => {
    const result = contactSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      phone: "",
      subject: "General Inquiry",
      message: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = contactSchema.safeParse({
      name: "",
      email: "john@example.com",
      subject: "General Inquiry",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactSchema.safeParse({
      name: "John",
      email: "not-an-email",
      subject: "General Inquiry",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid subject", () => {
    const result = contactSchema.safeParse({
      name: "John",
      email: "john@example.com",
      subject: "Invalid Subject",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty message", () => {
    const result = contactSchema.safeParse({
      name: "John",
      email: "john@example.com",
      subject: "General Inquiry",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Create contact schema**

```ts
// lib/schemas/contact.ts
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().default(""),
  subject: z.enum([
    "General Inquiry",
    "Product Question",
    "Partnership",
    "Other",
  ], { message: "Please select a subject" }),
  message: z.string().min(1, "Message is required"),
});

export type ContactFormData = z.infer<typeof contactSchema>;
```

- [ ] **Step 3: Run contact schema tests**

Run: `pnpm test -- __tests__/lib/schemas/contact.test.ts`
Expected: All PASS

- [ ] **Step 4: Write partner schema tests**

```ts
// __tests__/lib/schemas/partner.test.ts
import { describe, it, expect } from "vitest";
import { partnerSchema } from "@/lib/schemas/partner";

describe("partnerSchema", () => {
  const validData = {
    company: "Test Optical",
    contactName: "John Doe",
    email: "john@example.com",
    phone: "555-1234",
    address: "123 Main St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    referralSource: "Friend",
    referralOther: "",
  };

  it("validates complete partner application", () => {
    const result = partnerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing company", () => {
    const result = partnerSchema.safeParse({ ...validData, company: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = partnerSchema.safeParse({ ...validData, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid referral source", () => {
    const result = partnerSchema.safeParse({
      ...validData,
      referralSource: "Invalid",
    });
    expect(result.success).toBe(false);
  });

  it("requires referralOther when source is Other", () => {
    const result = partnerSchema.safeParse({
      ...validData,
      referralSource: "Other",
      referralOther: "",
    });
    expect(result.success).toBe(false);
  });

  it("allows referralOther when source is Other and filled", () => {
    const result = partnerSchema.safeParse({
      ...validData,
      referralSource: "Other",
      referralOther: "Trade show",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 5: Create partner schema**

```ts
// lib/schemas/partner.ts
import { z } from "zod";

export const partnerSchema = z
  .object({
    company: z.string().min(1, "Company name is required"),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Valid email required"),
    phone: z.string().min(1, "Phone is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zip: z.string().min(1, "Zip code is required"),
    referralSource: z.enum(["Friend", "Advertisement", "Social Media", "Other"], {
      message: "Please select how you heard about us",
    }),
    referralOther: z.string().optional().default(""),
  })
  .refine(
    (data) =>
      data.referralSource !== "Other" || data.referralOther.length > 0,
    {
      message: "Please specify how you heard about us",
      path: ["referralOther"],
    },
  );

export type PartnerFormData = z.infer<typeof partnerSchema>;
```

- [ ] **Step 6: Run partner schema tests**

Run: `pnpm test -- __tests__/lib/schemas/partner.test.ts`
Expected: All PASS

- [ ] **Step 7: Create contact API route**

```ts
// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { contactSchema } from "@/lib/schemas/contact";
import { sendEmail } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    await sendEmail({
      to: "cs@louisluso.com",
      subject: `[Contact Form] ${subject} — ${name}`,
      replyTo: email,
      body: [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : "",
        `Subject: ${subject}`,
        "",
        "Message:",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 8: Create become-a-partner API route**

```ts
// app/api/become-a-partner/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { partnerSchema } from "@/lib/schemas/partner";
import { createLead, attachFileToLead } from "@/lib/zoho/crm";
import type { CRMLeadInput } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const formData = await request.formData();

  // Extract text fields
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    }
  }

  const parsed = partnerSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Extract file if present
  const file = formData.get("creditApplication") as File | null;
  if (file && file.size > 0) {
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 20MB" },
        { status: 400 },
      );
    }
  }

  try {
    // Split contact name into first/last
    const nameParts = data.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const referral =
      data.referralSource === "Other"
        ? `Other: ${data.referralOther}`
        : data.referralSource;

    const leadInput: CRMLeadInput = {
      Company: data.company,
      First_Name: firstName,
      Last_Name: lastName,
      Email: data.email,
      Phone: data.phone,
      Street: data.address,
      City: data.city,
      State: data.state,
      Zip_Code: data.zip,
      Lead_Source: referral,
      Description: `Partner application via website. Referral: ${referral}`,
    };

    const leadId = await createLead(leadInput);

    // Attach file if present — stream directly to Zoho, never stored
    if (file && file.size > 0) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      await attachFileToLead(leadId, buffer, file.name);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 9: Write API route tests**

```ts
// __tests__/app/api/contact.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
}));
const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/contact/route";

describe("POST /api/contact", () => {
  beforeEach(() => {
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
  });

  it("sends email with valid data", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        email: "john@example.com",
        subject: "General Inquiry",
        message: "Hello",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid data", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });

    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        email: "john@example.com",
        subject: "General Inquiry",
        message: "Hello",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
```

```ts
// __tests__/app/api/become-a-partner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateLead, mockAttachFile } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(),
  mockAttachFile: vi.fn(),
}));
const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/zoho/crm", () => ({
  createLead: mockCreateLead,
  attachFileToLead: mockAttachFile,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/become-a-partner/route";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("POST /api/become-a-partner", () => {
  beforeEach(() => {
    mockCreateLead.mockReset().mockResolvedValue("lead-123");
    mockAttachFile.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
  });

  const validFields = {
    company: "Test Optical",
    contactName: "John Doe",
    email: "john@example.com",
    phone: "555-1234",
    address: "123 Main St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    referralSource: "Friend",
  };

  it("creates lead in Zoho CRM", async () => {
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST",
      body: makeFormData(validFields),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        Company: "Test Optical",
        First_Name: "John",
        Last_Name: "Doe",
        Email: "john@example.com",
      }),
    );
  });

  it("returns 400 for missing company", async () => {
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST",
      body: makeFormData({ ...validFields, company: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });

    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST",
      body: makeFormData(validFields),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
```

- [ ] **Step 10: Run all tests**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add lib/schemas/ lib/gmail.ts app/api/contact/route.ts app/api/become-a-partner/route.ts __tests__/lib/schemas/ __tests__/app/api/contact.test.ts __tests__/app/api/become-a-partner.test.ts
git commit -m "feat: add form schemas, Gmail send, and API routes for contact and partner forms"
```

---

## Task 9: Contact Page

Client component with form state management.

**Files:**
- Create: `app/contact/page.tsx`

- [ ] **Step 1: Create contact page**

```tsx
// app/contact/page.tsx
"use client";

import { useState } from "react";
import { TextInput } from "@/app/components/forms/TextInput";
import { TextArea } from "@/app/components/forms/TextArea";
import { Select } from "@/app/components/forms/Select";
import { SubmitButton } from "@/app/components/forms/SubmitButton";

const SUBJECT_OPTIONS = [
  { value: "General Inquiry", label: "General Inquiry" },
  { value: "Product Question", label: "Product Question" },
  { value: "Partnership", label: "Partnership" },
  { value: "Other", label: "Other" },
];

export default function ContactPage(): React.ReactElement {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      if (data.details) {
        const fieldErrors: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(data.details)) {
          fieldErrors[key] = (msgs as string[])[0] ?? "";
        }
        setErrors(fieldErrors);
      }
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl">Thank You</h1>
          <p className="mt-4 text-gray-600">
            We&apos;ve received your message and will get back to you shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-4xl">Contact Us</h1>
        <p className="mt-2 text-gray-600">
          Have a question? We&apos;d love to hear from you.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <TextInput
              label="Name"
              name="name"
              required
              value={form.name}
              onChange={(v) => update("name", v)}
              error={errors.name}
            />
            <TextInput
              label="Email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={(v) => update("email", v)}
              error={errors.email}
            />
            <TextInput
              label="Phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(v) => update("phone", v)}
            />
            <Select
              label="Subject"
              name="subject"
              required
              options={SUBJECT_OPTIONS}
              value={form.subject}
              onChange={(v) => update("subject", v)}
              error={errors.subject}
            />
            <TextArea
              label="Message"
              name="message"
              required
              value={form.message}
              onChange={(v) => update("message", v)}
              error={errors.message}
            />
            <SubmitButton label="Send Message" loading={loading} />
          </form>

          {/* Info + Map */}
          <div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1px] text-gray-500">
                  Address
                </h3>
                <p className="mt-1 text-sm text-gray-700">
                  Q-Vision Optics, Inc.
                  <br />
                  3413 N. Kennicott Ave, Ste B
                  <br />
                  Arlington Heights, IL
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1px] text-gray-500">
                  Email
                </h3>
                <a
                  href="mailto:cs@louisluso.com"
                  className="mt-1 block text-sm text-bronze hover:underline"
                >
                  cs@louisluso.com
                </a>
              </div>
            </div>

            {/* Google Maps embed */}
            <div className="mt-8 aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <iframe
                title="LOUISLUSO Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2960.0!2d-87.98!3d42.08!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDLCsDA0JzQ4LjAiTiA4N8KwNTgnNDguMCJX!5e0!3m2!1sen!2sus!4v1"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

Note: The Google Maps embed URL is a placeholder — the exact embed URL should be generated from Google Maps for the actual business address. The iframe approach is free and doesn't require an API key.

- [ ] **Step 2: Commit**

```bash
git add app/contact/page.tsx
git commit -m "feat: add contact page with form and Google Maps embed"
```

---

## Task 10: Become a Partner Page

Client component with form state, conditional fields, and file upload.

**Files:**
- Create: `app/become-a-partner/page.tsx`

- [ ] **Step 1: Create become-a-partner page**

```tsx
// app/become-a-partner/page.tsx
"use client";

import { useState } from "react";
import { TextInput } from "@/app/components/forms/TextInput";
import { Select } from "@/app/components/forms/Select";
import { FileUpload } from "@/app/components/forms/FileUpload";
import { SubmitButton } from "@/app/components/forms/SubmitButton";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
].map((s) => ({ value: s, label: s }));

const REFERRAL_OPTIONS = [
  { value: "Friend", label: "Friend" },
  { value: "Advertisement", label: "Advertisement" },
  { value: "Social Media", label: "Social Media" },
  { value: "Other", label: "Other" },
];

export default function BecomeAPartnerPage(): React.ReactElement {
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    referralSource: "",
    referralOther: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.append(key, value);
    }
    if (file) {
      formData.append("creditApplication", file);
    }

    const response = await fetch("/api/become-a-partner", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      if (data.details) {
        const fieldErrors: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(data.details)) {
          fieldErrors[key] = (msgs as string[])[0] ?? "";
        }
        setErrors(fieldErrors);
      }
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl">Thank You</h1>
          <p className="mt-4 text-gray-600">
            We&apos;ve received your application and will review it within 2-3
            business days. We&apos;ll be in touch!
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Partner With LOUISLUSO</h1>
        <p className="mt-2 text-gray-600">
          Join 500+ optical stores carrying the world&apos;s lightest frames.
          Competitive wholesale pricing, dedicated support, and a product your
          customers will love.
        </p>

        <form onSubmit={handleSubmit} className="mt-12 space-y-6">
          <TextInput
            label="Company Name"
            name="company"
            required
            value={form.company}
            onChange={(v) => update("company", v)}
            error={errors.company}
          />
          <TextInput
            label="Contact Name"
            name="contactName"
            required
            value={form.contactName}
            onChange={(v) => update("contactName", v)}
            error={errors.contactName}
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextInput
              label="Email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={(v) => update("email", v)}
              error={errors.email}
            />
            <TextInput
              label="Phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={(v) => update("phone", v)}
              error={errors.phone}
            />
          </div>
          <TextInput
            label="Street Address"
            name="address"
            required
            value={form.address}
            onChange={(v) => update("address", v)}
            error={errors.address}
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <TextInput
                label="City"
                name="city"
                required
                value={form.city}
                onChange={(v) => update("city", v)}
                error={errors.city}
              />
            </div>
            <Select
              label="State"
              name="state"
              required
              options={US_STATES}
              value={form.state}
              onChange={(v) => update("state", v)}
              error={errors.state}
            />
            <TextInput
              label="Zip Code"
              name="zip"
              required
              value={form.zip}
              onChange={(v) => update("zip", v)}
              error={errors.zip}
            />
          </div>
          <Select
            label="How did you hear about us?"
            name="referralSource"
            required
            options={REFERRAL_OPTIONS}
            value={form.referralSource}
            onChange={(v) => update("referralSource", v)}
            error={errors.referralSource}
          />
          {form.referralSource === "Other" && (
            <TextInput
              label="Please specify"
              name="referralOther"
              required
              value={form.referralOther}
              onChange={(v) => update("referralOther", v)}
              error={errors.referralOther}
            />
          )}
          <FileUpload
            label="Credit Application (optional)"
            name="creditApplication"
            accept=".pdf"
            maxSizeMB={20}
            onFileSelect={setFile}
            error={errors.creditApplication}
          />
          <SubmitButton label="Submit Application" loading={loading} />
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/become-a-partner/page.tsx
git commit -m "feat: add become-a-partner page with Zoho CRM integration"
```

---

## Task 11: Full Test Suite & Build Check

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run production build**

Run: `pnpm build`
Expected: Build succeeds. All new routes appear in the output.

- [ ] **Step 3: Verify all pages locally**

Run: `pnpm dev`
Verify:
- `http://localhost:3000` — homepage with hero, featured collections, brand promise, CTAs
- `http://localhost:3000/why-louisluso` — ULTEM material page with comparison table
- `http://localhost:3000/about` — company info, mission/vision/values
- `http://localhost:3000/contact` — form + map + company info
- `http://localhost:3000/become-a-partner` — multi-field form with file upload
- `http://localhost:3000/privacy` — placeholder
- `http://localhost:3000/terms` — placeholder
- Navigation renders on all pages with mega-menu on Eyeglasses
- Footer renders on all pages
- Mobile responsive: hamburger menu works at narrow widths
- Fonts: Cormorant Garamond headings, DM Sans body

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build and test issues"
```
