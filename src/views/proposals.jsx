import { ModuleListView, cell } from "./ModuleList.jsx";
import { proposalsApi } from "../lib/api.js";

const FIELDS = [
  { name: "title", label: "Title", required: true },
  { name: "clientId", label: "Client", type: "client", required: true },
  { name: "status", label: "Status", type: "select", defaultValue: "draft", options: [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ] },
  { name: "amount", label: "Amount ($)", type: "number" },
];

export function ProposalsView(props) {
  return (
    <ModuleListView
      {...props}
      title="Proposals"
      sub="Active and archived proposals by client."
      endpoint="/proposals"
      crud={proposalsApi}
      fields={FIELDS}
      itemName="proposal"
      addLabel="Add proposal"
      columns={["Proposal", "Status", "Amount"]}
      emptyTitle="No proposals"
      emptyDescription="Track drafts, sent proposals, and wins by adding your first proposal."
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
