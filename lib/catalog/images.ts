const PLACEHOLDER_IMAGE = "/images/placeholder-frame.svg";

/**
 * Returns the product image URL.
 * Currently returns a placeholder. When Cloudinary migration is done,
 * this will return: https://res.cloudinary.com/dctwzk6sn/image/upload/products/{sku}/{view}.jpg
 */
export function getProductImageUrl(
  _sku: string | null,
  _view: "main" | "side" | "front" = "main",
): string {
  return PLACEHOLDER_IMAGE;
}
