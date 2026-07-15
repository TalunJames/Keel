import React, { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Icon, Tag, Stat } from "../components/ui.jsx";
import { voterApi } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { createKeelMapStyle, PARTY_COLORS } from "../lib/map-style.js";
import { useModalA11y } from "../lib/useModalA11y.js";

const PARTY_LABEL = { D: "Democrat", R: "Republican", I: "Unaffiliated / Other" };

function Field({ label, value }) {
  return (
    <div>
      <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fs-navy)", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function MiniMap({ lat, lng, party }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!ref.current || mapRef.current || lat == null || lng == null) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: createKeelMapStyle(),
      center: [lng, lat],
      zoom: 15,
      interactive: true,
      attributionControl: false,
    });
    mapRef.current = map;
    const el = document.createElement("div");
    el.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${PARTY_COLORS[party] || PARTY_COLORS.I}`;
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, [lat, lng, party]);
  if (lat == null || lng == null) {
    return <div className="mut" style={{ fontSize: 12, padding: 16, textAlign: "center" }}>No geocoded location.</div>;
  }
  return <div ref={ref} style={{ height: 180, borderRadius: 6, overflow: "hidden" }} />;
}

export function VoterDetail({ clientId, voterId, tags = [], onClose, onOpenVoter, onChanged }) {
  const dialogRef = useModalA11y(onClose);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bioDraft, setBioDraft] = useState("");
  const [bioDirty, setBioDirty] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    voterApi.person(voterId, clientId)
      .then((r) => { setPerson(r.person); setBioDraft(r.person.bio || ""); setBioDirty(false); })
      .catch(() => setPerson(null))
      .finally(() => setLoading(false));
  }, [voterId, clientId]);

  useEffect(() => { load(); }, [load]);

  const personTagIds = new Set((person?.tags || []).map((t) => t.id));

  const toggleTag = async (tag) => {
    if (!person) return;
    setBusy(true);
    try {
      await voterApi.assignTag(tag.id, { clientId, voterIds: [person.id], remove: personTagIds.has(tag.id) });
      load();
      onChanged?.();
    } finally { setBusy(false); }
  };

  const saveBio = async () => {
    setBusy(true);
    try { await voterApi.saveBio(person.id, { clientId, bio: bioDraft }); setBioDirty(false); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!noteDraft.trim()) return;
    setBusy(true);
    try { await voterApi.addNote(person.id, { clientId, body: noteDraft.trim() }); setNoteDraft(""); load(); }
    finally { setBusy(false); }
  };

  const delNote = async (noteId) => {
    setBusy(true);
    try { await voterApi.deleteNote(person.id, noteId); load(); }
    finally { setBusy(false); }
  };

  const voted = person?.voteHistory?.filter((h) => h.voted).length || 0;
  const totalElections = person?.voteHistory?.length || 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(26,58,92,0.45)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Voter detail"
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 520, maxWidth: "94vw", height: "100%", borderRadius: 0, overflowY: "auto", padding: 0 }}
      >
        {loading ? <div style={{ padding: 40 }}><Loading /></div> : !person ? (
          <div style={{ padding: 40 }}>
            <div className="row between"><h3 style={{ margin: 0 }}>Voter not found</h3><button className="btn ghost sm" onClick={onClose}><Icon name="x" size={16} /></button></div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--fs-border)", position: "sticky", top: 0, background: "var(--fs-paper)", zIndex: 2 }}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 22 }}>{person.name}</h2>
                  <div className="mut" style={{ fontSize: 12, marginTop: 2 }}>Voter ID {person.stateVoterId || person.id}</div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <Tag style={{ background: PARTY_COLORS[person.party], color: "#fff" }}>{PARTY_LABEL[person.party] || person.party}</Tag>
                    <Tag>{person.status === "A" ? "Active" : person.status === "I" ? "Inactive" : person.status}</Tag>
                  </div>
                </div>
                <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
              </div>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Scores */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                <div className="card card-pad"><Stat figure={String(person.turnoutScore ?? "—")} label="Turnout score" /></div>
                <div className="card card-pad"><Stat figure={String(person.supportScore ?? "—")} label="Support score" gold /></div>
                <div className="card card-pad"><Stat figure={`${voted}/${totalElections}`} label="Elections voted" /></div>
              </div>

              {/* Core fields */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Profile</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Field label="Age / DOB year" value={person.age ? `${person.age} (${person.birthYear})` : "—"} />
                  <Field label="Gender" value={{ M: "Male", F: "Female", U: "Unknown" }[person.gender] || person.gender} />
                  <Field label="Registered" value={person.registrationDate} />
                  <Field label="Ethnicity (modeled)" value={person.ethnicity} />
                  <Field label="Language" value={person.language} />
                  <Field label="Address" value={person.address ? `${person.address}, ${person.city} ${person.zip}` : "—"} />
                  <Field label="Cell / phone" value={person.cellPhone || person.phone} />
                  <Field label="Email" value={person.email} />
                </div>
              </div>

              {/* Districts */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Districts</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Field label="County" value={person.county} />
                  <Field label="Precinct" value={person.precinct} />
                  <Field label="Congressional" value={person.congressional} />
                  <Field label="State Senate" value={person.senate} />
                  <Field label="State House" value={person.house} />
                  <Field label="Commissioner" value={person.commissioner} />
                </div>
              </div>

              {/* Map */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Location</div>
                <MiniMap lat={person.lat} lng={person.lng} party={person.party} />
              </div>

              {/* Tags */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Tags</div>
                {tags.length === 0 ? <div className="mut" style={{ fontSize: 12 }}>No tags defined yet. Create tags from the Tags tab.</div> : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tags.map((t) => {
                      const on = personTagIds.has(t.id);
                      return (
                        <button key={t.id} type="button" disabled={busy} onClick={() => toggleTag(t)} style={{
                          padding: "4px 10px", fontSize: 12, borderRadius: 999, cursor: "pointer",
                          border: "1px solid " + t.color,
                          background: on ? t.color : "transparent",
                          color: on ? "#fff" : t.color, fontWeight: 600,
                        }}>
                          {on ? "✓ " : "+ "}{t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vote history */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Vote history</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {person.voteHistory.map((h) => (
                    <div key={h.key} className="row between" style={{ fontSize: 12, padding: "6px 8px", borderRadius: 4, background: h.voted ? "rgba(108,139,75,0.10)" : "transparent" }}>
                      <span className="row" style={{ gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.voted ? "#6C8B4B" : "var(--fs-border)" }} />
                        {h.name}
                      </span>
                      <span className="mut" style={{ textTransform: "capitalize" }}>{h.voted ? (h.method || "voted") : "did not vote"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Household */}
              {person.household.length > 0 && (
                <div>
                  <div className="lbl" style={{ marginBottom: 8 }}>Household ({person.household.length + 1})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {person.household.map((h) => (
                      <button key={h.id} type="button" className="btn ghost sm" style={{ justifyContent: "space-between" }}
                        onClick={() => onOpenVoter?.(h.state_voter_id || h.id)}>
                        <span>{[h.first_name, h.last_name].join(" ")}</span>
                        <span className="mut">{h.party} · {h.age}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bio */}
              <div>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="lbl">Bio</div>
                  {bioDirty && <button className="btn primary sm" disabled={busy} onClick={saveBio}>Save bio</button>}
                </div>
                <textarea className="input" rows={4} value={bioDraft} placeholder="Add a longer profile / background for this voter…"
                  onChange={(e) => { setBioDraft(e.target.value); setBioDirty(true); }} style={{ resize: "vertical", fontSize: 13 }} />
              </div>

              {/* Notes */}
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>Notes</div>
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <input className="input" value={noteDraft} placeholder="Add a timestamped note…" onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
                  <button className="btn secondary sm" disabled={busy || !noteDraft.trim()} onClick={addNote}>Add</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {person.notes.length === 0 && <div className="mut" style={{ fontSize: 12 }}>No notes yet.</div>}
                  {person.notes.map((n) => (
                    <div key={n.id} className="card card-pad" style={{ fontSize: 13 }}>
                      <div className="row between">
                        <span className="mut" style={{ fontSize: 11 }}>{n.author} · {String(n.createdAt).slice(0, 16).replace("T", " ")}</span>
                        <button className="btn ghost sm" onClick={() => delNote(n.id)} aria-label="Delete note"><Icon name="x" size={13} /></button>
                      </div>
                      <div style={{ marginTop: 4 }}>{n.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
