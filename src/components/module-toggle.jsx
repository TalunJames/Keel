import React from "react";
import { Icon } from "./ui.jsx";

export function ModuleToggle({ mod, on, onChange, hint }) {
  const active = on || mod.mandatory;
  return (
    <label className={"module-toggle" + (active ? " on" : "") + (mod.mandatory ? " locked" : "")}>
      <span className="module-toggle-icon">
        <Icon name={mod.icon || "sliders"} size={18} />
      </span>
      <span className="module-toggle-label">
        {mod.label}
        {hint && <span className="mut" style={{ display: "block", fontSize: 11, fontWeight: 400 }}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={active}
        disabled={mod.mandatory}
        onChange={(e) => onChange(e.target.checked)}
        className="module-toggle-input"
      />
      <span className="module-toggle-switch" aria-hidden="true" />
    </label>
  );
}
