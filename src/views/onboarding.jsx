import { ModuleListView, cell } from "./ModuleList.jsx";
import { onboardingApi } from "../lib/api.js";

const FIELDS = [
  { name: "name", label: "Program name", required: true },
  { name: "clientId", label: "Client", type: "client", required: true },
  { name: "status", label: "Status", type: "select", defaultValue: "active", options: [
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "complete", label: "Complete" },
  ] },
];

export function OnboardingView(props) {
  return (
    <ModuleListView
      {...props}
      title="Onboarding"
      sub="New retainer checklists and provisioning status."
      endpoint="/onboarding/programs"
      crud={onboardingApi}
      fields={FIELDS}
      itemName="program"
      addLabel="Add program"
      columns={["Program", "Status", "Client"]}
      emptyTitle="No onboarding programs"
      emptyDescription="Start a program when a new client signs — tasks and credentials live here."
      emptyIcon="flag"
      renderItem={(p, { clients }) => (
        <>
          {cell(p.name, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(p.status)}
          {cell(clients.find((c) => c.id === p.clientId)?.name || p.clientId, { mut: true })}
        </>
      )}
    />
  );
}
