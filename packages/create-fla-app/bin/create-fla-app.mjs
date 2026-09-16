#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templateRoot = join(packageRoot, 'templates', 'base')

const defaults = {
  ui: 'base-ui',
  database: 'none',
  auth: 'none',
  deployment: 'local',
}

function usage() {
  console.log(`Usage: create-fla-app [project-directory]\n\nOptions:\n  --help       Show this help\n  --yes        Use defaults and skip prompts\n\nDefaults:\n  TanStack Start + shadcn/ui Base UI + local development`)
}

async function choose(rl, label, options, fallback) {
  console.log(`\n${label}`)
  options.forEach((option, index) => {
    console.log(`  ${index + 1}) ${option.label}${option.value === fallback ? ' (default)' : ''}`)
  })
  const answer = await rl.question(`Choose [${options.findIndex((option) => option.value === fallback) + 1}]: `)
  const index = answer.trim() === '' ? options.findIndex((option) => option.value === fallback) : Number(answer) - 1
  return options[index]?.value ?? fallback
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    usage()
    return
  }

  const yes = args.includes('--yes') || args.includes('-y')
  const projectArg = args.find((arg) => !arg.startsWith('-'))
  const rl = yes ? null : createInterface({ input, output })

  try {
    const projectName = projectArg ?? (rl ? await rl.question('Project name: ') : 'fla-app')
    if (!projectName || projectName.startsWith('-')) throw new Error('Project name is required.')

    const target = resolve(process.cwd(), projectName)
    const profile = {
      ui: defaults.ui,
      database: defaults.database,
      auth: defaults.auth,
      deployment: defaults.deployment,
    }

    if (rl) {
      profile.database = await choose(rl, 'Database', [
        { value: 'none', label: 'None' },
        { value: 'drizzle-postgres', label: 'Drizzle + PostgreSQL' },
      ], defaults.database)
      profile.auth = await choose(rl, 'Authentication', [
        { value: 'none', label: 'None' },
        { value: 'better-auth', label: 'Better Auth' },
        { value: 'better-auth-oidc', label: 'Better Auth + OIDC/Keycloak' },
      ], defaults.auth)
      profile.deployment = await choose(rl, 'Deployment', [
        { value: 'local', label: 'Local' },
        { value: 'coolify', label: 'Coolify' },
        { value: 'cloudflare', label: 'Cloudflare Workers' },
      ], defaults.deployment)
    }

    await mkdir(target, { recursive: true })
    const existing = await readFile(join(target, 'package.json'), 'utf8').catch(() => null)
    if (existing) throw new Error(`Target already contains package.json: ${target}`)

    await cp(templateRoot, target, { recursive: true, errorOnExist: false })
    const packageJsonPath = join(target, 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    packageJson.name = projectName.replaceAll('\\', '/').split('/').pop()
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    await writeFile(join(target, '.fla-code.json'), `${JSON.stringify(profile, null, 2)}\n`)

    console.log(`\nCreated ${target}`)
    console.log('Next steps:')
    console.log(`  cd ${projectName}`)
    console.log('  pnpm install')
    console.log('  pnpm dev')
  } finally {
    rl?.close()
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
