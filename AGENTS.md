# Gymia development instructions

Read README.md, docs/BUSINESS_RULES.md and docs/HANDOFF.md before changing behavior.

- Node 24; npm and package-lock.json. Do not migrate framework or database without request.
- All tenant data queries must be scoped, all mutations must authorize server-side.
- Preserve audit history; never delete sales to implement refunds.
- Integers for cents; UTC instants and tenant IANA timezone.
- Use serializable transactions for financial/inventory operations; retry serialization conflicts.
- Database and secrets stay server-side. Do not cache authenticated data in the service worker.
- Run typecheck, targeted tests and build; run Playwright when UI/auth changes.
- PostgreSQL dev binds only to loopback. Never run demo seed against production.
- Do not commit .env, .local, LOCAL-ACCESS.md, credentials or personal information.
- Keep documentation and HANDOFF.md aligned with implemented behavior. Do not claim pending integrations work.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
