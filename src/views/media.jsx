import { ModuleListView, cell, formatDate } from "./ModuleList.jsx";
import { mediaApi } from "../lib/api.js";

const FIELDS = [
  { name: "headline", label: "Headline", required: true },
  { name: "outlet", label: "Outlet", required: true },
  { name: "sentiment", label: "Sentiment", type: "select", options: [
    { value: "", label: "Not rated" },
    { value: "positive", label: "Positive" },
    { value: "neutral", label: "Neutral" },
    { value: "negative", label: "Negative" },
  ] },
  { name: "publishedAt", label: "Published", type: "date" },
  { name: "url", label: "Link", type: "url", placeholder: "https://…" },
  { name: "excerpt", label: "Excerpt", type: "textarea" },
  { name: "clientId", label: "Client", type: "client" },
];

export function MediaView(props) {
  return (
    <ModuleListView
      {...props}
      title="Media Monitoring"
      sub="Press coverage and wire mentions for retained clients."
      endpoint="/media/mentions"
      crud={mediaApi}
      fields={FIELDS}
      itemName="mention"
      addLabel="Add mention"
      columns={["Headline", "Outlet", "Sentiment", "Published"]}
      emptyTitle="No mentions"
      emptyDescription="Log press coverage as it lands to track sentiment by outlet."
      emptyIcon="comment"
      renderItem={(m) => (
        <>
          {cell(
            m.url
              ? <a href={m.url} target="_blank" rel="noreferrer" style={{ color: "var(--fs-navy)" }}>{m.headline}</a>
              : m.headline,
            { style: { fontWeight: 600, color: "var(--fs-navy)" } }
          )}
          {cell(m.outlet, { mut: true })}
          {cell(m.sentiment)}
          {cell(formatDate(m.publishedAt), { mut: true })}
        </>
      )}
    />
  );
}
