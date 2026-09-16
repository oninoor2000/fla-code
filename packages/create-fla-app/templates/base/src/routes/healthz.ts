import { createFileRoute } from '@tanstack/react-router'

// TanStack Start's server-route type augmentation is not exposed by the
// current package pair, but the runtime contract is supported.
export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)
