import { readFile, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const assetsDirectory = new URL('../dist/assets/', import.meta.url)
const assetsPath = fileURLToPath(assetsDirectory)
const indexHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
const entryMatch = indexHtml.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/)
if (!entryMatch) throw new Error('Could not identify the production entry script.')

const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'))
const results = await Promise.all(files.map(async (file) => ({
  file,
  bytes: gzipSync(await readFile(join(assetsPath, file))).byteLength,
})))

const failures = results.filter(({ file, bytes }) => bytes > (file === entryMatch[1] ? 180_000 : 120_000))
if (failures.length) {
  throw new Error(`Bundle budget exceeded: ${failures.map(({ file, bytes }) => `${basename(file)} ${Math.ceil(bytes / 1024)} KB gzip`).join(', ')}`)
}

const entry = results.find(({ file }) => file === entryMatch[1])
if (!entry) throw new Error('Production entry script is missing from the assets directory.')
console.log(`Bundle budgets passed: entry ${Math.ceil(entry.bytes / 1024)} KB gzip; ${results.length - 1} lazy chunks at or below 120 KB gzip.`)
