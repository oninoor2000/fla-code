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
  packageManager: 'pnpm',
  database: 'none',
  auth: 'none',
  storage: 'none',
  deployment: 'local',
}

function usage() {
  console.log(`Usage: create-fla-app [project-directory]\n\nOptions:\n  --help                    Show this help\n  --yes                     Use defaults and skip prompts\n  --package-manager=<pm>    pnpm | bun\n  --database=<profile>      none | drizzle-postgres | drizzle-d1\n  --auth=<profile>          none | better-auth | better-auth-oidc\n  --storage=<profile>       none | rustfs-s3 | cloudflare-r2\n  --deployment=<profile>    local | coolify | cloudflare\n\nDefaults:\n  TanStack Start + shadcn/ui Base UI + pnpm + local development`)
}

function option(args, name) {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
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
  const run = profile.packageManager === 'bun' ? 'bun run' : 'pnpm run'
  const exec = profile.packageManager === 'bun' ? 'bunx' : 'pnpm exec'
  const cloudflareAuth = profile.database === 'drizzle-d1' && profile.auth !== 'none'
  if (profile.database === 'drizzle-postgres') {
    packageJson.dependencies['drizzle-orm'] = '^0.44.7'
    packageJson.dependencies.pg = '^8.16.3'
    packageJson.devDependencies['@types/pg'] = '^8.15.5'
    packageJson.devDependencies['drizzle-kit'] = '^0.31.4'
  }

  if (profile.auth !== 'none') {
    packageJson.dependencies['better-auth'] = '^1.4.5'
  }

  if (profile.storage === 'rustfs-s3') {
    packageJson.dependencies['@aws-sdk/client-s3'] = '^3.900.0'
    await writeFile(join(target, 'src', 'lib', 'storage.ts'), `import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const bucket = process.env.S3_BUCKET
if (!bucket) throw new Error('S3_BUCKET is required')

export const storage = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
})

export const putObject = (key: string, body: Uint8Array | string, contentType?: string) =>
  storage.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))

export const getObject = (key: string) =>
  storage.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
`)
    const envPath = join(target, '.env.example')
    const env = await readFile(envPath, 'utf8')
    await writeFile(envPath, `${env.trimEnd()}\n\nS3_ENDPOINT=http://rustfs:9000\nS3_REGION=us-east-1\nS3_BUCKET=app\nS3_ACCESS_KEY_ID=\nS3_SECRET_ACCESS_KEY=\n`)
  }

  if (profile.storage === 'cloudflare-r2') {
    await writeFile(join(target, 'src', 'lib', 'storage.ts'), `import { env } from 'cloudflare:workers'

export const storage = env.BUCKET

export const putObject = (key: string, body: ArrayBuffer | ReadableStream | string, contentType?: string) =>
  storage.put(key, body, contentType ? { httpMetadata: { contentType } } : undefined)

export const getObject = (key: string) => storage.get(key)
`)
  }

  if (profile.database === 'drizzle-postgres') {
    await mkdir(join(target, 'src', 'db'), { recursive: true })
    await writeFile(join(target, 'src', 'db', 'index.ts'), `import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
`)
    await writeFile(join(target, 'src', 'db', 'schema.ts'), `import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const healthcheck = pgTable('healthcheck', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
`)
    await writeFile(join(target, 'drizzle.config.ts'), `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
`)
    const envPath = join(target, '.env.example')
    const env = await readFile(envPath, 'utf8')
    await writeFile(envPath, `${env.trimEnd()}\n\nDATABASE_URL=postgresql://user:password@localhost:5432/app\n`)
  }

  if (profile.database === 'drizzle-d1') {
    packageJson.dependencies['drizzle-orm'] = '^0.44.7'
    await mkdir(join(target, 'src', 'db'), { recursive: true })
    await writeFile(join(target, 'src', 'db', 'index.ts'), `import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from './schema'

export const db = drizzle(env.DB, { schema })
`)
    await writeFile(join(target, 'src', 'db', 'schema.ts'), `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const healthcheck = sqliteTable('healthcheck', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
`)
  }

  if (profile.auth !== 'none') {
    const oidcImports = profile.auth === 'better-auth-oidc'
      ? "import { genericOAuth } from 'better-auth/plugins'\n"
      : ''
    const oidcPlugin = profile.auth === 'better-auth-oidc'
      ? `    genericOAuth({
      config: [{
        providerId: 'keycloak',
        clientId: process.env.KEYCLOAK_CLIENT_ID ?? '',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
        discoveryUrl: process.env.KEYCLOAK_DISCOVERY_URL ?? '',
        scopes: ['openid', 'profile', 'email'],
      }],
    }),
`
      : ''
    const authImports = cloudflareAuth
      ? "import { env } from 'cloudflare:workers'\n"
      : "import { drizzleAdapter } from 'better-auth/adapters/drizzle'\n"
    const dbImport = cloudflareAuth ? '' : "import { db } from '@/db'\n"
    const databaseConfig = cloudflareAuth
      ? '  database: env.DB,'
      : "  database: drizzleAdapter(db, { provider: 'pg' }),"
    const authRuntimeConfig = cloudflareAuth
      ? '  secret: env.BETTER_AUTH_SECRET,\n  baseURL: env.BETTER_AUTH_URL,\n'
      : ''
    const envPrefix = cloudflareAuth ? 'env' : 'process.env'
    const resolvedOidcPlugin = oidcPlugin
      .replaceAll('process.env.', `${envPrefix}.`)
    await writeFile(join(target, 'src', 'lib', 'auth.ts'), `import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
${oidcImports}
${authImports}${dbImport}

export const auth = betterAuth({
${databaseConfig}
${authRuntimeConfig}
  emailAndPassword: { enabled: true },
  plugins: [
${resolvedOidcPlugin}    tanstackStartCookies(),
  ],
})
`)
    await writeFile(join(target, 'src', 'lib', 'auth-client.ts'), `import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
`)
    if (!cloudflareAuth) {
      await mkdir(join(target, 'src', 'routes', 'api', 'auth'), { recursive: true })
      await writeFile(join(target, 'src', 'routes', 'api', 'auth', '$.ts'), `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { auth } = await import('@/lib/auth')
        return auth.handler(request)
      },
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import('@/lib/auth')
        return auth.handler(request)
      },
    },
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)
`)
    }
    const envPath = join(target, '.env.example')
    const env = await readFile(envPath, 'utf8')
    const oidcEnv = profile.auth === 'better-auth-oidc'
      ? 'KEYCLOAK_CLIENT_ID=\nKEYCLOAK_CLIENT_SECRET=\nKEYCLOAK_DISCOVERY_URL=http://localhost:8080/realms/master/.well-known/openid-configuration\n'
      : ''
    await writeFile(envPath, `${env.trimEnd()}\n\nBETTER_AUTH_SECRET=replace-with-a-32-character-secret\nBETTER_AUTH_URL=http://localhost:3000\n${oidcEnv}`)
  }

  if (profile.deployment === 'coolify') {
    packageJson.dependencies.nitro = 'latest'
    packageJson.dependencies.h3 = '^1.15.4'
    packageJson.scripts.start = profile.packageManager === 'bun'
      ? 'bun .output/server/index.mjs'
      : 'node .output/server/index.mjs'
    const vitePath = join(target, 'vite.config.ts')
    const viteConfig = await readFile(vitePath, 'utf8')
    await writeFile(vitePath, viteConfig
      .replace("import { tanstackStart } from '@tanstack/react-start/plugin/vite'", "import { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport { nitro } from 'nitro/vite'")
      .replace('plugins: [tanstackStart(), tailwindcss(), viteReact()],', "nitro: { serverDir: './server' },\n  plugins: [tanstackStart(), tailwindcss(), nitro(), viteReact()],"))
    await writeFile(join(target, 'Dockerfile'), [
      profile.packageManager === 'bun' ? 'FROM oven/bun:1' : 'FROM node:22-bookworm-slim',
      'WORKDIR /app',
      'COPY package.json ./',
      'COPY . .',
      profile.packageManager === 'bun' ? 'RUN bun install && bun run build' : 'RUN corepack enable && pnpm install --no-frozen-lockfile && pnpm run build',
      'ENV HOST=0.0.0.0',
      'EXPOSE 3000',
      profile.packageManager === 'bun' ? 'CMD ["bun", "run", "start"]' : 'CMD ["pnpm", "start"]',
      '',
    ].join('\n'))
    await writeFile(join(target, '.dockerignore'), 'node_modules\ndist\n.output\n.env\n.git\n')
    await mkdir(join(target, 'server', 'routes'), { recursive: true })
    await writeFile(join(target, 'server', 'routes', 'healthz.get.ts'), `import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({ status: 'ok' }))
`)
  }

  if (profile.deployment === 'cloudflare') {
    if (profile.database === 'drizzle-postgres') {
      throw new Error('Cloudflare profile requires database=none or drizzle-d1; use Coolify for PostgreSQL.')
    }
    packageJson.devDependencies['@cloudflare/vite-plugin'] = '^1.26.0'
    packageJson.devDependencies.wrangler = '^4.70.0'
    packageJson.scripts.deploy = `${run} build && ${exec} wrangler deploy`
    packageJson.scripts['cf-typegen'] = `${exec} wrangler types`
    packageJson.scripts.typecheck = `${run} cf-typegen && tsc --noEmit`
    packageJson.scripts.build = `${run} cf-typegen && tsc -b && vite build`
    const tsconfigPath = join(target, 'tsconfig.json')
    const tsconfig = await readFile(tsconfigPath, 'utf8')
    const tsconfigFiles = cloudflareAuth ? '"src/vite-env.d.ts",\n    "src/cloudflare-env.d.ts",\n    "src/server.ts",\n    "worker-configuration.d.ts"' : '"src/vite-env.d.ts",\n    "src/cloudflare-env.d.ts",\n    "worker-configuration.d.ts"'
    await writeFile(tsconfigPath, tsconfig.replace('"src/vite-env.d.ts"', tsconfigFiles))
    await writeFile(join(target, 'src', 'cloudflare-env.d.ts'), `interface __BaseEnv_Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  KEYCLOAK_CLIENT_ID?: string
  KEYCLOAK_CLIENT_SECRET?: string
  KEYCLOAK_DISCOVERY_URL?: string
}
`)
    const workspacePath = join(target, 'pnpm-workspace.yaml')
    const workspaceConfig = await readFile(workspacePath, 'utf8')
    await writeFile(workspacePath, workspaceConfig.replace('allowBuilds:\n  esbuild: true', 'allowBuilds:\n  esbuild: true\n  workerd: true\n  lightningcss: true'))
    const vitePath = join(target, 'vite.config.ts')
    const viteConfig = await readFile(vitePath, 'utf8')
    await writeFile(vitePath, viteConfig
      .replace("import { tanstackStart } from '@tanstack/react-start/plugin/vite'", "import { tanstackStart } from '@tanstack/react-start/plugin/vite'\nimport { cloudflare } from '@cloudflare/vite-plugin'")
      .replace('plugins: [tanstackStart(), tailwindcss(), viteReact()],', "build: { rollupOptions: { external: ['cloudflare:workers'] } },\n  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), tanstackStart(), tailwindcss(), viteReact()],"))
    const wranglerConfig = {
      $schema: 'node_modules/wrangler/config-schema.json',
      name: packageJson.name,
      compatibility_date: '2026-09-17',
      compatibility_flags: ['nodejs_compat'],
      main: cloudflareAuth ? 'src/server.ts' : '@tanstack/react-start/server-entry',
      observability: { enabled: true },
    }
    if (profile.database === 'drizzle-d1') {
      wranglerConfig.d1_databases = [{
        binding: 'DB',
        database_name: `${packageJson.name}-db`,
        database_id: 'replace-after-wrangler-d1-create',
      }]
    }
    if (profile.storage === 'cloudflare-r2') {
      wranglerConfig.r2_buckets = [{ binding: 'BUCKET', bucket_name: `${packageJson.name}-storage` }]
    }
    if (cloudflareAuth) {
      await writeFile(join(target, 'src', 'server.ts'), `import handler from '@tanstack/react-start/server-entry'
import { auth } from './lib/auth'

export default {
  async fetch(request: Request) {
    if (new URL(request.url).pathname.startsWith('/api/auth/')) {
      return auth.handler(request)
    }
    return handler.fetch(request)
  },
}
`)
    }
    await writeFile(join(target, 'wrangler.jsonc'), JSON.stringify(wranglerConfig, null, 2) + '\n')
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
  const selected = {
    packageManager: option(args, 'package-manager'),
    database: option(args, 'database'),
    auth: option(args, 'auth'),
    storage: option(args, 'storage'),
    deployment: option(args, 'deployment'),
  }
  const hasExplicitProfile = Object.values(selected).some(Boolean)
  const rl = yes || hasExplicitProfile ? null : createInterface({ input, output })

  try {
    const projectName = projectArg ?? (rl ? await rl.question('Project name: ') : 'fla-app')
    if (!projectName || projectName.startsWith('-')) throw new Error('Project name is required.')

    const target = resolve(process.cwd(), projectName)
    const profile = {
      ui: defaults.ui,
      packageManager: selected.packageManager ?? defaults.packageManager,
      database: selected.database ?? defaults.database,
      auth: selected.auth ?? defaults.auth,
      storage: selected.storage ?? defaults.storage,
      deployment: selected.deployment ?? defaults.deployment,
    }

    if (rl) {
      profile.packageManager = await choose(rl, 'Package manager / local runtime', [
        { value: 'pnpm', label: 'pnpm' },
        { value: 'bun', label: 'Bun' },
      ], defaults.packageManager)
      profile.database = await choose(rl, 'Database', [
        { value: 'none', label: 'None' },
        { value: 'drizzle-postgres', label: 'Drizzle + PostgreSQL' },
        { value: 'drizzle-d1', label: 'Drizzle + Cloudflare D1' },
      ], defaults.database)
      profile.auth = await choose(rl, 'Authentication', [
        { value: 'none', label: 'None' },
        { value: 'better-auth', label: 'Better Auth' },
        { value: 'better-auth-oidc', label: 'Better Auth + OIDC/Keycloak' },
      ], defaults.auth)
      profile.storage = await choose(rl, 'Storage', [
        { value: 'none', label: 'None' },
        { value: 'rustfs-s3', label: 'RustFS / S3-compatible' },
        { value: 'cloudflare-r2', label: 'Cloudflare R2' },
      ], defaults.storage)
      profile.deployment = await choose(rl, 'Deployment', [
        { value: 'local', label: 'Local' },
        { value: 'coolify', label: 'Coolify' },
        { value: 'cloudflare', label: 'Cloudflare Workers' },
      ], defaults.deployment)
    }

    if (profile.auth !== 'none' && profile.database === 'none') {
      throw new Error('Better Auth requires the Drizzle + PostgreSQL database profile.')
    }
    if (profile.database === 'drizzle-d1' && profile.deployment !== 'cloudflare') {
      throw new Error('Drizzle + D1 requires the Cloudflare Workers deployment profile.')
    }
    if (profile.storage === 'rustfs-s3' && profile.deployment === 'cloudflare') {
      throw new Error('RustFS/S3 storage requires the Coolify or local deployment profile.')
    }
    if (profile.storage === 'cloudflare-r2' && profile.deployment !== 'cloudflare') {
      throw new Error('Cloudflare R2 storage requires the Cloudflare Workers deployment profile.')
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
    packageJson.packageManager = profile.packageManager === 'bun' ? 'bun@1.3.14' : 'pnpm@11'
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log('Next steps:')
    console.log(`  cd ${projectName}`)
    console.log(`  ${profile.packageManager} install`)
    console.log(`  ${profile.packageManager} run dev`)
  } finally {
    rl?.close()
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
