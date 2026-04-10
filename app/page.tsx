import Link from "next/link";
import type { Metadata } from "next";
import { ScaleIcon, ShieldCheckIcon, MapPinIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "LOUISLUSO — The World's Lightest Frames",
  description: "Premium eyewear crafted from ULTEM — lighter than titanium, stronger than steel. Trusted by 500+ optical stores.",
};

export default function HomePage(): React.ReactElement {
  return (
    <main>
      {/* Hero */}
      <section className="flex min-h-[70vh] items-center justify-center bg-warm-bg px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a] sm:text-6xl lg:text-7xl">
            Engineered for Comfort
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-gray-600">
            Premium eyewear crafted from ULTEM — lighter than titanium, stronger than steel. Every frame weighs under 10 grams.
          </p>
          <Link href="/eyeglasses" className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white">
            Explore the Collection
          </Link>
        </div>
      </section>

      {/* Featured Collections */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Link href="/eyeglasses/signature-series" className="group block">
              <div className="aspect-[3/2] w-full overflow-hidden bg-gray-100">
                <div className="flex h-full items-center justify-center text-gray-400">
                  <span className="font-heading text-2xl">Signature Series</span>
                </div>
              </div>
              <h2 className="mt-4 font-heading text-2xl text-gray-900">Signature Series</h2>
              <p className="mt-1 text-sm text-gray-500">Our flagship ULTEM collection — vibrant colors that never fade.</p>
              <span className="mt-2 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze group-hover:underline">Shop Now →</span>
            </Link>

            <Link href="/eyeglasses/london-collection" className="group block">
              <div className="aspect-[3/2] w-full overflow-hidden bg-gray-100">
                <div className="flex h-full items-center justify-center text-gray-400">
                  <span className="font-heading text-2xl">London Collection</span>
                </div>
              </div>
              <h2 className="mt-4 font-heading text-2xl text-gray-900">London Collection</h2>
              <p className="mt-1 text-sm text-gray-500">Wagner metal meets ULTEM — traditional yet modern design.</p>
              <span className="mt-2 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze group-hover:underline">Shop Now →</span>
            </Link>
          </div>
          <div className="mt-8 text-center">
            <Link href="/eyeglasses" className="text-[13px] font-medium uppercase tracking-[2px] text-bronze hover:underline">View All Collections →</Link>
          </div>
        </div>
      </section>

      {/* Brand Promise */}
      <section className="bg-off-white px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-3">
          <div className="text-center">
            <ScaleIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">Ultra-Lightweight</h3>
            <p className="mt-2 text-sm text-gray-600">Crafted from ULTEM — a space-grade polymer. Every frame weighs under 10 grams, 50% lighter than metal.</p>
          </div>
          <div className="text-center">
            <ShieldCheckIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">Premium Quality</h3>
            <p className="mt-2 text-sm text-gray-600">FDA-approved and ECO-certified. Hypoallergenic, flexible, and built to last with Korean precision engineering.</p>
          </div>
          <div className="text-center">
            <MapPinIcon className="mx-auto h-8 w-8 text-bronze" />
            <h3 className="mt-4 font-heading text-xl">500+ Dealers</h3>
            <p className="mt-2 text-sm text-gray-600">Trusted by optical stores nationwide. Find a dealer near you or become a partner.</p>
          </div>
        </div>
      </section>

      {/* Why LOUISLUSO Teaser */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-4xl text-gray-900">The World&apos;s Lightest Frames</h2>
            <p className="mt-6 leading-relaxed text-gray-600">
              ULTEM is a high-tech thermoplastic used in aerospace and medical devices. It&apos;s feather-light yet exceptionally durable, flexible, and hypoallergenic — ideal for everyday wear. Temperature resistant from -30&deg;C to 230&deg;C.
            </p>
            <Link href="/why-louisluso" className="mt-6 inline-block text-[13px] font-medium uppercase tracking-[2px] text-bronze hover:underline">Learn More →</Link>
          </div>
          <div className="aspect-[4/3] bg-gray-100">
            <div className="flex h-full items-center justify-center text-gray-400">
              <span className="text-sm uppercase tracking-wide">Product Photography</span>
            </div>
          </div>
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section className="bg-[#0a0a0a] px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-4xl text-white">Partner With Us</h2>
          <p className="mt-4 text-gray-400">Join 500+ optical stores carrying LOUISLUSO frames. Competitive wholesale pricing, dedicated support, and a product your customers will love.</p>
          <Link href="/become-a-partner" className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white">Apply Now</Link>
        </div>
      </section>
    </main>
  );
}
