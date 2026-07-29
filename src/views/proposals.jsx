import React, { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Full-screen embed of the Fog Signal proposal builder (vendored under /proposals/app).
 * Auth, team, clients, and workspace settings are wired through keel-bridge.js + proposals-app-routes.
 *
 * While a document (or workspace admin) is open inside the iframe, notify the Keel shell so it can
 * hide the global top bar — the editor already has its own chrome.
 */
function isImmersiveHash(hash) {
  const h = String(hash || "");
  return /^#doc\//.test(h) || h === "#admin";
}

export function ProposalsView({ clientId, deepLinkId, onEditorModeChange }) {
  const iframeRef = useRef(null);
  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId && clientId !== "all") params.set("clientId", clientId);
    const q = params.toString();
    const base = `/proposals/app/${q ? `?${q}` : ""}`;
    return deepLinkId ? `${base}#doc/${encodeURIComponent(deepLinkId)}` : base;
  }, [clientId, deepLinkId]);

  const report = useCallback((open) => {
    onEditorModeChange?.(!!open);
  }, [onEditorModeChange]);

  /* Deep-linked opens should hide the Keel top bar immediately, before iframe load. */
  useEffect(() => {
    report(!!deepLinkId);
  }, [deepLinkId, report]);

  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || data.source !== "keel-proposals" || data.type !== "view") return;
      report(data.view === "editor" || data.view === "admin");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [report]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const syncFromHash = () => {
      try {
        report(isImmersiveHash(iframe.contentWindow?.location?.hash));
      } catch {
        /* ignore cross-origin */
      }
    };

    const onLoad = () => {
      syncFromHash();
      try {
        iframe.contentWindow?.addEventListener("hashchange", syncFromHash);
      } catch {
        /* ignore */
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      try {
        iframe.contentWindow?.removeEventListener("hashchange", syncFromHash);
      } catch {
        /* ignore */
      }
    };
  }, [src, report]);

  /* Leaving the proposals section restores the Keel top bar. */
  useEffect(() => () => report(false), [report]);

  return (
    <div className="proposals-embed-wrap">
      <iframe
        ref={iframeRef}
        title="Proposal builder"
        src={src}
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#f7f6f2",
        }}
      />
    </div>
  );
}
