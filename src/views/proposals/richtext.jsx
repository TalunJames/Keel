import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui.jsx";

// Mirror of the server-side allowlist in proposal-routes.js — keep in sync.
const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li",
  "a", "h1", "h2", "h3", "blockquote", "span",
]);

export function sanitizeHtml(html) {
  if (!html) return "";
  let out = String(html).replace(/<(script|style|iframe|object|embed|svg)[\s\S]*?(<\/\1>|$)/gi, "");
  out = out.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    if (m.startsWith("</")) return `</${t}>`;
    if (t === "a") {
      const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs || "");
      const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
      const safe = /^(https?:|mailto:)/i.test(href) ? href : "#";
      return `<a href="${safe.replace(/"/g, "&quot;")}" rel="noopener noreferrer">`;
    }
    return `<${t}>`;
  });
  return out;
}

export function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html || "");
  return div.textContent || "";
}

const TOOLS = [
  { cmd: "bold", label: <b>B</b>, title: "Bold (⌘B)" },
  { cmd: "italic", label: <i>I</i>, title: "Italic (⌘I)" },
  { cmd: "underline", label: <u>U</u>, title: "Underline (⌘U)" },
  { cmd: "insertUnorderedList", label: "•—", title: "Bulleted list" },
  { cmd: "insertOrderedList", label: "1.", title: "Numbered list" },
  { cmd: "link", label: "⎘", title: "Link" },
  { cmd: "removeFormat", label: "⌫", title: "Clear formatting" },
];

/**
 * Lightweight rich-text editor: contentEditable + floating toolbar on selection.
 * Value is an HTML string (sanitized here on render and again server-side).
 */
export function RichText({ value, onChange, readOnly, style, placeholder = "Start writing…" }) {
  const wrapRef = useRef(null);
  const editorRef = useRef(null);
  const [bar, setBar] = useState(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const clean = sanitizeHtml(value || "");
    if (document.activeElement !== el && el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
  }, [value]);

  if (readOnly) {
    return (
      <div
        className="richtext"
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || "") }}
      />
    );
  }

  const updateToolbar = () => {
    const el = editorRef.current;
    const wrap = wrapRef.current;
    const sel = window.getSelection();
    if (!el || !wrap || !sel || sel.rangeCount === 0 || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      setBar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    setBar({
      top: rect.top - wrapRect.top - 38,
      left: Math.max(0, rect.left - wrapRect.left + rect.width / 2),
    });
  };

  const exec = (cmd) => {
    if (cmd === "link") {
      const url = window.prompt("Link URL (https://…)");
      if (url && /^(https?:|mailto:)/i.test(url)) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    editorRef.current?.focus();
    onChange?.(editorRef.current?.innerHTML || "");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {bar && (
        <div
          className="richtext-toolbar"
          style={{ top: bar.top, left: bar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {TOOLS.map((t) => (
            <button key={t.cmd} type="button" title={t.title} onClick={() => exec(t.cmd)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={editorRef}
        className="richtext richtext-editable"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={style}
        onInput={() => onChange?.(editorRef.current?.innerHTML || "")}
        onKeyUp={updateToolbar}
        onMouseUp={updateToolbar}
        onBlur={() => setTimeout(() => setBar(null), 150)}
      />
    </div>
  );
}

/** Inline "+" affordance between blocks that opens a searchable block menu. */
export function InsertMenu({ grouped, onInsert, compact }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const query = q.trim().toLowerCase();
  const flat = Object.entries(grouped).flatMap(([group, items]) =>
    items
      .filter((b) => !query || b.label.toLowerCase().includes(query) || group.toLowerCase().includes(query))
      .map((b) => ({ ...b, group }))
  );

  const pick = (type) => {
    setOpen(false);
    setQ("");
    onInsert(type);
  };

  return (
    <div ref={rootRef} className={"insert-zone" + (compact ? " compact" : "") + (open ? " open" : "")}>
      <div className="insert-line" />
      <button
        type="button"
        className="insert-btn"
        title="Insert block here"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="plus" size={12} />
        {compact ? null : <span>Add block</span>}
      </button>
      {open && (
        <div className="insert-menu">
          <input
            ref={inputRef}
            className="input"
            placeholder="Search blocks…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && flat.length) pick(flat[0].id);
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="insert-menu-list">
            {flat.map((b, i) => (
              <button key={b.id + i} type="button" onClick={() => pick(b.id)}>
                <Icon name={b.icon} size={13} color="var(--fs-navy)" />
                <span style={{ flex: 1 }}>{b.label}</span>
                <span className="mut" style={{ fontSize: 10 }}>{b.group}</span>
              </button>
            ))}
            {!flat.length && <div className="mut" style={{ padding: 10, fontSize: 12 }}>No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
