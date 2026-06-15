import { Icon } from "../components/ui.jsx";

const ALIASES = {
  "layout-grid": "layout",
  "alert-triangle": "alert",
  "triangle-alert": "alert",
  "arrow-left": "chevron-left",
  "arrow-up-right": "external",
  "trending-up": "trend-up",
  "check-square": "circle-check",
  "calendar-clock": "calendar",
  "calendar-check": "circle-check",
  "notebook-pen": "book",
  "search-x": "search",
  "filter-x": "filter",
  "pencil-line": "pen",
  loader: "loading",
  "check-check": "circle-check",
  radio: "tv",
  "flask-conical": "compass",
  kanban: "layout",
  inbox: "folder",
  hourglass: "clock",
  list: "menu",
  "scroll-text": "comment",
  reply: "comment",
  receipt: "comment",
  gavel: "flag",
  hand: "users",
  info: "alert",
  table: "layout",
  zap: "trend-up",
  trophy: "flag",
};

export function FathomIcon({ name, style = {} }) {
  const size = Number(style.width || style.height || 18);
  const { color, ...rest } = style;
  return <Icon name={ALIASES[name] || name} size={size} color={color} style={rest} />;
}
