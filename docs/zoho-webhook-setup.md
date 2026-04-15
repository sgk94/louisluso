# Zoho CRM Webhook Setup — Partner Invite Automation

When Ken converts a Lead to a Contact in Zoho CRM (or creates a Contact directly),
Zoho fires a workflow that calls our webhook. The webhook sends the welcome /
sign-up email automatically, so Ken does not have to run
`pnpm portal:invite -- --email …` manually.

Endpoint: `POST /api/zoho/webhooks/contact-created`
Rate limit: 20 req / 5 min per IP
Auth: shared secret in `X-Zoho-Webhook-Token` header (timing-safe comparison)

---

## 1. Generate the shared secret

```bash
openssl rand -hex 24
```

Copy the 48-char hex string. This is the value for `ZOHO_WEBHOOK_SECRET`.

## 2. Set the env var

**Local (`.env.local`):**

```
ZOHO_WEBHOOK_SECRET=<paste-the-secret>
```

**Vercel (production + preview):**

```bash
vercel env add ZOHO_WEBHOOK_SECRET production
vercel env add ZOHO_WEBHOOK_SECRET preview
```

Paste the SAME secret for both environments.

## 3. Configure the Zoho workflow rule

1. Zoho CRM → **Setup** → **Automation** → **Workflow Rules**
2. Click **Create Rule**
   - Module: **Contacts**
   - Rule Name: `Partner portal invite`
3. Trigger: **On a record action** → **Create**
4. Condition: skip (applies to all new Contacts) — or filter by Lead Source if
   you want to limit to partner-application-originated contacts
5. Actions → **Instant Actions** → **Webhook** → **Configure Webhook**
   - Name: `Partner portal invite webhook`
   - URL (production): `https://louisluso.com/api/zoho/webhooks/contact-created`
     (preview deployments: use the Vercel preview URL during testing)
   - Method: **POST**
   - URL parameters: none
   - **Headers**:
     - `X-Zoho-Webhook-Token` = `<the secret from step 1>`
     - `Content-Type` = `application/json`
   - **Body** (select "Custom"):
     ```json
     {"contactId": "${Contacts.Id}"}
     ```
     (Zoho merge variable `${Contacts.Id}` expands to the new contact's record
     ID at fire time.)
6. Save the webhook, associate it with the workflow rule, **activate** the rule.

## 4. Test it

**Dry-run in Zoho:**

Zoho provides a "Test Webhook" button when you configure the webhook. Use it
to send a sample payload. Expected response:

- `200 { "ok": true }` — everything wired correctly, welcome email was sent
- `401` — secret mismatch. Re-check the header value matches `ZOHO_WEBHOOK_SECRET`
- `404` — contact ID from the test payload doesn't exist (normal for manual
  test payloads — retest against a real contact)
- `429` — rate limit hit (retry after 5 minutes)

**End-to-end:**

1. Create a test Contact in Zoho CRM with a real inbox email you control.
2. Rule fires → Zoho posts to our endpoint → we look up the Contact →
   Gmail API sends the welcome email from `cs@louisluso.com`.
3. Check the test inbox. You should see the invite email within a few seconds.
4. Click the sign-up link → create a Clerk account with the same email.
5. First hit on `/portal/*` triggers our existing auto-match logic
   (`app/portal/layout.tsx`) → Clerk metadata updated → partner role granted.

## 5. Troubleshooting

- **No email arrived** → check Vercel logs for the webhook route. 200 means
  we sent it; inspect Gmail Sent folder for delivery confirmation. 502 means
  Gmail rejected the send — refresh `GMAIL_REFRESH_TOKEN` via `pnpm email:auth`.
- **Zoho retries a lot** → our endpoint returns 200 only on success. 4xx/5xx
  responses trigger Zoho retries (default ~5 attempts). If you see duplicate
  welcome emails, it's because our first response was non-200 for some reason
  — check the logs and fix the underlying issue.
- **401 at Zoho** → secret in Zoho header doesn't match our env var. Rotate:
  regenerate with `openssl rand -hex 24`, update both Zoho and Vercel env,
  redeploy, re-save Zoho webhook.

## 6. Manual fallback

If the webhook is unavailable (Zoho outage, ours, etc.), the original CLI
script still works:

```bash
pnpm portal:invite -- --email dealer@store.com
```

Both paths use the same `sendPartnerInvite` helper in `lib/portal/invite.ts`,
so the email content is identical.
