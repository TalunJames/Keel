#!/usr/bin/env node
/**
 * One-shot bootstrap for Colorado Springs SD 11 polling + voter files.
 *
 * Copies client PDFs from the Google Drive polling folder, ingests portal data,
 * and registers the voter universe + poll-disposition file.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { openDb } from "../server/db.js";
import { ingestPollingPortal } from "../server/polling/ingest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const CLIENT_ID = "d11-colorado-springs";

// Require the polling directory via env — do not hardcode a personal Drive path.
const DRIVE_ROOT = process.env.CSSD11_POLLING_DIR;
if (!DRIVE_ROOT) {
  console.error(
    "CSSD11_POLLING_DIR is not set. Set it to the polling source directory, e.g.:\n" +
      '  CSSD11_POLLING_DIR="/path/to/Colorado Springs SD/.../Polling" node scripts/bootstrap-cssd11.js',
  );
  process.exit(1);
}

const PDF_SOURCES = [
  { src: "Topline/Topline_FSS_CSSD11_2a.pdf", dest: "Topline_FSS_CSSD11_2a.pdf" },
  { src: "Final Deliverables/PollReport_FSS_CSSD11_3b.pdf", dest: "PollReport_FSS_CSSD11_3b.pdf" },
  { src: "Final Deliverables/SD11_Full_Crosstab_Report.pdf", dest: "SD11_Full_Crosstab_Report.pdf" },
  { src: "Final Deliverables/SD11_Q3_Initial_Ballot_Crosstab.pdf", dest: "SD11_Q3_Initial_Ballot_Crosstab.pdf" },
];

const VOTER_FILES = [
  {
    file: "voters.csv",
    source: "TargetSmart voter universe",
    ingest: true,
    link: false,
  },
  {
    file: "all_voters_master.csv",
    source: "D11 survey universe · Wave 1 master (TargetSmart)",
    link: true,
    supplement: true,
  },
  {
    file: "poll_responses_individual_voter_2026-04-17_04_35.csv",
    source: "D11 poll dispositions · Wave 1 respondents",
    link: true,
    supplement: true,
  },
];

function copyAssets() {
  const assetDir = path.join(root, "public", "client-assets", CLIENT_ID);
  fs.mkdirSync(assetDir, { recursive: true });

  for (const { src, dest } of PDF_SOURCES) {
    const from = path.join(DRIVE_ROOT, src);
    const to = path.join(assetDir, dest);
    if (!fs.existsSync(from)) {
      console.warn(`  Skipping missing PDF: ${from}`);
      continue;
    }
    fs.copyFileSync(from, to);
    console.log(`  Copied ${dest}`);
  }
}

function runVoterIngest({ file, source, link }) {
  const filePath = path.join(DRIVE_ROOT, file);
  let target = filePath;
  let useLink = link;
  if (!fs.existsSync(filePath)) {
    const localPath = path.join(root, "data", "voter", CLIENT_ID, file);
    if (!fs.existsSync(localPath)) {
      console.warn(`  Skipping missing voter file: ${filePath}`);
      return;
    }
    target = localPath;
    useLink = false;
  }
  // Pass args as an argv array (no shell) to avoid command injection via
  // crafted paths / source labels / env vars.
  const args = ["scripts/voter-ingest.js", "--client", CLIENT_ID, "--file", target, "--source", source];
  if (useLink) args.push("--link");
  execFileSync("node", args, { cwd: root, stdio: "inherit" });
}

function runVoterRegister({ file, source, link, supplement }) {
  const filePath = path.join(DRIVE_ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`  Skipping missing voter file: ${filePath}`);
    return;
  }
  const args = ["scripts/voter-register.js", "--client", CLIENT_ID, "--file", filePath, "--source", source];
  if (link) args.push("--link");
  if (supplement) args.push("--supplement");
  execFileSync("node", args, { cwd: root, stdio: "inherit" });
}

function main() {
  console.log("CSSD11 bootstrap\n");

  console.log("1. Copying PDF assets…");
  copyAssets();

  console.log("\n2. Ingesting polling portal…");
  const portalDir = path.join(root, "portal", "polling", "clients", CLIENT_ID);
  const db = openDb();
  try {
    const result = ingestPollingPortal(db, {
      portalDir,
      publicRoot: path.join(root, "public"),
      extraResources: [
        {
          title: "CSSD11 Bond Feasibility Presentation",
          category: "Polling",
          kind: "pptx",
          url: "/client-assets/d11-colorado-springs/CSSD11_Bond_Feasibility_Presentation.pptx",
          tags: ["polling", "presentation"],
        },
      ],
      who: "bootstrap-cssd11",
    });
    console.log(`  ${result.pollCount} polls → ${result.clientId}`);
    console.log(`  Manifest → ${result.manifestPath}`);
  } finally {
    db.close();
  }

  // Optional presentation copy
  const pptSrc = path.join(DRIVE_ROOT, "Final Deliverables/CSSD11_Bond_Feasibility_Presentation.pptx");
  const pptDest = path.join(root, "public", "client-assets", CLIENT_ID, "CSSD11_Bond_Feasibility_Presentation.pptx");
  if (fs.existsSync(pptSrc)) {
    fs.copyFileSync(pptSrc, pptDest);
    console.log("  Copied feasibility presentation");
  }

  console.log("\n3. Ingesting voter files…");
  for (const vf of VOTER_FILES) {
    if (vf.ingest) runVoterIngest(vf);
    else runVoterRegister(vf);
  }

  console.log("\nDone. Select client “School District 11 · Colorado Springs” in Keel to view polling.");
}

main();
