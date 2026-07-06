import React from "react";
import { Icon } from "../../components/ui.jsx";

/** Section labels for the ballot-RFP outline (matches template flow). */
const OUTLINE_SECTIONS = [
  { label: "Front matter", types: ["cover", "coverLetter", "toc", "summary", "executive", "sectionHeader"] },
  { label: "Qualifications", types: ["qualifications", "aboutfirm", "situation", "approach", "methodology", "stakeholders"] },
  { label: "Team & experience", types: ["teamBio", "team", "caseStudy", "references", "compliance"] },
  { label: "Approach & schedule", types: ["workPlan", "scope", "deliverables", "projectSchedule", "timeline"] },
  { label: "Fees", types: ["feeProposal", "fees", "optionalServices", "personnelCosts", "hourlyRates", "passThrough"] },
  { label: "Closing", types: ["terms", "insurance", "exceptions", "conclusion", "signoff"] },
];

function sectionForType(type) {
  return OUTLINE_SECTIONS.find((s) => s.types.includes(type))?.label || "Other";
}

export function outlineGroups(blocks, blockTypes) {
  const groups = [];
  let current = null;

  for (const block of blocks || []) {
    if (block.type === "pagebreak" || block.type === "divider") continue;
    const section = sectionForType(block.type);
    const label = blockTypes[block.type]?.label || block.type;
    const title =
      block.content?.title ||
      block.content?.client ||
      block.content?.serviceTitle?.split("\n")[0] ||
      label;

    if (!current || current.section !== section) {
      current = { section, items: [] };
      groups.push(current);
    }
    current.items.push({ blockId: block.id, type: block.type, title });
  }
  return groups;
}

export function ProposalOutline({ blocks, blockTypes, activeBlockId, onJump }) {
  const groups = outlineGroups(blocks, blockTypes);

  if (!groups.length) {
    return (
      <p className="mut" style={{ fontSize: 12, padding: "8px 12px", margin: 0 }}>
        Sections appear here as you build the proposal.
      </p>
    );
  }

  return (
    <nav className="proposal-outline" aria-label="Proposal outline">
      {groups.map((g) => (
        <div key={g.section} className="proposal-outline-group">
          <div className="proposal-outline-section">{g.section}</div>
          {g.items.map((item) => (
            <button
              key={item.blockId}
              type="button"
              className={"proposal-outline-item" + (activeBlockId === item.blockId ? " active" : "")}
              onClick={() => onJump(item.blockId)}
            >
              <Icon name={blockTypes[item.type]?.icon || "layout"} size={11} />
              <span className="proposal-outline-title">{item.title}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
