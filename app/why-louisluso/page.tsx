import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why LOUISLUSO — The World's Lightest Frames",
  description: "Discover ULTEM — the aerospace-grade material that makes LOUISLUSO frames 50% lighter than metal.",
};

export default function WhyLouislusoPage(): React.ReactElement {
  return (
    <main>
      <section className="bg-warm-bg px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a]">Why LOUISLUSO?</h1>
          <p className="mt-4 text-gray-600">The lightest and most comfortable frames, while never sacrificing strength and style.</p>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl">The ULTEM Advantage</h2>
          <p className="mt-6 leading-relaxed text-gray-600">
            ULTEM is a high-performance thermoplastic originally developed for aerospace and medical applications. It delivers seemingly contradictory qualities — feather-light yet exceptionally durable, flexible yet strong. Our frames weigh under 10 grams, making them up to 50% lighter than traditional metal frames.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Ultra-Lightweight</h3>
              <p className="mt-2 text-sm text-gray-600">Under 10g per frame — 50% lighter than metal. You&apos;ll forget you&apos;re wearing them.</p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Flexible &amp; Durable</h3>
              <p className="mt-2 text-sm text-gray-600">Exceptional mechanical strength with remarkable bendability. Built to withstand daily wear.</p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Hypoallergenic</h3>
              <p className="mt-2 text-sm text-gray-600">Safe for sensitive skin. No nickel, no irritation — comfortable for all-day wear.</p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">FDA &amp; ECO Certified</h3>
              <p className="mt-2 text-sm text-gray-600">Meets FDA standards and manufactured using environmentally conscious processes.</p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Temperature Resistant</h3>
              <p className="mt-2 text-sm text-gray-600">Functions from -30&deg;C to 230&deg;C. Engineered for any environment.</p>
            </div>
            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Aerospace Grade</h3>
              <p className="mt-2 text-sm text-gray-600">The same material used in advanced medical devices and aerospace components.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-off-white px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl">How ULTEM Compares</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-3 text-left text-xs font-medium uppercase tracking-[1px] text-gray-500">Property</th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-bronze">ULTEM</th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">Acetate</th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">Metal</th>
                  <th className="py-3 text-center text-xs font-medium uppercase tracking-[1px] text-gray-500">Titanium</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-200"><td className="py-3">Weight</td><td className="py-3 text-center font-medium text-bronze">Lightest</td><td className="py-3 text-center">Heavy</td><td className="py-3 text-center">Heavy</td><td className="py-3 text-center">Light</td></tr>
                <tr className="border-b border-gray-200"><td className="py-3">Flexibility</td><td className="py-3 text-center font-medium text-bronze">Excellent</td><td className="py-3 text-center">Poor</td><td className="py-3 text-center">Moderate</td><td className="py-3 text-center">Good</td></tr>
                <tr className="border-b border-gray-200"><td className="py-3">Hypoallergenic</td><td className="py-3 text-center font-medium text-bronze">Yes</td><td className="py-3 text-center">Yes</td><td className="py-3 text-center">No</td><td className="py-3 text-center">Yes</td></tr>
                <tr className="border-b border-gray-200"><td className="py-3">Durability</td><td className="py-3 text-center font-medium text-bronze">Excellent</td><td className="py-3 text-center">Moderate</td><td className="py-3 text-center">Good</td><td className="py-3 text-center">Excellent</td></tr>
                <tr><td className="py-3">Price</td><td className="py-3 text-center font-medium text-bronze">$$</td><td className="py-3 text-center">$$</td><td className="py-3 text-center">$</td><td className="py-3 text-center">$$$</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl">Experience the Difference</h2>
          <p className="mt-4 text-gray-600">Visit a dealer to try LOUISLUSO frames, or explore our collections online.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/find-a-dealer" className="inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white">Find a Dealer</Link>
            <Link href="/eyeglasses" className="inline-block px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-gray-600 transition-colors hover:text-bronze">Explore Collections →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
