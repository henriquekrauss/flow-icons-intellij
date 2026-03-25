#!/usr/bin/env node
/**
 * Downloads premium Flow Icons using your license key.
 *
 * Usage:
 *   node scripts/download-icons-pro.mjs <LICENSE_KEY> [theme]
 *   FLOW_ICONS_LICENSE=<key> node scripts/download-icons-pro.mjs [theme]
 *
 * theme: deep (default), dim, dawn, deep-light, dim-light, dawn-light
 */

import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { hostname } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "src/main/resources/icons/flow");
const VERSION_FILE = join(ROOT, ".icon-version");
const API_BASE = "https://legit-i9lq.onrender.com/flow-icons";

const LICENSE_KEY = process.argv[2] || process.env.FLOW_ICONS_LICENSE;
const THEME = process.argv[3] || "deep";

if (!LICENSE_KEY) {
  console.error("Error: License key is required.");
  console.error("Usage: node scripts/download-icons-pro.mjs <LICENSE_KEY> [theme]");
  console.error("   or: FLOW_ICONS_LICENSE=<key> node scripts/download-icons-pro.mjs [theme]");
  process.exit(1);
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  // Get extension version from Open VSX
  let extVersion = "1.0.0";
  try {
    const info = await fetchJson("https://open-vsx.org/api/thang-nm/flow-icons");
    extVersion = info.version ?? extVersion;
  } catch {
    console.warn("Could not fetch extension version, using", extVersion);
  }

  // Machine ID: MD5 of hostname (matches the original update-icons.cjs)
  const machineId = createHash("md5").update(hostname()).digest("hex");

  console.log(`Checking for premium icons (ext version: ${extVersion}) ...`);

  let remoteVersion, downloadUrl;
  try {
    const resp = await fetchJson(`${API_BASE}/version-3?v=${extVersion}`, {
      authorization: LICENSE_KEY,
      "machine-id": machineId,
      "user-agent": `Flow Icons/${extVersion}`,
    });
    remoteVersion = resp.version;
    downloadUrl = resp.url;
  } catch (e) {
    console.error("License check failed:", e.message);
    console.error("Make sure your license key is valid.");
    process.exit(1);
  }

  const versionKey = `${extVersion}-${remoteVersion}`;
  const currentVersion = existsSync(VERSION_FILE) ? readFileSync(VERSION_FILE, "utf8").trim() : "";

  if (currentVersion === versionKey && existsSync(ICONS_DIR)) {
    console.log(`Icons already up to date (${versionKey}). Nothing to do.`);
    process.exit(0);
  }

  console.log(`Downloading premium icons (remote version: ${remoteVersion}) ...`);

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  // The archive is a brotli-compressed tar. Node has no built-in brotli stream for
  // decompressing, so we use the system `brotli` CLI to decompress, then tar to extract.
  const { tmpdir } = await import("os");
  const tmpFile = join(tmpdir(), `flow-icons-${Date.now()}.tar.br`);
  const tmpTar = join(tmpdir(), `flow-icons-${Date.now()}.tar`);

  // Save the compressed file
  const writer = createWriteStream(tmpFile);
  await pipeline(res.body, writer);

  console.log("Decompressing ...");
  try {
    execSync(`brotli --decompress --output="${tmpTar}" "${tmpFile}"`);
  } catch {
    // Try python fallback
    try {
      execSync(`python3 -c "import brotli,sys; open('${tmpTar}','wb').write(brotli.decompress(open('${tmpFile}','rb').read()))"`);
    } catch {
      console.error("Could not decompress: install brotli (brew install brotli) or pip3 install brotli");
      process.exit(1);
    }
  }

  console.log(`Extracting theme '${THEME}' ...`);
  mkdirSync(ICONS_DIR, { recursive: true });

  // Extract only the chosen theme folder, stripping the leading theme/ prefix
  execSync(`tar -xf "${tmpTar}" -C "${ICONS_DIR}" --strip-components=1 "${THEME}/"`);

  // Cleanup
  try { execSync(`rm -f "${tmpFile}" "${tmpTar}"`); } catch {}

  writeFileSync(VERSION_FILE, versionKey);

  console.log("Resizing icons to 16x16 ...");
  execSync(`for f in "${ICONS_DIR}"/*.png; do sips -z 16 16 "$f" --out "$f" > /dev/null 2>&1; done`, { shell: "/bin/bash" });

  const count = execSync(`ls "${ICONS_DIR}" | wc -l`).toString().trim();
  console.log(`\nDone! ${count} icons installed to src/main/resources/icons/flow`);
  console.log("You can now build the plugin with: ./gradlew buildPlugin");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
