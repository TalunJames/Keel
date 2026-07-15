import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { PageHead, Icon, Stat, Tag } from "../components/ui.jsx";
import { api, voterApi, withClient, downloadExport } from "../lib/api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { Loading } from "../components/Loading.jsx";
import { useModalA11y } from "../lib/useModalA11y.js";
import { VoterFilters, DEFAULT_VOTER_FILTERS, filtersSummary, activeFilterCount } from "./voter-filters.jsx";
import { VoterDemographics } from "./VoterDemographics.jsx";
import { VoterDetail } from "./VoterDetail.jsx";
import { PARTY_FILL } from "./voter-charts.jsx";

const VoterMap = lazy(() => import("./VoterMap.jsx").then((m) => ({ default: m.VoterMap })));

const PAGE_SIZE = 50;
const SORTS = [
  { id: "name", label: "Name (A–Z)" },
  { id: "score", label: "Turnout score" },
  { id: "support", label: "Support score" },
  { id: "age", label: "Age" },
  { id: "precinct", label: "Precinct" },
];

const TABS = [
  { id: "file", label: "Voter File", icon: "users" },
  { id: "map", label: "Map", icon: "map" },
  { id: "demographics", label: "Demographics", icon: "chart-bar" },
  { id: "universes", label: "Universes", icon: "filter" },
  { id: "tags", label: "Tags", icon: "flag" },
];

export function VoterView({ role, clientId, client }) {
  const [tab, setTab] = useState("file");
  const [filters, setFilters] = useState({ ...DEFAULT_VOTER_FILTERS });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [mapBbox, setMapBbox] = useState(null);
  const [cuts, setCuts] = useState([]);
  const [tags, setTags] = useState([]);
  const [formats, setFormats] = useState([{ id: "standard", label: "Standard voter export" }]);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const flashTimer = useRef(null);
  const flash = (msg) => {
    setNotice(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setNotice(null), 3200);
  };

  const needsClient = !clientId || clientId === "all";

  const loadMeta = useCallback(() => {
    if (needsClient) { setFile(null); setMeta(null); setCuts([]); setTags([]); return; }
    Promise.all([
      voterApi.file(clientId),
      voterApi.meta(clientId),
      voterApi.cuts(clientId),
      voterApi.tags(clientId).catch(() => ({ tags: [] })),
    ])
      .then(([fileRes, metaRes, cutsRes, tagsRes]) => {
        setFile(fileRes.file);
        setMeta(metaRes.meta);
        setCuts(cutsRes.cuts || []);
        setTags(tagsRes.tags || []);
      })
      .catch((e) => { setFile(null); setMeta(null); flash(e.message || "Could not load voter file"); });
  }, [clientId, needsClient]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { voterApi.formats().then((r) => setFormats(r.formats || [])).catch(() => {}); }, []);

  const reloadTags = useCallback(() => {
    if (needsClient) return;
    voterApi.tags(clientId).then((r) => setTags(r.tags || [])).catch(() => {});
  }, [clientId, needsClient]);

  const applyCut = (c) => {
    setFilters({ ...DEFAULT_VOTER_FILTERS, ...c.filters });
    setQuery(c.query || "");
    setTab("file");
    flash(`Loaded universe "${c.name}"`);
  };

  const resetFilters = () => { setFilters({ ...DEFAULT_VOTER_FILTERS }); setQuery(""); };

  const saveCut = async (name) => {
    let count = 0;
    try {
      const r = await voterApi.count({ clientId, filters, query, scope: "filters" });
      count = r.total || 0;
    } catch { /* best effort */ }
    try {
      await voterApi.saveCut({ name, filters, query, clientId, count });
      loadMeta();
      setModal(null);
      flash(`Saved universe "${name}" (${count.toLocaleString()} voters)`);
    } catch (e) { flash(e?.message || "Could not save universe"); }
  };

  const hasVoterFile = !!file || meta?.loaded;
  const warehouseReady = meta?.loaded !== false && (!!meta?.loaded || !!file?.warehouse);
  const nFilters = activeFilterCount(filters) + (query ? 1 : 0);

  const sidebar = (
    <aside className="card" style={{ alignSelf: "start", position: "sticky", top: 12, maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
      <div className="card-head" style={{ position: "sticky", top: 0, background: "var(--fs-paper)", zIndex: 1 }}>
        <h3>Filters</h3>
        {nFilters > 0 && <button className="btn ghost sm" onClick={resetFilters}>Clear ({nFilters})</button>}
      </div>
      <VoterFilters filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} meta={meta} cuts={cuts} onApplyCut={applyCut} tags={tags} />
    </aside>
  );

  return (
    <div>
      {notice && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 200, padding: "12px 18px", background: "var(--fs-navy)", color: "var(--fs-paper)", borderRadius: 4, fontSize: 13, maxWidth: 360 }}>{notice}</div>
      )}

      <PageHead
        title="Voter File Manager"
        sub={file
          ? `Active file: ${file.source} · ${file.record_count?.toLocaleString()} records · refreshed ${file.refreshed_at?.slice?.(0, 10) || file.refreshed_at || "—"}`
          : meta?.loaded ? `Warehouse loaded · ${meta.recordCount?.toLocaleString()} records`
          : "Select a client with an ingested voter file to query records."}
        actions={
          <>
            <button type="button" className="btn secondary" disabled={needsClient || !hasVoterFile} onClick={() => setModal("export")}>
              <Icon name="download" size={13} /> Export
            </button>
            <button type="button" className="btn primary" disabled={needsClient || !hasVoterFile} onClick={() => setModal("cut")}>
              <Icon name="plus" size={14} /> Save universe
            </button>
          </>
        }
      />

      {!needsClient && hasVoterFile && (tab === "file" || tab === "map" || tab === "demographics") && (
        <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-fg-muted)" }}>
          <span style={{ color: "var(--fs-navy)", fontWeight: 600 }}>Active universe</span>{" · "}
          {filtersSummary(filters)}{query ? ` · search "${query}"` : ""}
          {tab === "map" && mapBbox ? " · map view scoped" : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--fs-border)", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
            color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: -1,
          }}>
            <Icon name={t.icon} size={14} />{t.label}
            {t.id === "tags" && tags.length > 0 && <span className="num mut">({tags.length})</span>}
            {t.id === "universes" && cuts.length > 0 && <span className="num mut">({cuts.length})</span>}
          </button>
        ))}
      </div>

      {needsClient && <EmptyState title="Select a client" description="Choose a specific client (not All Clients) to load their voter file." icon="users" />}
      {!needsClient && !hasVoterFile && tab !== "tags" && (
        <EmptyState title="No voter file on record"
          description="Ingest a TargetSmart CSV (npm run voter:ingest) or generate a demo file (npm run voter:mock -- --client <id>)." icon="users" />
      )}
      {!needsClient && hasVoterFile && !warehouseReady && (tab === "file" || tab === "map" || tab === "demographics") && (
        <EmptyState title="Voter file registered, not ingested" description="The file is on record but rows aren't loaded yet." icon="users" />
      )}

      {!needsClient && warehouseReady && tab === "file" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {sidebar}
          <VoterFileQuery clientId={clientId} client={client} file={file} meta={meta} filters={filters} query={query}
            sort={sort} setSort={setSort} tags={tags} onOpenVoter={setDetailId} onFlash={flash} reloadTags={reloadTags} />
        </div>
      )}

      {!needsClient && warehouseReady && tab === "map" && (
        <Suspense fallback={<Loading />}>
          <VoterMap clientId={clientId} meta={meta} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery}
            cuts={cuts} onApplyCut={applyCut} onBboxChange={setMapBbox} tags={tags} onOpenVoter={setDetailId} />
        </Suspense>
      )}

      {!needsClient && warehouseReady && tab === "demographics" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {sidebar}
          <VoterDemographics clientId={clientId} filters={filters} query={query} />
        </div>
      )}

      {!needsClient && tab === "universes" && (
        <UniversesTab cuts={cuts} onLoad={applyCut} onDelete={async (c) => {
          try { await voterApi.deleteCut(c.id); loadMeta(); flash(`Deleted "${c.name}"`); } catch (e) { flash(e.message || "Could not delete"); }
        }} onExport={(c) => { setFilters({ ...DEFAULT_VOTER_FILTERS, ...c.filters }); setQuery(c.query || ""); setModal("export"); }}
          onNew={() => setModal("cut")} disabled={!hasVoterFile} />
      )}

      {!needsClient && tab === "tags" && (
        <TagsTab clientId={clientId} tags={tags} reloadTags={reloadTags} onFlash={flash}
          onApplyUniverse={(tagId) => voterApi.assignTag(tagId, { clientId, all: true, filters, query })}
          universeSummary={`${filtersSummary(filters)}${query ? ` · "${query}"` : ""}`} />
      )}

      {modal === "cut" && (
        <VoterModal title="Save universe" onClose={() => setModal(null)}>
          <CutForm onSave={saveCut} onCancel={() => setModal(null)} filters={filters} />
        </VoterModal>
      )}
      {modal === "export" && (
        <ExportModal clientId={clientId} client={client} filters={filters} query={query} formats={formats}
          mapBbox={tab === "map" ? mapBbox : null} onClose={() => setModal(null)} onFlash={flash} />
      )}

      {detailId && (
        <VoterDetail clientId={clientId} voterId={detailId} tags={tags} onClose={() => setDetailId(null)}
          onOpenVoter={(id) => setDetailId(id)} onChanged={reloadTags} />
      )}
    </div>
  );
}

// ---------- Voter File tab ----------
function VoterFileQuery({ clientId, client, file, meta, filters, query, sort, setSort, tags, onOpenVoter, onFlash, reloadTags }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [tagMenu, setTagMenu] = useState(false);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [filters, query, clientId, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api("/voter/query", {
      method: "POST", signal: controller.signal,
      body: JSON.stringify({ clientId, filters, query, page, pageSize: PAGE_SIZE, sort }),
    })
      .then((r) => { if (!controller.signal.aborted) setResult(r); })
      .catch(() => { if (!controller.signal.aborted) setResult({ total: 0, rows: [], message: "Could not load voters." }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clientId, filters, query, page, sort]);

  const total = result?.total ?? 0;
  const recordCount = result?.recordCount ?? file?.record_count ?? meta?.recordCount ?? 0;
  const rows = result?.rows || [];
  const totalPages = Math.max(1, Math.ceil((total || recordCount) / PAGE_SIZE));
  const stats = result?.stats;

  const toggleRow = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.rowId));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPage) rows.forEach((r) => n.delete(r.rowId)); else rows.forEach((r) => n.add(r.rowId));
    return n;
  });

  const applyTag = async (tag, all) => {
    setTagMenu(false);
    try {
      const body = all ? { clientId, all: true, filters, query } : { clientId, voterIds: [...selected] };
      const r = await voterApi.assignTag(tag.id, body);
      onFlash(`Tagged ${r.affected.toLocaleString()} voters "${tag.name}"`);
      setSelected(new Set());
      reloadTags();
    } catch (e) { onFlash(e.message || "Could not tag"); }
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(90px,1fr))", gap: 12, flex: 1 }}>
          <div className="card card-pad"><Stat figure={recordCount.toLocaleString()} label="File records" /></div>
          <div className="card card-pad"><Stat figure={total.toLocaleString()} label="Matching universe" /></div>
          <div className="card card-pad"><Stat figure={stats?.avgScore ? String(stats.avgScore) : "—"} label="Avg turnout" /></div>
          <div className="card card-pad"><Stat figure={stats?.avgSupport ? String(stats.avgSupport) : "—"} label="Avg support" gold /></div>
        </div>
      </div>

      {stats?.partyMix && total > 0 && (
        <div className="card card-pad" style={{ marginBottom: 12 }}>
          <PartyBar mix={stats.partyMix} total={total} />
        </div>
      )}

      <div className="row between" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="lbl" style={{ margin: 0 }}>Sort</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "auto", fontSize: 12 }}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        {selected.size > 0 && (
          <div className="row" style={{ gap: 8, position: "relative" }}>
            <span className="mut" style={{ fontSize: 12 }}>{selected.size} selected</span>
            <button className="btn secondary sm" onClick={() => setTagMenu((v) => !v)} disabled={tags.length === 0}>
              <Icon name="flag" size={12} /> Tag selected
            </button>
            <button className="btn ghost sm" onClick={() => setSelected(new Set())}>Clear</button>
            {tagMenu && (
              <div className="card" style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 20, minWidth: 180, padding: 6 }}>
                {tags.map((t) => (
                  <button key={t.id} className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => applyTag(t, false)}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} /> {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {result?.message && <div className="card card-pad" style={{ marginBottom: 12, fontSize: 13, color: "var(--fs-fg-muted)" }}>{result.message}</div>}

      {loading && !result ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No matching voters" description="Try widening your filters or clearing the search box." icon="users" />
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 32 }}><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select page" /></th>
                <th>Voter</th><th>Party</th><th>Age</th><th>Gender</th><th>Precinct</th>
                <th>Turnout</th><th>Support</th><th>Gen/Pri</th><th>Tags</th><th>Address</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.rowId} style={{ cursor: "pointer", background: selected.has(v.rowId) ? "rgba(184,147,42,0.08)" : undefined }}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(v.rowId)} onChange={() => toggleRow(v.rowId)} /></td>
                  <td onClick={() => onOpenVoter(v.id)}><strong style={{ color: "var(--fs-navy)" }}>{v.name}</strong><div className="mut" style={{ fontSize: 11 }}>{v.id}</div></td>
                  <td onClick={() => onOpenVoter(v.id)}><span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 3, fontSize: 11, fontWeight: 700, color: "#fff", background: PARTY_FILL[v.party] || PARTY_FILL.I }}>{v.party}</span></td>
                  <td onClick={() => onOpenVoter(v.id)} className="num">{v.age ?? "—"}</td>
                  <td onClick={() => onOpenVoter(v.id)}>{v.gender}</td>
                  <td onClick={() => onOpenVoter(v.id)}>{v.precinct}</td>
                  <td onClick={() => onOpenVoter(v.id)} className="num">{v.score}</td>
                  <td onClick={() => onOpenVoter(v.id)} className="num">{v.support ?? "—"}</td>
                  <td onClick={() => onOpenVoter(v.id)} className="num mut">{v.generalVotes}/{v.primaryVotes}</td>
                  <td onClick={() => onOpenVoter(v.id)}>
                    <div className="row" style={{ gap: 3, flexWrap: "wrap" }}>
                      {v.tags.slice(0, 3).map((t) => <span key={t.id} style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} title={t.name} />)}
                      {v.tags.length > 3 && <span className="mut" style={{ fontSize: 10 }}>+{v.tags.length - 3}</span>}
                    </div>
                  </td>
                  <td onClick={() => onOpenVoter(v.id)} className="mut" style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: "flex-end", alignItems: "center" }}>
        <span className="mut" style={{ fontSize: 12 }}>Page {page} / {totalPages}</span>
        <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <button type="button" className="btn ghost sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}

function PartyBar({ mix, total }) {
  const seg = (k) => ({ width: `${((mix[k] || 0) / (total || 1)) * 100}%`, background: PARTY_FILL[k], height: 18 });
  return (
    <div>
      <div className="row between" style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>Party split</span>
        <span className="mut">D {(mix.D || 0).toLocaleString()} · R {(mix.R || 0).toLocaleString()} · I {(mix.I || 0).toLocaleString()}</span>
      </div>
      <div className="row" style={{ borderRadius: 4, overflow: "hidden", gap: 1 }}>
        <div style={seg("D")} /><div style={seg("R")} /><div style={seg("I")} />
      </div>
    </div>
  );
}

// ---------- Universes tab ----------
function UniversesTab({ cuts, onLoad, onDelete, onExport, onNew, disabled }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Saved universes</h3>
        <button className="btn primary sm" onClick={onNew} disabled={disabled}><Icon name="plus" size={13} /> Save current</button>
      </div>
      {cuts.length === 0 ? (
        <div style={{ padding: 24 }}><EmptyState title="No saved universes" description="Build a filter set on the Voter File tab, then Save universe to reuse and export it." icon="filter" /></div>
      ) : (
        <table className="tbl">
          <thead><tr><th>Name</th><th>Filters</th><th className="num">Voters</th><th>Saved</th><th></th></tr></thead>
          <tbody>
            {cuts.map((c) => (
              <tr key={c.id}>
                <td><strong style={{ color: "var(--fs-navy)" }}>{c.name}</strong></td>
                <td className="mut" style={{ fontSize: 12, maxWidth: 340 }}>{filtersSummary(c.filters)}{c.query ? ` · "${c.query}"` : ""}</td>
                <td className="num">{(c.count || 0).toLocaleString()}</td>
                <td className="mut" style={{ fontSize: 12 }}>{String(c.createdAt || "").slice(0, 10)}</td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn ghost sm" onClick={() => onLoad(c)}>Load</button>
                    <button className="btn ghost sm" onClick={() => onExport(c)}><Icon name="download" size={12} /></button>
                    <button className="btn ghost sm" onClick={() => onDelete(c)} aria-label="Delete"><Icon name="x" size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Tags tab ----------
const TAG_COLORS = ["#1A3A5C", "#B8932A", "#A8341E", "#6C8B4B", "#4A7BA7", "#8B5C8C", "#C77D3A", "#3A8B8B"];
function TagsTab({ clientId, tags, reloadTags, onFlash, onApplyUniverse, universeSummary }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await voterApi.createTag({ clientId, name: name.trim(), color }); setName(""); reloadTags(); onFlash(`Created tag "${name.trim()}"`); }
    catch (e) { onFlash(e.message || "Could not create tag"); }
    finally { setBusy(false); }
  };
  const remove = async (t) => {
    setBusy(true);
    try { await voterApi.deleteTag(t.id); reloadTags(); onFlash(`Deleted tag "${t.name}"`); }
    finally { setBusy(false); }
  };
  const applyUniverse = async (t) => {
    setBusy(true);
    try { const r = await onApplyUniverse(t.id); onFlash(`Applied "${t.name}" to ${(r.affected || 0).toLocaleString()} voters`); reloadTags(); }
    catch (e) { onFlash(e.message || "Could not apply"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div className="card">
        <div className="card-head"><h3>New tag</h3></div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="input" value={name} placeholder="Tag name (e.g. Volunteer, GOTV)" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          <div>
            <div className="lbl">Color</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {TAG_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: color === c ? "3px solid var(--fs-navy)" : "2px solid var(--fs-border)", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <button className="btn primary" disabled={busy || !name.trim()} onClick={create}><Icon name="plus" size={13} /> Create tag</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Tags</h3><span className="mut" style={{ fontSize: 12 }}>Apply the current universe: <em>{universeSummary}</em></span></div>
        {tags.length === 0 ? (
          <div style={{ padding: 24 }}><EmptyState title="No tags yet" description="Create a tag, then apply it to selected voters or the current universe." icon="flag" /></div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Tag</th><th>Description</th><th className="num">Voters</th><th></th></tr></thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td><span className="row" style={{ gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: t.color }} /><strong>{t.name}</strong></span></td>
                  <td className="mut" style={{ fontSize: 12 }}>{t.description || "—"}</td>
                  <td className="num">{(t.count || 0).toLocaleString()}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn ghost sm" disabled={busy} onClick={() => applyUniverse(t)}>Apply universe</button>
                      <button className="btn ghost sm" disabled={busy} onClick={() => remove(t)} aria-label="Delete"><Icon name="x" size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Export modal ----------
function ExportModal({ clientId, client, filters, query, formats, mapBbox, onClose, onFlash }) {
  const [format, setFormat] = useState("standard");
  const [scope, setScope] = useState("filters");
  const [count, setCount] = useState(null);
  const [mapCount, setMapCount] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let live = true;
    voterApi.count({ clientId, filters, query, scope: "filters" }).then((r) => live && setCount(r.total)).catch(() => live && setCount(0));
    if (mapBbox) voterApi.count({ clientId, filters, query, bbox: mapBbox, scope: "map" }).then((r) => live && setMapCount(r.total)).catch(() => {});
    return () => { live = false; };
  }, [clientId, filters, query, mapBbox]);

  const run = async () => {
    setExporting(true);
    try {
      const slug = (client?.tag || clientId || "universe").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { count: n } = await downloadExport("/voter/export",
        { clientId, filters, query, bbox: mapBbox, scope, format, name: `${slug}-${format}` },
        `${slug}-${format}-${new Date().toISOString().slice(0, 10)}.csv`);
      onClose();
      onFlash(`Exported ${(n || count || 0).toLocaleString()} voters (${format}).`);
    } catch (e) { onFlash(e.message || "Export failed"); }
    finally { setExporting(false); }
  };

  const effectiveCount = scope === "map" ? mapCount : count;

  return (
    <VoterModal title="Export universe" onClose={onClose}>
      <p className="mut" style={{ fontSize: 13, marginTop: 0 }}>{filtersSummary(filters)}{query ? ` · "${query}"` : ""}</p>

      <div className="lbl">Format</div>
      <select className="input" value={format} onChange={(e) => setFormat(e.target.value)} style={{ marginBottom: 12 }}>
        {formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>

      {mapBbox && (
        <>
          <div className="lbl">Scope</div>
          <div className="col" style={{ gap: 4, marginBottom: 12 }}>
            <label className="row" style={{ fontSize: 13, gap: 8 }}><input type="radio" checked={scope === "filters"} onChange={() => setScope("filters")} /> Full filtered universe {count != null && `(${count.toLocaleString()})`}</label>
            <label className="row" style={{ fontSize: 13, gap: 8 }}><input type="radio" checked={scope === "map"} onChange={() => setScope("map")} /> Current map view {mapCount != null && `(${mapCount.toLocaleString()})`}</label>
          </div>
        </>
      )}

      <p style={{ fontSize: 14, color: "var(--fs-navy)", margin: "8px 0 16px" }}>
        {effectiveCount == null ? "Counting…" : <><strong>{effectiveCount.toLocaleString()}</strong> voters will be exported.</>}
      </p>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={exporting || !effectiveCount} onClick={run}>
          <Icon name="download" size={13} /> {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>
    </VoterModal>
  );
}

// ---------- shared modal + cut form ----------
function VoterModal({ title, children, onClose }) {
  const dialogRef = useModalA11y(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(26,58,92,0.45)", display: "grid", placeItems: "center", padding: 24 }} onClick={onClose}>
      <div ref={dialogRef} className="card" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: 480, width: "100%", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)" }}>{title}</h3>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
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
      <input className="input" placeholder="Universe name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
      <p className="mut" style={{ fontSize: 12 }}>{filtersSummary(filters)}</p>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
      </div>
    </>
  );
}
