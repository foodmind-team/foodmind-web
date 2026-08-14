import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = process.env.FOODMIND_BACKEND_ROOT
  ? resolve(process.env.FOODMIND_BACKEND_ROOT)
  : resolve(webRoot, '..', 'foodmind-backend')
const sourcePath = 'src/main/resources/openapi/openapi.yaml'
const requestedCommit = process.argv[2]

if (!requestedCommit || !/^[a-f\d]{40}$/i.test(requestedCommit)) {
  throw new Error('Usage: npm run api:snapshot -- <40-character-backend-commit>')
}

const git = (...args) =>
  execFileSync('git', ['-C', backendRoot, ...args], { encoding: 'utf8' }).trim()

const resolvedCommit = git('rev-parse', `${requestedCommit}^{commit}`)
if (resolvedCommit !== requestedCommit.toLowerCase()) {
  throw new Error('The supplied backend commit did not resolve exactly.')
}

try {
  execFileSync('git', ['-C', backendRoot, 'diff', '--quiet', requestedCommit, '--', sourcePath])
} catch {
  throw new Error('The backend OpenAPI worktree differs from the supplied commit.')
}

const contract = execFileSync(
  'git',
  ['-C', backendRoot, 'show', `${requestedCommit}:${sourcePath}`],
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
)
const versionMatch = contract.match(/^info:\s*\r?\n(?:^[ \t].*\r?\n)*?^[ \t]+version:\s*["']?([^"'\r\n]+)["']?/m)
const outputPath = resolve(webRoot, 'contracts', 'backend-openapi-v1.yaml')
const lockPath = resolve(webRoot, 'contracts', 'backend-openapi-v1.lock.json')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, contract)
await writeFile(
  lockPath,
  `${JSON.stringify(
    {
      sourceRepository: 'foodmind-backend',
      sourcePath,
      backendCommit: requestedCommit,
      openapiInfoVersion: versionMatch?.[1]?.trim() ?? 'unknown',
      sha256: createHash('sha256').update(contract).digest('hex'),
      generator: 'openapi-typescript',
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
)

console.log(`Snapshotted ${requestedCommit} (${contract.length} bytes).`)
