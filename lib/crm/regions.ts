import { readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { join } from "path";

export interface Region {
  slug: string;
  name: string;
  zipPrefixes: string[]; // "900-935" means 900xx through 935xx
}

export const REGIONS: Region[] = [
  { slug: "socal", name: "Southern California", zipPrefixes: ["900-935"] },
  { slug: "norcal", name: "Northern California", zipPrefixes: ["936-961"] },
  { slug: "dallas", name: "Dallas / Fort Worth", zipPrefixes: ["750-753", "760-761"] },
  { slug: "austin", name: "Austin", zipPrefixes: ["786-787"] },
  { slug: "houston", name: "Houston", zipPrefixes: ["770-775"] },
  { slug: "lasvegas", name: "Las Vegas", zipPrefixes: ["891"] },
];

export function matchRegion(zip: string | undefined): string | null {
  if (!zip || zip.length < 3) return null;

  const prefix = parseInt(zip.substring(0, 3), 10);
  if (isNaN(prefix)) return null;

  for (const region of REGIONS) {
    for (const range of region.zipPrefixes) {
      const [startStr, endStr] = range.split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : start;

      if (prefix >= start && prefix <= end) {
        return region.slug;
      }
    }
  }

  return null;
}

export function getRegionName(slug: string): string | null {
  const region = REGIONS.find((r) => r.slug === slug);
  return region?.name ?? null;
}

export interface KnowledgeBaseEntry {
  state: string;
  city: string;
  zip: string;
  region: string | null;
}

export const KB_PATH = join(process.cwd(), "data", "location-kb.json");

export function loadKnowledgeBase(): Record<string, KnowledgeBaseEntry> {
  if (!existsSync(KB_PATH)) return {};
  try {
    return JSON.parse(readFileSync(KB_PATH, "utf-8")) as Record<string, KnowledgeBaseEntry>;
  } catch (err) {
    console.warn(`Warning: location-kb.json is corrupt or unreadable, starting fresh. Error: ${err instanceof Error ? err.message : err}`);
    return {};
  }
}

export function lookupCity(city: string, state: string): KnowledgeBaseEntry | null {
  const kb = loadKnowledgeBase();
  const key = `${city.toLowerCase().trim()}, ${state.toLowerCase().trim()}`;
  return kb[key] ?? null;
}

export function updateKnowledgeBase(
  city: string,
  state: string,
  zip: string,
  region: string | null,
): void {
  const kb = loadKnowledgeBase();
  const key = `${city.toLowerCase().trim()}, ${state.toLowerCase().trim()}`;

  // Only write if key is absent — don't overwrite existing entries (Fix 4: multi-zip safety)
  if (kb[key]) return;

  kb[key] = {
    state: state.toUpperCase().trim(),
    city: city.trim(),
    zip,
    region,
  };

  // Atomic write: write to temp file then rename (Fix 1)
  const tmpPath = KB_PATH + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(kb, null, 2) + "\n");
  renameSync(tmpPath, KB_PATH);
}
