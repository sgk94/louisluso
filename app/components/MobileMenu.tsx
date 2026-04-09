"use client";

import { useState } from "react";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Collection } from "@/lib/catalog/collections";

interface MobileMenuProps {
  eyeglassesCollections: Collection[];
  sunglassesCollections: Collection[];
}

export function MobileMenu({ eyeglassesCollections, sunglassesCollections }: MobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function toggleSection(section: string): void {
    setExpandedSection(expandedSection === section ? null : section);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Open menu">
        <Bars3Icon className="h-6 w-6 text-gray-700" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto bg-white p-6">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-heading text-xl tracking-[3px]">LOUISLUSO</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <XMarkIcon className="h-6 w-6 text-gray-700" />
              </button>
            </div>

            <nav className="space-y-4">
              <div>
                <button onClick={() => toggleSection("eyeglasses")} className="w-full text-left text-sm font-medium uppercase tracking-[1.5px] text-gray-700">
                  Eyeglasses {expandedSection === "eyeglasses" ? "−" : "+"}
                </button>
                {expandedSection === "eyeglasses" && (
                  <div className="mt-2 space-y-2 pl-4">
                    {eyeglassesCollections.map((c) => (
                      <Link key={c.slug} href={`/eyeglasses/${c.slug}`} onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleSection("sunglasses")} className="w-full text-left text-sm font-medium uppercase tracking-[1.5px] text-gray-700">
                  Sunglasses {expandedSection === "sunglasses" ? "−" : "+"}
                </button>
                {expandedSection === "sunglasses" && (
                  <div className="mt-2 space-y-2 pl-4">
                    {sunglassesCollections.map((c) => (
                      <Link key={c.slug} href={`/sunglasses/${c.slug}`} onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link href="/accessories" onClick={() => setOpen(false)} className="block text-sm font-medium uppercase tracking-[1.5px] text-gray-700 hover:text-bronze">
                Accessories
              </Link>
              <Link href="/find-a-dealer" onClick={() => setOpen(false)} className="block text-sm font-medium uppercase tracking-[1.5px] text-gray-700 hover:text-bronze">
                Find a Dealer
              </Link>

              <div className="border-t border-gray-200 pt-4">
                <Link href="/become-a-partner" onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
                  Become a Partner
                </Link>
                <Link href="/contact" onClick={() => setOpen(false)} className="mt-2 block text-sm text-gray-500 hover:text-bronze">
                  Contact Us
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
