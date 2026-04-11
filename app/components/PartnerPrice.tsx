import { formatPrice } from "@/lib/catalog/format";

interface PartnerPriceProps {
  srp: number | null;
  listingPrice: number;
  bespokePrice: number | null;
  isPartner: boolean;
  size?: "sm" | "lg";
}

export function PartnerPrice({ srp, listingPrice, bespokePrice, isPartner, size = "sm" }: PartnerPriceProps): React.ReactElement {
  const textClass = size === "lg" ? "text-xl" : "text-sm";

  // Public visitor — show SRP
  if (!isPartner) {
    if (srp === null) {
      return <p className={`${size === "lg" ? "text-sm" : "text-xs"} text-gray-400`}>Contact for pricing</p>;
    }
    return <p className={`${textClass} text-gray-600`}>{formatPrice(srp)}</p>;
  }

  // Partner with bespoke pricing different from listing
  if (bespokePrice !== null && bespokePrice !== listingPrice) {
    return (
      <div className={`flex items-center gap-2 ${textClass}`}>
        <s className="text-gray-400">{formatPrice(listingPrice)}</s>
        <span className="rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          {formatPrice(bespokePrice)}
        </span>
      </div>
    );
  }

  // Partner — show listing price (default wholesale)
  return <p className={`${textClass} text-gray-600`}>{formatPrice(listingPrice)}</p>;
}
