import { ModuleListView, cell } from "./ModuleList.jsx";

export function MediaView(props) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Comms"
      title="Media Monitoring"
      sub="Muck Rack and wire mentions ingested for retained clients."
      endpoint="/media/mentions"
      emptyTitle="No mentions"
      emptyDescription="Configure Muck Rack or AP integrations to pull coverage into Keel."
      emptyIcon="comment"
      renderItem={(m) => (
        <>
          {cell(m.headline, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(m.outlet, { mut: true })}
          {cell(m.sentiment)}
          {cell(m.publishedAt, { mut: true })}
        </>
      )}
    />
  );
}
