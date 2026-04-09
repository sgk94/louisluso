// app/accessories/page.tsx
import type { Metadata } from "next";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Accessories — LOUISLUSO",
  description: "Browse LOUISLUSO eyewear accessories.",
};

export default function AccessoriesPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-light uppercase tracking-widest">
        Accessories
      </h1>
      <div className="mt-10 py-16 text-center">
        <p className="text-gray-500">Accessories coming soon.</p>
      </div>
    </main>
  );
}
