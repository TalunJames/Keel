import { ModuleListView, cell } from "./ModuleList.jsx";

export function ResourcesView(props) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Library"
      title="Resources"
      sub="Memos, playbooks, and shared Drive assets."
      endpoint="/resources"
      emptyTitle="No resources"
      emptyDescription="Link Google Drive folders or upload documents through the API."
      emptyIcon="book"
      renderItem={(r) => (
        <>
          {cell(r.title, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(r.kind || r.category, { mut: true })}
          {cell(r.author, { mut: true })}
          {cell(r.account, { mut: true })}
        </>
      )}
    />
  );
}
