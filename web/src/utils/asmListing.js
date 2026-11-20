const LEADING_LABELS = /^\s*(?:[A-Za-z_.$][\w.$]*:\s*)+/

// Split "code  # comment" at the first # outside '…' or "…" (gg-asm has char literals like '#').
export function splitComment(text) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
    } else if (c === "'" || c === '"') {
      quote = c
    } else if (c === '#') {
      return { code: text.slice(0, i).trim(), comment: text.slice(i).trim() }
    }
  }
  return { code: text.trim(), comment: '' }
}

function labelsByIndex(labels) {
  const map = new Map()
  for (const [name, index] of labels) {
    if (!map.has(index)) map.set(index, [])
    map.get(index).push(name)
  }
  return map
}

export function buildListingRows(source, words = [], wordLines = []) {
  if (!source) return []
  const lines = source.text.split(/\r?\n/)
  const labelsAt = labelsByIndex(source.labels ?? [])
  const rows = [{ kind: 'header', key: 'header', name: source.name }]
  const pushLabels = index => {
    for (const name of labelsAt.get(index) ?? []) rows.push({ kind: 'label', key: `label:${name}`, name })
  }

  for (let address = 0; address < words.length; address++) {
    pushLabels(address)
    const line = wordLines[address]
    const base = { key: `word:${address}`, address, word: words[address] }
    if (address > 0 && line === wordLines[address - 1]) {
      rows.push({ ...base, kind: 'continuation' })
    } else {
      // A label on the same line ("loop: addi …") already has its own row, so strip it here.
      const text = (lines[line - 1] ?? '').replace(LEADING_LABELS, '')
      rows.push({ ...base, kind: 'instruction', line, ...splitComment(text) })
    }
  }
  pushLabels(words.length) // labels after the last instruction
  return rows
}