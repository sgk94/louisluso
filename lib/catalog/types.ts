// lib/catalog/types.ts

export interface CatalogVariant {
  id: string;
  colorCode: string;
  colorName: string;
  inStock: boolean;
  image: string | null;
}

export interface CatalogDimensions {
  lens: number;
  bridge: number;
  temple: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  srp: number | null;
  listingPrice: number;
  image: string | null;
  variants: CatalogVariant[];
  dimensions: CatalogDimensions | null;
}

export interface CollectionDetail {
  slug: string;
  name: string;
  category: "eyeglasses" | "sunglasses" | "accessories";
  material: string;
}

export interface CollectionWithProducts {
  collection: CollectionDetail;
  products: CatalogProduct[];
}
