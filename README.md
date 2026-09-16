# Fla Code

The reusable starter foundation behind `create-fla-app`.

Current checkpoint: TanStack Start + file-based routing + shadcn/ui Base UI,
using the ShadcnStore dashboard as the migration source.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Add route files under `src/routes`; TanStack Router
updates `src/routeTree.gen.ts` for you.

The server health check is available at http://localhost:3000/healthz.

Build the production app with:

```bash
pnpm build
```

## Generate a project

Run the local generator from the repository root:

```bash
pnpm create ./my-app
```

The generator uses Base UI by default and records the selected profile in
`.fla-code.json`. Database, authentication, and deployment selections are
currently recorded for the next adapter phase; the generated project remains
the verified local TanStack Start template.

## Direction

- Base UI is the only supported component primitive for new projects.
- Drizzle + PostgreSQL, Better Auth, OIDC/Keycloak, RustFS, Coolify, and
  Cloudflare profiles will be added incrementally.
- The original dashboard demo remains in `src/app` while its routes and
  interactions are migrated to TanStack Router.
