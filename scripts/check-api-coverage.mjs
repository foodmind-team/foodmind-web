import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contract = await readFile(resolve(root, 'contracts', 'backend-openapi-v1.yaml'), 'utf8')
const coverage = JSON.parse(await readFile(resolve(root, 'contracts', 'backend-api-coverage.json'), 'utf8'))
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])
const operations = new Set()
let currentPath = null

for (const line of contract.split(/\r?\n/)) {
  const pathMatch = line.match(/^  (\/[^:]+):\s*$/)
  if (pathMatch) {
    currentPath = pathMatch[1]
    continue
  }
  const methodMatch = line.match(/^    ([a-z]+):\s*$/)
  if (currentPath && methodMatch && methods.has(methodMatch[1])) operations.add(`${methodMatch[1].toUpperCase()} ${currentPath}`)
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  }))
  return nested.flat()
}

const usages = new Map()
const callPattern = /api\.(GET|POST|PUT|PATCH|DELETE)\(\s*['"]([^'"]+)['"]/g
for (const source of await sourceFiles(resolve(root, 'src'))) {
  const contents = await readFile(source, 'utf8')
  for (const match of contents.matchAll(callPattern)) usages.set(`${match[1]} ${match[2]}`, relative(root, source).replaceAll('\\', '/'))
}
for (const direct of coverage.directUsages) usages.set(`${direct.method} ${direct.path}`, direct.source)

const exceptions = new Map(coverage.exceptions.map((entry) => [`${entry.method} ${entry.path}`, entry]))
const uncovered = [...operations].filter((operation) => !usages.has(operation) && !exceptions.has(operation))
const unknownUsages = [...usages.keys()].filter((operation) => !operations.has(operation))
const staleExceptions = [...exceptions.keys()].filter((operation) => !operations.has(operation) || usages.has(operation))

if (uncovered.length || unknownUsages.length || staleExceptions.length) {
  const details = [
    uncovered.length ? `Uncovered backend operations: ${uncovered.join(', ')}` : '',
    unknownUsages.length ? `Web calls absent from the contract: ${unknownUsages.join(', ')}` : '',
    staleExceptions.length ? `Stale coverage exceptions: ${staleExceptions.join(', ')}` : '',
  ].filter(Boolean).join('\n')
  throw new Error(details)
}

console.log(`API coverage passed: ${usages.size} operations used; ${exceptions.size} explicitly deferred by the approved media-read constraint.`)
