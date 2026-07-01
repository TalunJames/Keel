import { ModuleListView, cell, formatDateTime } from "./ModuleList.jsx";
import { calendarApi } from "../lib/api.js";

const FIELDS = [
  { name: "title", label: "Title", required: true },
  { name: "startsAt", label: "Starts", type: "datetime", required: true },
  { name: "endsAt", label: "Ends", type: "datetime" },
  { name: "kind", label: "Kind", type: "select", defaultValue: "meeting", options: [
    { value: "meeting", label: "Meeting" },
    { value: "deadline", label: "Deadline" },
    { value: "event", label: "Event" },
    { value: "call", label: "Call" },
  ] },
  { name: "location", label: "Location" },
  { name: "clientId", label: "Client", type: "client" },
];

export function CalendarView(props) {
  return (
    <ModuleListView
      {...props}
      title="Calendar"
      sub="Meetings, deadlines, and events across the firm."
      endpoint="/calendar/events"
      crud={calendarApi}
      fields={FIELDS}
      itemName="event"
      addLabel="Add event"
      columns={["Event", "Starts", "Kind", "Location"]}
      emptyTitle="No events"
      emptyDescription="Add meetings, deadlines, and events to keep the shared calendar current."
      emptyIcon="calendar"
      renderItem={(e) => (
        <>
          {cell(e.title, { style: { fontWeight: 600, color: "var(--fs-navy)" } })}
          {cell(formatDateTime(e.startsAt), { mut: true })}
          {cell(e.kind)}
          {cell(e.location, { mut: true })}
        </>
      )}
    />
  );
}
