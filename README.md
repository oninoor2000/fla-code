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

Build the production app with:

```bash
pnpm build
```

## Direction

- Base UI is the only supported component primitive for new projects.
- Drizzle + PostgreSQL, Better Auth, OIDC/Keycloak, RustFS, Coolify, and
  Cloudflare profiles will be added incrementally.
- The original dashboard demo remains in `src/app` while its routes and
  interactions are migrated to TanStack Router.
