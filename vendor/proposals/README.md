# Fog Signal Proposals Builder (Keel)

Vendored from `Desktop/Editor/app`. Served at `/proposals/app` inside Keel.

## Integration

- **Static shell:** `index-keel.html`
- **Keel bridge:** `js/keel-bridge.js` — auth, team, clients, admin gating
- **API + SSE:** `server/proposals-app-routes.js` — documents in `proposals.payload_json` (`format: editor-v1`)
- **SPA tab:** `src/views/proposals.jsx` — full-height iframe embed

## Workspace settings & assets

Stored in `app_settings` keys `proposal_workspace_settings` and `proposal_workspace_assets`, synced live over SSE.

## Cleatus

New Cleatus ingest creates editor-format proposals via `createEditorProposal()` in `proposals-app-routes.js`.

Legacy proposals (old React builder format) are not shown in the new builder grid.
