/**
 * `.ggc` format-version helpers.
 *
 * A version string is `"major.minor"` (e.g. `"1.6"`). Compare NUMERICALLY, never
 * as strings — `'1.10' < '1.6'` is true lexically but false by version. These are
 * shared by the load-time version gate (useFileService) and the port-ordering gate
 * (componentRegistry / SchematicComponent), so the two never drift apart.
 */

/** Parse `"1.6"` → `[1, 6]`; missing/garbage parts read as 0 (so `"" → [0, 0]`). */
export function parseVersion(version) {
  const parts = String(version || '')
    .split('.')
    .map(n => parseInt(n, 10) || 0)
  return [parts[0] || 0, parts[1] || 0]
}

/** True when `version` is >= `[major, minor]` (numeric compare). */
export function atLeast(version, [major, minor]) {
  const [maj, min] = parseVersion(version)
  return maj > major || (maj === major && min >= minor)
}
