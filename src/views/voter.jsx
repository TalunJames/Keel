import React, { useState, useEffect, useCallback } from "react";
import { PageHead, Icon, Stat, Tag, Eyebrow } from "../components/ui.jsx";
import { api, withClient } from "../lib/api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { Loading } from "../components/Loading.jsx";

const DEFAULT_FILTERS = { party: "All", county: "All", scoreMin: 0, turnoutOnly: false };
const PAGE_SIZE = 50;
const COUNTIES = [
  "Franklin", "Cuyahoga", "Hamilton", "Montgomery", "Summit", "Lucas",
  "Butler", "Stark", "Lorain", "Mahoning", "Lake", "Warren", "Clermont",
];

export function VoterView({ role, clientId, client }) {
  const [tab, setTab] = useState("file");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [query, setQuery] = useState("");
  const [cuts, setCuts] = useState([]);
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [exportJob, setExportJob] = useState(null);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  };

  const loadMeta = useCallback(() => {
    if (!clientId || clientId === "all") {
      setFile(null);
      setCuts([]);
      return;
    }
    api(withClient("/voter/file", clientId)).then((r) => setFile(r.file));
    api(withClient("/voter/cuts", clientId)).then((r) => setCuts(r.cuts || []));
  }, [clientId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const runExport = async () => {
    setModal("export");
    setExportJob({ status: "queued" });
    try {
      const job = await api("/voter/export", {
        method: "POST",
        body: JSON.stringify({
          name: "Current universe",
          filters,
          query,
          clientId,
          count: 0,
        }),
      });
      setExportJob(job);
      const blob = new Blob([JSON.stringify(job.manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "keel-universe-export.json";
      a.click();
      URL.revokeObjectURL(url);
      flash("Export job queued. Manifest downloaded.");
    } catch (e) {
      setExportJob({ status: "error", error: e.message });
    }
  };

  const saveCut = async (name) => {
    await api("/voter/cuts", {
      method: "POST",
      body: JSON.stringify({ name, filters, query, clientId, count: 0 }),
    });
    loadMeta();
    setModal(null);
    flash('Saved cut "' + name + '"');
  };

  const needsClient = !clientId || clientId === "all";

  return (
    <div>
      {notice && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 200,
          padding: "12px 18px", background: "var(--fs-navy)", color: "var(--fs-paper)",
          borderRadius: 4, fontSize: 13, maxWidth: 360,
        }}>{notice}</div>
      )}

      <PageHead
        eyebrow="Voter & Polling Data"
        title="Voter File Explorer"
        sub={file
          ? `Active file: ${file.source} · ${file.record_count?.toLocaleString()} records · refreshed ${file.refreshed_at}`
          : "Select a client with an ingested voter file to query records."}
        actions={
          <>
            <button type="button" className="btn secondary" disabled={needsClient} onClick={() => setModal("saved")}>
              <Icon name="filter" size={13} /> Saved cuts
            </button>
            <button type="button" className="btn secondary" disabled={needsClient || !file} onClick={runExport}>
              <Icon name="download" size={13} /> Export universe
            </button>
            <button type="button" className="btn primary" disabled={needsClient || !file} onClick={() => setModal("cut")}>
              <Icon name="plus" size={14} /> Cut universe
            </button>
          </>
        }
      />

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 20 }}>
        {[
          { id: "file", label: "Voter File", icon: "users" },
          { id: "crosstabs", label: "Polling Crosstabs", icon: "trend-up" },
          { id: "map", label: "Precinct Map", icon: "map" },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
            color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: -1,
          }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {needsClient && (
        <EmptyState title="Select a client" description="Choose a specific client (not All Clients) to load their voter file." icon="users" />
      )}
      {!needsClient && !file && tab === "file" && (
        <EmptyState
          title="No voter file on record"
          description="Register an ingested TargetSmart (or vendor) file in Admin Console → Voter files before querying."
          icon="users"
        />
      )}
      {!needsClient && file && tab === "file" && (
        <VoterFileQuery clientId={clientId} file={file} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} cuts={cuts} onApplyCut={(c) => { setFilters({ ...DEFAULT_FILTERS, ...c.filters }); setQuery(c.query || ""); flash('Loaded "' + c.name + '"'); }} onFlash={flash} />
      )}
      {tab === "crosstabs" && <EmptyState title="Polling crosstabs" description="Link poll crosstabs from the Polling module when field data is published." icon="trend-up" />}
      {tab === "map" && <EmptyState title="Precinct map" description="Map layers render from ingested precinct geometries after the voter warehouse is connected." icon="map" />}

      {modal === "cut" && (
        <VoterModal title="Cut universe" onClose={() => setModal(null)}>
          <CutForm onSave={saveCut} onCancel={() => setModal(null)} filters={filters} />
        </VoterModal>
      )}
      {modal === "saved" && (
        <VoterModal title="Saved cuts" onClose={() => setModal(null)}>
          {cuts.length === 0 ? <p className="mut" style={{ fontSize: 13 }}>No saved cuts yet.</p> : (
            <div className="col" style={{ gap: 8 }}>
              {cuts.map((c) => (
                <button key={c.id} type="button" className="btn secondary" style={{ justifyContent: "space-between" }}
                  onClick={() => { setFilters({ ...DEFAULT_FILTERS, ...c.filters }); setQuery(c.query || ""); setModal(null); }}>
                  {c.name} <span className="num mut">{(c.count || 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </VoterModal>
      )}
      {modal === "export" && (
        <VoterModal title="Export universe" onClose={() => setModal(null)}>
          <p className="mut" style={{ fontSize: 13 }}>Job status: {exportJob?.status || "…"}</p>
          {exportJob?.manifest && <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 200 }}>{JSON.stringify(exportJob.manifest, null, 2)}</pre>}
        </VoterModal>
      )}
    </div>
  );
}

function VoterFileQuery({ clientId, file, filters, setFilters, query, setQuery, cuts, onApplyCut, onFlash }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPage(1); }, [filters, query, clientId]);

  useEffect(() => {
    setLoading(true);
    api("/voter/query", {
      method: "POST",
      body: JSON.stringify({ clientId, filters, query, page, pageSize: PAGE_SIZE }),
    })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [clientId, filters, query, page]);

  const total = result?.total ?? 0;
  const recordCount = result?.recordCount ?? file.record_count;
  const rows = result?.rows || [];
  const totalPages = Math.max(1, Math.ceil((total || recordCount) / PAGE_SIZE));
  const message = result?.message;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
      <aside className="card">
        <div className="card-head"><h3>Filters</h3></div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="lbl">Search</div>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or VAN ID" />
          </div>
          <div className="lbl">Party</div>
          <div className="row" style={{ gap: 4 }}>
            {["All", "D", "R", "I"].map((p) => (
              <button key={p} type="button" className={"btn " + (filters.party === p ? "primary" : "secondary")} style={{ flex: 1, fontSize: 12 }}
                onClick={() => setFilters((f) => ({ ...f, party: p }))}>{p}</button>
            ))}
          </div>
          <div>
            <div className="lbl">County</div>
            <select className="input" value={filters.county} onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))}>
              <option>All</option>
              {COUNTIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="lbl">Score min · {filters.scoreMin}</div>
            <input type="range" min={0} max={100} step={5} value={filters.scoreMin}
              onChange={(e) => setFilters((f) => ({ ...f, scoreMin: +e.target.value }))} style={{ width: "100%" }} />
          </div>
          {cuts.length > 0 && (
            <>
              <div className="divider" style={{ margin: 0 }} />
              <div className="lbl">Saved cuts</div>
              {cuts.slice(0, 5).map((s) => (
                <button key={s.id} type="button" className="btn ghost sm" onClick={() => onApplyCut(s)}>{s.name}</button>
              ))}
            </>
          )}
        </div>
      </aside>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
          <div className="card card-pad"><Stat figure={recordCount.toLocaleString()} label="File records" /></div>
          <div className="card card-pad"><Stat figure={total.toLocaleString()} label="Matching universe" /></div>
          <div className="card card-pad"><Stat figure={String(page) + " / " + totalPages} label="Page" /></div>
        </div>
        {message && (
          <div className="card card-pad" style={{ marginBottom: 12, fontSize: 13, color: "var(--fs-fg-muted)" }}>{message}</div>
        )}
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="No rows in this page" description="Complete warehouse ingest to query individual records. Universe counts use the registered file metadata until then." icon="users" />
        ) : (
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Voter</th><th>Party</th><th>County</th><th>Score</th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong><div className="mut" style={{ fontSize: 11 }}>{v.id}</div></td>
                    <td><Tag>{v.party}</Tag></td>
                    <td>{v.county}</td>
                    <td className="num">{v.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button type="button" className="btn ghost sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function VoterModal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(26,58,92,0.45)", display: "grid", placeItems: "center", padding: 24 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: "100%", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>{title}</h3>
          <button type="button" className="btn ghost sm" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CutForm({ onSave, onCancel, filters }) {
  const [name, setName] = useState("");
  return (
    <>
      <input className="input" placeholder="Cut name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
      <p className="mut" style={{ fontSize: 12 }}>Saves filter predicate for server-side export — party {filters.party}, county {filters.county}, score ≥ {filters.scoreMin}</p>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
      </div>
    </>
  );
}
