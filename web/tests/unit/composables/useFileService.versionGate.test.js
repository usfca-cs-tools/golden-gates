import { describe, it, expect } from 'vitest'
import { useFileService } from '@/composables/useFileService'

const { parseAndValidateJSON } = useFileService()
const doc = extra => JSON.stringify({ components: [], wires: [], ...extra })

describe('parseAndValidateJSON — strict version gate', () => {
  it('accepts the current format (1.6)', () => {
    expect(() => parseAndValidateJSON(doc({ version: '1.6' }))).not.toThrow()
  })

  it('still accepts 1.5 — 1.6 is backward-compatible (the floor stays at 1.5)', () => {
    expect(() => parseAndValidateJSON(doc({ version: '1.5' }))).not.toThrow()
  })

  it('rejects 1.4 loudly — it may carry the collapsed subcircuit ports the 1.5 save fixed', () => {
    let caught
    try {
      parseAndValidateJSON(doc({ version: '1.4' }))
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect(caught.code).toBe('UNSUPPORTED_VERSION')
    expect(caught.message).toMatch(/old file format/i)
  })

  it('rejects an even older format (1.3) loudly with a version code', () => {
    let caught
    try {
      parseAndValidateJSON(doc({ version: '1.3' }))
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect(caught.code).toBe('UNSUPPORTED_VERSION')
    expect(caught.message).toMatch(/old file format/i)
  })

  it('rejects a file with no version', () => {
    expect(() => parseAndValidateJSON(doc({}))).toThrow(/old file format/i)
  })
})
