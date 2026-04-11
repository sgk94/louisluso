# 2026 WooCommerce Price Update Plan

**Source:** [2026 Price Sheet](https://docs.google.com/spreadsheets/d/1CDssE5KCQQGXGCiV1MWelLTAEFvGDpToDTcznJFemOk/edit?gid=612922586)

**Action:** Update every WooCommerce product's regular price to match the **2026 List Price** from the price sheet.

---

## Price Mapping

### LOUISLUSO

| Collection | SKU Match | 2026 List Price |
|-----------|-----------|----------------|
| Eye Cloud | EK-* | $57 |
| Classic | LL-* (non-titanium, before LL3001) | $65 |
| Classic Plus | LL3001 and above | $63 |
| Junior | JN-* | $71 |
| Signature | SG-* (SG1000–SG4040) | $76 |
| Signature + | SP-* | $81 |
| London Series | LC-9015 through LC-9036 | $81 |
| London Titanium | LC-9041 through LC-9045 | $97 |
| Milan | ML-* | $99 |
| Grand Collection | GC-* | $73 |
| Rimless Air / Air-O | RA-* or AIR-* | $68 |
| LL Titanium (L-800, L-93) | L-800*, L-93* | $89 |
| LL Titanium (L-5000) | L-5000* | $108 |
| Urban | LU-* (LU1000–LU2999) | $121 |

### 2026 New Collections

| Collection | SKU Match | 2026 List Price |
|-----------|-----------|----------------|
| New Signature Series | SG4041–SG4048 | $68 |
| New London Titanium | LC9050–LC9055 | $99 |
| New Urban Titanium | LU3001–LU3005 | $102 |

### TANDY

| Collection | SKU Match | 2026 List Price |
|-----------|-----------|----------------|
| Tandy (standard) | TA-* (default) | $84 |
| Tandy (TA 1610–1618, 7525, 7526) | TA-1610 through TA-1618, TA-7525, TA-7526 | $86 |
| Tandy Titanium (1144–1520) | TA-1144 through TA-1520 | $108 |
| Tandy Titanium (1600, 1601, 1631–1638) | TA-1600, TA-1601, TA-1631 through TA-1638 | $121 |

### Other Brands

| Collection | SKU Match | 2026 List Price |
|-----------|-----------|----------------|
| Veritas | VT-* | $51 |
| SNF | SNF-* | $130 |
| TANI | T-* | $59 |
| Skylite (SL2001–2007) | SL2001 through SL2007 | $12 |
| Skylite (SL2008–2009) | SL2008, SL2009 | $15 |

### Not Updated (needs confirmation)

| Collection | Reason | Action |
|-----------|--------|--------|
| CLROTTE | Marked "discontinue" on price sheet | **Set all variants to out of stock** |
| Dr. Gram | Marked "discontinue" on price sheet | **Set all variants to out of stock** |
| Manomos Glasses | Per-model pricing | **$138.24 / $159.50 / $176.00 / $192.50** (see canonical JSON) |
| Manomos Sunglasses | Per-model pricing | **$138.24 / $159.50** (see canonical JSON) |
| Close Out / ABBR | Not on 2026 price sheet | **Skip — no price listed, needs confirmation** |
| Accessories (Cases) | Listed as separate line item | **TBD — confirm with Ken** |

---

## How It Works

1. Script reads all WooCommerce products via REST API
2. Matches each product to a collection based on SKU prefix + model number
3. Sets the product's **regular_price** to the 2026 List Price
4. For variable products (parent + variants): updates **both** parent and all variant prices
5. Products that don't match any rule are logged and skipped

## Safety

- **Dry-run mode** available — shows what would change without making updates
- All changes logged with before/after prices
- Can be reverted by running with previous prices
- WooCommerce API rate limits respected (Wordfence IP whitelisted)

---

## Also Update in Zoho Inventory

These items need their `item.rate` (listing price) updated in Zoho to match 2026 pricing:

| Collection | SKU Match | 2026 List Price | Notes |
|-----------|-----------|----------------|-------|
| TANI | T-* | $59 | Not on original price sheet — confirmed separately |

## Questions for Ken

1. Manomos and Close Out collections — what are their 2026 list prices?
2. The Accessories line (Cases) — what price should these be?
3. Are there any products that should NOT be updated?
