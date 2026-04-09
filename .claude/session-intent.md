---
created: 2026-03-17
status: active
---

# Session Intent Contract

## Job Statement
Get the Louis Luso email automation fully operational with Gmail API — from Google Cloud setup through first real outreach — so the system is production-ready and the client can maintain it independently.

## Success Criteria
1. **Working solution** — Emails send via Gmail API end-to-end (single + sequence + batch)
2. **Clear understanding** — Every step documented so Shawn knows the full flow
3. **Production-ready** — Tested with fallback, rate limiting, reply detection all working
4. **Team alignment** — Client can follow the setup doc and run/maintain the system without dev help

## Boundaries
- Must not break existing SMTP flow (fallback via `EMAIL_TRANSPORT=smtp`)
- Real outreach to real contacts — no room for test-in-prod mistakes
- Time-sensitive — minimize back-and-forth, get to sending quickly
- Single Google Workspace account (not multi-tenant)

## Context
- Knowledge level: Just starting with Gmail API / OAuth2
- Code status: Gmail API integration code is written (gmail.ts, cli-auth.ts, env.ts, send.ts, sequences.ts all updated)
- What's missing: Google Cloud project setup, OAuth credentials, token generation, end-to-end testing, client handoff docs
