import React, { useRef, useState } from "react";
import { Icon, Tag } from "../../components/ui.jsx";
import { triageLabel, triageTone } from "../../lib/proposal-status.js";

function useClickOutside(ref, onClose, open) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref, onClose, open]);
}

function Menu({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="gdocs-menu" ref={ref}>
      <button type="button" className="gdocs-menu-trigger" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div className="gdocs-menu-panel" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, children, onClick, disabled }) {
  return (
    <button type="button" className="gdocs-menu-item" disabled={disabled} onClick={onClick}>
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
    </button>
  );
}

export function DocToolbar({
  title,
  onTitleChange,
  onBack,
  mode,
  onModeChange,
  saving,
  saveError,
  lastSaved,
  words,
  outlineOpen,
  onToggleOutline,
  sideOpen,
  onToggleSide,
  onExport,
  onInsert,
  templates,
  activeTemplateId,
  onApplyTemplate,
  triageState,
  nextStep,
  onAdvanceWorkflow,
  openComments,
  onOpenComments,
}) {
  const saveLabel = saving
    ? "Saving…"
    : saveError
      ? "Save failed"
      : lastSaved
        ? "All changes saved"
        : "";

  return (
    <header className="gdocs-toolbar">
      <div className="gdocs-toolbar-row gdocs-toolbar-main">
        <div className="gdocs-toolbar-left">
          <button type="button" className="gdocs-icon-btn" onClick={onBack} title="Back to proposals">
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="gdocs-doc-icon">
            <Icon name="compass" size={20} color="var(--fs-navy)" />
          </div>
          <div className="gdocs-title-wrap">
            <input
              className="gdocs-title-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled proposal"
              aria-label="Document title"
            />
            <div className="gdocs-title-meta">
              {saveLabel && <span className={saveError ? "gdocs-save-err" : "gdocs-save-ok"}>{saveLabel}</span>}
              {words > 0 && <span>{words.toLocaleString()} words</span>}
              {triageState && <Tag tone={triageTone(triageState)}>{triageLabel(triageState)}</Tag>}
            </div>
          </div>
        </div>

        <div className="gdocs-toolbar-right">
          <div className="gdocs-mode-pill" role="group" aria-label="Editing mode">
            <button type="button" className={mode === "edit" ? "on" : ""} onClick={() => onModeChange("edit")}>Editing</button>
            <button type="button" className={mode === "suggest" ? "on" : ""} onClick={() => onModeChange("suggest")}>Suggesting</button>
          </div>
          <button
            type="button"
            className={"gdocs-icon-btn" + (sideOpen && openComments ? " on" : "")}
            title="Comments"
            onClick={() => { onToggleSide(true); onOpenComments?.(); }}
          >
            <Icon name="comment" size={18} />
            {openComments > 0 && <span className="gdocs-badge">{openComments}</span>}
          </button>
          <button type="button" className="gdocs-icon-btn" title={outlineOpen ? "Hide outline" : "Show outline"} onClick={onToggleOutline}>
            <Icon name="layout" size={18} />
          </button>
          <button type="button" className="gdocs-btn" onClick={onExport}>
            <Icon name="download" size={14} /> PDF
          </button>
          {nextStep && (
            <button type="button" className="gdocs-btn primary" onClick={onAdvanceWorkflow}>
              {nextStep.label}
            </button>
          )}
        </div>
      </div>

      <div className="gdocs-toolbar-row gdocs-toolbar-menus">
        <Menu label="File">
          <MenuBtn icon="download" onClick={onExport}>Export PDF</MenuBtn>
          {templates.map((t) => (
            <MenuBtn key={t.id} icon="layout" onClick={() => onApplyTemplate(t.id)}>
              {t.name}{activeTemplateId === t.id ? " ✓" : ""}
            </MenuBtn>
          ))}
        </Menu>
        <Menu label="Insert">
          <MenuBtn icon="plus" onClick={() => onInsert?.()}>Insert section…</MenuBtn>
        </Menu>
        <Menu label="View">
          <MenuBtn icon="layout" onClick={onToggleOutline}>{outlineOpen ? "Hide" : "Show"} document outline</MenuBtn>
          <MenuBtn icon="comment" onClick={() => onToggleSide()}>{sideOpen ? "Hide" : "Show"} side panel</MenuBtn>
        </Menu>
      </div>
    </header>
  );
}
