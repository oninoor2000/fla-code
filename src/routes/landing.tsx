import { Link, createFileRoute } from '@tanstack/react-router'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/landing')({ component: Landing })

function Landing() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-muted-foreground">Fla Code</p>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-balance">
            A clean starting point for your next product.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            TanStack Start, shadcn/ui, and Base UI with deployment profiles for
            local development, Coolify, and Cloudflare.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard" className={cn(buttonVariants({ size: 'lg' }))}>
              Open dashboard
            </Link>
            <Link
              to="/"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              Read the starter
            </Link>
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <img
            src="/hero-images-container.png"
            alt="Fla Code dashboard preview"
            className="h-auto w-full object-cover"
          />
          <CardHeader>
            <CardTitle>Ship from a known baseline</CardTitle>
            <CardDescription>
              Choose the runtime and integrations when you generate your app.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6 text-sm text-muted-foreground">
            Base UI is the default component primitive.
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
