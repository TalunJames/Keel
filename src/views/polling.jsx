import React from "react";
import { PageHead } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

export function PollingView({ role, clientId }) {
  const { data, loading, error } = useApi(withClient("/polling/polls", clientId), [clientId]);
  const polls = data?.polls || [];

  return (
    <div>
      <PageHead eyebrow="Research" title="Polling" sub="Released toplines and crosstabs by client." />
      {loading && <Loading />}
      {error && <div className="card card-pad" style={{ color: "#7a2210" }}>{error.message}</div>}
      {!loading && !error && polls.length === 0 && (
        <EmptyState title="No polls" description="Field polls appear here after your team publishes them for this client." icon="trend-up" />
      )}
      {!loading && polls.length > 0 && (
        <div className="col" style={{ gap: 12 }}>
          {polls.map((p) => (
            <div key={p.id} className="card card-pad">
              <h3 style={{ margin: "0 0 6px", color: "var(--fs-navy)", fontFamily: "var(--fs-font-display)" }}>{p.title}</h3>
              <p className="mut" style={{ margin: 0, fontSize: 13 }}>
                n={p.n ?? "—"} · {p.moe || "—"} · {p.date || "—"}
                {!p.unlocked && role === "client" && " · Locked"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
