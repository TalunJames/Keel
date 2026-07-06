import React, { useMemo, useState } from "react";
import { PageHead, Tag, Icon } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Loading } from "../../components/Loading.jsx";
import { TRIAGE_COLUMNS, triageTone, triageLabel } from "../../lib/proposal-status.js";

export function ProposalsTriage({ clientId, onOpen, onNew }) {
  const { data, loading, reload } = useApi(
    `/proposals?clientId=${encodeURIComponent(clientId || "all")}`,
    [clientId],
  );

  const items = data?.items || [];
  const [actionError, setActionError] = useState(null);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(TRIAGE_COLUMNS.map((c) => [c.key, []]));
    for (const p of items) {
      const key = map[p.triageState] ? p.triageState : "inbox";
      map[key].push(p);
    }
    return map;
  }, [items]);

  const handleDrop = async (proposalId, triageState) => {
    setActionError(null);
    try {
      await proposalsApi.update(proposalId, { triageState });
      reload();
    } catch (e) {
      setActionError(e?.message || "Could not move this proposal.");
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHead
        title="Proposal triage"
        sub="Opportunities from Cleatus land in Inbox. Drag to Building when you're ready to draft — RFP details and staff notes come along."
        actions={
          <button type="button" className="btn primary" onClick={onNew}>
            <Icon name="plus" size={14} /> New proposal
          </button>
        }
      />

      {actionError && (
        <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-danger)", borderColor: "var(--fs-danger)" }}>
          {actionError}
        </div>
      )}

      <div style={{ paddingBottom: 40, overflowX: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TRIAGE_COLUMNS.length}, minmax(220px, 1fr))`,
          gap: 14,
          minWidth: 1320,
        }}>
          {TRIAGE_COLUMNS.map((col) => {
            const cards = byColumn[col.key] || [];
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("proposalId");
                  if (id) handleDrop(Number(id), col.key);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div className="row between" style={{ padding: "0 4px" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fs-navy)" }}>
                    {col.label}
                  </span>
                  <span className="mut" style={{ fontSize: 12 }}>{cards.length}</span>
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "var(--fs-bone-100)",
                  borderRadius: 4,
                  padding: 10,
                  minHeight: 180,
                }}>
                  {cards.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("proposalId", String(p.id))}
                      onClick={() => onOpen(p)}
                      style={{
                        background: "var(--fs-paper)",
                        border: "1px solid var(--fs-border)",
                        borderRadius: 4,
                        padding: "12px 14px",
                        borderLeft: "3px solid var(--fs-navy)",
                        cursor: "grab",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fs-navy)", lineHeight: 1.3 }}>{p.title}</div>
                      <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>{p.clientName}</div>
                      <div className="row between" style={{ marginTop: 10 }}>
                        <Tag tone={triageTone(p.triageState)}>{triageLabel(p.triageState)}</Tag>
                        {p.source === "cleatus" && (
                          <span className="mut" style={{ fontSize: 11 }}>Cleatus</span>
                        )}
                      </div>
                      {p.cleatus?.rfpDueDate && (
                        <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>
                          RFP due {p.cleatus.rfpDueDate}
                        </div>
                      )}
                    </div>
                  ))}
                  {!cards.length && (
                    <div className="mut" style={{ fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                      {col.key === "building" ? "Drop here to start building" : "Empty"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
