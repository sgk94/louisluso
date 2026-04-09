# Email Automation — Full Setup Plan

**Created:** 2026-03-17
**Intent Contract:** See `.claude/session-intent.md`
**Status:** Ready to execute

---

## What You'll End Up With

A production-ready email outreach system that:
- Sends from the client's Google Workspace account via Gmail API
- Threads follow-up emails in the same Gmail conversation
- Auto-detects replies and stops the sequence for that contact
- Falls back to SMTP if Gmail is ever switched off
- **Logs every sent email** (full rendered text + metadata) to `email/sent-log.jsonl` for performance analysis
- Tracks outcomes (replied/bounced/completed) to build a feedback loop for improving email language
- Has a client-facing setup guide so they can maintain it

---

## Phase Breakdown

### Phase 1: Google Cloud Project Setup
**Time: ~15 min | You do this in a browser**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Louis Luso Email")
3. Enable the **Gmail API**:
   - APIs & Services → Library → search "Gmail API" → Enable
4. Configure **OAuth Consent Screen**:
   - APIs & Services → OAuth consent screen
   - User type: **Internal** (since this is a Workspace account — no Google review needed)
   - App name: "Louis Luso Email Automation"
   - Support email: client's Workspace email
   - Scopes: add `gmail.send` and `gmail.readonly`
   - No test users needed (Internal = all Workspace users can authorize)
5. Create **OAuth 2.0 Credentials**:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Desktop app**
   - Name: "Louis Luso CLI"
   - Download JSON → save as `email/credentials.json`
6. Copy `client_id` and `client_secret` from the JSON into `.env`:
   ```
   EMAIL_TRANSPORT=gmail
   GMAIL_CLIENT_ID=<client_id from JSON>
   GMAIL_CLIENT_SECRET=<client_secret from JSON>
   ```

**Checkpoint:** `email/credentials.json` exists, `.env` has Gmail vars set.

---

### Phase 2: OAuth2 Authorization
**Time: ~2 min | Run one command**

```bash
pnpm email:auth
```

This will:
1. Open a browser to Google's consent page
2. You log in with the **Workspace account that will send emails**
3. Grant permissions (gmail.send + gmail.readonly)
4. Browser redirects to localhost:3000 → token saved

**Checkpoint:** `email/token.json` exists with a `refresh_token`.

**Troubleshooting:**
- If port 3000 is busy, kill the process using it first
- If browser doesn't open, copy the URL from the terminal
- If you get "access_denied", make sure the Workspace account is in the same org as the Cloud project

---

### Phase 3: Verify Connection
**Time: ~1 min**

```bash
npx tsx -e "import { verifyConnection } from './email/send.ts'; verifyConnection().then(ok => { console.log(ok ? 'READY' : 'FAILED'); process.exit(ok ? 0 : 1); })"
```

Should print: `Gmail connected: <workspace-email>` + `READY`

---

### Phase 4: Test Single Send
**Time: ~2 min**

Send a test email to yourself:

```bash
pnpm email:send -- --to <your-test-email> --template outreach-intro --subject "Test from Gmail API" --var name=TestName --var company=TestCo
```

**Verify:**
- [ ] Email arrives in your inbox
- [ ] "From" shows the Workspace account name/address
- [ ] HTML renders correctly (not raw tags)

---

### Phase 5: Test Threading + Reply Detection
**Time: ~5 min**

1. **Enroll a test contact in a sequence:**
   ```bash
   pnpm email:enroll -- --sequence vision-source-outreach --email <your-test-email> --name "Test User" --company "Test Optical"
   ```

2. **Send step 0 (initial email):**
   ```bash
   pnpm email:sequence -- run --sequence vision-source-outreach
   ```

3. **Verify thread info was stored:**
   Check `email/state.json` — the contact should have `threadId` and `firstMessageId` set.

4. **Test reply detection:**
   - Reply to the test email from the test inbox
   - Wait ~30 seconds (for Gmail to index)
   - Run the sequence again:
     ```bash
     pnpm email:sequence -- run --sequence vision-source-outreach
     ```
   - Should auto-detect the reply and mark the contact as "replied"

5. **Check status:**
   ```bash
   pnpm email:sequence -- status --sequence vision-source-outreach
   ```

**Verify:**
- [ ] First email has a `threadId` in state.json
- [ ] Reply is auto-detected (no manual `markReplied` needed)
- [ ] Contact status shows "replied"

---

### Phase 6: Test SMTP Fallback
**Time: ~2 min**

Temporarily switch transport and verify SMTP still works:

```bash
# In .env, change:
EMAIL_TRANSPORT=smtp

# Then test:
pnpm email:send -- --to <your-test-email> --template outreach-intro --subject "SMTP fallback test" --var name=Test --var company=TestCo

# Then switch back:
EMAIL_TRANSPORT=gmail
```

**Verify:**
- [ ] SMTP send still works with existing credentials
- [ ] Switching back to gmail works without re-auth

---

### Phase 7: Import Real Contacts
**Time: ~5 min**

Prepare a CSV with your outreach list and import:

```bash
pnpm email:import -- --file contacts.csv
```

CSV format (see cli-import.ts for exact columns):
```
email,name,company,tag
buyer@opticalstore.com,Jane Smith,Smith Optical,vision-source
```

Then enroll by tag:

```bash
pnpm email:enroll -- --sequence vision-source-outreach --tag vision-source
```

---

### Phase 8: Production Send (First Batch)
**Time: ~10 min for first batch**

**Pre-flight checklist:**
- [ ] `EMAIL_TRANSPORT=gmail` in .env
- [ ] `verifyConnection()` returns READY
- [ ] Test email arrived correctly (Phase 4)
- [ ] Threading works (Phase 5)
- [ ] Contacts imported and enrolled
- [ ] Rate limits set appropriately in .env:
  - `EMAIL_MAX_PER_HOUR=50` (conservative start)
  - `EMAIL_MAX_PER_DAY=2000` (Workspace limit)
  - `EMAIL_DELAY_MS=2000` (2s between sends)

**Dry run first:**
```bash
pnpm email:sequence -- run --sequence vision-source-outreach --dry-run
```

**Then send for real:**
```bash
pnpm email:sequence -- run --sequence vision-source-outreach
```

**Monitor:**
```bash
pnpm email:sequence -- status --sequence vision-source-outreach
```

---

## Rate Limiting Summary

| Limit | Value | Source |
|-------|-------|--------|
| Per send delay | 2,000ms | `EMAIL_DELAY_MS` |
| Per hour | 50 | `EMAIL_MAX_PER_HOUR` |
| Per day | 2,000 | `EMAIL_MAX_PER_DAY` (Workspace limit) |
| Wordfence | N/A | Gmail API bypasses Wordfence (not hitting WC API) |

---

## Files Reference

| File | Purpose | Sensitive? |
|------|---------|------------|
| `email/credentials.json` | OAuth2 client ID/secret from Google | Yes — gitignored |
| `email/token.json` | OAuth2 refresh + access tokens | Yes — gitignored |
| `.env` | All secrets (SMTP, Gmail, WooCommerce) | Yes — gitignored |
| `email/state.json` | Sequence progress, thread IDs | No secrets, but has contact emails |
| `email/contacts.json` | Contact directory | Has PII (emails, names, companies) |
| `email/sent-log.jsonl` | Full sent email log + outcomes | Has PII — gitignored |

---

## Sent Log — Outreach Performance Feedback Loop

Every email sent through the system is automatically logged to `email/sent-log.jsonl` with the full rendered body text. Three event types:

**`"sent"` — logged automatically at send time:**
- Recipient (to, name, company, segment)
- Sequence name + step number
- Template used + subject line + A/B variant label
- Full rendered plain text body
- Message ID, thread ID, transport

**`"outcome"` — logged automatically or via CLI:**
- When Gmail detects a reply → `outcome: "replied"` + `daysToReply`
- When `markReplied` is called manually → same
- When contact finishes all steps without replying → `outcome: "completed"`
- When you tag a reply → includes `tag`, `sentiment`, `notes`

**`"stage"` — logged via CLI for conversion tracking:**
- Stages: `replied` → `sample-requested` → `meeting-booked` → `order` → `reorder`
- Each with optional notes

### Feedback Levers

| Lever | How | What it tells you |
|-------|-----|-------------------|
| **Quick tag** | `pnpm email:sequence -- tag --email X --tag warm` | Categorize reply quality (warm/cold/meeting-booked/not-interested) |
| **Sentiment** | `--sentiment positive\|neutral\|negative` on tag command | Track tone of responses |
| **Notes** | `--notes "wants samples in April"` on tag or stage | Free-text context for pattern matching |
| **Subject A/B** | Add `subjectVariants` to sequence step config | Which subject lines get more opens/replies |
| **Send time** | Automatic (derived from timestamp) | Best day/hour to send |
| **Segment** | Contact tags flow through as `segment` | Which buyer types respond best |
| **Conversion stage** | `pnpm email:sequence -- stage --email X --stage sample-requested` | Full funnel: reply → samples → order → reorder |
| **Link tracking** | Automatic UTM params on all template links | Which emails drive website visits (via Google Analytics) |

### Subject A/B Testing

Add variants to any sequence step in `email/campaigns/sequence-configs.ts`:

```typescript
{
  template: "outreach-intro",
  subject: "Premium Asian-Fit Frames — Louis Luso",  // fallback
  subjectVariants: [
    { variant: "a", subject: "Premium Asian-Fit Frames for Your Practice — Louis Luso" },
    { variant: "b", subject: "Titanium Frames Your Patients Will Love — Louis Luso" },
  ],
  delayDays: 0,
  skipIf: "none",
}
```

The system randomly assigns each contact a variant and logs which they received. `report` command shows reply rates per subject line.

### Link Tracking (UTM)

All links in email templates automatically get UTM parameters appended:
```
https://louisluso.com/shop → https://louisluso.com/shop?utm_source=email&utm_medium=sequence&utm_campaign=vision-source-outreach&utm_content=step0
```

View results in Google Analytics → Acquisition → Campaigns. No tracking pixels, no redirect servers — just standard URL parameters.

### Viewing Reports

```bash
pnpm email:sequence -- report                                    # all sequences
pnpm email:sequence -- report --sequence vision-source-outreach   # one sequence
```

Shows: reply rates by step, subject A/B results, best send times, segment comparison, and conversion funnel.

### Using the data to improve templates

When writing new email templates, Claude will:
1. Run `getPerformanceByStep()` — compare `repliedBodies` vs `ignoredBodies`
2. Run `getPerformanceBySubject()` — identify winning subject lines
3. Run `getPerformanceBySendTime()` — recommend best send windows
4. Run `getPerformanceBySegment()` — tailor messaging by buyer type
5. Check `getConversionFunnel()` — focus on language that drives conversions, not just replies

---

## Ongoing Operations

**Daily sequence run:**
```bash
pnpm email:sequence -- run --sequence vision-source-outreach
```

**Check who replied:**
```bash
pnpm email:sequence -- status --sequence vision-source-outreach
```

**Tag a reply (after reading it):**
```bash
pnpm email:sequence -- tag --email buyer@store.com --tag warm --sentiment positive --notes "asked about MOQ"
```

**Log a conversion stage:**
```bash
pnpm email:sequence -- stage --email buyer@store.com --stage sample-requested --notes "wants 3 titanium frames"
```

**View performance report:**
```bash
pnpm email:sequence -- report --sequence vision-source-outreach
```

**Manual reply mark (SMTP mode only — Gmail auto-detects):**
```bash
pnpm email:sequence -- reply --email buyer@store.com
```

**Send a one-off email:**
```bash
pnpm email:send -- --to buyer@store.com --template outreach-intro --subject "Subject" --var name=Jane --var company="Store Name"
```

---

## Execution Commands

To execute this plan phase by phase, follow Phases 1–8 above in order.

Or if you want Claude to assist with specific phases:
- Phase 1: Manual (browser-based Google Cloud Console)
- Phase 2: `pnpm email:auth` (Claude can troubleshoot)
- Phase 3–6: Claude can run verification commands
- Phase 7: Claude can help with CSV prep and import
- Phase 8: Claude can run dry-run and monitor

---

## Success Criteria (from intent contract)

- [ ] Emails send via Gmail API end-to-end
- [ ] Every step documented (this doc)
- [ ] Tested with fallback, rate limiting, reply detection
- [ ] Client can follow this doc independently
