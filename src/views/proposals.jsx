import React, { useState } from "react";
import { PageHead, Icon } from "../components/ui.jsx";
import { proposalsApi } from "../lib/api.js";
import { ProposalsTriage } from "./proposals/ProposalsTriage.jsx";
import { ProposalsQueue } from "./proposals/ProposalsQueue.jsx";
import { ProposalEditor } from "./proposals/ProposalEditor.jsx";
import { TabRow } from "./proposals/shared.jsx";

function NewProposalForm({ clientId, client, user, onBack, onCreated }) {
  const [title, setTitle] = useState(
    client?.name ? `Proposal — ${client.name}` : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const resolvedClientId = clientId && clientId !== "all" ? clientId : null;
    if (!resolvedClientId) {
      setError("Select a client from the switcher before creating a proposal.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await proposalsApi.create({
        title: title.trim(),
        clientId: resolvedClientId,
        triageState: "building",
      });
      onCreated(created);
    } catch (e) {
      setError(e.message || "Could not create proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHead
        title="New proposal"
        sub="Starts from the Ballot measure RFP template — cover letter, qualifications, team, experience, fees, and work plan."
        actions={
          <button type="button" className="btn ghost" onClick={onBack}>
            <Icon name="arrow-left" size={13} /> Cancel
          </button>
        }
      />
      <div className="card card-pad" style={{ maxWidth: 520 }}>
        <div className="field">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Client</label>
          <input className="input" value={client?.name || "—"} readOnly />
        </div>
        <div className="field">
          <label>Owner</label>
          <input className="input" value={user?.name || ""} readOnly />
        </div>
        {error && <p style={{ color: "var(--fs-danger)", fontSize: 13 }}>{error}</p>}
        <button type="button" className="btn primary" disabled={submitting} onClick={handleCreate}>
          {submitting ? "Creating…" : "Create & open builder"}
        </button>
      </div>
    </div>
  );
}

export function ProposalsView({ user, role, client, clientId }) {
  const [tab, setTab] = useState("triage");
  const [activeProposal, setActiveProposal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const bump = () => setReloadKey((k) => k + 1);

  const openProposal = (row) => {
    setActiveProposal(row.id);
    setTab("editor");
  };

  if (tab === "editor" && activeProposal) {
    return (
      <div className="proposals-doc-immersive">
        <ProposalEditor
        proposalId={activeProposal}
        client={client}
        user={user}
        onBack={() => { setTab("triage"); setActiveProposal(null); bump(); }}
        onSaved={bump}
        />
      </div>
    );
  }

  if (tab === "new") {
    return (
      <NewProposalForm
        clientId={clientId}
        client={client}
        user={user}
        onBack={() => setTab("triage")}
        onCreated={(p) => { setActiveProposal(p.id); setTab("editor"); bump(); }}
      />
    );
  }

  const tabs = [
    { id: "triage", label: "Triage", icon: "layout" },
    { id: "queue", label: "All proposals", icon: "folder" },
    { id: "new", label: "New", icon: "plus" },
  ];

  return (
    <div key={reloadKey}>
      <TabRow
        tabs={tabs}
        active={tab}
        onChange={(id) => {
          if (id === "new") setTab("new");
          else setTab(id);
        }}
      />

      {tab === "triage" ? (
        <ProposalsTriage
          clientId={clientId}
          onOpen={openProposal}
          onNew={() => setTab("new")}
        />
      ) : (
        <ProposalsQueue
          clientId={clientId}
          onOpen={openProposal}
          onNew={() => setTab("new")}
        />
      )}
    </div>
  );
}
