import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/outline";
import { currentUser } from "@clerk/nextjs/server";
import { getCollectionsByCategory } from "@/lib/catalog/collections";
import { isPartner } from "@/lib/portal/types";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";
import { UserMenu } from "./UserMenu";

export async function Navigation(): Promise<React.ReactElement> {
  const user = await currentUser();
  const partner = user ? isPartner(user.publicMetadata) : false;
  const eyeglasses = getCollectionsByCategory("eyeglasses");
  const sunglasses = getCollectionsByCategory("sunglasses");

  return (
    <header>
      {/* Top bar */}
      <div className="bg-[#0a0a0a] px-4 py-1.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-bronze">
            The World&apos;s Lightest Frames
          </span>
          <div className="flex gap-3">
            <a href="https://www.facebook.com/louisluso" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 transition-colors hover:text-gray-300">FB</a>
            <a href="https://www.instagram.com/louisluso" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 transition-colors hover:text-gray-300">IG</a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          {/* Left: nav links (desktop) */}
          <div className="hidden items-center gap-7 lg:flex">
            <MegaMenu collections={eyeglasses} label="Eyeglasses" basePath="/eyeglasses" />
            <Link href="/sunglasses" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Sunglasses</Link>
            <Link href="/accessories" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Accessories</Link>
          </div>

          {/* Center: Logo */}
          <Link href="/" className="font-heading text-2xl tracking-[4px] text-[#0a0a0a]">LOUISLUSO</Link>

          {/* Right: utility links (desktop) */}
          <div className="hidden items-center gap-6 lg:flex">
            <Link href="/find-a-dealer" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Find a Dealer</Link>
            <Link href="/portal" aria-label="Favorites"><HeartIcon className="h-5 w-5 text-gray-500 transition-colors hover:text-bronze" /></Link>
            {partner ? (
              <UserMenu />
            ) : (
              <Link href="/portal" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Login</Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <MobileMenu eyeglassesCollections={eyeglasses} sunglassesCollections={sunglasses} isPartner={partner} />
        </div>
      </nav>
    </header>
  );
}
