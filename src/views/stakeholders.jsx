import { ModuleListView, cell } from "./ModuleList.jsx";

export function StakeholdersView(props) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Relationships"
      title="Stakeholders"
      sub="Endorsers, coalition partners, and VIP contacts by client."
      endpoint="/stakeholders"
      emptyTitle="No stakeholders"
      emptyDescription="Import your stakeholder tracker or add contacts via the API."
      emptyIcon="stakeholders"
      renderItem={(s) => (
        <>
          {cell(s.name, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(s.org, { mut: true })}
          {cell(s.status)}
          {cell(s.owner, { mut: true })}
        </>
      )}
    />
  );
}
