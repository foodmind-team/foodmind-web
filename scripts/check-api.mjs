import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'foodmind-api-'))
const temporarySchema = resolve(temporaryDirectory, 'schema.ts')

try {
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
  console.log('Generated API schema matches the committed contract.')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
