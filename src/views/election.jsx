import React, { Suspense, lazy } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { RaceDetailErrorBoundary } from "../election/RaceDetailErrorBoundary.jsx";

const RaceDetailApp = lazy(() =>
  import("../election/RaceDetailApp.jsx").then((m) => ({ default: m.RaceDetailApp }))
);

export function ElectionView({ role }) {
  if (role === "client") {
    return (
      <div>
        <PageHead
          title="Live results aren't released to client view."
          sub="Your strategist will share post-election analysis once results are certified. Reach out if you need an early read."
        />
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Icon name="lock" size={20} color="var(--fs-navy)" />
          <div className="mut" style={{ fontSize: 14 }}>This section is staff-only by default.</div>
        </div>
      </div>
    );
  }

  return (
    <RaceDetailErrorBoundary>
      <Suspense fallback={<div style={{ display: "grid", placeItems: "center", height: "60vh", color: "var(--fs-fg-muted)" }}>Loading election monitor…</div>}>
        <RaceDetailApp />
      </Suspense>
    </RaceDetailErrorBoundary>
  );
}
