"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Collection } from "@/lib/catalog/collections";

interface MobileMenuProps {
  eyeglassesCollections: Collection[];
  sunglassesCollections: Collection[];
  isPartner?: boolean;
}

export function MobileMenu({ eyeglassesCollections, sunglassesCollections, isPartner }: MobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function toggleSection(section: string): void {
    setExpandedSection(expandedSection === section ? null : section);
  }

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Open menu" aria-expanded={open}>
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
                {!isPartner && (
                  <Link href="/become-a-partner" onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
                    Become a Partner
                  </Link>
                )}
                <Link href="/contact" onClick={() => setOpen(false)} className={`block text-sm text-gray-500 hover:text-bronze ${!isPartner ? "mt-2" : ""}`}>
                  Contact Us
                </Link>
              </div>

              {isPartner && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[2px] text-gray-400">Partner</p>
                  <Link href="/portal" onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
                    Dashboard
                  </Link>
                  <Link href="/portal/account" onClick={() => setOpen(false)} className="mt-2 block text-sm text-gray-500 hover:text-bronze">
                    Account
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
