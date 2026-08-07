/**
 * Composable for formatting numbers with leading zeros based on bit width
 * @param {number} value - The numeric value to format
 * @param {number} base - The base (2, 10, 16)
 * @param {number} bits - The bit width for padding
 * @returns {string} - Formatted string representation
 */
export function formatWithLeadingZeros(value, base, bits) {
  // Values can be a decimal string (exact 64-bit) or a Number; parse with BigInt so a value above
  // 2**53 formats without rounding. Guard a bad value to 0 rather than throwing.
  let v
  try {
    v = BigInt(value ?? 0)
  } catch {
    v = 0n
  }
  if (base === 16) {
    // Calculate hex digits needed (4 bits per hex digit)
    const hexDigits = Math.ceil(bits / 4)
    return '0x' + v.toString(16).padStart(hexDigits, '0')
  } else if (base === 2) {
    // Pad binary to full bit width
    return '0b' + v.toString(2).padStart(bits, '0')
  } else {
    return v.toString(10)
  }
}

/**
 * Composable hook for number formatting with leading zeros
 * @param {Object} props - Component props containing value, base, and bits
 * @returns {Object} - Object with formatting functions
 */
export function useLeadingZeros(props) {
  const formatValue = () => {
    return formatWithLeadingZeros(props.value, props.base, props.bits)
  }

  return {
    formatValue,
    formatWithLeadingZeros
  }
}
