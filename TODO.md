# TODO

## Business Operations
- [x] ~~Zoho Books vs Inventory~~ — Using Zoho One (includes both + CRM, Bookings, Forms, etc.)

## Business Card Scan Skill
- [ ] HEIC images need conversion to JPEG before reading (Claude's Read tool has 256KB limit). Currently done manually with `sips` — could automate in the skill or script.

## Zoho CRM ↔ Books Sync (follow-up after gap-fill)
- [ ] After the Books gap-fill plan (`docs/superpowers/plans/2026-04-15-zoho-gap-fill-from-sheet.md`) ships and Books is the clean source of truth, wire up CRM ↔ Books sync so the lifecycle is automatic:
  - Business card → CRM Lead (already works via `scripts/append-contact.ts`)
  - Convert Lead → CRM Contact + Account (manual in CRM UI, or Zoho Flow)
  - CRM Contact → Books Customer (on first invoice / portal signup)
- [ ] Recommended config: Books → Settings → Integrations → Zoho CRM → **one-way CRM → Books** for new contacts. Do NOT enable two-way until the gap-fill run has completed, to avoid CRM stale data overwriting Books.
- [ ] Open question: at what lifecycle point does a CRM Contact get promoted to a Books Customer? (First estimate? First invoice? Portal signup? Manual flag?) Decide before enabling sync.
- [ ] Reconcile the 419 (CRM Contacts) vs 868 (Books customers) gap — mostly Books has more because it absorbed older customers. Needs one-time pull from Books → CRM after sync is on.
