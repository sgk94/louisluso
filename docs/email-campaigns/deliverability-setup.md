# Email Deliverability Setup — `louisluso.com`

**Status (2026-04-16):** SPF ❌ DKIM ❌ DMARC ❌ — **must be configured before any outbound B2B campaign**.

Gmail Workspace sends will technically succeed (Gmail signs its own envelope), but receiving servers at Yahoo, Hotmail/Outlook, AOL, Comcast, SBCGlobal, and most ISPs will mark messages as spam or reject them outright without SPF+DKIM+DMARC aligned to the sending domain.

---

## 1. SPF — authorize Google to send on behalf of louisluso.com

**Where:** AWS Route 53 → hosted zone for `louisluso.com` → add TXT record

- **Name:** `louisluso.com` (apex) — in Route 53 leave "Record name" blank
- **Type:** TXT
- **Value:**
  ```
  v=spf1 include:_spf.google.com ~all
  ```
- **TTL:** 3600

If you already have a TXT record on the apex (e.g., google-site-verification), **don't replace it** — Route 53 allows multiple TXT values on the same name. Add the SPF as an additional line in the same record, each line in its own set of double quotes.

**Verify (after ~5 min):**
```bash
dig TXT louisluso.com +short | grep -i spf
```
Expected: `"v=spf1 include:_spf.google.com ~all"`

---

## 2. DKIM — cryptographically sign outgoing mail

**Part A — Generate key in Google Workspace admin:**
1. Go to [admin.google.com](https://admin.google.com) → sign in as super admin
2. Apps → Google Workspace → Gmail → Authenticate email
3. Select `louisluso.com` from the domain dropdown
4. Click **Generate new record**
   - Key bit length: **2048** (recommended)
   - Prefix selector: leave default (`google`)
5. Copy the **DNS Host name** and **TXT record value** it shows

**Part B — Publish in Route 53:**
- **Name:** `google._domainkey` (Route 53 will append `.louisluso.com`)
- **Type:** TXT
- **Value:** paste the entire string Google gave you — usually `v=DKIM1; k=rsa; p=MIIBIj...` (very long)
  - If Route 53 complains about length, split into multiple quoted strings each ≤255 chars
- **TTL:** 3600

**Part C — Activate:** Return to the Google Workspace Gmail auth page and click **Start authentication**. It verifies the TXT propagated and flips the switch.

**Verify:**
```bash
dig TXT google._domainkey.louisluso.com +short
```
Should return the long `v=DKIM1; k=rsa; p=...` string.

---

## 3. DMARC — tell receivers what to do with unverified mail

**Where:** Route 53 → add TXT record

- **Name:** `_dmarc` (Route 53 appends `.louisluso.com`)
- **Type:** TXT
- **Value (start loose — monitor only):**
  ```
  v=DMARC1; p=none; rua=mailto:postmaster@louisluso.com; pct=100; adkim=s; aspf=s
  ```
  - `p=none` = monitor only, nothing gets rejected yet
  - `rua` = where aggregate reports are sent; change email if you want them elsewhere
  - After 1-2 weeks of clean reports, tighten to `p=quarantine` then `p=reject`
- **TTL:** 3600

**Verify:**
```bash
dig TXT _dmarc.louisluso.com +short
```

---

## 4. Send a canary test

After all three records are in and DKIM is activated in Google Workspace:

1. From cs@louisluso.com, send a test to **an external address on each major provider**:
   - yahoo.com (create temp account or use known contact)
   - outlook.com / hotmail.com
   - gmail.com (personal, not @louisluso.com)
   - aol.com if available
2. In each inbox, **view raw headers** (Gmail: three-dot menu → "Show original")
3. Confirm:
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`
4. Confirm the message landed in **Inbox**, not Spam / Junk / Promotions.

**Alternative — use a free email-auth test tool:**
- [mail-tester.com](https://www.mail-tester.com/) — generate a temp address, send, see a score. 9+/10 = ready.

Only once the canary passes do we resume the trip campaign.

---

## 5. Post-setup: lift the pause

Run: `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config email/campaigns/checklist-runner.ts data/email-campaign/2026-04-16-ga.md`

That dry-runs the GA campaign. If clean and the canary confirmed inbox delivery, pass `--live`.
