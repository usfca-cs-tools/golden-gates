/**
 * Split an input/output NAME into SVG <tspan> segments, treating `_` as a subscript marker:
 * "IW_0" renders as "IW" with a smaller, lowered "0". Used for pipeline-stage naming in project07
 * (e.g. IW_0, PC_1). The underscore itself is consumed, not drawn.
 *
 * The first segment is the base (normal size, on the baseline); every segment after an underscore
 * is a subscript. Only the FIRST subscript carries the downward shift (`drop`) — later ones inherit
 * that lowered baseline, so "A_B_C" reads as A with a "BC" subscript rather than a descending stair.
 *
 * Callers render inside an existing <text> so the tspans inherit its font/position:
 *   <text ...><tspan v-for="(p,i) in subscriptParts(label)" :key="i"
 *      :font-size="p.subscript ? '0.72em' : null" :dy="p.drop ? '0.22em' : null">{{ p.text }}</tspan></text>
 *
 * @param {string} label
 * @returns {Array<{ text: string, subscript: boolean, drop: boolean }>}
 */
export function subscriptParts(label) {
  return String(label ?? '')
    .split('_')
    .map((text, i) => ({ text, subscript: i > 0, drop: i === 1 }))
}
