// One-off migration for the 1-grid port-pitch change (branch compact-1grid-pitch).
//
// Halving the pitch moves subcircuit/plexer ports, but .ggc wires store ABSOLUTE endpoints
// with no port reference, so they'd detach on reload. This reads each project05 file, computes
// where every affected port MOVES (using the app's own getConnections, so top/bottom rotated
// edge ports and plexer center/selector ports are handled exactly), and rewrites any wire
// coordinate that sat on an old port to its new position. Connectivity is preserved exactly;
// a mid-wire elbow that didn't coincide with a port may leave a small kink to tidy by hand.
//
// Run from web/:  npx vite-node scripts/migrate-pitch.mjs
// Writes to a NEW sibling directory; the original project05-phpeterson is never touched.

import fs from 'fs'
import path from 'path'
import { componentRegistry } from '@/utils/componentRegistry'

const SRC = '/Users/phil/usfca-cs-tools/gg-solutions/project05-phpeterson'
const DST = '/Users/phil/usfca-cs-tools/gg-solutions/project05-phpeterson-1grid'
const AFFECTED = new Set(['schematic-component', 'multiplexer', 'decoder', 'priorityEncoder'])

const key = (x, y) => `${x},${y}`

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.ggc'))
const parsed = {}
for (const f of files) parsed[f] = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))

fs.mkdirSync(DST, { recursive: true })

let totalMoved = 0
const warnings = []

for (const f of files) {
  const data = parsed[f]
  const remap = new Map() // "oldX,oldY" -> { x, y } (absolute grid coords)

  for (const comp of data.components || []) {
    if (!AFFECTED.has(comp.type)) continue
    const oldPorts = comp.ports || []
    if (!oldPorts.length) continue

    // NEW connection geometry from the app itself.
    let conns
    if (comp.type === 'schematic-component') {
      const child = parsed[comp.props?.filename]
      if (!child) {
        warnings.push(`${f}: ${comp.id} references missing child ${comp.props?.filename}`)
        continue
      }
      const circuitManager = { getCircuit: () => ({ components: child.components || [] }) }
      conns = componentRegistry['schematic-component'].getConnections(
        { ...comp.props, circuitId: comp.props?.circuitId || comp.props?.filename },
        circuitManager
      )
    } else {
      conns = componentRegistry[comp.type].getConnections(comp.props || {})
    }

    // Match old ports to new by (direction, name). Subcircuit connections carry no `name`,
    // but they come back in child-port order, matching the old ports' numeric names.
    const newByKey = new Map()
    conns.inputs.forEach((p, i) => newByKey.set('input:' + (p.name ?? String(i)), p))
    conns.outputs.forEach((p, i) => newByKey.set('output:' + (p.name ?? String(i)), p))

    for (const op of oldPorts) {
      const np = newByKey.get(op.direction + ':' + op.name)
      if (!np) {
        warnings.push(`${f}: ${comp.type} ${comp.id} — no new match for ${op.direction} "${op.name}"`)
        continue
      }
      const oldAbs = key(comp.x + op.x, comp.y + op.y)
      const newAbs = { x: comp.x + np.x, y: comp.y + np.y }
      if (oldAbs !== key(newAbs.x, newAbs.y)) remap.set(oldAbs, newAbs)
      // Keep the serialized ports snapshot consistent with the new geometry (the app would
      // recompute it on load anyway, but a matching file is less surprising to inspect).
      op.x = np.x
      op.y = np.y
    }
  }

  // Rewrite any wire coordinate (endpoints + waypoints) and junction that sat on a moved port.
  let moved = 0
  const fix = pt => {
    if (!pt) return
    const m = remap.get(key(pt.x, pt.y))
    if (m) {
      pt.x = m.x
      pt.y = m.y
      moved++
    }
  }
  for (const w of data.wires || []) {
    fix(w.startConnection?.pos)
    fix(w.endConnection?.pos)
    for (const p of w.points || []) fix(p)
  }
  for (const j of data.wireJunctions || []) fix(j.pos)

  fs.writeFileSync(path.join(DST, f), JSON.stringify(data, null, 2) + '\n')
  totalMoved += moved
  console.log(`${f.padEnd(24)} ${remap.size} ports moved, ${moved} wire coords rewritten`)
}

console.log(`\nDone → ${DST}\n${totalMoved} wire coordinates rewritten across ${files.length} files.`)
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const w of warnings) console.log('  ! ' + w)
}
