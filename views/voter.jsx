/* global React, VoterStore */
const { useState: useStateVoter, useMemo: useMemoVoter, useEffect: useEffectVoter, useCallback: useCallbackVoter } = React;

const DEFAULT_FILTERS = { party: "All", county: "All", scoreMin: 0, turnoutOnly: false };

function VoterView({ role, clientId, client }) {
  const [tab, setTab] = useStateVoter("file");
  const [filters, setFilters] = useStateVoter({ ...DEFAULT_FILTERS });
  const [query, setQuery] = useStateVoter("");
  const [cuts, setCuts] = useStateVoter(() => VoterStore.loadCuts());
  const [notice, setNotice] = useStateVoter(null);
  const [modal, setModal] = useStateVoter(null); // cut | saved | export
  const [exportStatus, setExportStatus] = useStateVoter(null);

  const refreshCuts = useCallbackVoter(() => setCuts(VoterStore.loadCuts()), []);

  const activeUniverse = useMemoVoter(() => ({
    name: "Current query",
    filters: { ...filters },
    query,
    count: VoterStore.estimateCount(filters, query),
  }), [filters, query]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  };

  useEffectVoter(() => {
    if (modal !== "export") return undefined;
    setExportStatus("Preparing…");
    return VoterStore.requestFullExport(activeUniverse, (s) => {
      if (s === null) {
        setExportStatus("done");
        flash("Universe manifest downloaded. Full row export runs server-side against this predicate.");
      } else {
        setExportStatus(s);
      }
    });
  }, [modal]);

  const applyCut = (cut) => {
    setFilters({ ...DEFAULT_FILTERS, ...cut.filters });
    setQuery(cut.query || "");
    flash('Loaded cut "' + cut.name + '"');
  };

  return (
    <div>
      {notice && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 200,
          padding: "12px 18px", background: "var(--fs-navy)", color: "var(--fs-paper)",
          borderRadius: 4, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          maxWidth: 360,
        }}>{notice}</div>
      )}

      <PageHead
        eyebrow="Voter & Polling Data"
        title="Voter File Explorer"
        sub="Query the latest TargetSmart pull, layer in turnout history, and build cut universes for design, mail, and field. Last refresh: TargetSmart 5/19, 9.4M Ohio records."
        actions={
          <>
            <button className="btn secondary" onClick={() => setModal("saved")}>
              <Icon name="filter" size={13} /> Saved filters
            </button>
            <button className="btn secondary" onClick={() => setModal("export")}>
              <Icon name="download" size={13} /> Export universe
            </button>
            <button className="btn primary" onClick={() => setModal("cut")}>
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
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px", background: "transparent", border: "none",
              borderBottom: "2px solid " + (tab === t.id ? "var(--fs-gold)" : "transparent"),
              color: tab === t.id ? "var(--fs-navy)" : "var(--fs-fg-muted)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, marginBottom: -1,
            }}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <VoterFile
          role={role}
          clientId={clientId}
          filters={filters}
          setFilters={setFilters}
          query={query}
          setQuery={setQuery}
          cuts={cuts}
          onCutsChange={refreshCuts}
          onApplyCut={applyCut}
          onFlash={flash}
        />
      )}
      {tab === "crosstabs" && <Crosstabs role={role} onFlash={flash} />}
      {tab === "map" && <PrecinctMap />}

      {modal === "cut" && (
        <VoterModal title="Cut universe" onClose={() => setModal(null)}>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Saves the current filters as a named universe ({VoterStore.formatCount(activeUniverse.count)} records).
            Exports and mail pulls reference this predicate — not a list of row IDs.
          </p>
          <CutForm
            count={activeUniverse.count}
            clientId={clientId}
            filters={filters}
            query={query}
            onSave={(name) => {
              VoterStore.saveCut({ name, filters, query, clientId });
              refreshCuts();
              setModal(null);
              flash('Saved cut "' + name + '"');
            }}
            onCancel={() => setModal(null)}
          />
        </VoterModal>
      )}

      {modal === "saved" && (
        <VoterModal title="Saved filters & cuts" onClose={() => setModal(null)}>
          <SavedCutsList
            cuts={cuts}
            onApply={(cut) => { applyCut(cut); setModal(null); }}
            onDelete={(id) => { VoterStore.deleteCut(id); refreshCuts(); }}
          />
        </VoterModal>
      )}

      {modal === "export" && (
        <VoterModal title="Export universe" onClose={() => setModal(null)}>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 12px" }}>
            Full-file exports run server-side against the universe predicate. This demo downloads the manifest immediately and simulates the bulk job.
          </p>
          <div style={{ padding: "14px 16px", background: "var(--fs-bone-50)", borderRadius: 4, fontSize: 13 }}>
            <div><strong>{activeUniverse.count.toLocaleString()}</strong> records match current filters</div>
            <div className="mut" style={{ marginTop: 8 }}>
              {exportStatus === "done"
                ? "Manifest ready — check your downloads folder."
                : exportStatus || "Starting…"}
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn secondary" onClick={() => setModal(null)}>Close</button>
          </div>
        </VoterModal>
      )}
    </div>
  );
}

function VoterModal({ title, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      background: "rgba(26, 58, 92, 0.45)",
      display: "grid", placeItems: "center", padding: 24,
    }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--fs-font-display)", color: "var(--fs-navy)" }}>{title}</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CutForm({ count, filters, query, clientId, onSave, onCancel }) {
  const [name, setName] = useStateVoter("");
  return (
    <>
      <label className="lbl">Cut name</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. OH-SEN GOTV — Sporadic D" style={{ marginBottom: 12 }} />
      <div className="mut" style={{ fontSize: 12, marginBottom: 16 }}>
        {count.toLocaleString()} records · {filters.party !== "All" ? filters.party + " · " : ""}
        {filters.county !== "All" ? filters.county + " · " : ""}
        score ≥ {filters.scoreMin}
        {filters.turnoutOnly ? " · 4+ of 5 elections" : ""}
      </div>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save cut</button>
      </div>
    </>
  );
}

function SavedCutsList({ cuts, onApply, onDelete }) {
  const presets = [
    { id: "preset-gotv", name: "OH-SEN GOTV — Sporadic D", filters: { party: "D", county: "All", scoreMin: 55, turnoutOnly: false }, query: "", count: 284000 },
    { id: "preset-coastal", name: "Coastal Renewal supporters", filters: { party: "D", county: "Lake", scoreMin: 40, turnoutOnly: false }, query: "", count: 412000 },
    { id: "preset-persuasion", name: "Persuasion — Suburban W 35-54", filters: { party: "I", county: "Cuyahoga", scoreMin: 45, turnoutOnly: false }, query: "", count: 168000 },
  ];
  const all = [...cuts, ...presets.filter(p => !cuts.some(c => c.name === p.name))];

  if (!all.length) {
    return <p className="mut" style={{ fontSize: 13 }}>No saved cuts yet. Build filters and use Cut universe.</p>;
  }

  return (
    <div className="col" style={{ gap: 8, maxHeight: 360, overflowY: "auto" }}>
      {all.map(cut => (
        <div key={cut.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", border: "1px solid var(--fs-border)", borderRadius: 4,
          background: "var(--fs-bone-50)",
        }}>
          <button className="btn ghost sm" style={{ flex: 1, textAlign: "left", justifyContent: "flex-start" }}
            onClick={() => onApply(cut)}>
            <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{cut.name}</span>
            <span className="num mut" style={{ marginLeft: 8 }}>
              {VoterStore.formatCount(cut.count || VoterStore.estimateCount(cut.filters, cut.query))}
            </span>
          </button>
          {cut.id && cut.id.startsWith("cut-") && (
            <button className="btn ghost sm" onClick={() => onDelete(cut.id)} title="Delete">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function VoterFile({ role, clientId, filters, setFilters, query, setQuery, cuts, onCutsChange, onApplyCut, onFlash }) {
  const [page, setPage] = useStateVoter(1);
  const [selected, setSelected] = useStateVoter(new Set());
  const [selectAllUniverse, setSelectAllUniverse] = useStateVoter(false);
  const [loading, setLoading] = useStateVoter(false);
  const [rows, setRows] = useStateVoter([]);

  const stats = useMemoVoter(() => VoterStore.estimateStats(filters, query), [filters, query]);
  const total = stats.total;
  const totalPages = Math.max(1, Math.ceil(total / VoterStore.PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffectVoter(() => {
    setPage(1);
    setSelected(new Set());
    setSelectAllUniverse(false);
  }, [VoterStore.filterKey(filters, query)]);

  useEffectVoter(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setRows(VoterStore.fetchPage(filters, query, safePage));
      setLoading(false);
    }, 120);
    return () => clearTimeout(t);
  }, [filters, query, safePage]);

  const counties = ["All", ...VoterStore.COUNTIES];
  const partyMix = [
    { p: "D", n: stats.partyMix.D },
    { p: "R", n: stats.partyMix.R },
    { p: "I", n: stats.partyMix.I },
  ];
  const rangeStart = (safePage - 1) * VoterStore.PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * VoterStore.PAGE_SIZE, total);
  const selectionCount = selectAllUniverse ? total : selected.size;

  const toggleSelectAllPage = (checked) => {
    if (checked) {
      setSelected(new Set(rows.map(v => v.id)));
      setSelectAllUniverse(false);
    } else {
      setSelected(new Set());
    }
  };

  const exportSelection = () => {
    if (selectAllUniverse) {
      const cut = { name: "selection-export", filters, query, count: total };
      VoterStore.exportUniverseManifest(cut);
      onFlash("Exported universe predicate for " + total.toLocaleString() + " records");
    } else {
      const picked = rows.filter(v => selected.has(v.id));
      VoterStore.exportPageCsv(picked, "selection");
      onFlash("Downloaded " + picked.length + " rows (page sample)");
    }
  };

  const saveSelectionAsCut = () => {
    const name = selectAllUniverse
      ? "Selection — " + total.toLocaleString() + " records"
      : "Selection — " + selected.size + " records";
    VoterStore.saveCut({ name, filters, query, clientId });
    onCutsChange();
    onFlash('Saved "' + name + '" as a cut');
    setSelected(new Set());
    setSelectAllUniverse(false);
  };

  const sidebarCuts = [
    ...cuts.slice(0, 5),
    { id: "preset-gotv", name: "OH-SEN GOTV — Sporadic D", filters: { party: "D", county: "All", scoreMin: 55, turnoutOnly: false }, query: "", count: 284000 },
    { id: "preset-coastal", name: "Coastal Renewal supporters", filters: { party: "D", county: "Lake", scoreMin: 40, turnoutOnly: false }, query: "", count: 412000 },
    { id: "preset-persuasion", name: "Persuasion — Suburban W 35-54", filters: { party: "I", county: "Cuyahoga", scoreMin: 45, turnoutOnly: false }, query: "", count: 168000 },
  ].filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i).slice(0, 6);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "flex-start" }}>
      <aside className="card" style={{ position: "sticky", top: 0 }}>
        <div className="card-head"><h3>Filters</h3></div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="lbl">Search</div>
            <div className="search" style={{ width: "100%", padding: "6px 10px" }}>
              <Icon name="search" size={13} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or VAN ID" />
            </div>
          </div>
          <div>
            <div className="lbl">Party</div>
            <div className="row" style={{ gap: 4 }}>
              {["All", "D", "R", "I"].map(p => (
                <button key={p} onClick={() => setFilters(f => ({ ...f, party: p }))}
                  className={"btn " + (filters.party === p ? "primary" : "secondary")}
                  style={{ flex: 1, padding: "5px 0", fontSize: 12 }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="lbl">County</div>
            <select className="input" value={filters.county} onChange={e => setFilters(f => ({ ...f, county: e.target.value }))}>
              {counties.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="lbl">Turnout score min · {filters.scoreMin}</div>
            <input type="range" min="0" max="100" step="5" value={filters.scoreMin}
              onChange={e => setFilters(f => ({ ...f, scoreMin: +e.target.value }))}
              style={{ width: "100%", accentColor: "var(--fs-navy)" }} />
          </div>
          <label className="row" style={{ fontSize: 13, cursor: "pointer", color: "var(--fs-ink)" }}>
            <input type="checkbox" checked={filters.turnoutOnly}
              onChange={e => setFilters(f => ({ ...f, turnoutOnly: e.target.checked }))}
              style={{ accentColor: "var(--fs-navy)" }} />
            Voted 4+ of last 5
          </label>
          <div className="divider" style={{ margin: 0 }} />
          <div>
            <div className="lbl">Saved cuts</div>
            <div className="col" style={{ gap: 6 }}>
              {sidebarCuts.map(s => (
                <button key={s.id} type="button" onClick={() => onApplyCut(s)}
                  style={{
                    display: "flex", justifyContent: "space-between", width: "100%",
                    padding: "8px 10px", fontSize: 13, color: "var(--fs-navy)",
                    border: "1px solid var(--fs-border)", borderRadius: 4,
                    background: "var(--fs-bone-50)", cursor: "pointer", textAlign: "left",
                  }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{s.name}</span>
                  <span className="num mut">{VoterStore.formatCount(s.count || VoterStore.estimateCount(s.filters, s.query))}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div className="card card-pad"><Stat figure={total.toLocaleString()} label="Records in universe" /></div>
          <div className="card card-pad"><Stat figure={stats.avgScore} label="Avg turnout score" gold /></div>
          <div className="card card-pad">
            <div className="lbl" style={{ marginBottom: 8 }}>Party mix</div>
            <div className="row" style={{ gap: 4, height: 10, background: "var(--fs-bone-100)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
              {partyMix.map(m => (
                <div key={m.p} style={{
                  width: (total ? m.n / total * 100 : 0) + "%",
                  height: "100%",
                  background: m.p === "D" ? "var(--fs-navy)" : m.p === "R" ? "#A8341E" : "var(--fs-ink-300)",
                }} />
              ))}
            </div>
            <div className="row" style={{ gap: 12, fontSize: 11 }}>
              {partyMix.map(m => <span key={m.p} className="num mut">{m.p}: {m.n.toLocaleString()}</span>)}
            </div>
          </div>
          <div className="card card-pad"><Stat figure="$0.32" label="Est. mail cost / record" /></div>
        </div>

        {(selected.size > 0 || selectAllUniverse) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--ks-ink-surface)", color: "var(--ks-on-ink)", borderRadius: 4 }}>
            <div style={{ fontSize: 13 }}>
              {selectAllUniverse
                ? "All " + total.toLocaleString() + " records in universe selected"
                : selected.size + " records selected"}
              {!selectAllUniverse && total > VoterStore.PAGE_SIZE && (
                <button className="btn ghost sm" style={{ color: "var(--fs-gold)", marginLeft: 10 }}
                  onClick={() => { setSelectAllUniverse(true); setSelected(new Set()); }}>
                  Select all {total.toLocaleString()} in universe
                </button>
              )}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost sm" style={{ color: "var(--ks-on-ink)" }} onClick={exportSelection}>
                <Icon name="download" size={12} /> CSV
              </button>
              <button className="btn accent sm" onClick={saveSelectionAsCut}>Save as cut</button>
              <button className="btn ghost sm" style={{ color: "rgba(255,255,255,0.7)" }}
                onClick={() => { setSelected(new Set()); setSelectAllUniverse(false); }}>Clear</button>
            </div>
          </div>
        )}

        <div className="card" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 120ms" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" style={{ accentColor: "var(--fs-navy)" }}
                    checked={!selectAllUniverse && selected.size === rows.length && rows.length > 0}
                    onChange={e => toggleSelectAllPage(e.target.checked)} />
                </th>
                <th>Voter</th>
                <th>Age</th>
                <th>Party</th>
                <th>County / Precinct</th>
                <th>Turnout (last 5)</th>
                <th style={{ textAlign: "right" }}>Score</th>
                <th>Last voted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(v => (
                <tr key={v.id + "-" + safePage} className={selected.has(v.id) || selectAllUniverse ? "selected" : ""}>
                  <td>
                    <input type="checkbox" style={{ accentColor: "var(--fs-navy)" }}
                      checked={selectAllUniverse || selected.has(v.id)}
                      disabled={selectAllUniverse}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(v.id); else next.delete(v.id);
                        setSelected(next);
                        setSelectAllUniverse(false);
                      }} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{v.name}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{v.id}</div>
                  </td>
                  <td className="num">{v.age}</td>
                  <td><Tag tone={v.party === "D" ? "navy" : v.party === "R" ? "danger" : "outline"}>{v.party}</Tag></td>
                  <td>
                    <div>{v.county}</div>
                    <div className="mut" style={{ fontSize: 11 }}>{v.precinct}</div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 3 }}>
                      {v.turn.map((t, i) => (
                        <span key={i} style={{
                          width: 16, height: 16, display: "grid", placeItems: "center",
                          fontSize: 9, fontWeight: 700,
                          color: t === "—" ? "var(--fs-ink-300)" : "var(--fs-paper)",
                          background: t === "G" ? "var(--fs-navy)" : t === "P" ? "var(--fs-navy-500)" : "var(--fs-bone-100)",
                          borderRadius: 2,
                        }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                    <span style={{ color: v.score > 80 ? "var(--fs-success)" : v.score > 60 ? "var(--fs-navy)" : "var(--fs-fg-muted)" }}>{v.score}</span>
                  </td>
                  <td className="mut">{v.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row between" style={{ padding: "10px 16px", borderTop: "1px solid var(--fs-border)", fontSize: 12, color: "var(--fs-fg-muted)" }}>
            <span>
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()} records
              {loading ? " · loading…" : ""}
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost sm" disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                <Icon name="chevron-left" size={12} />
              </button>
              <span className="num">{safePage.toLocaleString()} / {totalPages.toLocaleString()}</span>
              <button className="btn ghost sm" disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <Icon name="chevron-right" size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Crosstabs({ role, onFlash }) {
  const [poll, setPoll] = useStateVoter("statewide");
  const questions = {
    statewide: { title: "Statewide topline — May 12–17 IVR", n: 812, moe: "±3.4%", date: "May 12–17", unlocked: true },
    issue: { title: "Issue battery — Coastal Renewal", n: 812, moe: "±3.4%", date: "May 12–17", unlocked: true },
    adtest: { title: "Ad test — \"Lighthouse\" 30s", n: 401, moe: "±4.9%", date: "May 14", unlocked: false },
    tracking: { title: "Final pre-primary tracking", n: 600, moe: "±4.0%", date: "May 18–19", unlocked: false },
  };

  const rows = [
    { label: "Aoki", total: 47.2, gender: { m: 44.1, f: 50.3 }, age: { y: 52.1, m: 46.8, o: 43.2 }, region: { col: 52.4, cle: 49.1, cin: 41.8, rur: 38.6 }, party: { d: 78, dl: 56, i: 38, rl: 8, r: 3 } },
    { label: "Reyes", total: 42.0, gender: { m: 45.2, f: 38.8 }, age: { y: 36.1, m: 42.4, o: 47.6 }, region: { col: 40.1, cle: 41.4, cin: 44.8, rur: 51.8 }, party: { d: 18, dl: 38, i: 51, rl: 82, r: 88 } },
    { label: "Whitmore", total: 8.0, gender: { m: 7.4, f: 8.6 }, age: { y: 7.9, m: 7.5, o: 8.6 }, region: { col: 6.0, cle: 7.5, cin: 10.4, rur: 8.0 }, party: { d: 3, dl: 4, i: 8, rl: 6, r: 6 } },
    { label: "Undecided", total: 2.8, gender: { m: 3.3, f: 2.3 }, age: { y: 3.9, m: 3.3, o: 0.6 }, region: { col: 1.5, cle: 2.0, cin: 3.0, rur: 1.6 }, party: { d: 1, dl: 2, i: 3, rl: 4, r: 3 } },
  ];

  const downloadCsv = (kind) => {
    const header = "candidate,total,m,f,age_18_34,age_35_54,age_55,col,cle,cin,rur,d,dl,i,rl,r\n";
    const body = rows.map(r =>
      [r.label, r.total, r.gender.m, r.gender.f, r.age.y, r.age.m, r.age.o,
        r.region.col, r.region.cle, r.region.cin, r.region.rur,
        r.party.d, r.party.dl, r.party.i, r.party.rl, r.party.r].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keel-crosstab-" + kind + "-" + poll + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    onFlash && onFlash("Downloaded " + kind + " CSV");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "flex-start" }}>
      <aside className="card">
        <div className="card-head"><h3>Polls</h3></div>
        <div style={{ padding: 8 }}>
          {Object.entries(questions).map(([k, q]) => {
            const locked = role === "client" && !q.unlocked;
            return (
              <button key={k} onClick={() => !locked && setPoll(k)} disabled={locked}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 4,
                  background: poll === k ? "var(--fs-navy-50)" : "transparent",
                  border: "1px solid " + (poll === k ? "var(--fs-navy)" : "transparent"),
                  cursor: locked ? "not-allowed" : "pointer", marginBottom: 4, opacity: locked ? 0.55 : 1,
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>
                  {locked && <Icon name="lock" size={11} style={{ marginRight: 6 }} />}
                  {q.title}
                </div>
                <div className="mut" style={{ fontSize: 11, marginTop: 2 }}>n={q.n} · {q.moe} · {q.date}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <div>
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <Eyebrow>{questions[poll].date} · n={questions[poll].n} · {questions[poll].moe}</Eyebrow>
              <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 4px" }}>
                {questions[poll].title}
              </h3>
              <p className="mut" style={{ fontSize: 13, margin: 0 }}>
                "If the Democratic primary for U.S. Senate were held today, who would you vote for?"
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {role === "admin" && <button className="btn secondary" onClick={() => onFlash && onFlash("Access settings saved (demo)")}><Icon name="key" size={12} /> Manage access</button>}
              <button className="btn secondary" onClick={() => downloadCsv("topline")}><Icon name="download" size={12} /> Topline</button>
              <button className="btn secondary" onClick={() => downloadCsv("banner")}><Icon name="download" size={12} /> Banner</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 100 }}>Candidate</th>
                <th>Total</th>
                <th colSpan="2" style={{ textAlign: "center", borderLeft: "1px solid var(--fs-border)" }}>Gender</th>
                <th colSpan="3" style={{ textAlign: "center", borderLeft: "1px solid var(--fs-border)" }}>Age</th>
                <th colSpan="4" style={{ textAlign: "center", borderLeft: "1px solid var(--fs-border)" }}>Region</th>
                <th colSpan="5" style={{ textAlign: "center", borderLeft: "1px solid var(--fs-border)" }}>Party ID</th>
              </tr>
              <tr style={{ fontSize: 10 }}>
                <th></th><th></th>
                <th style={{ borderLeft: "1px solid var(--fs-border)" }}>M</th><th>F</th>
                <th style={{ borderLeft: "1px solid var(--fs-border)" }}>18–34</th><th>35–54</th><th>55+</th>
                <th style={{ borderLeft: "1px solid var(--fs-border)" }}>Col.</th><th>Cle.</th><th>Cin.</th><th>Rural</th>
                <th style={{ borderLeft: "1px solid var(--fs-border)" }}>D</th><th>D-lean</th><th>I</th><th>R-lean</th><th>R</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cell = (v, hi) => (
                  <td className="num" style={{
                    textAlign: "right", color: hi ? "var(--fs-navy)" : "var(--fs-ink)",
                    fontWeight: hi ? 700 : 400, background: hi ? "var(--fs-navy-50)" : "transparent",
                  }}>{v.toFixed(1)}</td>
                );
                return (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{r.label}</td>
                    <td className="num" style={{ fontWeight: 700, fontFamily: "var(--fs-font-display)", fontSize: 16, color: "var(--fs-navy)" }}>{r.total.toFixed(1)}</td>
                    {cell(r.gender.m, r.label === "Reyes")}
                    {cell(r.gender.f, r.label === "Aoki")}
                    {cell(r.age.y, r.label === "Aoki")}
                    {cell(r.age.m)}
                    {cell(r.age.o, r.label === "Reyes")}
                    {cell(r.region.col, r.label === "Aoki")}
                    {cell(r.region.cle)}
                    {cell(r.region.cin)}
                    {cell(r.region.rur, r.label === "Reyes")}
                    {cell(r.party.d, r.label === "Aoki")}
                    {cell(r.party.dl)}
                    {cell(r.party.i)}
                    {cell(r.party.rl, r.label === "Reyes")}
                    {cell(r.party.r, r.label === "Reyes")}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mut" style={{ fontSize: 12, marginTop: 14, padding: "10px 14px", background: "var(--fs-bone-50)", borderRadius: 4, lineHeight: 1.55 }}>
          <strong style={{ color: "var(--fs-navy)" }}>Read:</strong> Aoki leads strongly with women (+11.5 vs Reyes), under-35s (+16), and Columbus media market. Reyes leads with rural voters (+13.2) and Cincinnati. Persuasion target = older suburban women in Cleveland market.
        </div>
      </div>
    </div>
  );
}

function PrecinctMap() {
  const [layers, setLayers] = useStateVoter({
    "Live margin (current race)": true,
    "2022 D primary margin": false,
    "Turnout score average": false,
    "Mail universe density": false,
    "Field volunteer reach": false,
    "Counties (outline only)": true,
  });
  const [hovered, setHovered] = useStateVoter(null);

  const cells = useMemoVoter(() => {
    const arr = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 14; c++) {
      const m = Math.sin(c * 0.4 + r * 0.6) * 30 + (c - 7) * 1.4;
      arr.push({ r, c, m, rep: 30 + ((c + r * 3) % 70), id: "P-" + r + "-" + c });
    }
    return arr;
  }, []);

  const color = (m) => {
    if (m >= 0) {
      const t = Math.min(1, m / 25);
      return "rgba(26, 58, 92, " + (0.18 + 0.75 * t) + ")";
    }
    const t = Math.min(1, -m / 25);
    return "rgba(168, 52, 30, " + (0.18 + 0.75 * t) + ")";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "flex-start" }}>
      <div className="card card-pad">
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <Eyebrow>Precinct Map · Ohio statewide</Eyebrow>
            <h3 style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)", margin: "10px 0 0" }}>Margin layer · OH-SEN D primary</h3>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn secondary" onClick={() => {}}><Icon name="filter" size={12} /> Layer</button>
            <button className="btn secondary" onClick={() => {
              const csv = "precinct_id,margin,rep_pct_in\n" + cells.map(c => c.id + "," + c.m.toFixed(1) + "," + c.rep).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "keel-precinct-map.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}><Icon name="download" size={12} /> Export</button>
          </div>
        </div>

        <div style={{ background: "var(--fs-bone-50)", padding: 18, borderRadius: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 2 }}>
            {cells.map((c, i) => (
              <div key={i} title={"Margin " + c.m.toFixed(1) + " · " + c.rep + "% in"}
                onMouseEnter={() => setHovered(c)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  aspectRatio: "1", background: color(c.m), borderRadius: 2, cursor: "pointer",
                  opacity: layers["Live margin (current race)"] ? 1 : 0.35,
                }}>
                {c.rep < 50 && layers["Mail universe density"] && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 4px)",
                    borderRadius: 2,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="row between" style={{ marginTop: 14, fontSize: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="mut">Reyes +25</span>
            <div style={{ width: 200, height: 10, borderRadius: 2, background: "linear-gradient(90deg, #A8341E, #f1f0e8 50%, #1A3A5C)" }} />
            <span className="mut">Aoki +25</span>
          </div>
          <span className="num mut">2,134 precincts</span>
        </div>
      </div>

      <aside className="card">
        <div className="card-head"><h3>Map Layers</h3></div>
        <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.keys(layers).map(n => (
            <label key={n} className="row" style={{ fontSize: 13, padding: "6px 4px", cursor: "pointer" }}>
              <input type="checkbox" checked={layers[n]}
                onChange={e => setLayers(l => ({ ...l, [n]: e.target.checked }))}
                style={{ accentColor: "var(--fs-navy)" }} />
              {n}
            </label>
          ))}
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div style={{ padding: "12px 18px" }}>
          <div className="lbl">Hovered precinct</div>
          {hovered ? (
            <div style={{ fontSize: 13, color: "var(--fs-navy)" }}>
              <div><strong>{hovered.id}</strong></div>
              <div className="mut">Margin {hovered.m.toFixed(1)} · {hovered.rep}% turnout in</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--fs-fg-muted)" }}>Hover a cell to inspect →</div>
          )}
        </div>
      </aside>
    </div>
  );
}

window.VoterView = VoterView;
