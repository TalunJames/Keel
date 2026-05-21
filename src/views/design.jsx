import { ModuleListView, cell } from "./ModuleList.jsx";
import { Icon } from "../components/ui.jsx";

export function DesignView({ onNavigate, ...props }) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Creative"
      title="Design Requests"
      sub="Jobs from Odoo or manual intake appear here."
      endpoint="/design/requests"
      emptyTitle="No design requests"
      emptyDescription="Submit a new request or connect Odoo to sync open jobs."
      emptyIcon="pen"
      actions={
        <button type="button" className="btn primary" onClick={() => onNavigate?.("design")}>
          <Icon name="plus" size={14} /> New request
        </button>
      }
      renderItem={(r) => (
        <>
          {cell(r.title, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(r.status)}
          {cell(r.priority, { mut: true })}
          {cell(r.due, { mut: true })}
        </>
      )}
    />
  );
}
