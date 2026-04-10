"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Dealer } from "@/lib/dealers/types";

interface DealerMapProps {
  dealers: Dealer[];
  selectedDealerId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onSelectDealer: (dealer: Dealer) => void;
  mapboxToken: string;
}

const DEFAULT_CENTER: [number, number] = [-87.9, 41.9]; // Chicago area
const DEFAULT_ZOOM = 4;
const FOCUSED_ZOOM = 11;

export function DealerMap({ dealers, selectedDealerId, userLocation, onSelectDealer, mapboxToken }: DealerMapProps): React.ReactElement {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : DEFAULT_CENTER;
    const zoom = userLocation ? FOCUSED_ZOOM : DEFAULT_ZOOM;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, userLocation]);

  // Update markers when dealers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    for (const dealer of dealers) {
      const isSelected = dealer.id === selectedDealerId;
      const size = isSelected ? 20 : 14;

      const el = document.createElement("div");
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = "50%";
      el.style.background = isSelected ? "#c4a265" : "#8B6F4E";
      el.style.border = `2px solid ${isSelected ? "#e8d5a8" : "#c4a265"}`;
      el.style.boxShadow = isSelected
        ? "0 0 20px rgba(196,162,101,0.8), 0 0 40px rgba(196,162,101,0.3)"
        : "0 0 12px rgba(139,111,78,0.6)";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s ease";

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dealer.coordinates.lng, dealer.coordinates.lat])
        .addTo(map);

      el.addEventListener("click", () => onSelectDealer(dealer));

      markersRef.current.push(marker);
    }
  }, [dealers, selectedDealerId, onSelectDealer]);

  // Fly to selected dealer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedDealerId) return;

    const dealer = dealers.find((d) => d.id === selectedDealerId);
    if (!dealer) return;

    map.flyTo({
      center: [dealer.coordinates.lng, dealer.coordinates.lat],
      zoom: 13,
      duration: 800,
    });
  }, [selectedDealerId, dealers]);

  return (
    <div ref={mapContainer} className="h-full w-full" />
  );
}
