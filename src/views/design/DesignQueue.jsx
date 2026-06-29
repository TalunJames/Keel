import React, { useMemo, useState } from "react";
import { PageHead, Icon } from "../../components/ui.jsx";
import { designApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { withClient } from "../../lib/api.js";
import { Loading } from "../../components/Loading.jsx";
import { StatusStrip, RequestTable } from "./shared.jsx";

export function DesignQueue({ role, clientId, user, onOpen, onNew, initialFilter }) {
  const [statusFilter, setStatusFilter] = useState(initialFilter || null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const listPath = withClient("/design/requests", clientId);
  const statsPath = withClient("/design/stats", clientId);
  const { data: listData, loading, reload } = useApi(listPath, [clientId]);
  const { data: stats } = useApi(statsPath, [clientId]);
  const { data: designersData } = useApi(role !== "client" ? "/design/designers" : null, [role], { enabled: role !== "client" });

  const items = useMemo(() => {
    let rows = listData?.items || [];
    if (statusFilter && statusFilter !== "approvedWeek") {
      rows = rows.filter((r) => r.status === statusFilter);
    } else if (statusFilter === "approvedWeek") {
      rows = rows.filter((r) => r.status === "Approved");
    }
    if (priorityFilter) rows = rows.filter((r) => r.priority === priorityFilter);
    if (unassignedOnly) rows = rows.filter((r) => !r.assigneeId);
    return rows;
  }, [listData, statusFilter, priorityFilter, unassignedOnly]);

  const isClient = role === "client";
  const isStaff = role === "staff" || role === "admin";

  const handleAssign = async (row, assigneeId) => {
    await designApi.update(row.id, { assigneeId });
    reload();
  };

  const handleFilter = (key) => {
    setStatusFilter(key);
  };

  if (loading && !listData) return <Loading />;

  return (
    <div>
      <PageHead
        title={isClient ? "Your Active Proofs" : "Design Queue"}
        sub={isClient
          ? "Active and recently approved creative for your campaign. Click any item to review and comment."
          : "Every brief lives here. Submit a new request to route work to the design team."}
        actions={isStaff && (
          <>
            <button type="button" className="btn secondary" onClick={() => setShowFilters((v) => !v)}>
              <Icon name="filter" size={13} /> Filter
            </button>
            <button type="button" className="btn primary" onClick={onNew}>
              <Icon name="plus" size={14} /> New Request
            </button>
          </>
        )}
      />

      {!isClient && <StatusStrip stats={stats} onFilter={handleFilter} activeFilter={statusFilter} />}

      {showFilters && isStaff && (
        <div className="card card-pad row" style={{ gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <label>Priority</label>
            <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All</option>
              <option>Standard</option>
              <option>Rush</option>
              <option>Election critical</option>
            </select>
          </div>
          <label className="row" style={{ gap: 8, fontSize: 13, alignSelf: "flex-end", paddingBottom: 8 }}>
            <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
            Unassigned only
          </label>
        </div>
      )}

      <RequestTable
        items={items}
        role={role}
        onOpen={onOpen}
        onAssign={isStaff ? handleAssign : null}
        designers={designersData?.designers}
        showAssignee={!isClient}
      />
    </div>
  );
}
