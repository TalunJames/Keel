import React from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { RaceDetailApp } from "../election/RaceDetailApp.jsx";
import { RaceDetailErrorBoundary } from "../election/RaceDetailErrorBoundary.jsx";

export function ElectionView({ role }) {
  if (role === "client") {
    return (
      <div>
        <PageHead
          eyebrow="Election Night"
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
      <RaceDetailApp />
    </RaceDetailErrorBoundary>
  );
}
