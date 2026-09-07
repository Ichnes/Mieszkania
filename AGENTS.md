# Project Rules

- Keep TODO lists and session handoff notes in `docs/` alongside the other Markdown documentation. The task list is `docs/TODO.md`.
- Update `docs/TODO.md` during each task: record the current scope, completed changes, verification results, and remaining work.

- When import/collector runs fail, check `storage/logs/import-failures.ndjson` before debugging. The file is newline-delimited JSON and should keep recent failing source, external id, URL, error, attempts, and context.

# Responsive UI

For every frontend change, consider desktop PC, laptop, and mobile layouts. Add or revise responsive CSS when a component can overflow, become too dense, or lose key controls on smaller screens.

# Portal integrations

When adding a portal, treat it as a complete source integration: add it to the source registry, discovery, queue processing, retry/reset, queue status, multi-portal controls, and manual "fetch data" routing. Its image URLs must be stored so the shared "fetch photos" action works. Duplicate matching and the merged-offer source links must remain source-agnostic, so every merged portal URL is shown automatically.

# File organization and documentation

- Keep this root `AGENTS.md` discoverable by coding tools. It contains contributor rules, not user setup steps.
- `README.md` is the entry point. User instructions belong in `docs/guides/`, architecture in `docs/architecture/`, external data references in `docs/reference/`. Historical notes in `docs/archive/` are not current requirements.
- Update the relevant guide when a user workflow or setup command changes. Verify commands, links and UI labels against the implementation.
- Frontend routes belong in `apps/web/src/pages/`; feature components and helpers in `features/<feature>/`; shared helpers must be used across features. Keep `App.tsx` limited to composition.
- Every secondary page needs a visible route back to its parent. Import and preparation actions must expose loading, success, failure and existing-data status.
- Comparison must retain selected offers when filters or pagination change. Compare facts in aligned rows; keep horizontal scrolling inside the comparison on small screens.
- Never commit `.env`, `storage/`, local user addresses, database dumps or development artifacts from `.local/`.
