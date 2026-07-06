import { createDesignProjectFolder, isDriveConfigured } from "./google-drive.js";

export function isZapierConfigured() {
  return !!process.env.ZAPIER_DESIGN_WEBHOOK_URL?.trim();
}

async function sendZapierEvent(event, payload) {
  const url = process.env.ZAPIER_DESIGN_WEBHOOK_URL?.trim();
  if (!url) return { status: "skipped" };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...payload }),
  });
  if (!res.ok) {
    throw new Error(`Zapier webhook returned ${res.status}`);
  }
  return { status: "sent" };
}

/**
 * Run external integrations for a newly submitted design request.
 * Queue creation always proceeds regardless of integration outcomes.
 */
export async function provisionDesignIntegrations({
  requestId,
  clientId,
  clientName,
  clientDriveFolderUrl,
  title,
  assetType,
  audience,
  cta,
  spec,
  priority,
  due,
  budgetCode,
}) {
  const integrations = {
    drive: { status: isDriveConfigured() ? "pending" : "skipped" },
    zapier: { status: isZapierConfigured() ? "pending" : "skipped" },
  };

  let driveFolderUrl = null;
  let driveFolderId = null;
  let briefDocUrl = null;

  if (isDriveConfigured()) {
    try {
      const drive = await createDesignProjectFolder({
        clientDriveFolderUrl,
        requestId,
        title,
        clientName,
        assetType,
        audience,
        cta,
        spec,
        priority,
        due,
        budgetCode,
      });
      if (drive?.folderUrl) {
        driveFolderUrl = drive.folderUrl;
        driveFolderId = drive.folderId || null;
        briefDocUrl = drive.briefDocUrl || null;
        integrations.drive = { status: "ready" };
      }
    } catch (e) {
      console.error(`[drive] DR-${requestId}:`, e?.message || e);
      integrations.drive = { status: "error", error: e?.message || "Drive provisioning failed" };
    }
  }

  if (isZapierConfigured()) {
    try {
      await sendZapierEvent("design.submitted", {
        requestId,
        clientId,
        clientName,
        title,
        assetType,
        priority,
        due,
        driveFolderUrl,
      });
      integrations.zapier = { status: "sent" };
    } catch (e) {
      console.error(`[zapier] DR-${requestId}:`, e?.message || e);
      integrations.zapier = { status: "error", error: e?.message || "Zapier webhook failed" };
    }
  }

  return { integrations, driveFolderUrl, driveFolderId, briefDocUrl };
}

/** Fire-and-forget integration side effects for lifecycle events. */
export function queueDesignIntegrationEvent(event, payload) {
  if (!isZapierConfigured()) return;
  sendZapierEvent(event, payload).catch((e) => {
    console.error(`[zapier] ${event}:`, e?.message || e);
  });
}
