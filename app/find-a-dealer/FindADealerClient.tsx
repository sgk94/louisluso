"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DealerMap } from "@/app/components/DealerMap";
import { DealerCard } from "@/app/components/DealerCard";
import { ContactDealerModal } from "@/app/components/ContactDealerModal";
import { sortDealersByDistance, filterDealersByRadius } from "@/lib/dealers/distance";
import type { Dealer } from "@/lib/dealers/types";
import type { DealerWithDistance } from "@/lib/dealers/distance";
import { MagnifyingGlassIcon, MapPinIcon } from "@heroicons/react/24/outline";

const RADIUS_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: 250, label: "250 mi" },
  { value: null, label: "All Dealers" },
] as const;

const NEXT_RADIUS: Record<number, number | null> = { 10: 25, 25: 50, 50: 100, 100: 250, 250: null };

interface FindADealerClientProps {
  mapboxToken: string;
}

export function FindADealerClient({ mapboxToken }: FindADealerClientProps): React.ReactElement {
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [filtered, setFiltered] = useState<DealerWithDistance[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [contactDealer, setContactDealer] = useState<Dealer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState<number | null>(25);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const searchParams = useSearchParams();
  const productSlug = searchParams.get("product");

  // Fetch dealers
  useEffect(() => {
    async function fetchDealers(): Promise<void> {
      try {
        const res = await fetch("/api/dealers");
        if (!res.ok) {
          setFetchError(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setAllDealers(data.dealers);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDealers();
  }, []);

  // Request geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { timeout: 8000 },
    );
  }, []);

  // Filter dealers by location + radius
  useEffect(() => {
    if (allDealers.length === 0) return;

    if (userLocation) {
      const sorted = sortDealersByDistance(allDealers, userLocation.lat, userLocation.lng);
      setFiltered(filterDealersByRadius(sorted, radius));
    } else {
      // No location — show all with 0 distance
      setFiltered(allDealers.map((dealer) => ({ dealer, distance: 0 })));
    }
  }, [allDealers, userLocation, radius]);

  const handleNearMe = useCallback((): void => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(false);
      },
      () => setGeoError(true),
      { timeout: 8000 },
    );
  }, []);

  const handleSearch = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=US&limit=1`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        setUserLocation({ lat, lng });
        setGeoError(false);
      }
    } catch {
      // Geocoding failed — do nothing
    }
  }, [mapboxToken]);

  const handleExpandRadius = useCallback((): void => {
    if (radius === null) return;
    const next = NEXT_RADIUS[radius] ?? null;
    setRadius(next);
  }, [radius]);

  const handleSelectDealer = useCallback((dealer: Dealer): void => {
    setSelectedDealer(dealer);
    const card = cardRefs.current.get(dealer.id);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">Loading dealers...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-400">Unable to load dealers.</p>
        <a href="/contact" className="mt-2 text-xs text-bronze hover:underline">Contact us directly</a>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0a0a0a] lg:flex-row">
      {/* Map */}
      <div className="relative h-[55vh] w-full lg:h-full lg:flex-[7]">
        {/* Search overlay */}
        <div className="absolute left-4 right-4 top-4 z-10 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a]/90 px-3 py-2.5 backdrop-blur-sm">
            <MagnifyingGlassIcon className="h-4 w-4 text-bronze" />
            <input
              type="text"
              placeholder="Search by city, state, or zip code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery);
              }}
              className="flex-1 bg-transparent text-[13px] text-gray-200 outline-none placeholder:text-gray-500"
            />
          </div>
          <button
            onClick={handleNearMe}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a1a]/90 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-bronze/30"
          >
            <MapPinIcon className="h-3.5 w-3.5 text-bronze" />
            <span className="text-xs text-gray-300">Near me</span>
          </button>
        </div>

        <DealerMap
          dealers={filtered.map((f) => f.dealer)}
          selectedDealerId={selectedDealer?.id ?? null}
          userLocation={userLocation}
          onSelectDealer={handleSelectDealer}
          mapboxToken={mapboxToken}
        />
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col border-t border-white/10 bg-[#111] lg:h-full lg:w-auto lg:flex-[3] lg:border-l lg:border-t-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
              {userLocation ? "Dealers Near You" : "All Dealers"}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {filtered.length} location{filtered.length !== 1 ? "s" : ""}
              {radius !== null && userLocation ? ` within ${radius} miles` : ""}
            </p>
          </div>

          {/* Radius selector */}
          {userLocation && (
            <select
              value={radius ?? "all"}
              onChange={(e) => setRadius(e.target.value === "all" ? null : Number(e.target.value))}
              className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-400 outline-none"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? "all"}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Dealer list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-400">
                No dealers{radius !== null ? ` within ${radius} miles` : ""}.
              </p>
              {radius !== null && NEXT_RADIUS[radius] !== undefined && (
                <button
                  onClick={handleExpandRadius}
                  className="mt-3 text-xs text-bronze hover:underline"
                >
                  Expand search to {NEXT_RADIUS[radius] === null ? "all dealers" : `${NEXT_RADIUS[radius]} mi`}
                </button>
              )}
              {radius === null && (
                <p className="mt-2 text-xs text-gray-600">
                  <a href="/contact" className="text-bronze hover:underline">Contact us directly</a> at cs@louisluso.com
                </p>
              )}
            </div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.dealer.id} ref={(el) => { if (el) cardRefs.current.set(entry.dealer.id, el); }}>
                <DealerCard
                  dealer={entry.dealer}
                  distance={entry.distance}
                  selected={selectedDealer?.id === entry.dealer.id}
                  onSelect={handleSelectDealer}
                  onContact={setContactDealer}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contact modal */}
      {contactDealer && (
        <ContactDealerModal
          dealer={contactDealer}
          onClose={() => setContactDealer(null)}
          productSlug={productSlug}
        />
      )}
    </div>
  );
}
