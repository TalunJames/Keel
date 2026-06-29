import React from "react";

export const DEFAULT_VOTER_FILTERS = {
  party: "All",
  county: "All",
  precinct: "All",
  ageRange: "All",
  status: "All",
  scoreMin: 0,
  turnoutOnly: false,
};

export function VoterFilters({
  filters,
  setFilters,
  query,
  setQuery,
  meta,
  cuts,
  onApplyCut,
  compact = false,
}) {
  const counties = meta?.counties || [];
  const precincts = meta?.precincts || [];
  const ageRanges = meta?.ageRanges || [];

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: compact ? 12 : 14 }}>
      <div>
        <div className="lbl">Search</div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, ID, or address"
        />
      </div>
      <div className="lbl">Party</div>
      <div className="row" style={{ gap: 4 }}>
        {["All", "D", "R", "I"].map((p) => (
          <button
            key={p}
            type="button"
            className={"btn " + (filters.party === p ? "primary" : "secondary")}
            style={{ flex: 1, fontSize: 12 }}
            onClick={() => setFilters((f) => ({ ...f, party: p }))}
          >
            {p}
          </button>
        ))}
      </div>
      {precincts.length > 0 && (
        <div>
          <div className="lbl">Precinct</div>
          <select
            className="input"
            value={filters.precinct}
            onChange={(e) => setFilters((f) => ({ ...f, precinct: e.target.value }))}
          >
            <option>All</option>
            {precincts.slice(0, 300).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}
      {ageRanges.length > 0 && (
        <div>
          <div className="lbl">Age range</div>
          <select
            className="input"
            value={filters.ageRange}
            onChange={(e) => setFilters((f) => ({ ...f, ageRange: e.target.value }))}
          >
            <option>All</option>
            {ageRanges.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <div className="lbl">Status</div>
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option>All</option>
          <option value="A">Active</option>
          <option value="I">Inactive</option>
        </select>
      </div>
      {counties.length > 0 && (
        <div>
          <div className="lbl">County</div>
          <select
            className="input"
            value={filters.county}
            onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))}
          >
            <option>All</option>
            {counties.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <div className="lbl">Turnout score ≥ {filters.scoreMin}</div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.scoreMin}
          onChange={(e) => setFilters((f) => ({ ...f, scoreMin: +e.target.value }))}
          style={{ width: "100%" }}
        />
      </div>
      <label className="row" style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={filters.turnoutOnly}
          onChange={(e) => setFilters((f) => ({ ...f, turnoutOnly: e.target.checked }))}
        />
        Has turnout score
      </label>
      {cuts?.length > 0 && (
        <>
          <div className="divider" style={{ margin: 0 }} />
          <div className="lbl">Saved cuts</div>
          {cuts.slice(0, 5).map((s) => (
            <button key={s.id} type="button" className="btn ghost sm" onClick={() => onApplyCut?.(s)}>
              {s.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function filtersSummary(filters) {
  const parts = [];
  if (filters.party !== "All") parts.push(`party ${filters.party}`);
  if (filters.county !== "All") parts.push(filters.county);
  if (filters.precinct !== "All") parts.push(`precinct ${filters.precinct}`);
  if (filters.ageRange !== "All") parts.push(filters.ageRange);
  if (filters.status !== "All") parts.push(filters.status === "A" ? "active" : "inactive");
  if (filters.scoreMin > 0) parts.push(`score ≥ ${filters.scoreMin}`);
  if (filters.turnoutOnly) parts.push("has score");
  return parts.length ? parts.join(" · ") : "All voters";
}
