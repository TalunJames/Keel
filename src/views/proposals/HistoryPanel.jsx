import React, { useState } from "react";
import { Eyebrow, Icon } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function HistoryPanel({ proposalId, revisions, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");

  const snapshot = async () => {
    setBusy(true);
    try {
      await proposalsApi.revisions.snapshot(proposalId, label.trim() || "Manual snapshot");
      setLabel("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (rev) => {
    if (!window.confirm(`Restore the version from ${formatWhen(rev.createdAt)}? Your current state is saved to history first.`)) return;
    setBusy(true);
    try {
      await proposalsApi.revisions.restore(proposalId, rev.id);
      onChanged({ restored: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Eyebrow>Version history</Eyebrow>
      <div className="row" style={{ gap: 6, marginTop: 12 }}>
        <input
          className="input"
          style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          placeholder="Name this version (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && snapshot()}
        />
        <button type="button" className="btn secondary sm" disabled={busy} onClick={snapshot}>
          <Icon name="pin" size={11} /> Save
        </button>
      </div>
      <p className="mut" style={{ fontSize: 11, marginTop: 6 }}>
        Versions are also saved automatically while you edit.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: "52vh", overflowY: "auto" }}>
        {revisions.map((r) => (
          <div key={r.id} className="revision-card">
            <div className="row between">
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fs-navy)" }}>
                  {r.label || "Autosave"}
                </div>
                <div className="mut" style={{ fontSize: 11 }}>
                  {formatWhen(r.createdAt)}{r.authorName ? ` · ${r.authorName}` : ""} · {r.blockCount} blocks
                </div>
              </div>
              <button type="button" className="btn ghost sm" disabled={busy} title="Restore this version" onClick={() => restore(r)}>
                <Icon name="rotate-ccw" size={12} /> Restore
              </button>
            </div>
          </div>
        ))}
        {!revisions.length && <p className="mut" style={{ fontSize: 12 }}>No versions yet — they appear as you edit.</p>}
      </div>
    </>
  );
}
