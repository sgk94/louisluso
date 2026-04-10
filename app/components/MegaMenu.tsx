"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/catalog/collections";

interface MegaMenuProps {
  collections: Collection[];
  label: string;
  basePath: string;
}

export function MegaMenu({ collections, label, basePath }: MegaMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="true"
        className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze"
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          onMouseLeave={() => setOpen(false)}
          className="absolute left-0 top-full z-50 mt-2 w-[500px] border border-gray-200 bg-white p-6 shadow-lg"
        >
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {collections.map((c) => (
              <Link
                key={c.slug}
                href={`${basePath}/${c.slug}`}
                onClick={() => setOpen(false)}
                className="text-sm text-gray-600 transition-colors hover:text-bronze"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Link href={basePath} onClick={() => setOpen(false)} className="text-xs font-medium uppercase tracking-[2px] text-bronze">
              View All {label} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
