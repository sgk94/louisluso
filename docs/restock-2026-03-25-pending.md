# Restock 2026-03-25 — Pending Items

Source: TANI Reorder Lists dated 26.3.25

## Completed (21 variants, 215 units)

All confirmed variants updated on 2026-04-03. See `scripts/restock-2026-03-25.ts`.

---

## Needs Verification — Color Mapping Unknown (11 items, 110 units)

These T-series products have no SKUs on their WooCommerce variants, so we can't confirm which variant ID matches which color number. Need Ken or the factory to confirm color-to-number mapping.

| Item | Color | Qty | WC Product ID | Issue |
|---|---|---|---|---|
| T-7224 | C5 | 10 | 26853 | No variant with C5/CO5 in SKU. Available colors: Brown, Black, Wine, Grey, TAN, Pink, Purple, Clear |
| T-7235 | C11 | 10 | 26842 | No CO11 in any SKU. Available colors: Brown Glossed, Grey, Pink, Purple, Black, Red, TAN, Transparent |
| T-7238 | C2 | 10 | 27075 | All variants have empty SKUs. Colors: Black, Brown, Grey, Pink, TAN, Transparent |
| T-7238 | C8 | 10 | 27075 | Same — no SKUs |
| T-7239 | C1 | 10 | 27083 | All variants have empty SKUs. Colors: Black, Brown, Grey, Pink, TAN, Transparent |
| T-7241 | C2 | 10 | 27099 | All variants have empty SKUs. Colors: Black, Brown, Grey, Pink, TAN, Transparent |
| T-7241 | C3 | 10 | 27099 | Same — no SKUs |
| T-7241 | C8 | 10 | 27099 | Same — no SKUs |
| T-7249 | C3 | 10 | 26945 | All variants have empty SKUs. Colors: Black, Brown, Grey, Pink, Purple, Red, Transparent |
| T-7249 | C11 | 10 | 26945 | Same — no SKUs |
| T-7251 | C2DG | 10 | 26962 | No SKUs. Likely "DARK GREY" variant (id: 26966) but unconfirmed |

### What we need to resolve these

A color code reference chart for T-series (e.g., C1=Brown, C2=Grey, C3=Black, etc.). From the products that DO have SKUs, we can see a pattern:

| Code | Color (from SKU-confirmed products) |
|---|---|
| CO1 / C1 | Brown |
| CO2 / C2 | Grey |
| CO3 / C3 | Black |
| CO5 / C5 | Red/Wine? |
| CO6 / C6 | Purple/Wine |
| CO8 / C8 | Transparent/Grey |
| CO11 | Clear? |
| CO18 | Pink |
| 2DG | Dark Grey? |

**Problem:** C8 maps to "Clear/Transparent" on T-7223 but "Grey" on T-7224. Mappings may not be consistent across models.

---

## Not in WooCommerce (8 items, 80 units)

These products don't exist in the WooCommerce store. They need to be created before stock can be set.

| Item | Color | Qty | Notes |
|---|---|---|---|
| T-7242 | C18 | 10 | Product not found in WC search |
| T-7242 | C2 | 10 | Product not found in WC search |
| SG-4041 | C6 | 10 | No SG-40xx products exist in WC (highest is SG1037) |
| SG-4042 | C26 | 10 | Same — new product line? |
| SG-4044 | C7 | 10 | Same |
| SG-4046 | C2 | 10 | Same |
| SG-4047 | C1 | 10 | Same |
| SG-4048 | C7 | 10 | Same |

### Questions for Ken

1. Are SG-40xx a new product line? Do they need to be added to the website?
2. Does T-7242 exist under a different name?
3. Should these products be created in WooCommerce, or are they only for wholesale/in-person sales?

---

## Status

- [x] 21 confirmed variants updated (2026-04-03)
- [ ] 11 items awaiting color verification
- [ ] 8 items awaiting WooCommerce product creation
