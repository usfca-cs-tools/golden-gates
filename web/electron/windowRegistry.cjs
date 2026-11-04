// Pure bookkeeping for the desktop app's multiple windows. No Electron imports, so it can be
// unit-tested under vitest; main.cjs owns the BrowserWindows and calls into this.
//
// Each Golden Gates window shows at most one project folder, and a folder may be open in only
// one window at a time (two windows saving the same .ggc files would overwrite each other).

const path = require('path')
const fs = require('fs')

/**
 * Canonical form of a project folder path, for "is this folder already open?" comparisons.
 * Resolves `..`/trailing separators and symlinks (when the folder exists), and folds case on
 * macOS/Windows, whose default filesystems are case-insensitive.
 */
function normalizeProjectDir(
  dir,
  { platform = process.platform, realpath = fs.realpathSync } = {}
) {
  if (typeof dir !== 'string' || dir.length === 0) return null
  let resolved = path.resolve(dir)
  try {
    resolved = realpath(resolved)
  } catch {
    // Folder doesn't exist (yet) — compare the resolved path as-is.
  }
  if (resolved.length > 1 && /[\\/]$/.test(resolved)) resolved = resolved.slice(0, -1)
  return platform === 'darwin' || platform === 'win32' ? resolved.toLowerCase() : resolved
}

/** Tracks which window has which project folder open. Windows are identified by numeric id. */
class ProjectWindowRegistry {
  constructor({ normalize = normalizeProjectDir } = {}) {
    this.normalize = normalize
    this.dirs = new Map() // windowId -> { dir (as given), key (normalized) }
  }

  /** Record (or, with a null dir, clear) the project folder shown in a window. */
  setProjectDir(windowId, dir) {
    const key = this.normalize(dir)
    if (key) this.dirs.set(windowId, { dir, key })
    else this.dirs.delete(windowId)
  }

  projectDirOf(windowId) {
    return this.dirs.get(windowId)?.dir ?? null
  }

  hasProject(windowId) {
    return this.dirs.has(windowId)
  }

  /** Id of the window (other than `exceptWindowId`) that has `dir` open, or null. */
  ownerOf(dir, { exceptWindowId = null } = {}) {
    const key = this.normalize(dir)
    if (!key) return null
    for (const [windowId, entry] of this.dirs) {
      if (windowId !== exceptWindowId && entry.key === key) return windowId
    }
    return null
  }

  remove(windowId) {
    this.dirs.delete(windowId)
  }
}

/**
 * Bounds for a new window: offset down-right from `from` (the window it was opened from), like
 * most document apps, wrapping back to the work area's top-left when it would run off-screen.
 */
function cascadeBounds(from, workArea, offset = 28) {
  const width = Math.min(from.width, workArea.width)
  const height = Math.min(from.height, workArea.height)
  let x = from.x + offset
  let y = from.y + offset
  if (x + width > workArea.x + workArea.width || y + height > workArea.y + workArea.height) {
    x = workArea.x
    y = workArea.y
  }
  return { x, y, width, height }
}

/**
 * Which window should receive a folder opened from outside the app (double-clicking a .ggc):
 * the focused window if it's still empty, else any empty window, else null (open a new one).
 * A window is empty when it has no project folder and no unsaved work.
 * `windows` is a list of { id, focused, hasUnsavedWork } in front-to-back order.
 */
function pickWindowForExternalOpen(windows, registry) {
  const empty = windows.filter(w => !registry.hasProject(w.id) && !w.hasUnsavedWork)
  const focusedEmpty = empty.find(w => w.focused)
  return (focusedEmpty || empty[0])?.id ?? null
}

module.exports = {
  normalizeProjectDir,
  ProjectWindowRegistry,
  cascadeBounds,
  pickWindowForExternalOpen
}
