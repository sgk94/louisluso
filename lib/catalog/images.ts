const CLOUDINARY_BASE = "https://res.cloudinary.com/dctwzk6sn/image/upload";
const PLACEHOLDER_IMAGE = "/images/placeholder-frame.svg";

function toSlug(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Returns the Cloudinary URL for a product's main image.
 * Falls back to placeholder if model is null.
 */
export function getProductImageUrl(model: string | null): string {
  if (!model) return PLACEHOLDER_IMAGE;
  return `${CLOUDINARY_BASE}/products/${toSlug(model)}/main.jpg`;
}

/**
 * Returns the Cloudinary URL for a specific color variant image.
 * Falls back to the main product image if colorName is null.
 */
export function getVariantImageUrl(
  model: string | null,
  colorName: string | null,
): string {
  if (!model) return PLACEHOLDER_IMAGE;
  if (!colorName) return getProductImageUrl(model);
  return `${CLOUDINARY_BASE}/products/${toSlug(model)}/${toSlug(colorName)}.jpg`;
}
