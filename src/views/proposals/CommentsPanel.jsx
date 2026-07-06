import React, { useState } from "react";
import { Avatar, Eyebrow, Icon, Tag } from "../../components/ui.jsx";
import { proposalsApi } from "../../lib/api.js";

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z")).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function CommentCard({ comment, blockLabel, user, proposalId, onChanged, onJump }) {
  const resolved = comment.status === "resolved";
  const setStatus = async (status) => {
    await proposalsApi.comments.update(proposalId, comment.id, { status });
    onChanged();
  };
  const remove = async () => {
    await proposalsApi.comments.remove(proposalId, comment.id);
    onChanged();
  };
  return (
    <div className="comment-card" style={{ opacity: resolved ? 0.65 : 1 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="row" style={{ gap: 8 }}>
          <Avatar name={comment.authorName} size={22} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fs-navy)" }}>{comment.authorName}</div>
            <div className="mut" style={{ fontSize: 10.5 }}>{timeAgo(comment.createdAt)}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button
            type="button"
            className="btn ghost sm"
            style={{ padding: 4 }}
            title={resolved ? "Reopen" : "Resolve"}
            onClick={() => setStatus(resolved ? "open" : "resolved")}
          >
            <Icon name={resolved ? "rotate-ccw" : "circle-check"} size={13} color={resolved ? undefined : "var(--fs-success)"} />
          </button>
          {(comment.authorId === user?.id || user?.role === "admin") && (
            <button type="button" className="btn ghost sm" style={{ padding: 4, color: "var(--fs-danger)" }} title="Delete" onClick={remove}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>
      {blockLabel && (
        <button type="button" className="comment-anchor" onClick={onJump}>
          <Icon name="pin" size={10} /> {blockLabel}
        </button>
      )}
      <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 6 }}>{comment.text}</div>
      <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {comment.assigneeName && (
          <Tag tone={resolved ? "success" : "navy"}>
            {resolved ? "Done" : "Assigned"} · {comment.assigneeName}
          </Tag>
        )}
        {resolved && comment.resolvedBy && (
          <span className="mut" style={{ fontSize: 10.5 }}>Resolved by {comment.resolvedBy}</span>
        )}
      </div>
    </div>
  );
}

export function CommentsPanel({
  proposalId,
  comments,
  user,
  team,
  blocks,
  blockTypes,
  targetBlockId,
  onClearTarget,
  onChanged,
  onJumpToBlock,
}) {
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [filter, setFilter] = useState("open");
  const [posting, setPosting] = useState(false);

  const blockLabel = (blockId) => {
    if (!blockId) return null;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return "Removed block";
    const b = blocks[idx];
    const meta = blockTypes[b.type];
    return `${idx + 1}. ${b.content?.title || meta?.label || b.type}`;
  };

  const submit = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await proposalsApi.comments.add(proposalId, {
        text: text.trim(),
        blockId: targetBlockId || null,
        assigneeId: assigneeId || null,
      });
      setText("");
      setAssigneeId("");
      onClearTarget?.();
      onChanged();
    } finally {
      setPosting(false);
    }
  };

  const shown = comments.filter((c) => (filter === "all" ? true : c.status === filter));
  const openCount = comments.filter((c) => c.status === "open").length;

  return (
    <>
      <div className="row between">
        <Eyebrow>Comments</Eyebrow>
        <select className="input" style={{ width: "auto", padding: "3px 8px", fontSize: 11 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open ({openCount})</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="comment-composer">
        {targetBlockId ? (
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="comment-anchor" style={{ cursor: "default" }}>
              <Icon name="pin" size={10} /> {blockLabel(targetBlockId)}
            </span>
            <button type="button" className="btn ghost sm" style={{ padding: 2 }} title="Comment on the whole proposal instead" onClick={onClearTarget}>
              <Icon name="x" size={11} />
            </button>
          </div>
        ) : (
          <div className="mut" style={{ fontSize: 11, marginBottom: 6 }}>
            On the whole proposal — or hover a block and hit <Icon name="comment" size={10} /> to anchor it.
          </div>
        )}
        <textarea
          className="input"
          rows={3}
          placeholder="Add a comment… "
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="row between" style={{ marginTop: 8, gap: 8 }}>
          <select className="input" style={{ flex: 1, padding: "5px 8px", fontSize: 12 }} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Assign to… (optional)</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button type="button" className="btn primary sm" disabled={!text.trim() || posting} onClick={submit}>
            Comment
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxHeight: "50vh", overflowY: "auto" }}>
        {shown.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            blockLabel={blockLabel(c.blockId)}
            user={user}
            proposalId={proposalId}
            onChanged={onChanged}
            onJump={() => c.blockId && onJumpToBlock(c.blockId)}
          />
        ))}
        {!shown.length && (
          <p className="mut" style={{ fontSize: 12 }}>
            {filter === "open" ? "No open comments. Nice and tidy." : "Nothing here yet."}
          </p>
        )}
      </div>
    </>
  );
}
