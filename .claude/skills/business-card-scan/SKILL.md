---
name: business-card-scan
description: Scan a business card photo and extract contact info into the Louis Luso customer Google Sheet and contacts.json. Use this skill whenever the user provides a business card image, mentions scanning a card, wants to add a contact from a card, or says anything about business cards, name cards, or contact cards — even if they don't say "scan" explicitly.
allowed-tools: Bash, Read, Write, Edit
---

# Business Card Scanner

Extract contact information from business card photos and add them to the Louis Luso customer database (Google Sheet + local contacts.json).

## How it works

You receive a business card image. You read every piece of text on the card using your vision capability, map it to the contact fields below, show the user for confirmation, then run the append script.

## Step 1: Extract all text from the card

Read the image carefully. Pull out every piece of text you can see — names, titles, emails, phone numbers, addresses, websites, company names, taglines, fax numbers, social handles, everything.

Business cards vary wildly in layout. Some put the name huge and centered, others bury it. Some have multiple phone numbers or emails. Use context clues (font size, position, formatting) to figure out what's what.

If the card is in a language other than English, extract the text as-is and also provide an English translation where helpful (e.g., for the company name or title).

## Step 2: Map to contact fields

Map extracted text to these fields. The column order matches the Google Sheet exactly.

| Field | Column | What goes here |
|-------|--------|---------------|
| Name | A | Full name (first + last) |
| Email | B | Email address — required, skip the card if missing |
| Company | C | Company or practice name |
| Type | D | Business type if apparent (e.g., "optician", "distributor", "optical store") |
| Role | E | Job title / position |
| Location | F | City, State or general location |
| Tags | G | Default: `business-card` — add context tags like trade show name if mentioned |
| Source | H | Where the card was collected (ask user if not obvious, default: `business-card`) |
| Notes | I | Anything that doesn't fit other fields — fax, second phone, social handles, tagline |
| Phone | M | Primary phone number |
| Website | N | Website URL |
| Address | O | Full street address |

Fields J (Status), K (Email Count), L (Last Contacted) are set automatically by the script.

## Step 3: Show for confirmation

Present the extracted data in a clean table so the user can review it before it gets saved. Format:

```
Extracted from business card:

Name:     John Smith
Email:    john@example.com
Company:  ABC Optical
Type:     optical store
Role:     Owner
Location: Dallas, TX
Tags:     business-card; vision-expo-2026
Source:   business-card
Notes:    Fax: 555-0199
Phone:    (555) 555-0123
Website:  abcoptical.com
Address:  123 Main St, Dallas, TX 75201
```

Ask: "Look good? I'll add this to the sheet and contacts. Let me know if anything needs fixing."

If the card has no email address, tell the user and ask if they want to proceed anyway or skip it. Email is the key identifier in the contact system — without it, the contact can't be enrolled in sequences.

## Step 4: Append to sheet and contacts

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
  "address": "123 Main St, Dallas, TX 75201"
}
```

The script appends to Google Sheet `1xWFgNlWI0GKnwPJ-btI9Yx9MaWaEwx42P-gQWnxQwpw` and adds to `email/contacts.json`.

## Batch mode

If the user provides multiple card images at once, process them one at a time — extract, show for review, wait for confirmation, then move to the next. Don't batch-confirm because the user might want to correct individual cards.

## Edge cases

- **No email on card**: Flag it. Ask if user wants to add anyway (sheet-only, won't be enrollable in sequences) or skip.
- **Duplicate email**: The script will skip duplicates in contacts.json but still append to the sheet. Mention this to the user.
- **Low quality / unreadable text**: Tell the user which parts you couldn't read. Ask them to fill in the gaps.
- **Multiple people on one card**: Rare, but create separate entries for each person if it happens.

## Key files

- `scripts/append-contact.ts` — Appends contact to Google Sheet + contacts.json
- `email/contacts.json` — Local contact directory (gitignored)
- `email/gmail.ts` — Google Sheets API client (OAuth2)
