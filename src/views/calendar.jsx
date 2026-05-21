import { ModuleListView, cell } from "./ModuleList.jsx";

export function CalendarView(props) {
  return (
    <ModuleListView
      {...props}
      eyebrow="Schedule"
      title="Calendar"
      sub="Events synced from your firm's calendar integration."
      endpoint="/calendar/events"
      emptyTitle="No events"
      emptyDescription="Connect Google Calendar or add events via the API to populate this view."
      emptyIcon="calendar"
      renderItem={(e) => (
        <>
          {cell(e.title, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(e.startsAt, { mut: true })}
          {cell(e.kind)}
          {cell(e.location, { mut: true })}
        </>
      )}
    />
  );
}
