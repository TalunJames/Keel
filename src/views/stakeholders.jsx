import { ModuleListView, cell } from "./ModuleList.jsx";
import { stakeholdersApi } from "../lib/api.js";

const FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "org", label: "Organization" },
  { name: "title", label: "Title" },
  { name: "clientId", label: "Client", type: "client", required: true },
  { name: "tier", label: "Tier", type: "select", defaultValue: "2", options: [
    { value: "1", label: "Tier 1 — priority" },
    { value: "2", label: "Tier 2" },
    { value: "3", label: "Tier 3" },
  ] },
  { name: "status", label: "Status", type: "select", defaultValue: "prospect", options: [
    { value: "prospect", label: "Prospect" },
    { value: "engaged", label: "Engaged" },
    { value: "committed", label: "Committed" },
    { value: "declined", label: "Declined" },
  ] },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "owner", label: "Owner", help: "Staff member responsible for this relationship." },
];

export function StakeholdersView(props) {
  return (
    <ModuleListView
      {...props}
      title="Stakeholders"
      sub="Endorsers, coalition partners, and VIP contacts by client."
      endpoint="/stakeholders"
      crud={stakeholdersApi}
      fields={FIELDS}
      itemName="stakeholder"
      addLabel="Add stakeholder"
      columns={["Name", "Organization", "Status", "Owner"]}
      emptyTitle="No stakeholders"
      emptyDescription="Build your stakeholder tracker by adding endorsers and coalition contacts."
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
