import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getAllProductSlugs } from "@/lib/catalog/catalog";
import { formatPrice } from "@/lib/catalog/format";
import { VariantSelector } from "./VariantSelector";

export const revalidate = 900; // ISR: 15 minutes

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getAllProductSlugs();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Not Found — LOUISLUSO" };

  return {
    title: `${data.product.name} — LOUISLUSO`,
    description: `${data.product.name}. ${data.collection.material} frame by LOUISLUSO.`,
  };
}

export default async function ProductDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);

  if (!data) notFound();

  const { product, collection } = data;
  const categoryPath =
    collection.category === "sunglasses" ? "/sunglasses" : "/eyeglasses";

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-8 text-sm text-gray-500">
        <Link href={categoryPath} className="hover:underline">
          {collection.category === "sunglasses" ? "Sunglasses" : "Eyeglasses"}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`${categoryPath}/${collection.slug}`}
          className="hover:underline"
        >
          {collection.name}
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <VariantSelector
          variants={product.variants}
          productName={product.name}
        />

        <div>
          <h1 className="text-2xl font-light uppercase tracking-widest">
            {product.name}
          </h1>

          {product.srp !== null ? (
            <p className="mt-2 text-xl">{formatPrice(product.srp)}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Contact for pricing</p>
          )}

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Specifications
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Material</dt>
                <dd>{collection.material}</dd>
              </div>
              {product.dimensions && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Lens Width</dt>
                    <dd>{product.dimensions.lens}mm</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Bridge</dt>
                    <dd>{product.dimensions.bridge}mm</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Temple Length</dt>
                    <dd>{product.dimensions.temple}mm</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Available Colors</dt>
                <dd>{product.variants.length}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8">
            <Link
              href="/find-a-dealer"
              className="inline-block w-full border border-black px-8 py-3 text-center text-sm font-medium uppercase tracking-wide transition-colors hover:bg-black hover:text-white"
            >
              Find Nearest Dealer
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
