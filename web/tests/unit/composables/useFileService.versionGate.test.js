import { describe, it, expect } from 'vitest'
import { useFileService } from '@/composables/useFileService'

const { parseAndValidateJSON } = useFileService()
const doc = extra => JSON.stringify({ components: [], wires: [], ...extra })

describe('parseAndValidateJSON — strict version gate', () => {
  it('accepts the current format (1.4)', () => {
    expect(() => parseAndValidateJSON(doc({ version: '1.4' }))).not.toThrow()
  })

  it('rejects an old format (1.3) loudly with a version code', () => {
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
