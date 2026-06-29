import { ModuleListView, cell } from "./ModuleList.jsx";

export function OnboardingView(props) {
  return (
    <ModuleListView
      {...props}
      title="Onboarding"
      sub="New retainer checklists and provisioning status."
      endpoint="/onboarding/programs"
      emptyTitle="No onboarding programs"
      emptyDescription="Start a program when a new client signs — tasks and credentials live here."
      emptyIcon="flag"
      renderItem={(p) => (
        <>
          {cell(p.name, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(p.status)}
          {cell(p.clientId, { mut: true })}
        </>
      )}
    />
  );
}
