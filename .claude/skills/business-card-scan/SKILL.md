---
name: business-card-scan
description: Scan a business card photo and extract contact info into Zoho CRM (primary) and Google Sheet (backup view). Use this skill whenever the user provides a business card image, mentions scanning a card, wants to add a contact from a card, or says anything about business cards, name cards, or contact cards — even if they don't say "scan" explicitly.
allowed-tools: Bash, Read, Write, Edit
---

# Business Card Scanner

Extract contact information from business card photos and add them to Zoho CRM (primary) + Google Sheet (Ken's view).

## How it works

You receive (or fetch) business card images. You read every piece of text on each card using your vision capability, map it to the contact fields below, enrich the location data, show the user for confirmation, then run the append script.

## Step 0: Fetch unscanned cards from Google Drive

Cards default to a shared Drive folder. If the user says "scan the unscanned folder" (or anything equivalent) without attaching images, pull them from Drive first:

```bash
set -a && source .env.local && set +a
npx tsx .claude/skills/business-card-scan/list-unscanned.ts
```

The helper uses the canonical unscanned folder ID `1A7BqXvQyfc_uqONyRh0fcU2DRVFLlL0M`, downloads every image in it to `/tmp/drive-cards-unscanned/`, and prints a JSON manifest (`id`, `name`, `path`, `mimeType`) on stdout. Progress logs go to stderr so piping stdout to `jq` works.

Override the folder with `--folder <id>` or the output dir with `--out <dir>`. If the user hands you images directly (attached to a message, or a local path), skip this step.

Use the `path` values from the manifest when reading each card in Step 1.

## Step 1: Extract all text from the card

Read the image carefully. Pull out every piece of text you can see — names, titles, emails, phone numbers, addresses, websites, company names, taglines, fax numbers, social handles, everything.

Business cards vary wildly in layout. Some put the name huge and centered, others bury it. Some have multiple phone numbers or emails. Use context clues (font size, position, formatting) to figure out what's what.

If the card is in a language other than English, extract the text as-is and also provide an English translation where helpful (e.g., for the company name or title).

## Step 2: Map to contact fields and enrich location

Map extracted text to these fields:

| Field | What goes here |
|-------|---------------|
| Name | Full name (first + last) |
| Email | Email address — required, skip the card if missing |
| Company | Company or practice name |
| Type | Business type if apparent (e.g., "optician", "distributor", "optical store") |
| Role | Job title / position |
| Location | City, State or general location |
| Tags | Default: `business-card` — add context tags like trade show name if mentioned |
| Source | Where the card was collected (ask user if not obvious, default: `business-card`) |
| Notes | Anything that doesn't fit other fields — fax, second phone, social handles, tagline |
| Phone | Primary phone number |
| Website | Website URL |
| Address | Full street address |
| State | Two-letter state abbreviation (e.g., CA, TX) — parse from address or city line |
| City | City name — parse from address or city line |
| Zip | ZIP code or postal code — parse from address. If only city+state available, check knowledge base |
| Country | "US" or "CA" — auto-detected from state/province or zip format, but include in JSON if obvious from the card |

**Country auto-detection:** The script auto-detects country from province (BC, ON = Canada) or zip format (V6X = Canada, 90001 = US). You can include `"country": "CA"` or `"country": "US"` in the JSON to be explicit, but it's optional.

**Location enrichment:** If the card has city + state but no zip code, check the knowledge base by running:
```bash
npx tsx -e "import { lookupCity } from './lib/crm/regions.js'; const r = lookupCity('CITY', 'STATE'); console.log(r ? JSON.stringify(r) : 'not found')"
```
If found, use the stored zip. If not found, leave zip blank — it'll get filled in next time we see that city with a zip.

**Region auto-assign:** The append script handles this automatically from the zip code. You don't need to figure out the region — just show it in the confirmation table if it resolves.

## Step 3: Show for confirmation

Present the extracted data in a clean table so the user can review it before it gets saved:

```
Extracted from business card:

Name:     John Smith
Email:    john@example.com
Company:  ABC Optical
Type:     optical store
Role:     Owner
Location: Dallas, TX
State:    TX
City:     Dallas
Zip:      75201
Region:   dallas (auto-assigned)
Country:  US (auto-detected)
Tags:     business-card; vision-expo-2026
Source:   business-card
Notes:    Fax: 555-0199
Phone:    (555) 555-0123
Website:  abcoptical.com
Address:  123 Main St, Dallas, TX 75201
```

Ask: "Look good? I'll add this to Zoho CRM and the Sheet. Let me know if anything needs fixing."

If the card has no email address, tell the user and ask if they want to proceed anyway or skip it.

## Step 4: Write to Zoho CRM + Sheet + knowledge base

Once confirmed, run:

```bash
npx tsx scripts/append-contact.ts '<JSON>'
```

Where `<JSON>` is a single-line JSON string with these fields:
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "company": "ABC Optical",
  "type": "optical store",
  "role": "Owner",
  "location": "Dallas, TX",
  "tags": ["business-card", "vision-expo-2026"],
  "source": "business-card",
  "notes": "Fax: 555-0199",
  "phone": "(555) 555-0123",
  "website": "abcoptical.com",
  "address": "123 Main St, Dallas, TX 75201",
  "state": "TX",
  "city": "Dallas",
  "zip": "75201"
}
```

The script will:
1. Auto-assign region from zip code
2. Create a Lead in Zoho CRM (with state, city, zip, region fields)
3. Append a row to Google Sheet (Ken's view)
4. Update the location knowledge base (if new city+state+zip combo)

## Batch mode

If the user provides multiple card images at once (e.g. a Drive folder):

1. Read all images and extract contact data
2. Show the full list for review (all contacts in one summary table)
3. After user confirms, write all contacts to a temp JSON array file
4. Run batch command instead of individual calls:

```bash
npx tsx scripts/append-contact.ts --batch /tmp/cards-batch.json
```

The batch command processes all contacts in one process invocation with a 2-second delay between each, avoiding Zoho API rate limiting. **Never run individual append-contact calls back-to-back** — Zoho throttles token refreshes after ~10 rapid calls.

For single cards (one at a time), the individual command is fine:
```bash
npx tsx scripts/append-contact.ts '<JSON>'
```

## Edge cases

- **No email on card**: Flag it. Ask if user wants to add anyway (CRM + sheet, but won't be enrollable in email sequences) or skip.
- **Duplicate email**: Zoho CRM allows duplicate leads. Mention this to the user if you suspect a duplicate.
- **Low quality / unreadable text**: Tell the user which parts you couldn't read. Ask them to fill in the gaps.
- **Multiple people on one card**: Rare, but create separate entries for each person if it happens.
- **No address at all**: Set state, city, zip to empty. The contact gets `region: null` — it can be tagged manually later.
- **City + state but no zip**: Check knowledge base (Step 2). If not found, leave zip blank. Region won't auto-assign but city/state are still searchable.

## Key files

- `.claude/skills/business-card-scan/list-unscanned.ts` — Lists + downloads images from the unscanned Drive folder, prints manifest (Step 0)
- `scripts/append-contact.ts` — Writes to Zoho CRM + Google Sheet + updates knowledge base
- `lib/crm/regions.ts` — Region config, zip matching, knowledge base read/write
- `lib/zoho/crm.ts` — Zoho CRM API (createLead)
- `data/location-kb.json` — Location knowledge base (grows over time)
- `email/gmail.ts` — Google Sheets + Drive API client (OAuth2)
