import React from "react";
import { PageHead } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

export function ElectionView({ clientId, onNavigate }) {
  const { data, loading } = useApi(withClient("/election/races", clientId), [clientId]);
  const races = data?.races || [];

  return (
    <div>
      <PageHead
        eyebrow="Election Night"
        title="War room"
        sub="Live results when races are configured — AP Elections and state feeds."
      />
      {loading && <Loading />}
      {!loading && races.length === 0 && (
        <EmptyState
          title="No active races"
          description="Add election races in Admin Console or connect AP Elections to go live on election night."
          icon="tv"
          actionLabel="Open Admin"
          onAction={() => onNavigate("admin")}
        />
      )}
      {!loading && races.length > 0 && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr><th>Race</th><th>State</th><th>Status</th></tr>
            </thead>
            <tbody>
              {races.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.name}</td>
                  <td className="mut">{r.state || "—"}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
