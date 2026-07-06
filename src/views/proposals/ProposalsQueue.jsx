import React, { useMemo, useState } from "react";
import { PageHead, Icon } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Loading } from "../../components/Loading.jsx";
import { ProposalTable } from "./shared.jsx";

export function ProposalsQueue({ clientId, onOpen, onNew }) {
  const [sourceFilter, setSourceFilter] = useState("");
  const { data, loading } = useApi(
    `/proposals?clientId=${encodeURIComponent(clientId || "all")}`,
    [clientId],
  );

  const items = useMemo(() => {
    let rows = data?.items || [];
    if (sourceFilter) rows = rows.filter((p) => p.source === sourceFilter);
    return rows;
  }, [data, sourceFilter]);

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHead
        title="All proposals"
        sub="Every active and archived proposal across accounts."
        actions={
          <>
            <select className="input" style={{ fontSize: 13 }} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">All sources</option>
              <option value="cleatus">Cleatus</option>
              <option value="manual">Manual</option>
            </select>
            <button type="button" className="btn primary" onClick={onNew}>
              <Icon name="plus" size={14} /> New proposal
            </button>
          </>
        }
      />
      <ProposalTable items={items} onOpen={onOpen} />
    </div>
  );
}
