const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR",
]);

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC", "puerto rico": "PR",
};

const CA_PROVINCE_CODES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

const CA_PROVINCE_NAME_TO_CODE: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
  "newfoundland and labrador": "NL", "nova scotia": "NS", "northwest territories": "NT",
  nunavut: "NU", ontario: "ON", "prince edward island": "PE", quebec: "QC", "québec": "QC",
  saskatchewan: "SK", yukon: "YT",
};

function normalizeCountry(country: string | undefined | null): string {
  // Strip whitespace + periods so "U.S.A." / "U.S.A" / "USA." all collapse to "USA".
  return String(country ?? "").trim().replace(/\./g, "").toUpperCase();
}

function isCanada(country: string | undefined | null): boolean {
  const c = normalizeCountry(country);
  return c === "CANADA" || c === "CAN";
  // NOTE: "CA" intentionally NOT treated as Canada here — collides with California.
}

function isUSA(country: string | undefined | null): boolean {
  const c = normalizeCountry(country);
  if (!c) return false;
  return (
    c === "USA" ||
    c === "US" ||
    c === "USOFA" ||
    c === "UNITED STATES" ||
    c === "UNITED STATES OF AMERICA" ||
    c === "AMERICA"
  );
}

export function toStateCode(
  input: string | null | undefined,
  country?: string | null,
): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  const countryStr = country ?? undefined;
  const canadaHint = isCanada(countryStr);
  const usaHint = isUSA(countryStr);

  // 2-letter code lookup
  if (upper.length === 2) {
    if (canadaHint) {
      return CA_PROVINCE_CODES.has(upper) ? upper : null;
    }
    if (usaHint) {
      return US_STATE_CODES.has(upper) ? upper : null;
    }
    // No hint: US wins, then Canada
    if (US_STATE_CODES.has(upper)) return upper;
    if (CA_PROVINCE_CODES.has(upper)) return upper;
    return null;
  }

  // Full name lookup
  if (canadaHint) {
    return CA_PROVINCE_NAME_TO_CODE[lower] ?? null;
  }
  if (usaHint) {
    return US_STATE_NAME_TO_CODE[lower] ?? null;
  }
  return US_STATE_NAME_TO_CODE[lower] ?? CA_PROVINCE_NAME_TO_CODE[lower] ?? null;
}
