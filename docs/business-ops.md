# Louis Luso — Business Operations & Fixed Costs

Last updated: 2026-04-08

## Current Monthly Tech Services

| Service | What it does | Monthly Cost | Notes |
|---------|-------------|-------------|-------|
| **Zoho One** | CRM, Books, Inventory, Bookings, Forms — all-in-one | ~$45/user | Replaces HubSpot, WC Bookings, WPForms |
| AWS Lightsail | WordPress/WooCommerce hosting (current site) | $5–25 | US-East-2, IP 3.21.67.85 |
| AWS Route 53 | DNS management | ~$1 | $0.50/zone + query fees |
| Bluehost | Domain registration (louisluso.com) | ~$1.50 | Amortized; expires Sep 20, 2026 |
| Google Workspace | Gmail + Sheets API (email outreach) | $18–24 | 1 user (cs@louisluso.com) |
| Google Analytics | Website analytics | $0 | Free |
| Google reCAPTCHA v2 | Bot protection | $0 | Free |

### Estimated monthly baseline: **~$71–97/month** (1 Zoho user)

## Dropping (when new site launches)

These are on the current WordPress site and will not carry over to the new build:

| Service | Reason |
|---------|--------|
| Elementor | New site, different stack |
| Wordfence | New site — use Cloudflare or AWS WAF instead |
| WC Bookings | Zoho Bookings covers this |
| HubSpot | Zoho CRM covers this |
| LiteSpeed Cache | WordPress-specific |
| Savoy theme | WordPress-specific |
| BeRocket Better Labels | WordPress-specific |
| Contact Form 7 | Zoho Forms covers this |
| WP Google Maps | Rebuild in new site if needed |

## Annual / One-Time Costs

| Service | Cost | Notes |
|---------|------|-------|
| Bluehost domain renewal | $12–18/yr | Renew by Sep 2026 |
| Domain privacy (Perfect Privacy) | $3–10/yr | WHOIS masking |

## Pending Decisions

- [ ] **New website stack** — What platform/framework for the new build? (Next.js, Shopify, etc.)
- [ ] **Payment processor** — Not visible in codebase. What's handling transactions? (Stripe, Square, PayPal?)
- [ ] **Security for new site** — Cloudflare (free tier), AWS WAF, or other?
- [ ] **Hosting for new site** — Stay on AWS Lightsail, move to Vercel, or other?

## Future Costs

| Service | Est. Cost | When |
|---------|----------|------|
| Vision Expo trade shows | ~$50K/yr | Per business plan |
| Additional Zoho One users | ~$45/user/mo | As team grows |
| Additional Google Workspace users | $18–24/mo each | As team grows |
| New site hosting (TBD) | Varies | When new site launches |
