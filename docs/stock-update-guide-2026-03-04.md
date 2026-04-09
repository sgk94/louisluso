# Stock Update Guide — March 4, 2026

Based on the handwritten out-of-stock list dated 3/3/2026. All data verified against the live WooCommerce Store API.

## Key Discovery: The `*` Notation

The `*` in the handwritten list maps to a `-` in WooCommerce SKUs:
- `18*1` = SKU suffix `C18-1` (Brown/Orange)
- `3*1` = SKU suffix `C3-1` (Light Brown)
- `1*2` = SKU suffix `C1-2` (Black/Silver)

The variant numbers (1, 3, 4, etc.) correspond to the C-code in the SKU (e.g., variant 4 = C4 = Wine).

---

## VARIANTS THAT NEED TO BE SET TO "OUT OF STOCK"

These are currently showing **In Stock** on the site and need to be changed in WP Admin.

### Junior Collection

| Product | Color | WooCommerce Variant ID | SKU | Current Status |
|---------|-------|----------------------|-----|----------------|
| **719** | Brown | 8266 | 719-brown | In Stock → **set to OOS** |

### Classic Collection

| Product | Color | WooCommerce Variant ID | SKU | Current Status |
|---------|-------|----------------------|-----|----------------|
| **LL4006** | Wine Glossed (C4) | 8885 | LL4006-C4 | In Stock → **set to OOS** |

### London Collection

| Product | Color | WooCommerce Variant ID | SKU | Current Status |
|---------|-------|----------------------|-----|----------------|
| **LC9017** | Black (C1) | 8331 | LC9017-C1 | In Stock → **set to OOS** |
| **LC9021** | Black (C1) | 8392 | LC9021-C1 | In Stock → **set to OOS** |
| **LC9021** | Gray (C24) | 8395 | LC9021-C24 | In Stock → **set to OOS** |
| **LC9032** | Gray (C12) | 8422 | LC9032-C12 | In Stock → **set to OOS** |
| **LC9034** | Brown/Orange (C18-1) | 8455 | LC9034-C18-1 | In Stock → **set to OOS** |
| **LC9041** | Black (C1) | 14269 | LC_9041_C1 | In Stock → **set to OOS** |
| **LC9041** | Wine (C4) | 14271 | LC_9041_C4 | In Stock → **set to OOS** |
| **LC9041** | Purple (C6) | 14272 | LC_9041_C6 | In Stock → **set to OOS** |
| **LC9042** | Light Brown (C3-1) | 14794 | LC_9042_C3-1 | In Stock → **set to OOS** |
| **LC9043** | Black/Gold (C1) | 14322 | LC_9043_C1 | In Stock → **set to OOS** |
| **LC9043** | Black/Silver (C2) | 14323 | LC_9043_C2 | In Stock → **set to OOS** |
| **LC9044** | Black/Silver (C1-2) | 14339 | LC_9044_C1-2 | In Stock → **set to OOS** |
| **LC9044** | Purple/Gold (C11) | 14341 | LC_9044_C11 | In Stock → **set to OOS** |
| **722** | Wine | 8521 | 722_wine | In Stock (5 units) → **set to OOS** |

**Total: 15 variants need to be changed**

---

## VARIANTS ALREADY OUT OF STOCK (no action needed)

These are on the handwritten list but are already marked as out of stock in WooCommerce.

| Product | Color | SKU |
|---------|-------|-----|
| 719 | Black | 719-black |
| 720 | Wine | 720_wine |
| 721 | Black/White | 721_Black/White |
| 722 | Black/White | 722_black/white |
| 722 | Pink/Wine | 722_pink/wine |
| LL4004 | Black Matte (C1) | LL4004-C1 |
| LL4004 | Black/Silver (C14) | LL4004-C14 |
| LL4004 | Black/Green (C23) | LL4004-C23* |
| LL4005 | Black Matte (C1) | LL4005-C1 |
| LL4005 | Wine Glossed (C4) | LL4005-C4 |
| LL4005 | Tortoise (C8) | LL4005-C8 |
| LL4006 | Black Matte (C1) | LL4006-C1 |
| LL4006 | Brown (C3) | LL4006-C3 |
| LL4006 | Black/Green (C23) | LL4006-C23 |
| LC9015 | Clear (C22) | LC9015-C22 |
| LC9017 | Wine (C4) | LC9017-C4 |
| LC9017 | Tortoise (C8) | LC9017-C8 |
| LC9017 | Clear (C22) | LC9017-C22 |
| LC9018 | Brown (C3) | LC9018-C3 |
| LC9020 | Black (C1) | LC9020-C1 |
| LC9020 | Tortoise (C8) | LC9020-C8 |
| LC9021 | Tortoise (C8) | LC9021-C8 |
| LC9022 | Black (C1) | LC9022-C1 |
| LC9022 | Wine (C4) | LC9022-C4 |
| LC9022 | Tortoise (C8) | LC9022-C8 |
| LC9022 | Pink (C25) | LC9022-C25 |
| LC9031 | Black (C1) | LC9031-C1 |
| LC9031 | Clear (C22) | LC9031-C22 |
| LC9042 | Black/Gold (C1) | LC_9042_C1 |
| LC9042 | Brown/Gold (C3) | LC_9042_C3 |
| LC9042 | Blue (C7) | LC_9042_C7 |
| LC9044 | Black/Gold (C1) | LC_9044_C1 |
| LC9044 | Brown/Gold (C9) | LC_9044_C9 |
| LC9045 | Black (C1) | LC_9045_C1 |
| LC9045 | Brown (C3) | LC_9045_C3 |

*Note: LL4004 has ALL 9 variants out of stock, not just the 3 listed.

---

## FLAGS / ISSUES — Need Clarification

| # | Issue | Details |
|---|-------|---------|
| 1 | **4009 not found** | Product "4009" / "LL4009" does not exist on the site. Searched all naming variations. Might be a different code. |
| 2 | **LC9019 C2 doesn't exist** | LC9019 only has C1 (Black), C3 (Brown), C4 (Wine). No C2 variant. |
| 3 | **LL4006 C9 doesn't exist** | LL4006 variants are C1,C2,C3,C4,C8,C11,C12,C14,C23. No C9. |
| 4 | **LC9041 C3 has no variation** | The "Brown" attribute exists on LC9041 but no WooCommerce variation was created for it. May need to be added first. |
| 5 | **LC9044 C8 doesn't exist** | LC9044 variants are C1, C1-2, C9, C11. No C8. |
| 6 | **722 "Red/Silver" doesn't exist** | Product 722 has no Red/Silver variant. Product 719 does have Red/Silver — possible mix-up on the list? |

---

## WP Admin Steps (for each variant above)

1. Go to `louisluso.com/wp-admin`
2. Navigate to **Products** in the left sidebar
3. Search for the product name (e.g., "719", "LL4006", "LC9017")
4. Click **Edit** on the product
5. Scroll to **Product Data** section → click **Variations** tab
6. Find the specific color variant and expand it (click the triangle/arrow)
7. Change **Stock status** dropdown from "In stock" to **"Out of stock"**
8. Click **Save changes** on the variation
9. Click **Update** (blue button, top right) to save the product
10. Repeat for each variant listed above

### After all updates:
- Click **WP Rocket** in the admin toolbar → **Clear Cache**
- Spot-check a few products on the frontend to verify changes

---

## Complete C-Code → Color Reference (all products)

### Classic Collection Color Codes
| C-Code | LL4004 | LL4005 | LL4006 |
|--------|--------|--------|--------|
| C1 | Black Matte | Black Matte | Black Matte |
| C2 | Black Glossed | Black Glossed | Black Glossed |
| C3 | Brown | Brown | Brown |
| C4 | Wine Glossed | Wine Glossed | Wine Glossed |
| C6 | Purple Glossed | Purple Glossed | — |
| C7 | — | Black/Teal | — |
| C8 | Tortoise | Tortoise | Tortoise |
| C9 | Brown/Gold | Brown/Gold | — |
| C11 | — | — | Black/Smokey Blue |
| C12 | Black/Gray | Black/Gray | Black/Gray |
| C14 | Black/Silver | — | Black/Silver |
| C23 | — | — | Black/Green |

### London Collection Color Codes (common mappings)
| C-Code | Common Color |
|--------|-------------|
| C1 | Black (or Black/Gold on metal frames) |
| C2 | Black/Silver (or Black/Gold) |
| C3 | Brown (or Brown/Gold) |
| C3-1 | Light Brown |
| C4 | Wine (or Wine/Gold) |
| C6 | Purple |
| C7 | Blue |
| C8 | Tortoise |
| C9 | Brown/Gold |
| C11 | Blue (or Purple/Gold) |
| C12 | Gray |
| C18-1 | Brown/Orange |
| C22 | Clear |
| C24 | Gray |
| C25 | Pink |
| C26 | Pink |
