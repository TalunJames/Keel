import React, { useMemo, useState } from "react";
import { PageHead, Icon, Eyebrow } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

function toneForPoll(poll) {
  if (poll.tone) return poll.tone;
  if (poll.payload?.tone) return poll.payload.tone;
  const t = poll.payload?.topline;
  if (t) return `${t.support}% support · ${t.oppose}% oppose`;
  return poll.title;
}

function BallotBars({ question, bars }) {
  if (!bars?.length) return null;
  return (
    <div className="card card-pad">
      {question && (
        <h3 style={{ fontFamily: "var(--fs-font-sans)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fs-navy)", margin: "0 0 18px" }}>
          {question}
        </h3>
      )}
      <div className="col" style={{ gap: 16 }}>
        {bars.map((b) => (
          <div key={b.label}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 16, fontWeight: 600, color: "var(--fs-navy)" }}>{b.label}</span>
              <span className="num" style={{ fontFamily: "var(--fs-font-display)", fontSize: 20, fontWeight: 700, color: "var(--fs-navy)" }}>{b.value.toFixed(1)}%</span>
            </div>
            <div style={{ height: 12, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${b.value}%`, height: "100%", background: b.color || "var(--fs-navy)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueTable({ issues, role }) {
  if (!issues?.length) return null;
  const isImportance = issues[0].extremelyImportant != null;
  return (
    <div className="card">
      <div className="card-head">
        <h3>{isImportance ? "Issue importance" : "Issue battery"}</h3>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Issue</th>
            {isImportance ? (
              <>
                <th style={{ textAlign: "right" }}>Ext. important</th>
                <th style={{ textAlign: "right" }}>Top two box</th>
              </>
            ) : (
              <>
                <th style={{ textAlign: "right" }}>Favor</th>
              </>
            )}
            {role !== "client" && <th>Reads</th>}
          </tr>
        </thead>
        <tbody>
          {issues.map((r) => (
            <tr key={r.issue}>
              <td style={{ fontWeight: 500, color: "var(--fs-navy)" }}>{r.issue}</td>
              {isImportance ? (
                <>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, color: "var(--fs-success)" }}>{r.extremelyImportant}%</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{r.topTwoBox}%</td>
                </>
              ) : (
                <td className="num" style={{ textAlign: "right", fontWeight: 700, color: "var(--fs-success)" }}>{r.topTwoBox}%</td>
              )}
              {role !== "client" && <td className="mut">{r.read || "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemographicTable({ demographics }) {
  if (!demographics?.length) return null;
  return (
    <div className="card">
      <div className="card-head"><h3>Demographic crosstabs</h3></div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Group</th>
            <th style={{ textAlign: "right" }}>Support</th>
            <th style={{ textAlign: "right" }}>Oppose</th>
            <th style={{ textAlign: "right" }}>Not sure</th>
          </tr>
        </thead>
        <tbody>
          {demographics.map((d) => (
            <tr key={d.label} style={d.overall ? { fontWeight: 700, background: "var(--fs-bone-50)" } : undefined}>
              <td>{d.label}</td>
              <td className="num" style={{ textAlign: "right", color: "var(--fs-success)" }}>{d.support}%</td>
              <td className="num" style={{ textAlign: "right", color: "var(--fs-danger)" }}>{d.oppose}%</td>
              <td className="num" style={{ textAlign: "right" }}>{d.undecided}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetLinks({ assets }) {
  if (!assets) return null;
  const links = [
    assets.pdf && { label: "Topline PDF", url: assets.pdf },
    assets.crosstabPdf && { label: "Crosstabs PDF", url: assets.crosstabPdf },
    assets.reportPdf && { label: "Full report PDF", url: assets.reportPdf },
    assets.presentation && { label: "Presentation", url: assets.presentation },
  ].filter(Boolean);
  if (!links.length) return null;
  return (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      {links.map((l) => (
        <a key={l.url} className="btn secondary sm" href={l.url} target="_blank" rel="noopener noreferrer">
          <Icon name="download" size={12} /> {l.label}
        </a>
      ))}
    </div>
  );
}

export function PollingView({ role, clientId, client }) {
  const { data, loading, error } = useApi(withClient("/polling/polls", clientId), [clientId]);
  const allPolls = data?.polls || [];
  const polls = useMemo(
    () => (role === "client" ? allPolls.filter((p) => p.unlocked) : allPolls),
    [allPolls, role],
  );
  const [pollId, setPollId] = useState(null);
  const sel = polls.find((p) => p.id === pollId) || polls[0];
  const lockedCount = role === "client" ? 0 : allPolls.filter((p) => !p.unlocked).length;

  if (loading) return <Loading />;
  if (error) return <div className="card card-pad" style={{ color: "#7a2210" }}>{error.message}</div>;

  return (
    <div>
      <PageHead
        eyebrow={role === "client" ? "Released to you" : "Research"}
        title="Polling"
        sub={role === "client"
          ? "Topline and issue numbers your Fog Signal team has released. Crosstabs and message tests are held until your next strategy review."
          : "Released toplines and crosstabs by client. Internal polls stay locked until you release them."}
      />

      {polls.length === 0 ? (
        <EmptyState title="No polls" description="Field polls appear here after your team publishes them for this client." icon="trend-up" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 24, alignItems: "flex-start" }}>
          <aside className="card">
            <div className="card-head"><h3>Polls</h3></div>
            <div style={{ padding: 8 }}>
              {polls.map((p) => {
                const locked = !p.unlocked;
                const active = sel?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={role === "client" && locked}
                    onClick={() => setPollId(p.id)}
                    style={{
                      width: "100%", textAlign: "left", padding: "12px 14px",
                      background: active ? "var(--fs-navy-50)" : "transparent",
                      border: `1px solid ${active ? "var(--fs-navy)" : "transparent"}`,
                      borderRadius: 4, cursor: locked && role === "client" ? "not-allowed" : "pointer",
                      marginBottom: 4, opacity: locked && role === "client" ? 0.55 : 1,
                    }}
                  >
                    <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                      {locked
                        ? <Icon name="lock" size={11} color="var(--fs-fg-muted)" />
                        : <Icon name="circle-check" size={11} color="var(--fs-success)" />}
                      <span style={{ fontSize: 11, color: "var(--fs-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                        {locked ? (role === "client" ? "Not released" : "Internal only") : "Released"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 2 }}>{p.title}</div>
                    <div className="mut" style={{ fontSize: 11 }}>n={p.n ?? "—"} · {p.moe || "—"} · {p.date || "—"}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          {sel && (
            <div className="col" style={{ gap: 18 }}>
              <div className="card card-pad" style={{ background: "var(--fs-bone)" }}>
                <Eyebrow>{sel.date} · n={sel.n ?? "—"} · {sel.moe || "—"}</Eyebrow>
                <h2 style={{ fontFamily: "var(--fs-font-display)", fontStyle: "italic", fontSize: 28, fontWeight: 500, color: "var(--fs-navy)", margin: "14px 0 0", lineHeight: 1.25 }}>
                  {toneForPoll(sel)}
                </h2>
                {sel.payload?.comparison && (
                  <p className="mut" style={{ margin: "10px 0 0", fontSize: 13 }}>
                    {sel.payload.comparison.label}: support {sel.payload.comparison.supportDelta > 0 ? "+" : ""}{sel.payload.comparison.supportDelta} pts
                  </p>
                )}
              </div>

              <BallotBars question={sel.payload?.question} bars={sel.payload?.bars} />
              <IssueTable issues={sel.payload?.issues} role={role} />
              <DemographicTable demographics={sel.payload?.demographics} />
              <AssetLinks assets={sel.payload?.assets} />

              {role === "client" && lockedCount > 0 && (
                <div style={{ display: "flex", gap: 14, padding: "16px 20px", background: "var(--fs-bone-50)", border: "1px dashed var(--fs-border-strong)", borderRadius: 4, alignItems: "flex-start" }}>
                  <Icon name="lock" size={18} color="var(--fs-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 4 }}>Some materials are held for now</div>
                    <div className="mut" style={{ fontSize: 13, lineHeight: 1.5 }}>
                      Message tests, bond-use crosstabs, and tracking waves remain internal until your strategist releases them.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
