import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionProducts } from "@/lib/catalog/catalog";
import { getCollectionBySlug, getCollectionsByCategory } from "@/lib/catalog/collections";
import { ProductGrid } from "@/app/components/ProductGrid";

export const revalidate = 900; // ISR: 15 minutes

interface PageProps {
  params: Promise<{ collection: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { collection: slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) return { title: "Not Found — LOUISLUSO" };

  return {
    title: `${collection.name} — LOUISLUSO`,
    description: `Browse ${collection.name}. ${collection.material} frames by LOUISLUSO.`,
  };
}

export async function generateStaticParams(): Promise<
  Array<{ collection: string }>
> {
  return getCollectionsByCategory("eyeglasses").map((c) => ({
    collection: c.slug,
  }));
}

export default async function EyeglassesCollectionPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { collection: slug } = await params;
  const data = await getCollectionProducts(slug);

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/eyeglasses" className="hover:underline">
          Eyeglasses
        </Link>
        <span className="mx-2">/</span>
        <span>{data.collection.name}</span>
      </nav>

      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-light uppercase tracking-widest">
          {data.collection.name}
        </h1>
        <p className="text-sm text-gray-500">
          {data.products.length} {data.products.length === 1 ? "style" : "styles"}
        </p>
      </div>

      <p className="mb-10 text-sm text-gray-500">
        {data.collection.material} frames
      </p>

      <ProductGrid products={data.products} />
    </main>
  );
}
