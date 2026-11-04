import { describe, it, expect } from 'vitest'
import windowRegistry from '../../../electron/windowRegistry.cjs'

const { normalizeProjectDir, ProjectWindowRegistry, cascadeBounds, pickWindowForExternalOpen } =
  windowRegistry

// Deterministic normalization for tests: no filesystem access, Linux (case-sensitive) rules.
const linuxNoFs = dir =>
  normalizeProjectDir(dir, {
    platform: 'linux',
    realpath: () => {
      throw new Error('ENOENT')
    }
  })

describe('normalizeProjectDir', () => {
  const noFs = {
    realpath: () => {
      throw new Error('ENOENT')
    }
  }

  it('returns null for empty input', () => {
    expect(normalizeProjectDir(null)).toBeNull()
    expect(normalizeProjectDir('')).toBeNull()
  })

  it('resolves .. segments and trailing separators', () => {
    expect(normalizeProjectDir('/a/b/../proj/', { platform: 'linux', ...noFs })).toBe('/a/proj')
  })

  it('folds case on macOS and Windows but not Linux', () => {
    expect(normalizeProjectDir('/Users/Me/Proj', { platform: 'darwin', ...noFs })).toBe(
      '/users/me/proj'
    )
    expect(normalizeProjectDir('/Users/Me/Proj', { platform: 'linux', ...noFs })).toBe(
      '/Users/Me/Proj'
    )
  })

  it('follows symlinks when the folder exists', () => {
    const realpath = p => (p === '/link/proj' ? '/real/proj' : p)
    expect(normalizeProjectDir('/link/proj', { platform: 'linux', realpath })).toBe('/real/proj')
  })
})

describe('ProjectWindowRegistry', () => {
  it('finds the window that has a folder open', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    reg.setProjectDir(1, '/projects/alu')
    reg.setProjectDir(2, '/projects/cpu')

    expect(reg.ownerOf('/projects/cpu')).toBe(2)
    expect(reg.ownerOf('/projects/cpu/')).toBe(2) // same folder, different spelling
    expect(reg.ownerOf('/projects/other')).toBeNull()
  })

  it('ignores the asking window itself (re-opening your own folder is allowed)', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    reg.setProjectDir(1, '/projects/alu')

    expect(reg.ownerOf('/projects/alu', { exceptWindowId: 1 })).toBeNull()
    expect(reg.ownerOf('/projects/alu', { exceptWindowId: 2 })).toBe(1)
  })

  it('releases a folder when the window switches folders, clears it, or closes', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    reg.setProjectDir(1, '/projects/alu')
    reg.setProjectDir(1, '/projects/cpu')
    expect(reg.ownerOf('/projects/alu')).toBeNull()
    expect(reg.projectDirOf(1)).toBe('/projects/cpu')

    reg.setProjectDir(1, null)
    expect(reg.hasProject(1)).toBe(false)

    reg.setProjectDir(2, '/projects/regfile')
    reg.remove(2)
    expect(reg.ownerOf('/projects/regfile')).toBeNull()
  })
})

describe('cascadeBounds', () => {
  const workArea = { x: 0, y: 25, width: 1440, height: 875 }

  it('offsets a new window down and right of the one it came from', () => {
    expect(cascadeBounds({ x: 100, y: 100, width: 800, height: 600 }, workArea)).toEqual({
      x: 128,
      y: 128,
      width: 800,
      height: 600
    })
  })

  it('wraps to the top-left of the work area instead of running off-screen', () => {
    expect(cascadeBounds({ x: 600, y: 300, width: 800, height: 600 }, workArea)).toEqual({
      x: 0,
      y: 25,
      width: 800,
      height: 600
    })
  })

  it('never makes a window larger than the work area', () => {
    const b = cascadeBounds({ x: 0, y: 0, width: 3000, height: 2000 }, workArea)
    expect(b.width).toBe(1440)
    expect(b.height).toBe(875)
  })
})

describe('pickWindowForExternalOpen', () => {
  it('prefers the focused window when it is empty', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    const windows = [
      { id: 1, focused: false, hasUnsavedWork: false },
      { id: 2, focused: true, hasUnsavedWork: false }
    ]
    expect(pickWindowForExternalOpen(windows, reg)).toBe(2)
  })

  it('skips windows that have a project or unsaved work', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    reg.setProjectDir(1, '/projects/alu')
    const windows = [
      { id: 1, focused: true, hasUnsavedWork: false },
      { id: 2, focused: false, hasUnsavedWork: true },
      { id: 3, focused: false, hasUnsavedWork: false }
    ]
    expect(pickWindowForExternalOpen(windows, reg)).toBe(3)
  })

  it('returns null when every window is busy, meaning open a new window', () => {
    const reg = new ProjectWindowRegistry({ normalize: linuxNoFs })
    reg.setProjectDir(1, '/projects/alu')
    expect(
      pickWindowForExternalOpen([{ id: 1, focused: true, hasUnsavedWork: false }], reg)
    ).toBeNull()
  })
})
