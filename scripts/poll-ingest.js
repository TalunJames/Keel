#!/usr/bin/env node
/**
 * Ingest polling portal files (manifest + poll JSON) into Keel.
 *
 * Usage:
 *   npm run poll:ingest -- --client d11-colorado-springs
 *   npm run poll:ingest -- --dir portal/polling/clients/d11-colorado-springs
 */
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "../server/db.js";
import { ingestPollingPortal } from "../server/polling/ingest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function usage() {
  console.log(`Usage: npm run poll:ingest -- [--client <id> | --dir <portal-dir>]

Options:
  --client <id>   Portal directory under data/polling/clients/<id>
  --dir <path>    Explicit portal directory (must contain polling-manifest.json + polls/)
  --help          Show this help
`);
}

function parseArgs(argv) {
  const out = { client: null, dir: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--client") out.client = argv[++i];
    else if (arg === "--dir") out.dir = argv[++i];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const portalDir = args.dir
    ? path.resolve(args.dir)
    : args.client
      ? path.join(root, "portal", "polling", "clients", args.client)
      : null;

  if (!portalDir) {
    usage();
    process.exit(1);
  }

  const publicRoot = path.join(root, "public");
  const db = openDb();

  try {
    const result = ingestPollingPortal(db, { portalDir, publicRoot, who: "poll-ingest" });
    console.log(`Ingested ${result.pollCount} poll(s) for ${result.clientId}`);
    console.log(`  Poll ids: ${result.pollIds.join(", ")}`);
    console.log(`  Manifest: ${result.manifestPath}`);
  } finally {
    db.close();
  }
}

main();
