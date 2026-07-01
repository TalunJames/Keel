import { ModuleListView, cell } from "./ModuleList.jsx";
import { resourcesApi } from "../lib/api.js";

const FIELDS = [
  { name: "title", label: "Title", required: true },
  { name: "category", label: "Category", type: "select", required: true, defaultValue: "memo", options: [
    { value: "memo", label: "Memo" },
    { value: "playbook", label: "Playbook" },
    { value: "template", label: "Template" },
    { value: "report", label: "Report" },
    { value: "link", label: "Link" },
  ] },
  { name: "kind", label: "Kind", placeholder: "e.g. PDF, Doc, Sheet" },
  { name: "author", label: "Author" },
  { name: "account", label: "Account", placeholder: "e.g. Shared Drive" },
  { name: "url", label: "URL", type: "url", placeholder: "https://…" },
  { name: "tags", label: "Tags", type: "tags", help: "Comma-separated, e.g. fundraising, field" },
  { name: "clientId", label: "Client", type: "client" },
];

export function ResourcesView(props) {
  return (
    <ModuleListView
      {...props}
      title="Resources"
      sub="Memos, playbooks, and shared assets."
      endpoint="/resources"
      crud={resourcesApi}
      fields={FIELDS}
      itemName="resource"
      addLabel="Add resource"
      columns={["Resource", "Kind", "Author", "Account"]}
      emptyTitle="No resources"
      emptyDescription="Add memos, playbooks, and shared links for the team."
      emptyIcon="book"
      renderItem={(r) => (
        <>
          {cell(
            r.url
              ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--fs-navy)" }}>{r.title}</a>
              : r.title,
            { style: { fontWeight: 600, color: "var(--fs-navy)" } }
          )}
          {cell(r.kind || r.category, { mut: true })}
          {cell(r.author, { mut: true })}
          {cell(r.account, { mut: true })}
        </>
      )}
    />
  );
}
