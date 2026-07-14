import React, { useMemo } from "react";

/**
 * Full-screen embed of the Fog Signal proposal builder (vendored under /proposals/app).
 * Auth, team, clients, and workspace settings are wired through keel-bridge.js + proposals-app-routes.
 */
export function ProposalsView({ clientId }) {
  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId && clientId !== "all") params.set("clientId", clientId);
    const q = params.toString();
    return `/proposals/app/${q ? `?${q}` : ""}`;
  }, [clientId]);

  return (
    <div className="proposals-embed-wrap">
      <iframe
        title="Proposal builder"
        src={src}
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#f7f6f2",
        }}
      />
    </div>
  );
}
