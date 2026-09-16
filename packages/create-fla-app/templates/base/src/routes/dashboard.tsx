import { createFileRoute } from '@tanstack/react-router'

import { SectionCards } from '@/app/dashboard/components/section-cards'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  return (
    <main className="min-h-svh bg-background px-6 py-12 text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Fla Code</p>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <SectionCards />
      </section>
    </main>
  )
}
