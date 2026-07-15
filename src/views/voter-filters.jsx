import React, { useState, useMemo } from "react";
import { Icon } from "../components/ui.jsx";

// Rich filter model. Arrays are multi-select; ranges use paired bounds. The
// server's buildWhere accepts this shape (and the legacy flat shape) so old
// saved universes still load. `query` (free text) is kept as separate state in
// the parent, not in this object.
export const DEFAULT_VOTER_FILTERS = {
  parties: [],
  counties: [],
  cities: [],
  precincts: [],
  senate: [],
  house: [],
  commissioner: [],
  congressional: [],
  genders: [],
  ethnicities: [],
  languages: [],
  ageMin: "",
  ageMax: "",
  status: "All",
  regFrom: "",
  regTo: "",
  turnoutMin: 0,
  turnoutMax: 100,
  supportMin: 0,
  supportMax: 100,
  hasPhone: false,
  hasCell: false,
  hasEmail: false,
  generalsMin: 0,
  primariesMin: 0,
  votedElections: [],
  notVotedElections: [],
  tagsInclude: [],
  tagsExclude: [],
};

const PARTY_LABELS = { D: "Dem", R: "Rep", I: "Other" };
const GENDER_LABELS = { M: "Male", F: "Female", U: "Unknown" };

function toArr(v) { return Array.isArray(v) ? v : []; }

// Count of constraints inside a subset of keys, for section badges.
function countKeys(f, keys) {
  let n = 0;
  for (const k of keys) {
    const v = f[k];
    if (Array.isArray(v)) n += v.length ? 1 : 0;
    else if (typeof v === "boolean") n += v ? 1 : 0;
    else if (k === "status") n += v && v !== "All" ? 1 : 0;
    else if (k === "turnoutMin") n += Number(v) > 0 ? 1 : 0;
    else if (k === "turnoutMax") n += Number(v) < 100 ? 1 : 0;
    else if (k === "supportMin") n += Number(v) > 0 ? 1 : 0;
    else if (k === "supportMax") n += Number(v) < 100 ? 1 : 0;
    else n += v !== "" && v != null && Number(v) !== 0 ? 1 : 0;
  }
  return n;
}

export function activeFilterCount(f = {}) {
  return countKeys(f, Object.keys(DEFAULT_VOTER_FILTERS));
}

// ---------- small primitives ----------

function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--fs-border)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 4px", background: "transparent", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
          color: "var(--fs-navy)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {badge > 0 && (
            <span style={{
              background: "var(--fs-gold)", color: "var(--fs-navy-900, #10233a)",
              borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 16, textAlign: "center",
            }}>{badge}</span>
          )}
        </span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {open && <div style={{ padding: "2px 2px 14px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>}
    </div>
  );
}

// Toggle chips for small option sets.
function ChipToggle({ options, value, onChange, labelFor }) {
  const sel = toArr(value);
  const toggle = (opt) => {
    onChange(sel.includes(opt) ? sel.filter((x) => x !== opt) : [...sel, opt]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((opt) => {
        const on = sel.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              padding: "5px 10px", fontSize: 12, borderRadius: 999, cursor: "pointer",
              border: "1px solid " + (on ? "var(--fs-navy)" : "var(--fs-border)"),
              background: on ? "var(--fs-navy)" : "transparent",
              color: on ? "var(--fs-paper)" : "var(--fs-fg-muted)",
              fontWeight: on ? 600 : 500,
            }}
          >
            {labelFor ? labelFor(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

// Searchable multi-select checklist for larger option sets (precincts, cities…).
function SearchSelect({ label, options, value, onChange, placeholder = "Search…", max = 400 }) {
  const [q, setQ] = useState("");
  const sel = toArr(value);
  const opts = useMemo(() => {
    const list = (options || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
    const ql = q.trim().toLowerCase();
    const filtered = ql ? list.filter((o) => o.label.toLowerCase().includes(ql)) : list;
    return filtered.slice(0, max);
  }, [options, q, max]);
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  if (!options || options.length === 0) return null;

  return (
    <div>
      {label && <div className="lbl">{label}</div>}
      {sel.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {sel.map((v) => {
            const o = (options || []).map((x) => (typeof x === "string" ? { value: x, label: x } : x)).find((x) => x.value === v);
            return (
              <span key={v} onClick={() => toggle(v)} style={{
                display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
                background: "var(--fs-navy-100, #e7edf4)", color: "var(--fs-navy)", borderRadius: 4,
                padding: "2px 6px", fontSize: 11, fontWeight: 600,
              }}>
                {o?.label || v} <Icon name="x" size={11} />
              </span>
            );
          })}
        </div>
      )}
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ fontSize: 12 }} />
      {q.trim() && (
        <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 4, border: "1px solid var(--fs-border)", borderRadius: 4 }}>
          {opts.length === 0 && <div className="mut" style={{ fontSize: 12, padding: 8 }}>No matches</div>}
          {opts.map((o) => (
            <label key={o.value} className="row" style={{ fontSize: 12, padding: "5px 8px", cursor: "pointer", gap: 8 }}>
              <input type="checkbox" checked={sel.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RangePair({ label, min, max, minVal, maxVal, step = 1, onMin, onMax, unit = "" }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <input className="input" type="number" placeholder={String(min)} value={minVal} min={min} max={max} step={step}
          onChange={(e) => onMin(e.target.value)} style={{ fontSize: 12 }} />
        <span className="mut" style={{ fontSize: 12 }}>to</span>
        <input className="input" type="number" placeholder={String(max) + unit} value={maxVal} min={min} max={max} step={step}
          onChange={(e) => onMax(e.target.value)} style={{ fontSize: 12 }} />
      </div>
    </div>
  );
}

// ---------- main panel ----------

export function VoterFilters({ filters, setFilters, query, setQuery, meta, cuts, onApplyCut, tags = [] }) {
  const facets = meta?.facets || {};
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const f = { ...DEFAULT_VOTER_FILTERS, ...(filters || {}) };

  const precinctOpts = (meta?.precincts || []).map((p) => ({ value: p, label: `Precinct ${p}` }));
  const electionOpts = (facets.elections || []).map((e) => ({ value: e.key, label: e.name }));
  const tagOpts = (tags || []).map((t) => ({ value: t.id, label: t.name }));

  const geoBadge = countKeys(f, ["counties", "cities", "precincts", "senate", "house", "commissioner", "congressional"]);
  const demoBadge = countKeys(f, ["genders", "ethnicities", "languages", "ageMin", "ageMax"]);
  const scoreBadge = countKeys(f, ["turnoutMin", "turnoutMax", "supportMin", "supportMax"]);
  const voteBadge = countKeys(f, ["generalsMin", "primariesMin", "votedElections", "notVotedElections"]);
  const contactBadge = countKeys(f, ["hasPhone", "hasCell", "hasEmail"]);
  const regBadge = countKeys(f, ["status", "regFrom", "regTo"]);
  const tagBadge = countKeys(f, ["tagsInclude", "tagsExclude"]);

  return (
    <div style={{ padding: "6px 14px 14px" }}>
      <div style={{ marginBottom: 4 }}>
        <div className="lbl">Search</div>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ID, or address" />
      </div>

      <Section title="Party" badge={f.parties.length} defaultOpen>
        <ChipToggle options={["D", "R", "I"]} value={f.parties} onChange={(v) => set({ parties: v })} labelFor={(p) => PARTY_LABELS[p]} />
      </Section>

      <Section title="Geography" badge={geoBadge} defaultOpen>
        <SearchSelect label="Precinct" options={precinctOpts} value={f.precincts} onChange={(v) => set({ precincts: v })} placeholder="Search precincts…" />
        <SearchSelect label="City" options={facets.cities} value={f.cities} onChange={(v) => set({ cities: v })} placeholder="Search cities…" />
        {(facets.senate || []).length > 0 && <div><div className="lbl">State Senate</div><ChipToggle options={facets.senate} value={f.senate} onChange={(v) => set({ senate: v })} /></div>}
        {(facets.house || []).length > 0 && <div><div className="lbl">State House</div><ChipToggle options={facets.house} value={f.house} onChange={(v) => set({ house: v })} /></div>}
        {(facets.commissioner || []).length > 0 && <div><div className="lbl">Commissioner</div><ChipToggle options={facets.commissioner} value={f.commissioner} onChange={(v) => set({ commissioner: v })} /></div>}
        <SearchSelect label="County" options={meta?.counties} value={f.counties} onChange={(v) => set({ counties: v })} placeholder="Search counties…" />
      </Section>

      <Section title="Demographics" badge={demoBadge}>
        <div><div className="lbl">Gender</div><ChipToggle options={facets.genders || ["M", "F", "U"]} value={f.genders} onChange={(v) => set({ genders: v })} labelFor={(g) => GENDER_LABELS[g] || g} /></div>
        <RangePair label="Age" min={18} max={110} minVal={f.ageMin} maxVal={f.ageMax} onMin={(v) => set({ ageMin: v })} onMax={(v) => set({ ageMax: v })} />
        {(facets.ethnicities || []).length > 0 && <div><div className="lbl">Ethnicity (modeled)</div><ChipToggle options={facets.ethnicities} value={f.ethnicities} onChange={(v) => set({ ethnicities: v })} /></div>}
        {(facets.languages || []).length > 0 && <SearchSelect label="Language" options={facets.languages} value={f.languages} onChange={(v) => set({ languages: v })} placeholder="Search languages…" />}
      </Section>

      <Section title="Registration & Status" badge={regBadge}>
        <div>
          <div className="lbl">Status</div>
          <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="All">All</option>
            <option value="A">Active</option>
            <option value="I">Inactive</option>
          </select>
        </div>
        <div>
          <div className="lbl">Registered between</div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input className="input" type="date" value={f.regFrom} onChange={(e) => set({ regFrom: e.target.value })} style={{ fontSize: 12 }} />
            <span className="mut" style={{ fontSize: 12 }}>–</span>
            <input className="input" type="date" value={f.regTo} onChange={(e) => set({ regTo: e.target.value })} style={{ fontSize: 12 }} />
          </div>
        </div>
      </Section>

      <Section title="Scores" badge={scoreBadge}>
        <div>
          <div className="lbl">Turnout score {f.turnoutMin}–{f.turnoutMax}</div>
          <input type="range" min={0} max={100} step={5} value={f.turnoutMin} onChange={(e) => set({ turnoutMin: +e.target.value })} style={{ width: "100%" }} />
          <input type="range" min={0} max={100} step={5} value={f.turnoutMax} onChange={(e) => set({ turnoutMax: +e.target.value })} style={{ width: "100%" }} />
        </div>
        <div>
          <div className="lbl">Support score {f.supportMin}–{f.supportMax}</div>
          <input type="range" min={0} max={100} step={5} value={f.supportMin} onChange={(e) => set({ supportMin: +e.target.value })} style={{ width: "100%" }} />
          <input type="range" min={0} max={100} step={5} value={f.supportMax} onChange={(e) => set({ supportMax: +e.target.value })} style={{ width: "100%" }} />
        </div>
      </Section>

      <Section title="Vote History" badge={voteBadge}>
        <RangePair label="Generals voted (of last 5) — min" min={0} max={5} minVal={f.generalsMin || ""} maxVal={""} onMin={(v) => set({ generalsMin: Number(v) || 0 })} onMax={() => {}} />
        <div style={{ marginTop: -4 }}>
          <div className="lbl">Primaries voted — min</div>
          <input className="input" type="number" min={0} max={4} value={f.primariesMin || ""} onChange={(e) => set({ primariesMin: Number(e.target.value) || 0 })} style={{ fontSize: 12 }} />
        </div>
        <SearchSelect label="Voted in" options={electionOpts} value={f.votedElections} onChange={(v) => set({ votedElections: v })} placeholder="Search elections…" />
        <SearchSelect label="Did NOT vote in" options={electionOpts} value={f.notVotedElections} onChange={(v) => set({ notVotedElections: v })} placeholder="Search elections…" />
      </Section>

      <Section title="Contact info" badge={contactBadge}>
        <label className="row" style={{ fontSize: 13, gap: 8 }}><input type="checkbox" checked={f.hasCell} onChange={(e) => set({ hasCell: e.target.checked })} /> Has cell phone</label>
        <label className="row" style={{ fontSize: 13, gap: 8 }}><input type="checkbox" checked={f.hasPhone} onChange={(e) => set({ hasPhone: e.target.checked })} /> Has any phone</label>
        <label className="row" style={{ fontSize: 13, gap: 8 }}><input type="checkbox" checked={f.hasEmail} onChange={(e) => set({ hasEmail: e.target.checked })} /> Has email</label>
      </Section>

      {tagOpts.length > 0 && (
        <Section title="Tags" badge={tagBadge}>
          <SearchSelect label="Has any of" options={tagOpts} value={f.tagsInclude} onChange={(v) => set({ tagsInclude: v })} placeholder="Search tags…" />
          <SearchSelect label="Excludes" options={tagOpts} value={f.tagsExclude} onChange={(v) => set({ tagsExclude: v })} placeholder="Search tags…" />
        </Section>
      )}

      {cuts?.length > 0 && (
        <Section title="Saved universes" badge={0}>
          {cuts.slice(0, 8).map((s) => (
            <button key={s.id} type="button" className="btn ghost sm" style={{ justifyContent: "space-between" }} onClick={() => onApplyCut?.(s)}>
              {s.name} <span className="num mut">{(s.count || 0).toLocaleString()}</span>
            </button>
          ))}
        </Section>
      )}
    </div>
  );
}

// Human-readable one-line summary of the active filter set.
export function filtersSummary(filters = {}) {
  const f = { ...DEFAULT_VOTER_FILTERS, ...(filters || {}) };
  const parts = [];
  if (f.parties.length) parts.push("party " + f.parties.join("/"));
  if (f.precincts.length) parts.push(f.precincts.length + " precinct" + (f.precincts.length > 1 ? "s" : ""));
  if (f.cities.length) parts.push(f.cities.join(", "));
  if (f.senate.length) parts.push(f.senate.join("/"));
  if (f.house.length) parts.push(f.house.join("/"));
  if (f.counties.length) parts.push(f.counties.join(", "));
  if (f.genders.length) parts.push(f.genders.map((g) => GENDER_LABELS[g] || g).join("/"));
  if (f.ethnicities.length) parts.push(f.ethnicities.join("/"));
  if (f.languages.length) parts.push(f.languages.join("/"));
  if (f.ageMin || f.ageMax) parts.push("age " + (f.ageMin || "18") + "–" + (f.ageMax || "110"));
  if (f.status && f.status !== "All") parts.push(f.status === "A" ? "active" : "inactive");
  if (f.regFrom || f.regTo) parts.push("reg " + (f.regFrom || "…") + "→" + (f.regTo || "…"));
  if (Number(f.turnoutMin) > 0 || Number(f.turnoutMax) < 100) parts.push("turnout " + f.turnoutMin + "–" + f.turnoutMax);
  if (Number(f.supportMin) > 0 || Number(f.supportMax) < 100) parts.push("support " + f.supportMin + "–" + f.supportMax);
  if (f.generalsMin > 0) parts.push(f.generalsMin + "+ generals");
  if (f.primariesMin > 0) parts.push(f.primariesMin + "+ primaries");
  if (f.votedElections.length) parts.push("voted " + f.votedElections.length + " elec");
  if (f.notVotedElections.length) parts.push("skipped " + f.notVotedElections.length + " elec");
  if (f.hasCell) parts.push("has cell");
  if (f.hasPhone) parts.push("has phone");
  if (f.hasEmail) parts.push("has email");
  if (f.tagsInclude.length) parts.push(f.tagsInclude.length + " tag");
  if (f.tagsExclude.length) parts.push("−" + f.tagsExclude.length + " tag");
  return parts.length ? parts.join(" · ") : "All voters";
}
