/** Standard sub-folders for a new design project (created when Drive is wired). */
export const DESIGN_PROJECT_SUBFOLDERS = [
  "01 Brief",
  "02 Working Files",
  "03 Proofs",
  "04 Client Feedback",
  "05 Final",
];

export function isDriveConfigured() {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
  );
}

/**
 * Provision a Google Drive project folder and brief doc.
 * Returns null until credentials and API wiring are configured.
 */
export async function createDesignProjectFolder(_params) {
  if (!isDriveConfigured()) return null;
  // Wire up googleapis here when Drive is ready.
  console.warn("[drive] GOOGLE_SERVICE_ACCOUNT_* is set but Drive provisioning is not implemented yet");
  return null;
}
