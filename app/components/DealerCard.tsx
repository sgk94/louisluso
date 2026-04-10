"use client";

import type { Dealer } from "@/lib/dealers/types";

interface DealerCardProps {
  dealer: Dealer;
  distance: number;
  selected: boolean;
  onSelect: (dealer: Dealer) => void;
  onContact: (dealer: Dealer) => void;
}

export function DealerCard({ dealer, distance, selected, onSelect, onContact }: DealerCardProps): React.ReactElement {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${dealer.address.street}, ${dealer.address.city}, ${dealer.address.state} ${dealer.address.zip}`
  )}`;

  return (
    <div
      className={`cursor-pointer border-b border-white/10 px-4 py-3.5 transition-colors ${
        selected
          ? "border-l-[3px] border-l-bronze bg-white/[0.03]"
          : "border-l-[3px] border-l-transparent hover:bg-white/[0.02]"
      }`}
      onClick={() => onSelect(dealer)}
      role="button"
      tabIndex={0}
      aria-label={`Select ${dealer.name}`}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(dealer); }}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <span className={`text-[13px] font-semibold ${selected ? "text-white" : "text-gray-300"}`}>
          {dealer.name}
        </span>
        <span className={`ml-2 shrink-0 text-[11px] ${selected ? "text-bronze" : "text-gray-500"}`}>
          {`${distance} mi`}
        </span>
      </div>

      <p className="mb-2.5 text-[11px] text-gray-500">
        {dealer.address.city}, {dealer.address.state}
      </p>

      <div className="flex gap-1.5">
        <a
          href={`tel:${dealer.phone}`}
          aria-label={`Call ${dealer.name}`}
          className="flex-1 rounded border border-white/10 bg-white/[0.03] py-1.5 text-center text-[10px] text-gray-400 transition-colors hover:border-white/20 hover:text-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          Call
        </a>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${dealer.name}`}
          className="flex-1 rounded border border-white/10 bg-white/[0.03] py-1.5 text-center text-[10px] text-gray-400 transition-colors hover:border-white/20 hover:text-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          Directions
        </a>
        <button
          aria-label={`Contact ${dealer.name}`}
          className="flex-[1.4] rounded bg-bronze py-1.5 text-center text-[10px] font-semibold text-white transition-colors hover:bg-bronze-light"
          onClick={(e) => {
            e.stopPropagation();
            onContact(dealer);
          }}
        >
          Contact
        </button>
      </div>
    </div>
  );
}
