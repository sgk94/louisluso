import type { Dealer } from "./types";

export interface DealerWithDistance {
  dealer: Dealer;
  distance: number; // miles
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_MILES * c * 10) / 10;
}

export function sortDealersByDistance(
  dealers: Dealer[],
  userLat: number,
  userLng: number,
): DealerWithDistance[] {
  return dealers
    .map((dealer) => ({
      dealer,
      distance: haversineDistance(
        userLat,
        userLng,
        dealer.coordinates.lat,
        dealer.coordinates.lng,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
}

export function filterDealersByRadius(
  sorted: DealerWithDistance[],
  radiusMiles: number | null,
): DealerWithDistance[] {
  if (radiusMiles === null) return sorted;
  return sorted.filter((entry) => entry.distance <= radiusMiles);
}
