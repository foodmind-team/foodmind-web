import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const allowedAdvisories = new Set(['https://github.com/advisories/GHSA-qwww-vcr4-c8h2'])
let output
try {
  const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  output = execFileSync(process.execPath, [npmCli, 'audit', '--json'], { encoding: 'utf8' })
} catch (error) {
  output = error.stdout?.toString() || ''
}

if (!output.trim()) throw new Error('npm audit did not return a JSON report.')
const report = JSON.parse(output)
const vulnerabilities = report.vulnerabilities || {}

function isReviewed(name, seen = new Set()) {
  if (seen.has(name)) return true
  seen.add(name)
  const finding = vulnerabilities[name]
  if (!finding) return false
  return finding.via.every((item) =>
    typeof item === 'string'
      ? isReviewed(item, seen)
      : allowedAdvisories.has(item.url),
  )
}

const blocking = Object.entries(vulnerabilities)
  .filter(([, finding]) => ['high', 'critical'].includes(finding.severity))
  .filter(([name]) => !isReviewed(name))
  .map(([name, finding]) => `${name} (${finding.severity})`)

if (blocking.length) {
  throw new Error(`Unreviewed high-severity dependency findings: ${blocking.join(', ')}`)
}

const reviewed = Object.entries(vulnerabilities)
  .filter(([, finding]) => ['high', 'critical'].includes(finding.severity))
  .map(([name]) => name)
console.log(reviewed.length
  ? `Security gate passed with documented non-reachable advisory: ${reviewed.join(', ')}.`
  : 'Security gate passed with no high-severity dependency findings.')
