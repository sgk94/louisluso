/**
 * Business-card-scan skill helper.
 *
 * Lists image files in the "unscanned" Google Drive folder, downloads
 * each to a local temp dir, and prints a JSON manifest so the skill
 * workflow can point its vision reads at local paths.
 *
 * Default folder is the canonical unscanned folder for Louis Luso.
 * Override with --folder <id>. Override temp dir with --out <dir>.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx .claude/skills/business-card-scan/list-unscanned.ts
 *   npx tsx .claude/skills/business-card-scan/list-unscanned.ts --folder <id> --out /tmp/cards
 */
import "dotenv/config";
import { google } from "googleapis";
import { createOAuth2Client } from "../../../email/gmail.ts";
import { mkdirSync, createWriteStream, existsSync } from "fs";
import { join } from "path";

const DEFAULT_FOLDER_ID = "1A7BqXvQyfc_uqONyRh0fcU2DRVFLlL0M";
const DEFAULT_OUT_DIR = "/tmp/drive-cards-unscanned";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface ManifestEntry {
  id: string;
  name: string;
  path: string;
  mimeType: string;
}

function parseArgs(): { folderId: string; outDir: string } {
  const args = process.argv.slice(2);
  let folderId = DEFAULT_FOLDER_ID;
  let outDir = DEFAULT_OUT_DIR;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--folder":
        folderId = args[++i] ?? folderId;
        break;
      case "--out":
        outDir = args[++i] ?? outDir;
        break;
      default:
        console.error(`Unknown flag: ${args[i]}`);
        process.exit(1);
    }
  }

  return { folderId, outDir };
}

async function main(): Promise<void> {
  const { folderId, outDir } = parseArgs();

  mkdirSync(outDir, { recursive: true });

  const auth = createOAuth2Client();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: 200,
  });

  const files = (res.data.files ?? []).filter(
    (f): f is DriveFile => !!(f.id && f.name && f.mimeType),
  );

  const imageFiles = files.filter(
    (f) =>
      f.mimeType.startsWith("image/") ||
      /\.(jpe?g|png|heic|webp)$/i.test(f.name),
  );

  console.error(
    `Folder ${folderId}: ${files.length} items, ${imageFiles.length} image files`,
  );
  console.error(`Downloading to ${outDir}\n`);

  const manifest: ManifestEntry[] = [];

  for (const file of imageFiles) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const outPath = join(outDir, `${file.id}__${safeName}`);

    if (existsSync(outPath)) {
      console.error(`  skip (exists): ${file.name}`);
    } else {
      const dl = await drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "stream" },
      );

      await new Promise<void>((resolve, reject) => {
        const out = createWriteStream(outPath);
        dl.data
          .on("end", () => resolve())
          .on("error", reject)
          .pipe(out);
      });

      console.error(`  downloaded: ${file.name}`);
    }

    manifest.push({
      id: file.id,
      name: file.name,
      path: outPath,
      mimeType: file.mimeType,
    });
  }

  console.error("");
  console.log(JSON.stringify({ folderId, outDir, files: manifest }, null, 2));
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
