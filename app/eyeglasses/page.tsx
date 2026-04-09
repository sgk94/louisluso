import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionsByCategory } from "@/lib/catalog/collections";

export const metadata: Metadata = {
  title: "Eyeglasses — LOUISLUSO",
  description: "Browse our eyeglasses collections. The World's Lightest Frames.",
};

export default function EyeglassesPage(): React.ReactElement {
  const collections = getCollectionsByCategory("eyeglasses");

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-light uppercase tracking-widest">
        Eyeglasses
      </h1>
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={`/eyeglasses/${collection.slug}`}
            className="group block"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <div className="flex h-full items-center justify-center text-gray-400">
                <span className="text-sm uppercase tracking-wide">
                  {collection.name}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide group-hover:underline">
                {collection.name}
              </h2>
              {collection.isNew && (
                <span className="bg-black px-2 py-0.5 text-xs font-medium uppercase text-white">
                  New
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {collection.material}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
