import React from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { useApi } from "../lib/useApi.js";
import { withClient } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

/**
 * Generic API-backed list for modules without bespoke UI yet.
 */
export function ModuleListView({
  title, sub, endpoint, clientId, itemKey = "items",
  emptyTitle, emptyDescription, emptyIcon = "folder",
  renderItem,
  actions,
}) {
  const path = withClient(endpoint, clientId);
  const { data, loading, error } = useApi(path, [clientId]);
  const items = data?.[itemKey] || [];

  return (
    <div>
      <PageHead title={title} sub={sub} actions={actions} />
      {loading && <Loading />}
      {error && (
        <div className="card card-pad" style={{ color: "#7a2210", fontSize: 13 }}>{error.message}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="card">
          <table className="tbl">
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>{renderItem(item)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function cell(text, opts = {}) {
  return <td className={opts.mut ? "mut" : ""} style={opts.style}>{text ?? "—"}</td>;
}
