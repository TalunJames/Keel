# Periscope (upstream)

Vendored from [TalunJames/periscope](https://github.com/TalunJames/periscope) — the 3D mailer fold proof viewer.

Keel serves this app at `/periscope` and links shares to design proofs via `design_proofs.periscope_share_id`.

To refresh from upstream:

```bash
rsync -a --exclude .git /path/to/periscope/ vendor/periscope/
# Re-apply Keel patches in app.jsx (search for "Keel:") and keep index-keel.html
```

Or add as a git submodule:

```bash
git submodule add https://github.com/TalunJames/periscope.git vendor/periscope
```
