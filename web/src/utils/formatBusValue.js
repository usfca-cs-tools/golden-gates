/**
 * Format a bus value for the wire hover tooltip (issue #133).
 *
 * A wire carries no per-component number base (unlike Input/Output, whose base is a prop),
 * so show a fixed, debug-friendly form: decimal and hex zero-padded to the bus width.
 *   formatBusValue(42, 6) -> "42  ·  0x2A"
 *
 * Returns '' when there's no value to show (e.g. before a run), so callers can guard on it.
 */
export function formatBusValue(value, bits) {
  if (value == null) return ''
  // Values arrive from the engine as strings so a >2**53 (64-bit) bus value is exact; parse with
  // BigInt. Guard against a non-integer/garbage value by returning '' rather than throwing.
  let v
  try {
    v = BigInt(value)
  } catch {
    return ''
  }
  const hexDigits = Math.max(1, Math.ceil((bits || 1) / 4))
  const hex = v.toString(16).toUpperCase().padStart(hexDigits, '0')
  return `${v}  ·  0x${hex}`
}
