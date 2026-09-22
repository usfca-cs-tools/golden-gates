// Generate BENCHMARKS.md: GGL's effective clock frequency on the native Python
// interpreter vs. inside Pyodide (the WASM runtime the Golden Gates app runs on).
//
// It runs ggl-engine/scripts/benchmark.py two ways over the SAME synthetic circuits:
//   1. natively (child python3, ggl on PYTHONPATH), and
//   2. by importing that same module inside this repo's pinned Pyodide and calling
//      run_benchmarks() -- so the only difference between the columns is the runtime.
//
// Usage:  node scripts/benchmark-pyodide.mjs        (writes web/BENCHMARKS.md)

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url)) // web/scripts
const web = path.resolve(here, '..')
const gglSrc = path.join(web, 'ggl-engine', 'src')
const scriptsDir = path.join(web, 'ggl-engine', 'scripts')
const benchPy = path.join(scriptsDir, 'benchmark.py')

// Resolve the app's own pinned Pyodide (same version the frontend loads), portably.
const require = createRequire(import.meta.url)
const pyodideDir = path.dirname(require.resolve('pyodide/package.json'))
const { loadPyodide } = await import(pathToFileURL(path.join(pyodideDir, 'pyodide.mjs')).href)

// 1. Native run.
const native = JSON.parse(
  execFileSync('python3', [benchPy], { env: { ...process.env, PYTHONPATH: gglSrc }, encoding: 'utf8' })
)

// 2. Pyodide run of the very same module.
const py = await loadPyodide()
for (const [mnt, root] of [['/ggl_src', gglSrc], ['/ggl_scripts', scriptsDir]]) {
  py.FS.mkdir(mnt)
  py.FS.mount(py.FS.filesystems.NODEFS, { root }, mnt)
}
py.runPython(`import sys; sys.path[:0] = ['/ggl_src', '/ggl_scripts']`)
const pyodide = JSON.parse(py.runPython(`import json, benchmark; json.dumps(benchmark.run_benchmarks())`))

// A register latches on the rising edge, so one full clock CYCLE is two edges.
const clockHz = perEdgeMs => 1000 / (2 * perEdgeMs)
const fmtHz = hz => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`)

const byLabel = Object.fromEntries(pyodide.map(r => [r.label, r]))
const rows = native.map(n => {
  const p = byLabel[n.label]
  return { ...n, py_ms: p.per_edge_ms, tax: p.per_edge_ms / n.per_edge_ms }
})

const table = [
  '| Circuit | deep nodes | settle passes / edge | native ms/edge | native clock | Pyodide ms/edge | Pyodide clock | Pyodide tax |',
  '|---|--:|--:|--:|--:|--:|--:|--:|',
  ...rows.map(
    r =>
      `| ${r.label} | ${r.deep_nodes} | ${r.avg_passes} | ${r.per_edge_ms.toFixed(3)} | ` +
      `${fmtHz(clockHz(r.per_edge_ms))} Hz | ${r.py_ms.toFixed(3)} | ${fmtHz(clockHz(r.py_ms))} Hz | ` +
      `${r.tax.toFixed(1)}× |`
  ),
].join('\n')

const md = `# GGL effective clock frequency

How fast the GGL engine can actually advance a circuit — the ceiling on Run and Run
Tests. This is distinct from the **UI clock frequency** you set on a circuit (e.g. 1 Hz):
that only paces the free-running \`Run\`, whereas tests and the settle engine run at best
effort. The number below is the *effective* clock: full cycles per second the engine
sustains (one cycle = a rising + falling edge; a register latches on the rising edge).

Two runtimes:
- **native** — CPython running the engine headless (what \`grade.py\` / pytest use).
- **Pyodide** — the same engine inside the WASM runtime the Golden Gates web app loads
  (pyodide ${py.version}). This is closer to what a student experiences in the browser.

The circuits are synthetic \`counter-bank ×N\` sweeps (N independent \`reg <- reg + 1\`
counters on one clock), built in \`ggl-engine/scripts/benchmark.py\` — reproducible and
reviewable, no external files. Cost scales with node count; the settle passes per edge
stay flat because the counters share one combinational depth.

${table}

_Numbers are machine-dependent (measured on one host); regenerate to compare. Regenerate with:_
\`\`\`
node scripts/benchmark-pyodide.mjs
\`\`\`
`

const outPath = path.join(web, 'BENCHMARKS.md')
writeFileSync(outPath, md)
console.log(md)
console.error(`\nwrote ${outPath}`)
