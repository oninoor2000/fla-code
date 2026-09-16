import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SectionCards } from '@/app/dashboard/components/section-cards'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="min-h-svh bg-background px-6 py-16 text-foreground">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Fla Code</p>
          <h1 className="text-4xl font-semibold tracking-tight">Start building.</h1>
          <p className="max-w-xl text-muted-foreground">
            TanStack Start with shadcn/ui Base UI primitives, ready for the next
            feature.
          </p>
        </div>
        <SectionCards />
        <Card>
          <CardHeader>
            <CardTitle>Golden path initialized</CardTitle>
            <CardDescription>
              The new repository is running on the official TanStack Start file
              router and Base UI component preset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button">Continue</Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
