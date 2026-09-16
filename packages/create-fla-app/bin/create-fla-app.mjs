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

async function applyProfile(target, packageJson, profile) {
  if (profile.database === 'drizzle-postgres') {
    packageJson.dependencies['drizzle-orm'] = '^0.44.7'
    packageJson.dependencies.pg = '^8.16.3'
    packageJson.devDependencies['@types/pg'] = '^8.15.5'
    packageJson.devDependencies['drizzle-kit'] = '^0.31.4'
  }

  if (profile.auth !== 'none') {
    packageJson.dependencies['better-auth'] = '^1.4.5'
  }

  if (profile.deployment === 'coolify') {
    packageJson.dependencies.nitro = 'latest'
    packageJson.scripts.start = 'node .output/server/index.mjs'
    const vitePath = join(target, 'vite.config.ts')
    const viteConfig = await readFile(vitePath, 'utf8')
    await writeFile(vitePath, viteConfig
      .replace("import { tanstackStart } from '@tanstack/react-start/plugin/vite'", "import { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport { nitro } from 'nitro/vite'")
      .replace('plugins: [tanstackStart(), tailwindcss(), viteReact()],', "plugins: [tanstackStart(), tailwindcss(), nitro(), viteReact()],"))
    await writeFile(join(target, 'Dockerfile'), [
      'FROM node:22-bookworm-slim',
      'WORKDIR /app',
      'COPY package.json pnpm-lock.yaml ./',
      'RUN corepack enable && pnpm install --no-frozen-lockfile',
      'COPY . .',
      'RUN pnpm build',
      'ENV HOST=0.0.0.0',
      'EXPOSE 3000',
      'CMD ["pnpm", "start"]',
      '',
    ].join('\n'))
    await writeFile(join(target, '.dockerignore'), 'node_modules\ndist\n.output\n.env\n.git\n')
  }

  if (profile.deployment === 'cloudflare') {
    packageJson.devDependencies['@cloudflare/vite-plugin'] = '^1.26.0'
    packageJson.devDependencies.wrangler = '^4.70.0'
    packageJson.scripts.deploy = 'pnpm run build && wrangler deploy'
    const workspacePath = join(target, 'pnpm-workspace.yaml')
    const workspaceConfig = await readFile(workspacePath, 'utf8')
    await writeFile(workspacePath, workspaceConfig.replace('allowBuilds:\n  esbuild: true', 'allowBuilds:\n  esbuild: true\n  workerd: true\n  lightningcss: true'))
    const vitePath = join(target, 'vite.config.ts')
    const viteConfig = await readFile(vitePath, 'utf8')
    await writeFile(vitePath, viteConfig
      .replace("import { tanstackStart } from '@tanstack/react-start/plugin/vite'", "import { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport { cloudflare } from '@cloudflare/vite-plugin'")
      .replace('plugins: [tanstackStart(), tailwindcss(), viteReact()],', "plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), tanstackStart(), tailwindcss(), viteReact()],"))
    await writeFile(join(target, 'wrangler.jsonc'), JSON.stringify({
      $schema: 'node_modules/wrangler/config-schema.json',
      name: packageJson.name,
      compatibility_date: '2025-09-02',
      compatibility_flags: ['nodejs_compat'],
      main: '@tanstack/react-start/server-entry',
    }, null, 2) + '\n')
  }
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
    await applyProfile(target, packageJson, profile)
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
