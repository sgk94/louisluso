export interface ParsedColor {
  colorCode: string;
  colorName: string;
}

export interface ParsedDimensions {
  lens: number;
  bridge: number;
  temple: number;
}

export function parseColor(sku: string): ParsedColor | null {
  // Format 1: CO.{number} {COLOR NAME} [Sunglass]
  const coMatch = sku.match(/CO\.(\d+)\s+(.+?)(?:\s+Sunglass)?$/i);
  if (coMatch) {
    return {
      colorCode: `C${coMatch[1]}`,
      colorName: toTitleCase(coMatch[2].trim()),
    };
  }

  // Format 2: C{number}. {COLOR NAME} [Sunglass]
  const cMatch = sku.match(/C(\d+)\.\s+(.+?)(?:\s+Sunglass)?$/i);
  if (cMatch) {
    return {
      colorCode: `C${cMatch[1]}`,
      colorName: toTitleCase(cMatch[2].trim()),
    };
  }

  return null;
}

export function parseDimensions(sku: string): ParsedDimensions | null {
  const match = sku.match(/(\d{2,3})\/(\d{2,3})\/(\d{2,3})/);
  if (!match) return null;

  return {
    lens: parseInt(match[1], 10),
    bridge: parseInt(match[2], 10),
    temple: parseInt(match[3], 10),
  };
}

function toTitleCase(str: string): string {
  // Title-case each word, preserving slash separators
  return str
    .split(/(\s+|(?<=\/)(?=\S)|(?<=\S)(?=\/))/)
    .map((segment) => {
      if (/^\s+$/.test(segment) || segment === "/") return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("");
}
