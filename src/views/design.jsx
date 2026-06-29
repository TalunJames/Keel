import React, { useMemo, useState, useEffect } from "react";
import { DesignQueue } from "./design/DesignQueue.jsx";
import { DesignDesk } from "./design/DesignDesk.jsx";
import { DesignIntake } from "./design/DesignIntake.jsx";
import { DesignProof } from "./design/DesignProof.jsx";
import { TabRow } from "./design/shared.jsx";

export function DesignView({ user, role, clientId, client, onNavigate, initialTab }) {
  const isClient = role === "client";
  const isStaff = role === "staff" || role === "admin";
  const isDesigner = !!user?.isDesigner;

  const defaultTab = useMemo(() => {
    if (initialTab) return initialTab;
    if (isClient) return "queue";
    if (isDesigner) return "desk";
    return "queue";
  }, [initialTab, isClient, isDesigner]);

  const [tab, setTab] = useState(defaultTab);
  const [activeRequest, setActiveRequest] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const bump = () => setReloadKey((k) => k + 1);

  const openRequest = (row) => {
    setActiveRequest(row.id);
    setTab("proof");
  };

  if (tab === "proof" && activeRequest) {
    return (
      <DesignProof
        requestId={activeRequest}
        user={user}
        role={role}
        onBack={() => { setTab(isDesigner && !isStaff ? "desk" : "queue"); setActiveRequest(null); }}
        onUpdated={bump}
      />
    );
  }

  if (tab === "new" && isStaff) {
    return (
      <DesignIntake
        clientId={clientId}
        client={client}
        onBack={() => setTab("queue")}
        onSubmitted={() => { setTab("queue"); bump(); }}
      />
    );
  }

  const staffTabs = [
    ...(isDesigner ? [{ id: "desk", label: "Designer Desk", icon: "pen" }] : []),
    { id: "queue", label: "Queue", icon: "folder" },
    ...(isStaff ? [{ id: "new", label: "New Request", icon: "plus" }] : []),
  ];

  return (
    <div key={reloadKey}>
      {!isClient && staffTabs.length > 1 && (
        <TabRow
          tabs={staffTabs}
          active={tab === "new" ? "new" : tab}
          onChange={(id) => {
            if (id === "new") setTab("new");
            else setTab(id);
          }}
        />
      )}

      {tab === "desk" && isDesigner ? (
        <DesignDesk clientId={clientId} onOpen={openRequest} onReload={bump} />
      ) : (
        <DesignQueue
          role={role}
          clientId={clientId}
          user={user}
          onOpen={openRequest}
          onNew={() => setTab("new")}
        />
      )}
    </div>
  );
}
