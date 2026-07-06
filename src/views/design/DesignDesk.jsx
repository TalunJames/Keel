import React, { useState } from "react";
import { PageHead, Icon } from "../../components/ui.jsx";
import { designApi } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { withClient } from "../../lib/api.js";
import { Loading } from "../../components/Loading.jsx";
import { DeskSummaryStrip, RequestTable, PoolTable, TabRow } from "./shared.jsx";

export function DesignDesk({ clientId, onOpen, onReload }) {
  const [sub, setSub] = useState("my");
  const [actionError, setActionError] = useState(null);
  const { data: queueData, loading: qLoading, reload: reloadQueue } = useApi("/design/my-queue", []);
  const poolPath = withClient("/design/pool", clientId);
  const { data: poolData, loading: pLoading, reload: reloadPool } = useApi(poolPath, [clientId]);
  const { data: deskStats, reload: reloadStats } = useApi("/design/desk-stats", []);

  const reload = () => {
    reloadQueue();
    reloadPool();
    reloadStats();
    onReload?.();
  };

  const handleClaim = async (row) => {
    setActionError(null);
    try {
      await designApi.claim(row.id);
      reload();
    } catch (e) {
      setActionError(e?.message || "Could not claim this job.");
    }
  };

  if (qLoading && !queueData) return <Loading />;

  return (
    <div>
      <PageHead
        title="Designer Desk"
        sub="Your assigned work and the unassigned pool. Claim jobs from the pool or work from your queue."
      />

      {actionError && (
        <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13, color: "var(--fs-danger)", borderColor: "var(--fs-danger)" }}>
          {actionError}
        </div>
      )}

      <DeskSummaryStrip stats={deskStats} />

      <TabRow
        active={sub}
        onChange={setSub}
        tabs={[
          { id: "my", label: "My Queue", icon: "pen" },
          { id: "pool", label: "Unassigned Pool", icon: "users" },
        ]}
      />

      {sub === "my" ? (
        <RequestTable
          items={queueData?.items || []}
          role="staff"
          isDesigner
          onOpen={onOpen}
          showAssignee={false}
        />
      ) : pLoading && !poolData ? (
        <Loading />
      ) : (
        <PoolTable items={poolData?.items || []} onClaim={handleClaim} onOpen={onOpen} />
      )}
    </div>
  );
}
