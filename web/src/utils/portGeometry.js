import { componentRegistry } from './componentRegistry'

/**
 * Compute a component's ports as grid-unit offsets relative to the component
 * origin, each tagged with its name and direction.
 *
 * This reads from the SAME source wire endpoints are derived from — the
 * registry's `getConnections(props)` / static `connections` (see
 * useWireController.startWireDrawing/completeWire) — so a serialized port
 * coordinate is guaranteed to equal the endpoint coordinate of any wire drawn
 * to it. The consumer (ggl.view) adds the component's grid position to recover
 * the absolute coordinate and match it against wire endpoints, holding no
 * geometry rules of its own.
 *
 * Offsets are stored relative (not absolute) so they don't duplicate the
 * component's stored position; a name of the numeric index is used when a port
 * carries no explicit name, mirroring the validator's `port.name || index`.
 *
 * @param {Object} component - circuit component ({ type, x, y, props })
 * @param {Object} [circuitManager] - needed only for schematic-component ports
 * @returns {Array<{name: string, x: number, y: number, direction: 'input'|'output'}>}
 */
export function computeComponentPorts(component, circuitManager = null) {
  const config = componentRegistry[component?.type]
  if (!config) return []

  const conns = config.getConnections
    ? config.getConnections(component.props, circuitManager)
    : config.connections
  if (!conns) return []

  const ports = []
  ;(conns.inputs || []).forEach((p, i) => {
    ports.push({ name: p.name || String(i), x: p.x, y: p.y, direction: 'input' })
  })
  ;(conns.outputs || []).forEach((p, i) => {
    ports.push({ name: p.name || String(i), x: p.x, y: p.y, direction: 'output' })
  })
  return ports
}
