# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js application with auth, Zoho API integration, rate limiting, and deploy to Vercel — everything later phases build on.

**Architecture:** Next.js App Router on Vercel with Clerk for auth and serverless API routes that proxy Zoho API calls. Environment validated with Zod. Rate limiting via Upstash Redis. All Zoho credentials server-side only.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, Clerk, Zoho REST APIs (OAuth2), Upstash Redis (rate limiting), Zod, pnpm, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-louisluso-website-redesign.md`

---

## Prerequisites

Before starting, the following accounts must be created and credentials available:

- [ ] Vercel account + project created
- [ ] Clerk account + application created (email-only login configured)
- [ ] Zoho API Console app created (Server-based Application, scopes: `ZohoInventory.items.READ`, `ZohoInventory.salesorders.ALL`, `ZohoBooks.invoices.ALL`, `ZohoBooks.salesorders.ALL`, `ZohoBooks.contacts.ALL`, `ZohoCRM.modules.ALL`)
- [ ] Upstash Redis database created (free tier — for rate limiting)
- [ ] Cloudinary account created

---

## File Structure

```
louisluso/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Clerk provider, fonts, Tailwind)
│   ├── page.tsx                  # Homepage placeholder
│   ├── portal/
│   │   └── layout.tsx            # Portal layout (auth-protected)
│   └── api/
│       ├── health/
│       │   └── route.ts          # Health check endpoint
│       └── zoho/
│           └── products/
│               └── route.ts      # Products API (proxies Zoho Inventory)
├── lib/
│   ├── env.ts                    # Zod-validated environment variables
│   ├── zoho/
│   │   ├── auth.ts               # Zoho OAuth2 token management
│   │   ├── client.ts             # Base Zoho HTTP client (fetch wrapper)
│   │   ├── inventory.ts          # Zoho Inventory API wrapper
│   │   ├── books.ts              # Zoho Books API wrapper
│   │   └── crm.ts                # Zoho CRM API wrapper
│   └── rate-limit.ts             # Upstash rate limiter
├── proxy.ts                      # Clerk auth middleware
├── __tests__/
│   ├── lib/
│   │   ├── env.test.ts           # Env validation tests
│   │   ├── zoho/
│   │   │   ├── auth.test.ts      # Token management tests
│   │   │   ├── client.test.ts    # HTTP client tests
│   │   │   ├── inventory.test.ts # Inventory API tests
│   │   │   ├── books.test.ts     # Books API tests
│   │   │   └── crm.test.ts       # CRM API tests
│   │   └── rate-limit.test.ts    # Rate limiter tests
│   └── app/
│       └── api/
│           └── health.test.ts    # Health endpoint test
├── .env.local.example            # Environment variable template
├── next.config.ts                # Next.js config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config (strict)
├── vitest.config.ts              # Vitest config
├── postcss.config.mjs            # PostCSS for Tailwind
└── package.json                  # Dependencies and scripts
```

**Note:** Existing `scripts/` and `email/` directories remain untouched — they continue to work alongside the new site during the transition.

---

## Task 1: Next.js Project Scaffold

**Files:**
- Create: `package.json` (modify existing — add Next.js deps)
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Initialize Next.js project**

We're adding Next.js to the existing repo (which already has `package.json` for scripts/email). Run from the project root:

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "noUncheckedIndexedAccess": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts", "email"]
}
```

- [ ] **Step 3: Create Next.js config**

Create `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create Tailwind config**

Create `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

Create `postcss.config.mjs`:

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 5: Create root layout and homepage placeholder**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/globals.css`:

```css
@import 'tailwindcss';
```

Create `app/page.tsx`:

```tsx
export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold tracking-tight">LOUISLUSO</h1>
    </main>
  );
}
```

- [ ] **Step 6: Create Vitest config**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

Create `__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Add scripts to package.json**

Add to `package.json` scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Verify the app runs**

```bash
pnpm dev
```

Open `http://localhost:3000` — should see "LOUISLUSO" centered on a white page.

```bash
pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add app/ next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs vitest.config.ts __tests__/setup.ts package.json pnpm-lock.yaml
git commit -m "feat: scaffold Next.js app with TypeScript, Tailwind, Vitest"
```

---

## Task 2: Environment Variables with Zod Validation

**Files:**
- Create: `lib/env.ts`
- Create: `__tests__/lib/env.test.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses valid environment variables', async () => {
    vi.stubEnv('ZOHO_CLIENT_ID', 'test-client-id');
    vi.stubEnv('ZOHO_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('ZOHO_REFRESH_TOKEN', 'test-refresh-token');
    vi.stubEnv('ZOHO_ORG_ID', 'test-org-id');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_xxx');
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_xxx');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'louisluso');
    vi.stubEnv('GMAIL_CLIENT_ID', 'test-gmail-id');
    vi.stubEnv('GMAIL_CLIENT_SECRET', 'test-gmail-secret');
    vi.stubEnv('GMAIL_REFRESH_TOKEN', 'test-gmail-refresh');

    // Re-import to pick up new env vars
    const { env } = await import('@/lib/env');
    expect(env.ZOHO_CLIENT_ID).toBe('test-client-id');
    expect(env.ZOHO_CLIENT_SECRET).toBe('test-client-secret');
    expect(env.CLOUDINARY_CLOUD_NAME).toBe('louisluso');
  });

  it('throws on missing required variables', async () => {
    // Clear all env vars
    vi.stubEnv('ZOHO_CLIENT_ID', '');

    await expect(async () => {
      // Force re-evaluation
      vi.resetModules();
      await import('@/lib/env');
    }).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/env.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/env'`

- [ ] **Step 3: Write the implementation**

```bash
pnpm add zod
```

Create `lib/env.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Zoho OAuth
  ZOHO_CLIENT_ID: z.string().min(1),
  ZOHO_CLIENT_SECRET: z.string().min(1),
  ZOHO_REFRESH_TOKEN: z.string().min(1),
  ZOHO_ORG_ID: z.string().min(1),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),

  // Upstash Redis (rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),

  // Gmail API (for transactional emails)
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_REFRESH_TOKEN: z.string().min(1),

  // Optional
  ZOHO_API_BASE_URL: z.string().url().default('https://www.zohoapis.com'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const message = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => `  ${key}: ${JSON.stringify(val)}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${message}`);
  }
  return result.data;
}

export const env = parseEnv();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/env.test.ts
```

Expected: PASS

- [ ] **Step 5: Create .env.local.example**

Create `.env.local.example`:

```bash
# Zoho OAuth (Server-based Application from Zoho API Console)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORG_ID=
ZOHO_API_BASE_URL=https://www.zohoapis.com

# Clerk (from Clerk dashboard)
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudinary
CLOUDINARY_CLOUD_NAME=

# Gmail API (for transactional emails — reuse existing OAuth)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
```

Add `.env.local` to `.gitignore` if not already present.

- [ ] **Step 6: Commit**

```bash
git add lib/env.ts __tests__/lib/env.test.ts .env.local.example .gitignore
git commit -m "feat: add Zod-validated environment variables"
```

---

## Task 3: Zoho OAuth2 Token Management

**Files:**
- Create: `lib/zoho/auth.ts`
- Create: `__tests__/lib/zoho/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken, clearTokenCache } from '@/lib/zoho/auth';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env module
vi.mock('@/lib/env', () => ({
  env: {
    ZOHO_CLIENT_ID: 'test-client-id',
    ZOHO_CLIENT_SECRET: 'test-client-secret',
    ZOHO_REFRESH_TOKEN: 'test-refresh-token',
    ZOHO_API_BASE_URL: 'https://www.zohoapis.com',
  },
}));

describe('zoho/auth', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearTokenCache();
  });

  it('fetches a new access token using refresh token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const token = await getAccessToken();

    expect(token).toBe('new-access-token');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('accounts.zoho.com/oauth/v2/token'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns cached token on subsequent calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cached-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const token1 = await getAccessToken();
    const token2 = await getAccessToken();

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('refreshes token when expired', async () => {
    // First call — returns token expiring in 0 seconds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'expired-token',
        expires_in: 0,
        token_type: 'Bearer',
      }),
    });

    // Second call — returns new token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'fresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const token1 = await getAccessToken();
    expect(token1).toBe('expired-token');

    const token2 = await getAccessToken();
    expect(token2).toBe('fresh-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on failed token refresh', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_client' }),
    });

    await expect(getAccessToken()).rejects.toThrow('Failed to refresh Zoho access token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/zoho/auth.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/zoho/auth'`

- [ ] **Step 3: Write the implementation**

Create `lib/zoho/auth.ts`:

```typescript
import { env } from '@/lib/env';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export function clearTokenCache(): void {
  tokenCache = null;
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await fetch(
    `https://accounts.zoho.com/oauth/v2/token?${params.toString()}`,
    { method: 'POST' },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to refresh Zoho access token: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  const data: { access_token: string; expires_in: number } = await response.json();

  // Cache with 5-minute buffer before actual expiry
  const bufferMs = 5 * 60 * 1000;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - bufferMs,
  };

  return data.access_token;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/zoho/auth.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/auth.ts __tests__/lib/zoho/auth.test.ts
git commit -m "feat: add Zoho OAuth2 token management with caching"
```

---

## Task 4: Zoho Base HTTP Client

**Files:**
- Create: `lib/zoho/client.ts`
- Create: `__tests__/lib/zoho/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zohoFetch } from '@/lib/zoho/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/zoho/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
}));

vi.mock('@/lib/env', () => ({
  env: {
    ZOHO_ORG_ID: 'test-org-id',
    ZOHO_API_BASE_URL: 'https://www.zohoapis.com',
  },
}));

describe('zoho/client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('makes authenticated GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await zohoFetch('/inventory/v1/items');

    expect(result).toEqual({ items: [] });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.zohoapis.com/inventory/v1/items',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Zoho-oauthtoken test-access-token',
          'X-com-zoho-inventory-organizationid': 'test-org-id',
        }),
      }),
    );
  });

  it('makes POST request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ salesorder: { salesorder_id: '123' } }),
    });

    const result = await zohoFetch('/books/v3/salesorders', {
      method: 'POST',
      body: { customer_id: '456', line_items: [] },
    });

    expect(result).toEqual({ salesorder: { salesorder_id: '123' } });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.zohoapis.com/books/v3/salesorders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ customer_id: '456', line_items: [] }),
      }),
    );
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    await expect(zohoFetch('/inventory/v1/items')).rejects.toThrow(
      'Zoho API error 429',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/zoho/client.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/zoho/client'`

- [ ] **Step 3: Write the implementation**

Create `lib/zoho/client.ts`:

```typescript
import { getAccessToken } from '@/lib/zoho/auth';
import { env } from '@/lib/env';

interface ZohoFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export async function zohoFetch<T = unknown>(
  path: string,
  options: ZohoFetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, params } = options;
  const token = await getAccessToken();

  let url = `${env.ZOHO_API_BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    'X-com-zoho-inventory-organizationid': env.ZOHO_ORG_ID,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Zoho API error ${response.status}: ${JSON.stringify(errorBody)}`,
    );
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/zoho/client.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/client.ts __tests__/lib/zoho/client.test.ts
git commit -m "feat: add Zoho base HTTP client with auth injection"
```

---

## Task 5: Zoho Inventory API Wrapper

**Files:**
- Create: `lib/zoho/inventory.ts`
- Create: `__tests__/lib/zoho/inventory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/inventory.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItems, getItemGroup, getItemGroups, getPriceLists } from '@/lib/zoho/inventory';

vi.mock('@/lib/zoho/client', () => ({
  zohoFetch: vi.fn(),
}));

import { zohoFetch } from '@/lib/zoho/client';
const mockZohoFetch = vi.mocked(zohoFetch);

describe('zoho/inventory', () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it('fetches all items with pagination', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      items: [{ item_id: '1', name: 'SG1011' }],
      page_context: { has_more_page: false },
    });

    const items = await getItems();

    expect(items).toEqual([{ item_id: '1', name: 'SG1011' }]);
    expect(mockZohoFetch).toHaveBeenCalledWith('/inventory/v1/items', {
      params: { page: '1', per_page: '200' },
    });
  });

  it('fetches a single item group by ID', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      item_group: {
        group_id: '100',
        group_name: 'SG1011',
        items: [
          { item_id: '1', name: 'SG1011 - C2', sku: 'SG1011_C2' },
          { item_id: '2', name: 'SG1011 - C6', sku: 'SG1011_C6' },
        ],
      },
    });

    const group = await getItemGroup('100');

    expect(group.group_name).toBe('SG1011');
    expect(group.items).toHaveLength(2);
  });

  it('fetches item groups', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      itemgroups: [{ group_id: '100', group_name: 'SG1011' }],
      page_context: { has_more_page: false },
    });

    const groups = await getItemGroups();

    expect(groups).toEqual([{ group_id: '100', group_name: 'SG1011' }]);
  });

  it('fetches price lists', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      pricelists: [
        { pricelist_id: '1', name: '20% Discount', type: 'markdown', percentage: 20 },
      ],
    });

    const lists = await getPriceLists();

    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe('20% Discount');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/zoho/inventory.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/zoho/inventory'`

- [ ] **Step 3: Write the implementation**

Create `lib/zoho/inventory.ts`:

```typescript
import { zohoFetch } from '@/lib/zoho/client';

// --- Types ---

export interface ZohoItem {
  item_id: string;
  name: string;
  sku: string;
  rate: number;
  stock_on_hand: number;
  status: string;
  group_id?: string;
  group_name?: string;
  image_name?: string;
  custom_fields?: Array<{ label: string; value: string }>;
}

export interface ZohoItemGroup {
  group_id: string;
  group_name: string;
  items: ZohoItem[];
  image_name?: string;
  description?: string;
  brand?: string;
  category_name?: string;
}

export interface ZohoPriceList {
  pricelist_id: string;
  name: string;
  type: string;
  percentage?: number;
  item_prices?: Array<{ item_id: string; price: number }>;
}

interface PageContext {
  has_more_page: boolean;
}

// --- API Functions ---

export async function getItems(page = 1): Promise<ZohoItem[]> {
  const data = await zohoFetch<{ items: ZohoItem[]; page_context: PageContext }>(
    '/inventory/v1/items',
    { params: { page: String(page), per_page: '200' } },
  );

  if (data.page_context.has_more_page) {
    const nextItems = await getItems(page + 1);
    return [...data.items, ...nextItems];
  }

  return data.items;
}

export async function getItemGroup(groupId: string): Promise<ZohoItemGroup> {
  const data = await zohoFetch<{ item_group: ZohoItemGroup }>(
    `/inventory/v1/itemgroups/${groupId}`,
  );
  return data.item_group;
}

export async function getItemGroups(page = 1): Promise<ZohoItemGroup[]> {
  const data = await zohoFetch<{ itemgroups: ZohoItemGroup[]; page_context: PageContext }>(
    '/inventory/v1/itemgroups',
    { params: { page: String(page), per_page: '200' } },
  );

  if (data.page_context.has_more_page) {
    const nextGroups = await getItemGroups(page + 1);
    return [...data.itemgroups, ...nextGroups];
  }

  return data.itemgroups;
}

export async function getPriceLists(): Promise<ZohoPriceList[]> {
  const data = await zohoFetch<{ pricelists: ZohoPriceList[] }>(
    '/inventory/v1/pricelists',
  );
  return data.pricelists;
}

export async function getPriceListForContact(
  priceListId: string,
): Promise<ZohoPriceList> {
  const data = await zohoFetch<{ pricelist: ZohoPriceList }>(
    `/inventory/v1/pricelists/${priceListId}`,
  );
  return data.pricelist;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/zoho/inventory.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/inventory.ts __tests__/lib/zoho/inventory.test.ts
git commit -m "feat: add Zoho Inventory API wrapper (items, groups, price lists)"
```

---

## Task 6: Zoho Books API Wrapper

**Files:**
- Create: `lib/zoho/books.ts`
- Create: `__tests__/lib/zoho/books.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/books.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSalesOrder,
  getSalesOrders,
  getInvoicesForContact,
} from '@/lib/zoho/books';

vi.mock('@/lib/zoho/client', () => ({
  zohoFetch: vi.fn(),
}));

import { zohoFetch } from '@/lib/zoho/client';
const mockZohoFetch = vi.mocked(zohoFetch);

describe('zoho/books', () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it('creates a sales order', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      salesorder: { salesorder_id: 'SO-001', total: 500 },
    });

    const order = await createSalesOrder({
      customer_id: 'CUST-1',
      line_items: [
        { item_id: 'ITEM-1', quantity: 10, rate: 50 },
      ],
    });

    expect(order.salesorder_id).toBe('SO-001');
    expect(mockZohoFetch).toHaveBeenCalledWith(
      '/books/v3/salesorders',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ customer_id: 'CUST-1' }),
      }),
    );
  });

  it('fetches sales orders for a contact', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      salesorders: [{ salesorder_id: 'SO-001' }],
    });

    const orders = await getSalesOrders('CUST-1');

    expect(orders).toHaveLength(1);
    expect(mockZohoFetch).toHaveBeenCalledWith(
      '/books/v3/salesorders',
      expect.objectContaining({
        params: expect.objectContaining({ customer_id: 'CUST-1' }),
      }),
    );
  });

  it('fetches invoices for a contact', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      invoices: [{ invoice_id: 'INV-001', status: 'sent' }],
    });

    const invoices = await getInvoicesForContact('CUST-1');

    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('sent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/zoho/books.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/zoho/books'`

- [ ] **Step 3: Write the implementation**

Create `lib/zoho/books.ts`:

```typescript
import { zohoFetch } from '@/lib/zoho/client';

// --- Types ---

export interface LineItem {
  item_id: string;
  quantity: number;
  rate: number;
  name?: string;
  sku?: string;
}

export interface CreateSalesOrderInput {
  customer_id: string;
  line_items: LineItem[];
  notes?: string;
  reference_number?: string;
}

export interface ZohoSalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  total: number;
  line_items: LineItem[];
  date: string;
  created_time: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total: number;
  balance: number;
  date: string;
  due_date: string;
  invoice_url?: string;
}

// --- API Functions ---

export async function createSalesOrder(
  input: CreateSalesOrderInput,
): Promise<ZohoSalesOrder> {
  const data = await zohoFetch<{ salesorder: ZohoSalesOrder }>(
    '/books/v3/salesorders',
    { method: 'POST', body: input as unknown as Record<string, unknown> },
  );
  return data.salesorder;
}

export async function getSalesOrders(
  customerId: string,
): Promise<ZohoSalesOrder[]> {
  const data = await zohoFetch<{ salesorders: ZohoSalesOrder[] }>(
    '/books/v3/salesorders',
    { params: { customer_id: customerId, sort_column: 'created_time', sort_order: 'D' } },
  );
  return data.salesorders;
}

export async function getSalesOrder(
  salesOrderId: string,
): Promise<ZohoSalesOrder> {
  const data = await zohoFetch<{ salesorder: ZohoSalesOrder }>(
    `/books/v3/salesorders/${salesOrderId}`,
  );
  return data.salesorder;
}

export async function getInvoicesForContact(
  customerId: string,
): Promise<ZohoInvoice[]> {
  const data = await zohoFetch<{ invoices: ZohoInvoice[] }>(
    '/books/v3/invoices',
    { params: { customer_id: customerId, sort_column: 'created_time', sort_order: 'D' } },
  );
  return data.invoices;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/zoho/books.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/lib/zoho/books.test.ts
git commit -m "feat: add Zoho Books API wrapper (sales orders, invoices)"
```

---

## Task 7: Zoho CRM API Wrapper

**Files:**
- Create: `lib/zoho/crm.ts`
- Create: `__tests__/lib/zoho/crm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/crm.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLead, getContacts, getContactById } from '@/lib/zoho/crm';

vi.mock('@/lib/zoho/client', () => ({
  zohoFetch: vi.fn(),
}));

import { zohoFetch } from '@/lib/zoho/client';
const mockZohoFetch = vi.mocked(zohoFetch);

describe('zoho/crm', () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it('creates a lead from partner application', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [{ details: { id: 'LEAD-001' }, status: 'success' }],
    });

    const leadId = await createLead({
      Company: 'Test Optical',
      First_Name: 'John',
      Last_Name: 'Doe',
      Email: 'john@testoptical.com',
      Phone: '555-1234',
      Street: '123 Main St',
      City: 'Chicago',
      State: 'IL',
      Zip_Code: '60601',
      Lead_Source: 'Website',
    });

    expect(leadId).toBe('LEAD-001');
    expect(mockZohoFetch).toHaveBeenCalledWith(
      '/crm/v6/Leads',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches contacts with filters', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [{ id: 'CONT-1', Account_Name: 'Test Optical' }],
    });

    const contacts = await getContacts({ type: 'customer' });

    expect(contacts).toHaveLength(1);
    expect(contacts[0].Account_Name).toBe('Test Optical');
  });

  it('fetches a single contact by ID', async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [{ id: 'CONT-1', Email: 'john@test.com' }],
    });

    const contact = await getContactById('CONT-1');

    expect(contact.Email).toBe('john@test.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/zoho/crm.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/zoho/crm'`

- [ ] **Step 3: Write the implementation**

Create `lib/zoho/crm.ts`:

```typescript
import { zohoFetch } from '@/lib/zoho/client';

// --- Types ---

export interface CRMLeadInput {
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street: string;
  City: string;
  State: string;
  Zip_Code: string;
  Lead_Source?: string;
  Description?: string;
}

export interface CRMContact {
  id: string;
  Email: string;
  First_Name: string;
  Last_Name: string;
  Account_Name: string;
  Phone: string;
  Mailing_Street: string;
  Mailing_City: string;
  Mailing_State: string;
  Mailing_Zip: string;
  [key: string]: unknown;
}

interface CRMResponse<T> {
  data: T[];
}

// --- API Functions ---

export async function createLead(input: CRMLeadInput): Promise<string> {
  const data = await zohoFetch<{
    data: Array<{ details: { id: string }; status: string }>;
  }>('/crm/v6/Leads', {
    method: 'POST',
    body: { data: [input] } as unknown as Record<string, unknown>,
  });

  const result = data.data[0];
  if (result.status !== 'success') {
    throw new Error(`Failed to create lead: ${JSON.stringify(result)}`);
  }

  return result.details.id;
}

export async function getContacts(
  filters?: Record<string, string>,
): Promise<CRMContact[]> {
  const params: Record<string, string> = {};
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      params[key] = value;
    });
  }

  const data = await zohoFetch<CRMResponse<CRMContact>>('/crm/v6/Contacts', {
    params,
  });

  return data.data ?? [];
}

export async function getContactById(contactId: string): Promise<CRMContact> {
  const data = await zohoFetch<CRMResponse<CRMContact>>(
    `/crm/v6/Contacts/${contactId}`,
  );

  if (!data.data?.[0]) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  return data.data[0];
}

export async function attachFileToLead(
  leadId: string,
  file: Buffer,
  fileName: string,
): Promise<void> {
  // File attachments use multipart/form-data — handled separately from zohoFetch
  const { getAccessToken } = await import('@/lib/zoho/auth');
  const { env } = await import('@/lib/env');
  const token = await getAccessToken();

  const formData = new FormData();
  formData.append('file', new Blob([file]), fileName);

  const response = await fetch(
    `${env.ZOHO_API_BASE_URL}/crm/v6/Leads/${leadId}/Attachments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to attach file to lead: ${response.status}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/zoho/crm.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/crm.ts __tests__/lib/zoho/crm.test.ts
git commit -m "feat: add Zoho CRM API wrapper (leads, contacts, attachments)"
```

---

## Task 8: Rate Limiting Middleware

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `__tests__/lib/rate-limit.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

// Mock Upstash
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
  })),
}));

vi.mock('@/lib/env', () => ({
  env: {
    UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  },
}));

describe('rate-limit', () => {
  it('returns success for allowed requests', async () => {
    const result = await rateLimit('test-ip-1');

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('creates limiter with correct config', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    expect(Ratelimit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/rate-limit.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/rate-limit'`

- [ ] **Step 4: Write the implementation**

Create `lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// 10 requests per 10 seconds per IP for public API routes
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'louisluso:ratelimit',
});

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/rate-limit.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/rate-limit.ts __tests__/lib/rate-limit.test.ts
git commit -m "feat: add Upstash rate limiting for public API routes"
```

---

## Task 9: Clerk Auth Integration

**Files:**
- Create: `middleware.ts`
- Modify: `app/layout.tsx`
- Create: `app/portal/layout.tsx`

- [ ] **Step 1: Install Clerk**

```bash
pnpm add @clerk/nextjs
```

- [ ] **Step 2: Update root layout with Clerk provider**

Update `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { ClerkProvider, Show, UserButton, SignInButton } from '@clerk/nextjs';
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
    <html lang="en">
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create Clerk middleware**

Create `proxy.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/portal(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 4: Create protected portal layout**

Create `app/portal/layout.tsx`:

```tsx
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Check if user has 'partner' role in metadata
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== 'partner') {
    redirect('/');
  }

  return <div>{children}</div>;
}
```

Create `app/portal/page.tsx` (placeholder):

```tsx
export default function PortalDashboard(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">B2B Portal</h1>
      <p className="text-gray-500">Dashboard coming in Phase 5</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify auth works**

```bash
pnpm dev
```

Visit `http://localhost:3000` — should see homepage.
Visit `http://localhost:3000/portal` — should redirect to Clerk sign-in page.

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/layout.tsx app/portal/layout.tsx app/portal/page.tsx
git commit -m "feat: add Clerk auth with protected portal routes"
```

---

## Task 10: Health Check API Route

**Files:**
- Create: `app/api/health/route.ts`
- Create: `__tests__/app/api/health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/app/api/health.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/health/route'`

- [ ] **Step 3: Write the implementation**

Create `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/app/api/health.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/health/route.ts __tests__/app/api/health.test.ts
git commit -m "feat: add health check API route"
```

---

## Task 11: Products API Route (Zoho Proxy)

**Files:**
- Create: `app/api/zoho/products/route.ts`

- [ ] **Step 1: Create the products API route**

Create `app/api/zoho/products/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getItemGroups } from '@/lib/zoho/inventory';

export const revalidate = 900; // ISR: 15 minutes

export async function GET(): Promise<NextResponse> {
  try {
    const groups = await getItemGroups();
    return NextResponse.json({ products: groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch products from Zoho:', message);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Verify the route builds**

```bash
pnpm build
```

Expected: build succeeds. The route won't work without real Zoho credentials, but it should compile.

- [ ] **Step 3: Commit**

```bash
git add app/api/zoho/products/route.ts
git commit -m "feat: add products API route proxying Zoho Inventory"
```

---

## Task 12: Vercel Deployment

- [ ] **Step 1: Create Vercel project config**

Create `vercel.json` (optional — Vercel auto-detects Next.js, but this locks in settings):

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build"
}
```

- [ ] **Step 2: Deploy to Vercel**

```bash
pnpm add -g vercel
vercel
```

Follow prompts to link to your Vercel project. For the first deploy, it will ask questions — accept defaults for a Next.js project.

- [ ] **Step 3: Set environment variables in Vercel**

Go to Vercel dashboard → Project → Settings → Environment Variables. Add all variables from `.env.local.example`. For now, you can use placeholder values for services not yet configured — the health check endpoint will still work.

Required for first deploy:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

All other env vars can be added as services are configured.

- [ ] **Step 4: Verify deployment**

Visit `https://your-project.vercel.app` — should see "LOUISLUSO" homepage.
Visit `https://your-project.vercel.app/api/health` — should return `{"status":"ok","timestamp":"..."}`.

- [ ] **Step 5: Commit vercel config**

```bash
git add vercel.json
git commit -m "feat: add Vercel deployment config"
```

---

## Task 13: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git status
```

If there are any uncommitted changes, commit them:

```bash
git add -A
git commit -m "chore: phase 1 cleanup"
```

---

## Phase 1 Deliverables

When complete, you should have:

- [ ] Next.js app running locally and deployed on Vercel
- [ ] TypeScript strict mode, Tailwind CSS, Vitest configured
- [ ] Zod-validated environment variables
- [ ] Zoho OAuth2 token management with caching
- [ ] Zoho Inventory, Books, and CRM API wrappers with tests
- [ ] Clerk auth with protected `/portal/*` routes (email-only login)
- [ ] Rate limiting middleware (Upstash Redis)
- [ ] Health check endpoint at `/api/health`
- [ ] Products API route at `/api/zoho/products` (proxy to Zoho Inventory)
- [ ] All tests passing
- [ ] Deployed to Vercel

**Next:** Phase 2 — Public Catalog (product pages pulling from Zoho Inventory + Cloudinary images)
