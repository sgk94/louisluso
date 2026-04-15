"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { UserCircleIcon } from "@heroicons/react/24/outline";

const MENU_ITEMS = [
  { label: "Dashboard", href: "/portal", enabled: true },
  { label: "My Quotes", href: "/portal/quotes", enabled: true },
  { label: "Orders", href: "/portal/orders", enabled: false },
  { label: "Favorites", href: "/portal/favorites", enabled: false },
  { label: "Account", href: "/portal/account", enabled: true },
];

export function UserMenu(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="text-gray-500 transition-colors hover:text-bronze"
      >
        <UserCircleIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
          {MENU_ITEMS.map((item) =>
            item.enabled ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-xs text-gray-300 transition-colors hover:bg-white/[0.04] hover:text-bronze"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="block px-4 py-2 text-xs text-gray-600"
              >
                {item.label} <span className="text-gray-700">(Coming soon)</span>
              </span>
            ),
          )}

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="block w-full px-4 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-red-400"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
