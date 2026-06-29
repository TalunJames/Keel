import React, { useState, useEffect, useCallback } from "react";
import { PageHead, Icon, Stat, Tag } from "../components/ui.jsx";
import { api, withClient, downloadExport } from "../lib/api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { Loading } from "../components/Loading.jsx";
import { VoterMap } from "./VoterMap.jsx";
import { VoterFilters, DEFAULT_VOTER_FILTERS, filtersSummary } from "./voter-filters.jsx";

const PAGE_SIZE = 50;

export function VoterView({ role, clientId, client }) {
  const [tab, setTab] = useState("file");
  const [filters, setFilters] = useState({ ...DEFAULT_VOTER_FILTERS });
  const [query, setQuery] = useState("");
  const [mapBbox, setMapBbox] = useState(null);
  const [cuts, setCuts] = useState([]);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportCount, setExportCount] = useState(null);
  const [mapExportCount, setMapExportCount] = useState(null);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  };

  const loadMeta = useCallback(() => {
    if (!clientId || clientId === "all") {
      setFile(null);
      setMeta(null);
      setCuts([]);
      return;
    }
    Promise.all([
      api(withClient("/voter/file", clientId)),
      api(withClient("/voter/meta", clientId)),
      api(withClient("/voter/cuts", clientId)),
    ])
      .then(([fileRes, metaRes, cutsRes]) => {
        setFile(fileRes.file);
        setMeta(metaRes.meta);
        setCuts(cutsRes.cuts || []);
      })
      .catch((e) => {
        setFile(null);
        setMeta(null);
        flash(e.message || "Could not load voter file");
      });
  }, [clientId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const applyCut = (c) => {
    setFilters({ ...DEFAULT_VOTER_FILTERS, ...c.filters });
    setQuery(c.query || "");
    flash('Loaded cut "' + c.name + '"');
  };

  const openExport = async () => {
    setModal("export");
    setExportCount(null);
    setMapExportCount(null);
    try {
      const [{ total }, mapResult] = await Promise.all([
        api("/voter/export/count", {
          method: "POST",
          body: JSON.stringify({ clientId, filters, query, scope: "filters" }),
        }),
        tab === "map" && mapBbox
          ? api("/voter/export/count", {
            method: "POST",
            body: JSON.stringify({ clientId, filters, query, bbox: mapBbox, scope: "map" }),
          })
          : Promise.resolve({ total: null }),
      ]);
      setExportCount(total);
      setMapExportCount(mapResult.total);
    } catch {
      setExportCount(0);
    }
  };

  const runExport = async (scope) => {
    setExporting(true);
    try {
      const slug = (client?.tag || clientId || "universe").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const label = scope === "map" ? "map-view" : "filtered";
      const { count } = await downloadExport(
        "/voter/export",
        { clientId, filters, query, bbox: mapBbox, scope, name: `${slug}-${label}` },
        `${slug}-${label}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      setModal(null);
      flash(`Exported ${(count || exportCount || 0).toLocaleString()} voters to CSV.`);
    } catch (e) {
      flash(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const saveCut = async (name) => {
    let count = 0;
    try {
      const r = await api("/voter/export/count", {
        method: "POST",
        body: JSON.stringify({ clientId, filters, query, scope: "filters" }),
      });
      count = r.total || 0;
    } catch { /* ignore */ }
    await api("/voter/cuts", {
      method: "POST",
      body: JSON.stringify({ name, filters, query, clientId, count }),
    });
    loadMeta();
    setModal(null);
    flash('Saved cut "' + name + '"');
  };

  const needsClient = !clientId || clientId === "all";
  const hasVoterFile = !!file || meta?.loaded;
  const warehouseReady = meta?.loaded !== false && (!!meta?.loaded || !!file?.warehouse);
  const sharedFilterProps = {
    filters,
    setFilters,
    query,
    setQuery,
    meta,
    cuts,
    onApplyCut: applyCut,
  };

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
          ? `Active file: ${file.source} · ${file.record_count?.toLocaleString()} records · refreshed ${file.refreshed_at?.slice?.(0, 10) || file.refreshed_at || "—"}`
          : meta?.loaded
            ? `Warehouse loaded · ${meta.recordCount?.toLocaleString()} records`
            : "Select a client with an ingested voter file to query records."}
        actions={
          <>
            <button type="button" className="btn secondary" disabled={needsClient} onClick={() => setModal("saved")}>
              <Icon name="filter" size={13} /> Saved cuts
            </button>
            <button type="button" className="btn secondary" disabled={needsClient || !hasVoterFile} onClick={openExport}>
              <Icon name="download" size={13} /> Export CSV
            </button>
            <button type="button" className="btn primary" disabled={needsClient || !hasVoterFile} onClick={() => setModal("cut")}>
              <Icon name="plus" size={14} /> Cut universe
            </button>
          </>
        }
      />

      {!needsClient && hasVoterFile && (
        <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-fg-muted)" }}>
          <span style={{ color: "var(--fs-navy)", fontWeight: 600 }}>Active filters</span>
          {" · "}{filtersSummary(filters)}
          {query ? ` · search "${query}"` : ""}
          {tab === "map" && mapBbox ? " · map view scoped" : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 20 }}>
        {[
          { id: "file", label: "Voter File", icon: "users" },
          { id: "map", label: "Map", icon: "map" },
          { id: "crosstabs", label: "Polling Crosstabs", icon: "trend-up" },
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
      {!needsClient && !hasVoterFile && (tab === "file" || tab === "map") && (
        <EmptyState
          title="No voter file on record"
          description="Ingest a TargetSmart CSV with npm run voter:ingest -- --client <id> --file <csv>, then npm run voter:geocode -- --client <id>."
          icon="users"
        />
      )}
      {!needsClient && hasVoterFile && !warehouseReady && (tab === "file" || tab === "map") && (
        <EmptyState
          title="Voter file registered, not ingested"
          description="The file is on record but rows aren't loaded yet. Run npm run voter:ingest for this client, then voter:geocode for the map."
          icon="users"
        />
      )}
      {!needsClient && warehouseReady && tab === "file" && (
        <VoterFileQuery clientId={clientId} file={file} {...sharedFilterProps} />
      )}
      {!needsClient && warehouseReady && tab === "map" && (
        <VoterMap clientId={clientId} meta={meta} {...sharedFilterProps} onBboxChange={setMapBbox} />
      )}
      {tab === "crosstabs" && <EmptyState title="Polling crosstabs" description="Link poll crosstabs from the Polling module when field data is published." icon="trend-up" />}

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
                  onClick={() => { applyCut(c); setModal(null); }}>
                  {c.name} <span className="num mut">{(c.count || 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </VoterModal>
      )}
      {modal === "export" && (
        <VoterModal title="Export universe" onClose={() => setModal(null)}>
          <p className="mut" style={{ fontSize: 13, marginTop: 0 }}>
            {filtersSummary(filters)}
            {query ? ` · "${query}"` : ""}
          </p>
          {exportCount == null ? (
            <p className="mut" style={{ fontSize: 13 }}>Counting matching records…</p>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "var(--fs-navy)", margin: "12px 0" }}>
                <strong>{exportCount.toLocaleString()}</strong> voters match the full filter set.
                {mapExportCount != null && (
                  <span className="mut" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                    {mapExportCount.toLocaleString()} in the current map view.
                  </span>
                )}
              </p>
              <div className="col" style={{ gap: 8 }}>
                <button type="button" className="btn primary" disabled={exporting || exportCount === 0}
                  onClick={() => runExport("filters")}>
                  Export full filtered universe (CSV)
                </button>
                {tab === "map" && mapBbox && (
                  <button type="button" className="btn secondary" disabled={exporting || mapExportCount === 0}
                    onClick={() => runExport("map")}>
                    Export current map view ({mapExportCount?.toLocaleString() || 0} voters)
                  </button>
                )}
              </div>
            </>
          )}
        </VoterModal>
      )}
    </div>
  );
}

function VoterFileQuery({ clientId, file, filters, setFilters, query, setQuery, meta, cuts, onApplyCut }) {
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
      .catch(() => setResult({ total: 0, rows: [], message: "Could not load voters. Check that the warehouse is ingested for this client." }))
      .finally(() => setLoading(false));
  }, [clientId, filters, query, page]);

  const total = result?.total ?? 0;
  const recordCount = result?.recordCount ?? file?.record_count ?? meta?.recordCount ?? 0;
  const rows = result?.rows || [];
  const totalPages = Math.max(1, Math.ceil((total || recordCount) / PAGE_SIZE));
  const message = result?.message;
  const avgScore = result?.stats?.avgScore ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
      <aside className="card">
        <div className="card-head"><h3>Filters</h3></div>
        <VoterFilters
          filters={filters}
          setFilters={setFilters}
          query={query}
          setQuery={setQuery}
          meta={meta}
          cuts={cuts}
          onApplyCut={onApplyCut}
        />
      </aside>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          <div className="card card-pad"><Stat figure={recordCount.toLocaleString()} label="File records" /></div>
          <div className="card card-pad"><Stat figure={total.toLocaleString()} label="Matching universe" /></div>
          <div className="card card-pad"><Stat figure={avgScore ? String(avgScore) : "—"} label="Avg turnout score" /></div>
          <div className="card card-pad"><Stat figure={String(page) + " / " + totalPages} label="Page" /></div>
        </div>
        {message && (
          <div className="card card-pad" style={{ marginBottom: 12, fontSize: 13, color: "var(--fs-fg-muted)" }}>{message}</div>
        )}
        {loading ? <Loading /> : rows.length === 0 && !message ? (
          <EmptyState title="No matching voters" description="Try widening your filters or clearing the search box." icon="users" />
        ) : rows.length === 0 ? (
          <EmptyState title="No rows loaded" description="Run voter:ingest to load the warehouse for this client." icon="users" />
        ) : (
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Voter</th><th>Party</th><th>County</th><th>Score</th><th>Address</th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong><div className="mut" style={{ fontSize: 11 }}>{v.id}</div></td>
                    <td><Tag>{v.party}</Tag></td>
                    <td>{v.county}</td>
                    <td className="num">{v.score}</td>
                    <td className="mut" style={{ fontSize: 12 }}>{v.address || "—"}</td>
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
      <p className="mut" style={{ fontSize: 12 }}>{filtersSummary(filters)}</p>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
      </div>
    </>
  );
}
