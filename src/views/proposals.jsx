import { ModuleListView, cell } from "./ModuleList.jsx";

export function ProposalsView(props) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Business development"
      title="Proposals"
      sub="Active and archived proposals by client."
      endpoint="/proposals"
      emptyTitle="No proposals"
      emptyDescription="Create proposals in your CRM or add them through the Admin API."
      emptyIcon="compass"
      renderItem={(p) => (
        <>
          {cell(p.title, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(p.status)}
          {cell(p.amount != null ? "$" + Number(p.amount).toLocaleString() : "—", { mut: true })}
        </>
      )}
    />
  );
}
