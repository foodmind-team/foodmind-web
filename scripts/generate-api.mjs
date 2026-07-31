import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(webRoot, 'src', 'lib', 'api', 'generated', 'schema.ts')
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'foodmind-contract-'))
const normalizedContractPath = resolve(temporaryDirectory, 'openapi.yaml')

try {
  const sourcePath = resolve(webRoot, 'contracts', 'backend-openapi-v1.yaml')
  const contract = await readFile(sourcePath, 'utf8')
  const invalidReference = "#/components/schemas/ApiError'"
  const occurrences = contract.split(invalidReference).length - 1
  if (occurrences !== 1) {
    throw new Error(`Expected one known ApiError reference defect, found ${occurrences}. Review the backend contract.`)
  }

  // Backend controllers and every shared error response use ApiErrorResponse.
  // Keep the committed snapshot exact and normalize only the generator input.
  const normalizedContract = contract.replace(invalidReference, "#/components/schemas/ApiErrorResponse'")
  await writeFile(normalizedContractPath, normalizedContract)

  execFileSync(
    process.execPath,
    [resolve(webRoot, 'node_modules', 'openapi-typescript', 'bin', 'cli.js'), normalizedContractPath, '-o', outputPath],
    { stdio: 'inherit' },
  )
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
