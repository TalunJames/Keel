import React, { useState } from "react";
import { Icon, Tag } from "../components/ui.jsx";
import { Loading } from "../components/Loading.jsx";
import { ClientWizard } from "./new-client-wizard.jsx";

export function AdminClientsTab({ clients, loading, onReload, onFlash }) {
  const [editingId, setEditingId] = useState(null);
  const editingClient = editingId ? clients.find((c) => c.id === editingId) : null;

  if (editingClient) {
    return (
      <ClientWizard
        client={editingClient}
        onCancel={() => setEditingId(null)}
        onSaved={() => {
          setEditingId(null);
          onReload();
          onFlash("Client updated");
        }}
      />
    );
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="mut" style={{ fontSize: 13, margin: 0, maxWidth: 580, lineHeight: 1.55 }}>
            Clients are added through the New Client wizard. Click a row to edit service line, identity, team, tabs, and portal contacts.
          </p>
        </div>
      </div>

      <div className="card">
        {loading ? <Loading /> : clients.length === 0 ? (
          <div className="card-pad mut" style={{ fontSize: 13 }}>
            No clients yet. Use <strong style={{ color: "var(--fs-navy)" }}>New → Client</strong> in the top bar to add one.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Lead strategist</th>
                <th>Modules</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const staffOn = Object.values(c.staffModules || {}).filter(Boolean).length;
                const clientOn = Object.values(c.clientModules || {}).filter(Boolean).length;
                const status = c.active === false ? "Archived" : "Active";
                return (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditingId(c.id)}
                  >
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        {c.logo ? (
                          <img src={c.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover" }} />
                        ) : (
                          <span style={{
                            width: 30, height: 30, borderRadius: "50%", background: c.color,
                            color: "var(--ks-on-ink)", display: "grid", placeItems: "center",
                            fontSize: 11, fontWeight: 700,
                          }}>{c.initials}</span>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{c.name}</div>
                          <div className="mut" style={{ fontSize: 11 }}>{c.tag}</div>
                        </div>
                      </div>
                    </td>
                    <td><Tag tone="outline">{c.type || "—"}</Tag></td>
                    <td className="mut">{c.team?.lead || "—"}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--fs-navy)", fontWeight: 600 }}>{staffOn}</span>{" "}
                        <span className="mut">staff</span>
                        {" · "}
                        <span style={{ color: "var(--fs-gold-700)", fontWeight: 600 }}>{clientOn}</span>{" "}
                        <span className="mut">client</span>
                      </div>
                    </td>
                    <td>
                      <Tag tone={status === "Active" ? "success" : "outline"}>{status}</Tag>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Icon name="chevron-right" size={14} color="var(--fs-fg-subtle)" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
