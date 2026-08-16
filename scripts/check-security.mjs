import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

let output
try {
  const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  output = execFileSync(process.execPath, [npmCli, 'audit', '--json'], { encoding: 'utf8' })
} catch (error) {
  output = error.stdout?.toString() || ''
}

if (!output.trim()) throw new Error('npm audit did not return a JSON report.')
const report = JSON.parse(output)
if (report.error) {
  throw new Error(`npm audit failed: ${report.error.summary || report.error.code || 'unknown error'}`)
}
if (!report.metadata?.vulnerabilities) {
  throw new Error('npm audit returned an incomplete report without vulnerability totals.')
}
const vulnerabilities = report.vulnerabilities || {}

const blocking = Object.entries(vulnerabilities)
  .filter(([, finding]) => ['moderate', 'high', 'critical'].includes(finding.severity))
  .map(([name, finding]) => `${name} (${finding.severity})`)

if (blocking.length) {
  throw new Error(`Medium-or-higher dependency findings: ${blocking.join(', ')}`)
}

console.log('Security gate passed with no Medium-or-higher dependency findings.')
