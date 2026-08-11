import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = resolve(webRoot, '..', 'foodmind-backend')
const contractPath = resolve(webRoot, 'contracts', 'backend-openapi-v1.yaml')
const lockPath = resolve(webRoot, 'contracts', 'backend-openapi-v1.lock.json')
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'foodmind-api-'))
const temporarySchema = resolve(temporaryDirectory, 'schema.ts')

try {
  const [contract, lockContents] = await Promise.all([
    readFile(contractPath, 'utf8'),
    readFile(lockPath, 'utf8'),
  ])
  const lock = JSON.parse(lockContents)
  if (lock.sourceRepository !== 'foodmind-backend' ||
      lock.sourcePath !== 'src/main/resources/openapi/openapi.yaml' ||
      !/^[a-f\d]{40}$/i.test(lock.backendCommit ?? '') ||
      !/^[a-f\d]{64}$/i.test(lock.sha256 ?? '')) {
    throw new Error('Backend OpenAPI lock metadata is incomplete or invalid.')
  }

  const digest = createHash('sha256').update(contract).digest('hex')
  if (digest !== lock.sha256) {
    throw new Error('Backend OpenAPI snapshot SHA-256 does not match its lock.')
  }

  if (existsSync(resolve(backendRoot, '.git'))) {
    const git = (...args) => execFileSync('git', ['-C', backendRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim()
    const resolvedCommit = git('rev-parse', `${lock.backendCommit}^{commit}`)
    if (resolvedCommit !== lock.backendCommit.toLowerCase()) {
      throw new Error('Backend OpenAPI lock commit does not resolve exactly.')
    }
    const committedSource = execFileSync(
      'git',
      ['-C', backendRoot, 'show', `${lock.backendCommit}:${lock.sourcePath}`],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    )
    if (committedSource.replaceAll('\r\n', '\n') !== contract.replaceAll('\r\n', '\n')) {
      throw new Error('Backend OpenAPI snapshot differs from its locked backend commit.')
    }
  }
  const sourceInput = process.env.FOODMIND_BACKEND_OPENAPI ??
    (existsSync(resolve(backendRoot, lock.sourcePath)) ? resolve(backendRoot, lock.sourcePath) : null)
  if (sourceInput) {
    const backendSource = await readFile(sourceInput, 'utf8')
    if (backendSource.replaceAll('\r\n', '\n') !== contract.replaceAll('\r\n', '\n')) {
      throw new Error('Backend OpenAPI source differs from the Web snapshot. Run api:snapshot after committing the backend contract.')
    }
  }

  execFileSync(process.execPath, [resolve(webRoot, 'scripts', 'generate-api.mjs'), temporarySchema], {
    stdio: 'inherit',
  })
  const [expected, actual] = await Promise.all([
    readFile(resolve(webRoot, 'src', 'lib', 'api', 'generated', 'schema.ts'), 'utf8'),
    readFile(temporarySchema, 'utf8'),
  ])
  if (expected.replaceAll('\r\n', '\n') !== actual.replaceAll('\r\n', '\n')) {
    throw new Error('Generated API schema is out of date. Run npm run api:generate.')
  }
  console.log(`Generated API schema and backend source match ${lock.backendCommit}.`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
