#!/usr/bin/env node
/**
 * Register a voter CSV for a client (metadata + row count).
 * Copies or symlinks the file into data/voter/<clientId>/.
 *
 * Usage:
 *   npm run voter:register -- --client d11-colorado-springs --file /path/to/voters.csv
 *   npm run voter:register -- --client d11-colorado-springs --file voters.csv --source "TargetSmart Mar 2026" --link
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { openDb } from "../server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function usage() {
  console.log(`Usage: npm run voter:register -- --client <client-id> --file <csv-path> [options]

Options:
  --source <label>   Display label (default: CSV filename)
  --link             Symlink instead of copying into data/voter/
  --help             Show this help
`);
}

function parseArgs(argv) {
  const out = { client: null, file: null, source: null, link: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--link") out.link = true;
    else if (arg === "--client") out.client = argv[++i];
    else if (arg === "--file") out.file = argv[++i];
    else if (arg === "--source") out.source = argv[++i];
  }
  return out;
}

async function countCsvRows(filePath) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  for await (const _line of rl) {
    count += 1;
  }
  return Math.max(0, count - 1);
}

function storeVoterFile({ clientId, sourcePath, link }) {
  const destDir = path.join(root, "data", "voter", clientId);
  fs.mkdirSync(destDir, { recursive: true });
  const base = path.basename(sourcePath);
  const destPath = path.join(destDir, base);

  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  if (link) {
    fs.symlinkSync(sourcePath, destPath);
  } else {
    fs.copyFileSync(sourcePath, destPath);
  }
  return destPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.client || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const sourcePath = path.resolve(args.file);
  if (!fs.existsSync(sourcePath)) {
    console.error(`File not found: ${sourcePath}`);
    process.exit(1);
  }

  const source = args.source || path.basename(sourcePath);
  console.log(`Counting rows in ${sourcePath}…`);
  const recordCount = await countCsvRows(sourcePath);
  const storagePath = storeVoterFile({
    clientId: args.client,
    sourcePath,
    link: args.link,
  });

  const db = openDb();
  db.prepare("UPDATE voter_files SET active = 0 WHERE client_id = ?").run(args.client);
  db.prepare(
    `INSERT INTO voter_files (client_id, source, record_count, refreshed_at, storage_path, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(args.client, source, recordCount, new Date().toISOString(), storagePath);
  db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
    "voter-register",
    `Registered voter file for ${args.client}: ${source} (${recordCount.toLocaleString()} records)`,
    "Data",
  );
  db.close();

  console.log(`Registered ${recordCount.toLocaleString()} records for ${args.client}`);
  console.log(`  Source: ${source}`);
  console.log(`  Storage: ${storagePath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
