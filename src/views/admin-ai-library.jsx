import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/ui.jsx";

/**
 * Admin → AI Library: upload finished proposals; Claude distills each one in
 * the background and keeps a firm "playbook" that all AI drafting learns from.
 * Talks to the staff-gated AI API under /proposals/app/api (not /api).
 */
async function libApi(path, options = {}) {
  const res = await fetch("/proposals/app/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!res.ok) throw new Error(data?.error || res.statusText || "Request failed");
  return data;
}

const STATUS_LABELS = {
  pending: { label: "Queued", color: "var(--fs-mut, #8a8574)" },
  processing: { label: "Learning…", color: "var(--fs-gold-700, #96731f)" },
  ready: { label: "Learned", color: "var(--fs-green, #1b7f4b)" },
  error: { label: "Failed", color: "var(--fs-red, #b3261e)" },
};

export function AdminAiLibraryTab({ onFlash }) {
  const [items, setItems] = useState(null);
  const [playbook, setPlaybook] = useState(null);
  const [file, setFile] = useState(null); // { name, base64 }
  const [pasted, setPasted] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const r = await libApi("/ai/library");
      setItems(r.items || []);
      setPlaybook(r.playbook || null);
      return r.items || [];
    } catch (e) {
      if (items == null) setItems([]);
      return [];
    }
  };

  // Load once, then poll every 5s while anything is queued/processing so
  // "Learning…" flips to "Learned" without a manual refresh.
  useEffect(() => {
    load();
    pollRef.current = setInterval(async () => {
      const current = await load();
      if (!current.some((i) => i.status === "pending" || i.status === "processing")) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const current = await load();
      if (!current.some((i) => i.status === "pending" || i.status === "processing")) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 5000);
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf") return onFlash("Please choose a PDF file");
    if (f.size > 15 * 1024 * 1024) return onFlash("PDF too large (15 MB max)");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      setFile({ name: f.name, base64 });
    };
    reader.readAsDataURL(f);
  };

  const upload = async (e) => {
    e.preventDefault();
    if (uploading || (!file && pasted.trim().length < 200)) return;
    setUploading(true);
    try {
      await libApi("/ai/library", {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: file?.base64 || undefined,
          mediaType: file ? "application/pdf" : undefined,
          fileName: file?.name || undefined,
          text: file ? undefined : pasted,
          title: title.trim() || undefined,
        }),
      });
      setFile(null);
      setPasted("");
      setTitle("");
      onFlash("Proposal added — Claude is learning from it in the background");
      await load();
      startPolling();
    } catch (err) {
      onFlash(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reprocess = async (id) => {
    try {
      await libApi(`/ai/library/${id}/reprocess`, { method: "POST" });
      onFlash("Re-queued for learning");
      await load();
      startPolling();
    } catch (err) {
      onFlash(err?.message || "Could not re-queue");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.title || item.fileName || "this proposal"}" from the library? The playbook will be rebuilt without it.`)) return;
    try {
      await libApi(`/ai/library/${item.id}`, { method: "DELETE" });
      onFlash("Removed from library");
      load();
    } catch (err) {
      onFlash(err?.message || "Could not remove");
    }
  };

  if (items == null) return <div className="card card-pad mut">Loading AI library…</div>;

  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <div className="col" style={{ gap: 16, maxWidth: 860 }}>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Upload finished proposals and Claude studies them in the background — structure, voice,
        winning language, pricing framing. Everything it learns is distilled into a firm playbook
        that automatically guides every future AI draft, chat answer, and rewrite. The more you add,
        the better the drafts get. Processing counts toward the monthly AI budget.
      </p>

      {/* Upload */}
      <form className="card card-pad col" style={{ gap: 12 }} onSubmit={upload}>
        <h3 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 15 }}>Add a finished proposal</h3>
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={pickFile} />
          <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {file ? `PDF: ${file.name}` : "Choose PDF…"}
          </button>
          {file && (
            <button type="button" className="btn secondary" onClick={() => setFile(null)} disabled={uploading}>
              Clear
            </button>
          )}
          <span className="mut" style={{ fontSize: 12.5 }}>or paste the proposal text below</span>
        </div>
        {!file && (
          <textarea
            className="input"
            rows={4}
            placeholder="Paste the full proposal text here (at least a few paragraphs)…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={uploading}
          />
        )}
        <div className="field" style={{ margin: 0, maxWidth: 420 }}>
          <label>Title <span className="mut" style={{ fontWeight: 400 }}>(optional — Claude fills it in)</span></label>
          <input className="input" placeholder="e.g. D11 Bond Communications Proposal" value={title}
            onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
        </div>
        <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}
          disabled={uploading || (!file && pasted.trim().length < 200)}>
          <Icon name="check" size={13} /> {uploading ? "Uploading…" : "Add to library"}
        </button>
      </form>

      {/* Playbook status */}
      <div className="card card-pad col" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 15 }}>What Claude has learned</h3>
          <span style={{
            fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
            border: `1px solid ${playbook ? "var(--fs-gold, #b98a2f)" : "var(--fs-line, #d8d4c8)"}`,
            background: playbook ? "var(--fs-bone-50, #f4f1ea)" : "transparent",
            color: playbook ? "var(--fs-navy)" : "var(--fs-mut, #8a8574)",
          }}>
            {playbook ? `Playbook active · ${playbook.sourceCount} proposal${playbook.sourceCount === 1 ? "" : "s"}` : "No playbook yet"}
          </span>
        </div>
        {playbook ? (
          <>
            <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
              Last updated {new Date(playbook.updatedAt).toLocaleString()}. This playbook is injected
              into every AI draft, chat, and rewrite automatically.
            </p>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fs-navy)" }}>View the playbook</summary>
              <pre style={{
                whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.55,
                background: "var(--fs-bone-50, #f4f1ea)", borderRadius: 8, padding: 12, marginTop: 8, maxHeight: 360, overflowY: "auto",
              }}>{playbook.text}</pre>
            </details>
          </>
        ) : (
          <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
            Add your first finished proposal above — once it's processed, the playbook appears here
            {readyCount ? "" : " and starts improving AI drafts immediately"}.
          </p>
        )}
      </div>

      {/* Library list */}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Proposal</th><th>Client type</th><th>Status</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {items.map((it) => {
              const s = STATUS_LABELS[it.status] || STATUS_LABELS.pending;
              return (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{it.title || it.fileName || "Untitled"}</div>
                    {it.agency && <div className="mut" style={{ fontSize: 12 }}>{it.agency}</div>}
                    {it.status === "error" && it.error && (
                      <div style={{ fontSize: 12, color: "var(--fs-red, #b3261e)", marginTop: 2 }}>{it.error}</div>
                    )}
                  </td>
                  <td className="mut">{it.clientType || "—"}</td>
                  <td>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: s.color }}>
                      {s.label}
                    </span>
                  </td>
                  <td className="mut" style={{ whiteSpace: "nowrap" }}>{String(it.createdAt).slice(0, 10)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {it.status === "error" && (
                      <button type="button" className="btn secondary" style={{ marginRight: 6 }} onClick={() => reprocess(it.id)}>
                        Retry
                      </button>
                    )}
                    <button type="button" className="btn secondary" onClick={() => remove(it)}>Remove</button>
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr><td colSpan={5} className="mut" style={{ textAlign: "center", padding: 24 }}>
                No proposals in the library yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
