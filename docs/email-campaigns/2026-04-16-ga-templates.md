# GA Trip — Email Drafts (Apr 16-17)

## First-touch template

**Template file:** `email/templates/trip-visit.html`
**Subject:** `Visiting Atlanta Apr 16-17: introducing LOUISLUSO`
**Variables:** `greeting`, `company`, `area`, `dates`

### Rendered example (Chasidy, Advanced Eyecare Center, Perry — outlier → "your area"):

```
Hi Chasidy,

I'll be visiting your area on April 16-17 and would love the opportunity to stop by Advanced Eyecare Center to introduce you to our LOUISLUSO eyewear collection.

LOUISLUSO frames are crafted from ULTEM, a high-grade thermoplastic originally developed for the aerospace industry. They're up to 50% lighter than traditional acetate or titanium, incredibly flexible, hypoallergenic, and built to last. Our frames come in all sizes, and you won't find them online or in big box stores.

I'd be happy to bring samples and walk you through the collection in person. Would you have 15-20 minutes available during my visit? Feel free to reply to this email or call me directly to set something up.

You can preview the full collection at louisluso.com.

Best regards,
Ken Yoon
Louis Luso Eyewear
louisluso.com
cs@louisluso.com
```

---

## Established template (warmer, existing customers)

**Template file:** `email/templates/trip-visit-established.html`
**Subject:** `Ken from Louis Luso in the Atlanta area Apr 16-17`
**Variables:** `greeting`, `company`, `area`, `dates`

### Rendered example (Sara Yum, Eye Believe Eye Care, Suwanee — ATL metro):

```
Hi Sara,

I'll be in the Atlanta area on April 16-17 and wanted to see if I could stop by Eye Believe Eye Care to show you our latest LOUISLUSO frames.

Would you have 15-20 minutes open either day? I'd love to bring samples of some of the newer models and hear how things are going on your end.

Feel free to reply or call me directly to set something up.

Best,
Ken Yoon
Louis Luso Eyewear
louisluso.com
cs@louisluso.com
```

### Rendered example (generic inbox — e.g., 20/20 Eyecare, Alpharetta):

```
Hello,

I'll be in the Atlanta area on April 16-17 and wanted to see if I could stop by 20/20 Eyecare to show you our latest LOUISLUSO frames.

Would you have 15-20 minutes open either day? ...
```

---

## Send configuration

- **From:** Ken Yoon `<cs@louisluso.com>`
- **BCC on every send:** `shawn@louisluso.com`, `admin@louisluso.com`
- **Transport:** Gmail API
- **Rate:** 2s between sends
- **Tracking:** auto-logged to `email/sent-log.jsonl`; Gmail reply detection runs per sequence
- **Campaign scripts:**
  - `email/campaigns/ga-first-touch.ts` (built)
  - `email/campaigns/ga-established.ts` (pending)

## Style rules applied

- No em-dashes / en-dashes (AI tell).
- Single hyphens OK (`Apr 16-17`, `15-20 minutes`).
- No pricing / discount language in first-touch (per Shawn).
- Name fallback: `"Hello"` when no personal name or generic inbox; `"Hi {name}"` when email is clearly personal.
- Area fallback: outlier cities (Perry, Dalton for GA; Palm Desert for LA) get `"your area"` instead of metro name.
