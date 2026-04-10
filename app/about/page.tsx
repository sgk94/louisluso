import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us — LOUISLUSO",
  description: "Q-Vision Optics — creating the world's lightest frames from Arlington Heights, Illinois.",
};

export default function AboutPage(): React.ReactElement {
  return (
    <main>
      <section className="bg-warm-bg px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-5xl text-[#0a0a0a]">About LOUISLUSO</h1>
          <p className="mt-4 text-gray-600">Creating exceptionally light eyewear that combines functionality with personal style.</p>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-16">
          <div>
            <h2 className="font-heading text-3xl">Our Mission</h2>
            <p className="mt-4 leading-relaxed text-gray-600">LOUISLUSO creates exceptionally light eyewear frames using ULTEM — a material that is 50% lighter than metal yet incredibly durable and flexible. We combine functionality with personal style and quality craftsmanship, because your eyewear should be as comfortable as it is beautiful.</p>
          </div>

          <div>
            <h2 className="font-heading text-3xl">Our Vision</h2>
            <p className="mt-4 leading-relaxed text-gray-600">To become a recognized global leader in eyewear, known for innovative, lightweight frames that reflect individual style while making positive environmental impacts through eco-conscious manufacturing.</p>
          </div>

          <div>
            <h2 className="font-heading text-3xl">Our Values</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Innovation</h3>
                <p className="mt-2 text-sm text-gray-600">Continuously developing new materials and technologies to create unique, high-quality eyewear.</p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Customer Oriented</h3>
                <p className="mt-2 text-sm text-gray-600">Understanding customer needs and delivering exceptional service and satisfaction.</p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-bronze">Comfort</h3>
                <p className="mt-2 text-sm text-gray-600">Lightweight design with universal fit through flexible ULTEM material for every wearer.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-16 text-center">
            <p className="font-heading text-2xl text-gray-900">Trusted by 500+ optical stores across North America</p>
            <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">Q-Vision Optics, Inc. &middot; 3413 N. Kennicott Ave, Ste B, Arlington Heights, IL</p>
            <Link href="/become-a-partner" className="mt-8 inline-block border border-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white">Become a Partner</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
