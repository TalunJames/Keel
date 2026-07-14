import React, { useEffect, useState } from "react";
import { Icon } from "../components/ui.jsx";
import { api } from "../lib/api.js";

/**
 * Admin → Integrations: enter API keys / connection secrets once, server-side.
 * Values are write-only — the server returns a masked preview, never the key.
 */
export function AdminIntegrationsTab({ onFlash }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    api("/admin/integrations")
      .then((r) => setItems(r.integrations || []))
      .catch((e) => setError(e?.message || "Could not load integrations"));
  };
  useEffect(load, []);

  if (error) return <div className="card card-pad" style={{ color: "var(--fs-red, #b3261e)" }}>{error}</div>;
  if (!items) return <div className="card card-pad mut">Loading integrations…</div>;

  return (
    <div className="col" style={{ gap: 16, maxWidth: 680 }}>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Keys entered here are stored on the server, apply immediately, and are shared by the whole
        workspace — no restart or .env edit needed. Keys are never shown again after saving; only
        the last 4 characters are displayed.
      </p>
      <AiBudgetCard onFlash={onFlash} />
      {items.map((it) => (
        <IntegrationCard key={it.key} item={it} onChanged={setItems} onFlash={onFlash} />
      ))}
    </div>
  );
}

/** Monthly AI spend limit — enforced server-side before every AI call. */
function AiBudgetCard({ onFlash }) {
  const [budget, setBudget] = useState(null); // server state
  const [enabled, setEnabled] = useState(true);
  const [monthlyUsd, setMonthlyUsd] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/admin/ai-budget")
      .then((b) => {
        setBudget(b);
        setEnabled(!!b.enabled);
        setMonthlyUsd(b.monthlyUsd ?? 30);
      })
      .catch(() => setBudget({ error: true }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const b = await api("/admin/ai-budget", {
        method: "PUT",
        body: JSON.stringify({ enabled, monthlyUsd: Number(monthlyUsd) }),
      });
      setBudget(b);
      setEnabled(!!b.enabled);
      setMonthlyUsd(b.monthlyUsd);
      onFlash(b.enabled ? `AI budget locked at $${b.monthlyUsd}/month` : "AI budget limit disabled");
    } catch (err) {
      onFlash(err?.message || "Could not save AI budget");
    } finally {
      setBusy(false);
    }
  };

  if (!budget) return <div className="card card-pad mut">Loading AI budget…</div>;
  if (budget.error) return null;

  const spent = budget.spentUsd ?? 0;
  const pct = enabled && monthlyUsd > 0 ? Math.min(100, (spent / monthlyUsd) * 100) : 0;
  const overBudget = enabled && spent >= monthlyUsd;

  return (
    <form className="card card-pad col" style={{ gap: 12 }} onSubmit={save}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 15 }}>Monthly AI spend limit</h3>
        <span style={{
          fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap",
          border: `1px solid ${overBudget ? "var(--fs-red, #b3261e)" : enabled ? "var(--fs-gold, #b98a2f)" : "var(--fs-line, #d8d4c8)"}`,
          color: overBudget ? "var(--fs-red, #b3261e)" : enabled ? "var(--fs-navy)" : "var(--fs-mut, #8a8574)",
          background: enabled ? "var(--fs-bone-50, #f4f1ea)" : "transparent",
        }}>
          {overBudget ? "Limit reached — AI paused" : enabled ? `Locked at $${budget.monthlyUsd}/mo` : "No limit"}
        </span>
      </div>
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
        When the workspace's estimated Claude spend for the calendar month reaches this amount, all
        AI features pause until the limit is raised or the month rolls over. Estimated spend this
        month: <strong>${spent.toFixed(2)}</strong>{enabled ? ` of $${budget.monthlyUsd}` : ""}.
      </p>

      {enabled && (
        <div style={{ height: 6, borderRadius: 999, background: "var(--fs-bone-50, #f4f1ea)", overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 999,
            background: overBudget ? "var(--fs-red, #b3261e)" : "var(--fs-gold, #b98a2f)",
            transition: "width 200ms ease",
          }} />
        </div>
      )}

      <label className="row" style={{ gap: 8, fontSize: 13, alignItems: "center" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enforce a monthly limit
      </label>

      <div className={"row" + (!enabled ? " disabled-fields" : "")} style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={Math.min(200, Math.max(5, Number(monthlyUsd) || 5))}
          onChange={(e) => setMonthlyUsd(Number(e.target.value))}
          disabled={!enabled || busy}
          style={{ flex: "1 1 220px", accentColor: "var(--fs-gold, #b98a2f)" }}
        />
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--fs-navy)" }}>$</span>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            value={monthlyUsd}
            onChange={(e) => setMonthlyUsd(e.target.value)}
            disabled={!enabled || busy}
            style={{ width: 90 }}
          />
          <span className="mut" style={{ fontSize: 12.5 }}>/ month</span>
        </div>
      </div>

      <button type="submit" className="btn primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
        <Icon name="check" size={13} /> Save limit
      </button>
    </form>
  );
}

function IntegrationCard({ item, onChanged, onFlash }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  const save = async (e) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setTestResult(null);
    try {
      const r = await api(`/admin/integrations/${item.key}`, {
        method: "PUT",
        body: JSON.stringify({ value: value.trim() }),
      });
      onChanged(r.integrations || []);
      setValue("");
      onFlash(`${item.label} saved`);
    } catch (err) {
      onFlash(err?.message || "Could not save key");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    if (!window.confirm(`Remove the saved ${item.label}? ${item.source === "settings" && item.envVar ? "If the server environment also sets " + item.envVar + ", that value will be used instead." : "The integration will be disabled."}`)) return;
    setBusy(true);
    setTestResult(null);
    try {
      const r = await api(`/admin/integrations/${item.key}`, { method: "DELETE" });
      onChanged(r.integrations || []);
      onFlash(`${item.label} removed`);
    } catch (err) {
      onFlash(err?.message || "Could not remove key");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy(true);
    setTestResult(null);
    try {
      const r = await api(`/admin/integrations/${item.key}/test`, { method: "POST" });
      setTestResult({ ok: true, message: r.message || "Connection OK" });
    } catch (err) {
      setTestResult({ ok: false, message: err?.message || "Connection test failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-pad col" style={{ gap: 10 }} onSubmit={save}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "var(--fs-navy)", fontSize: 15 }}>{item.label}</h3>
        <StatusChip item={item} />
      </div>
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>{item.help}</p>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          style={{ flex: "1 1 260px" }}
          placeholder={item.configured ? `Current: ${item.preview} — paste a new value to replace` : item.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn primary" disabled={busy || !value.trim()}>
          <Icon name="check" size={13} /> Save
        </button>
        {item.testable && item.configured && (
          <button type="button" className="btn secondary" disabled={busy} onClick={test}>
            Test connection
          </button>
        )}
        {item.source === "settings" && (
          <button type="button" className="btn secondary" disabled={busy} onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {testResult && (
        <div style={{ fontSize: 12.5, color: testResult.ok ? "var(--fs-green, #1b7f4b)" : "var(--fs-red, #b3261e)" }}>
          {testResult.message}
        </div>
      )}
      {item.source === "env" && (
        <div className="mut" style={{ fontSize: 12 }}>
          Currently using the server environment variable <code>{item.envVar}</code>. Saving a value
          here overrides it.
        </div>
      )}
    </form>
  );
}

function StatusChip({ item }) {
  const cfg = item.configured;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: cfg ? "var(--fs-bone-50, #f4f1ea)" : "transparent",
        border: `1px solid ${cfg ? "var(--fs-gold, #b98a2f)" : "var(--fs-line, #d8d4c8)"}`,
        color: cfg ? "var(--fs-navy)" : "var(--fs-mut, #8a8574)",
      }}
    >
      {cfg ? (item.source === "env" ? "Configured (env)" : `Configured ${item.preview}`) : "Not configured"}
    </span>
  );
}
