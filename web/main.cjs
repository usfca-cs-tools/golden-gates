// main.js acts as the "backend" of the desktop app.
// It does three things: creates the window, loads your Vue app into it,
// and listens for file save/open requests from the Vue side.


const { app, BrowserWindow, ipcMain, dialog, Menu, screen } = require('electron')
const fs = require('fs')
const path = require('path')
const {
  ProjectWindowRegistry,
  cascadeBounds,
  pickWindowForExternalOpen
} = require('./electron/windowRegistry.cjs')
app.name = 'Golden Gates'

// Remember the window's size and position across runs, so the app reopens where the user left
// it. Persisted to a small JSON file in userData (no extra dependency). Best-effort: any read
// or write failure just falls back to the default 1280x800.
function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'))
    if (!Number.isFinite(s.width) || !Number.isFinite(s.height)) return null
    // Drop a saved position that no longer overlaps any connected display (e.g. an external
    // monitor was unplugged) so the window can't reopen off-screen; fall back to centering.
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
      const visible = screen.getAllDisplays().some(d => {
        const wa = d.workArea
        return (
          s.x < wa.x + wa.width &&
          s.x + s.width > wa.x &&
          s.y < wa.y + wa.height &&
          s.y + s.height > wa.y
        )
      })
      if (!visible) {
        delete s.x
        delete s.y
      }
    }
    return s
  } catch {
    return null
  }
}

// With several windows open, the one most recently moved/resized (or closed) wins, so the next
// launch reopens where the user last arranged a window.
let persistStateTimer = null
function persistWindowState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return
  try {
    // getNormalBounds() is the un-maximized size, so a maximized session doesn't persist a
    // full-screen rectangle that would be awkward to restore.
    fs.writeFileSync(windowStatePath(), JSON.stringify(win.getNormalBounds()))
  } catch {
    /* ignore write failures */
  }
}

// Debounce the persist so a drag-resize doesn't hammer the disk every frame.
function scheduleWindowStateSave(win) {
  clearTimeout(persistStateTimer)
  persistStateTimer = setTimeout(() => persistWindowState(win), 400)
}

// Build identity, written at build time by scripts/gen-build-info.cjs and bundled
// into the app. Missing => a bare `electron .` run that skipped the generator; fall
// back to a clearly-local identity rather than crashing.
const buildInfo = (() => {
  try {
    return require('./build-info.json')
  } catch {
    return { id: 'dev', channel: 'local', sha: 'unknown', date: null }
  }
})()

// "About Golden Gates": show the build id and, bluntly, which channel it came from
// so a user can tell a tagged release from an unvetted rolling build.
function showAboutDialog() {
  const channelLine =
    buildInfo.channel === 'release'
      ? `Release build ${buildInfo.id}` // a tagged release: show its version/tag
      : buildInfo.channel === 'dev'
        ? 'Development build — rolling “latest”, may be unstable'
        : 'Local development build'
  // Build identity, set off from the channel line by a blank line. The date is paired
  // with the commit hash because it's the commit's date, not the build time.
  const details = []
  if (buildInfo.sha && buildInfo.sha !== 'unknown') {
    const dated = buildInfo.commitDate ? ` · ${buildInfo.commitDate}` : ''
    details.push(`commit ${buildInfo.sha}${dated}`)
  }
  if (buildInfo.runNumber) details.push(`build run ${buildInfo.runNumber}`)
  const detail = details.length ? [channelLine, '', ...details].join('\n') : channelLine
  dialog.showMessageBox(activeWindow() || undefined, {
    // A dev/local build gets the warning icon; a real release gets the info icon.
    type: buildInfo.channel === 'release' ? 'info' : 'warning',
    title: 'About Golden Gates',
    message: 'Golden Gates',
    detail,
    buttons: ['OK'],
    defaultId: 0
  })
}

// Auto-update, from tagged (stable) releases only. Gated hard: only a packaged, signed,
// tagged build ever checks — because on macOS Squirrel rejects an unsigned update anyway,
// and dev/rolling builds shouldn't self-update. `buildInfo.signed` is false until Developer
// ID signing is configured, so this is a no-op today. electron-updater defaults to
// allowPrerelease:false, so it ignores the rolling `latest` prerelease and only moves
// between tagged releases. The dependency is required lazily so unsigned/local runs (which
// may not have it bundled) never touch it.
function maybeCheckForUpdates() {
  if (!app.isPackaged || !buildInfo.signed || buildInfo.channel !== 'release') return
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.warn('auto-update check skipped:', err && err.message)
  }
}

// Multiple windows: each BrowserWindow runs its own copy of the Vue app with its own project
// folder, tabs, undo history and simulation engine. `windowState` holds main-process bookkeeping
// per window; `projects` records which folder each window has open (one window per folder).
const windowState = new Map() // webContents-independent BrowserWindow.id -> state (see createWindow)
const projects = new ProjectWindowRegistry()
let pendingFilePath = null // project dir opened (Finder / command line) before the app is ready

// Save-on-quit state. A full app quit (Cmd-Q, menu Quit) walks every window with unsaved changes
// and prompts for each in turn (see the 'before-quit' handler); `quitInProgress` is true while
// that walk runs, and `quitConfirmed` once every window has been saved or discarded so the
// windows may close without prompting again.
let quitInProgress = false
let quitConfirmed = false

function liveWindows() {
  return BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && windowState.has(w.id))
}

// The window menu commands act on: the focused one, else the most recently focused one.
function activeWindow() {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && windowState.has(focused.id)) return focused
  let latest = null
  for (const w of liveWindows()) {
    if (!latest || windowState.get(w.id).lastFocused > windowState.get(latest.id).lastFocused) {
      latest = w
    }
  }
  return latest
}

function bringToFront(win) {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// A folder can be open in only one window: two windows saving the same .ggc files would
// silently overwrite each other's work. Bring the window that has it to the front and say so.
function showFolderAlreadyOpen(ownerWin, dirPath) {
  bringToFront(ownerWin)
  dialog.showMessageBox(ownerWin, {
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    message: 'Folder already open',
    detail: `“${path.basename(dirPath)}” is already open in this window. A folder can only be ` +
      'open in one Golden Gates window at a time.'
  })
}

// Returns true if `dirPath` may be opened in `requestingWin` (null = a new window); otherwise
// shows the "already open" message on the window that has it and returns false.
function claimCheck(dirPath, requestingWin) {
  const ownerId = projects.ownerOf(dirPath, { exceptWindowId: requestingWin?.id ?? null })
  const owner = ownerId != null ? BrowserWindow.fromId(ownerId) : null
  if (!owner || owner.isDestroyed()) return true
  showFolderAlreadyOpen(owner, dirPath)
  return false
}

function updateWindowTitle(win) {
  const dir = projects.projectDirOf(win.id)
  win.setTitle(dir ? `${path.basename(dir)} — Golden Gates` : 'Golden Gates')
}

async function windowHasUnsavedChanges(win) {
  try {
    return !!(await win.webContents.executeJavaScript(
      'window.__ggHasUnsavedChanges ? window.__ggHasUnsavedChanges() : false'
    ))
  } catch {
    return false
  }
}

// Windows/Linux pass the path of an associated file as a command-line argument
// when the app is launched (or re-launched) by double-clicking it. Pick out the
// .ggc path, ignoring the executable and any Chromium/Electron flags.
function getFilePathFromArgv(argv) {
  return (
    argv.find(arg => !arg.startsWith('-') && arg.toLowerCase().endsWith('.ggc')) ||
    null
  )
}

// Load a project folder into a window (optionally focusing the file that triggered the open).
// The renderer asks before replacing work it already has.
function sendOpenProject(win, dirPath, activeFile = null) {
  const state = windowState.get(win.id)
  if (state && !state.loaded) {
    state.pendingOpen = { dirPath, activeFile } // delivered on did-finish-load
  } else {
    win.webContents.send('open-project', { dirPath, activeFile })
  }
  bringToFront(win)
}

// Open a folder in a brand-new window. The folder is reserved for that window immediately, so it
// can't be opened a second time while the new window is still starting up.
function openProjectInNewWindow(dirPath, activeFile = null, fromWin = activeWindow()) {
  if (!claimCheck(dirPath, null)) return
  const win = createWindow({ fromWin })
  projects.setProjectDir(win.id, dirPath)
  updateWindowTitle(win)
  sendOpenProject(win, dirPath, activeFile)
}

// A folder opened from outside the app (double-clicking a .ggc in Finder/Explorer, or a second
// launch on Windows/Linux): reuse an empty window if there is one, otherwise open a new window
// rather than replacing a project the user is working on.
async function openProjectDir(dirPath, activeFile = null) {
  if (!dirPath) return
  if (!app.isReady()) {
    pendingFilePath = { dirPath, activeFile }
    return
  }
  if (!claimCheck(dirPath, null)) return
  const focused = BrowserWindow.getFocusedWindow()
  const candidates = []
  for (const w of liveWindows()) {
    candidates.push({
      id: w.id,
      focused: w === focused,
      hasUnsavedWork: await windowHasUnsavedChanges(w)
    })
  }
  const targetId = pickWindowForExternalOpen(candidates, projects)
  const target = targetId != null ? BrowserWindow.fromId(targetId) : null
  if (target) sendOpenProject(target, dirPath, activeFile)
  else openProjectInNewWindow(dirPath, activeFile)
}

// Keep a single running instance so a second double-click reuses this window
// instead of spawning a new process (Windows/Linux). macOS is single-instance
// by default and delivers files through the 'open-file' event instead.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // Fired in the primary instance when a second instance is launched — e.g. the
  // user double-clicked a .ggc file while the app was already running. The new
  // process's argv carries the file path.
  app.on('second-instance', (_event, argv) => {
    const filePath = getFilePathFromArgv(argv)
    if (filePath) {
      openProjectDir(path.dirname(filePath), path.basename(filePath))
    } else {
      const win = activeWindow()
      if (win) bringToFront(win)
      else createWindow()
    }
  })

  // macOS: capture double-click open-file events
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    openProjectDir(path.dirname(filePath), path.basename(filePath))
  })

  app.whenReady().then(() => {
    // Windows/Linux cold start: the double-clicked file is on our command line.
    if (process.platform !== 'darwin' && !pendingFilePath) {
      const filePath = getFilePathFromArgv(process.argv)
      if (filePath) pendingFilePath = { dirPath: path.dirname(filePath), activeFile: path.basename(filePath) }
    }

    const isMac = process.platform === 'darwin'

    // Native menu bar. On macOS the first submenu is the app menu (Golden Gates);
    // that's where About belongs. Windows/Linux have no app menu, so About goes
    // under Help. Either way it opens the same channel-aware About dialog.
    // Send a one-off event to the window the menu click applies to (Electron passes the focused
    // window as the click handler's second argument; fall back to the last-focused one).
    const targetWindow = win => (win && !win.isDestroyed() && windowState.has(win.id) ? win : activeWindow())
    const sendMenu = channel => (_item, win) => {
      const target = targetWindow(win)
      if (target) target.webContents.send(channel)
    }

    const menuTemplate = [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { label: 'About Golden Gates', click: showAboutDialog },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
              ]
            }
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Circuit',
            accelerator: 'CmdOrCtrl+N',
            click: sendMenu('menu-new-circuit')
          },
          {
            // A separate, empty Golden Gates window, e.g. to open another project alongside this
            // one and copy circuits between them.
            label: 'New Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: (_item, win) => {
              const fromWin = targetWindow(win)
              const created = createWindow({ fromWin })
              bringToFront(created)
            }
          },
          { type: 'separator' },
          {
            // A project is a folder of .ggc files, so opening is always "open a folder".
            // (Double-clicking a .ggc in Finder still opens its folder via app.on('open-file').)
            // Opens in the current window, which asks before replacing its work.
            label: 'Open Folder...',
            accelerator: 'CmdOrCtrl+O',
            click: async (_item, win) => {
              const target = targetWindow(win)
              const { filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
              })
              if (filePaths.length === 0) return
              if (!target || target.isDestroyed()) {
                openProjectInNewWindow(filePaths[0])
              } else if (claimCheck(filePaths[0], target)) {
                sendOpenProject(target, filePaths[0])
              }
            }
          },
          {
            label: 'Open Folder in New Window...',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: async (_item, win) => {
              const fromWin = targetWindow(win)
              const { filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
              })
              if (filePaths.length > 0) openProjectInNewWindow(filePaths[0], null, fromWin)
            }
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: sendMenu('menu-save-circuit')
          },
          {
            label: 'Save As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: sendMenu('menu-save-circuit-as')
          },
          { type: 'separator' },
          // Close Window (Cmd/Ctrl+W); the window's own save prompt still applies.
          { role: 'close' }
        ]
      },
      {
        // macOS routes the clipboard/undo key equivalents (Cmd+X/C/V/A/Z) to a focused text
        // input ONLY when matching menu items with these roles exist — without this Edit menu,
        // paste doesn't work in property-pane fields. On the canvas (nothing editable focused)
        // the roles no-op and the renderer's own keydown handles component copy/paste, so the
        // two don't collide.
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            // No accelerator on purpose: clearing a circuit is destructive, so it must be a
            // deliberate menu choice, never a stray keystroke.
            label: 'Clear Circuit',
            click: sendMenu('menu-clear-circuit')
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            // Checkbox so the menu shows whether DevTools is currently open. The
            // packaged app builds a fully custom menu (no default View menu), so this
            // is the only way to open the renderer console — where the generated GGL
            // program is logged. The checked state is kept in sync in createWindow()
            // via the webContents devtools-opened/closed events, so it stays correct
            // even when DevTools is closed from its own UI or the accelerator.
            id: 'toggle-devtools',
            label: 'Developer Tools',
            type: 'checkbox',
            checked: false,
            accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
            click: (_item, win) => {
              const target = targetWindow(win)
              if (!target) return
              const wc = target.webContents
              if (wc.isDevToolsOpened()) wc.closeDevTools()
              else wc.openDevTools()
            }
          }
        ]
      },
      {
        label: 'Simulation',
        submenu: [
          { label: 'Run', accelerator: 'CmdOrCtrl+R', click: sendMenu('menu-run') },
          { label: 'Step Clock', accelerator: 'CmdOrCtrl+K', click: sendMenu('menu-step-clock') },
          { label: 'Stop', accelerator: 'CmdOrCtrl+.', click: sendMenu('menu-stop') },
          { type: 'separator' },
          { label: 'Run Tests', accelerator: 'CmdOrCtrl+T', click: sendMenu('menu-run-tests') }
        ]
      },
      // Lists the open Golden Gates windows (macOS) so users can switch between projects.
      { role: 'windowMenu' },
      // macOS already has About in the app menu; elsewhere it lives under Help.
      ...(isMac
        ? []
        : [
            {
              role: 'help',
              submenu: [{ label: 'About Golden Gates', click: showAboutDialog }]
            }
          ])
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

    // Keep the View → Developer Tools checkbox showing the focused window's DevTools state.
    app.on('browser-window-focus', (_e, win) => {
      const state = windowState.get(win.id)
      if (state) state.lastFocused = Date.now()
      syncDevToolsChecked()
    })

    const first = createWindow()
    if (pendingFilePath) {
      const { dirPath, activeFile } = pendingFilePath
      pendingFilePath = null
      projects.setProjectDir(first.id, dirPath)
      updateWindowTitle(first)
      sendOpenProject(first, dirPath, activeFile)
    }
    maybeCheckForUpdates() // no-op unless this is a signed, tagged build
  })

  app.on('activate', () => {
    if (liveWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // A full app quit (Cmd-Q, menu Quit) fires before-quit before any window closes. Hold the quit,
  // then go through the windows one at a time: each one with unsaved changes comes to the front
  // and asks Save / Don't Save / Cancel. Cancel (or a failed save) in any window stops the whole
  // quit, so nothing is lost; once every window is settled, quit for real.
  app.on('before-quit', async e => {
    if (quitConfirmed) return
    e.preventDefault()
    if (quitInProgress) return
    // A window is already showing its own close prompt — let the user answer that first.
    if ([...windowState.values()].some(s => s.closePromptOpen)) return
    quitInProgress = true
    try {
      const focused = activeWindow()
      const ordered = liveWindows().sort((a, b) => (a === focused ? -1 : b === focused ? 1 : 0))
      for (const win of ordered) {
        if (win.isDestroyed()) continue
        if (!(await confirmCloseWindow(win, { quitting: true }))) return
      }
      quitConfirmed = true
      const last = activeWindow()
      if (last) persistWindowState(last)
      app.quit()
    } finally {
      quitInProgress = false
    }
  })
}

// Keep the View → Developer Tools checkbox in sync with the active window's real DevTools state,
// so it reflects reality even when DevTools is closed from its own toolbar or the accelerator.
function syncDevToolsChecked() {
  const item = Menu.getApplicationMenu()?.getMenuItemById('toggle-devtools')
  const win = activeWindow()
  if (item) item.checked = !!(win && win.webContents.isDevToolsOpened())
}

// Save-on-close: unsaved circuit changes must not silently vanish (they'd never reach the .ggc
// project files a student commits). Ask the window's renderer whether anything is unsaved, and if
// so prompt Save / Don't Save / Cancel. Disk is the source of truth, so "Save" writes the whole
// project. Resolves true if the window may close (nothing unsaved, saved, or discarded), false on
// Cancel or a failed/cancelled save.
async function confirmCloseWindow(win, { quitting = false } = {}) {
  if (!(await windowHasUnsavedChanges(win))) return true
  if (win.isDestroyed()) return true

  bringToFront(win) // with several windows, show which project the prompt is about
  const dir = projects.projectDirOf(win.id)
  const name = dir ? `“${path.basename(dir)}”` : 'this window'
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: quitting
      ? `Save changes to ${name} before quitting?`
      : `Save changes to ${name} before closing?`,
    detail:
      'Your circuit has unsaved changes. Anything not saved is not written to your project ' +
      'files, so it will not be committed or graded.'
  })

  if (response === 2) return false // Cancel
  if (response === 1) return true // Don't Save

  // Save: only close if the save actually succeeded.
  try {
    return !!(await win.webContents.executeJavaScript(
      'window.__ggSaveAll ? window.__ggSaveAll() : false'
    ))
  } catch {
    return false
  }
}

// Create a Golden Gates window. The first window of a run restores the saved size/position; a
// window opened from another one (New Window, Open Folder in New Window) cascades from it.
function createWindow({ fromWin = null } = {}) {
  let bounds
  if (fromWin && !fromWin.isDestroyed()) {
    const from = fromWin.getNormalBounds()
    bounds = cascadeBounds(from, screen.getDisplayMatching(from).workArea)
  } else {
    const savedState = loadWindowState()
    bounds = {
      width: savedState?.width ?? 1280,
      height: savedState?.height ?? 800,
      // Only restore an explicit position when we have a validated (on-screen) one; otherwise
      // let the OS center the window as it does by default.
      ...(Number.isFinite(savedState?.x) && Number.isFinite(savedState?.y)
        ? { x: savedState.x, y: savedState.y }
        : {})
    }
  }

  const win = new BrowserWindow({
    ...bounds,
    title: 'Golden Gates',
    // macOS: hide the native title bar and let AppToolbar act as the drag region (issue #141).
    // With the native title bar, Electron clamps a drag at the top of the current display, so the
    // window can't be dragged onto a monitor arranged above it; a CSS drag region isn't clamped.
    // The traffic lights are centered in the 48px toolbar, which pads its left edge to clear them.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 17 } }
      : {}),
    icon: path.join(__dirname, 'assets/icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  })
  const id = win.id // win.id is unreadable once the window is destroyed; keep it for cleanup
  const state = {
    loaded: false, // renderer finished loading (can receive open-project)
    pendingOpen: null, // { dirPath, activeFile } to send once loaded
    readyToClose: false, // the user confirmed this window's close (saved or discarded)
    closePromptOpen: false, // this window's Save / Don't Save / Cancel prompt is showing
    lastFocused: Date.now()
  }
  windowState.set(id, state)
  win.loadFile('dist/index.html')

  // Persist size/position as the user resizes or moves the window (debounced).
  win.on('resize', () => scheduleWindowStateSave(win))
  win.on('move', () => scheduleWindowStateSave(win))

  // The window title names the project (Window menu, Mission Control, taskbar), so keep the
  // page's <title> from overwriting it.
  win.on('page-title-updated', e => e.preventDefault())

  win.webContents.on('devtools-opened', syncDevToolsChecked)
  win.webContents.on('devtools-closed', syncDevToolsChecked)

  // Once the renderer is ready, send any queued project directory
  win.webContents.on('did-finish-load', () => {
    state.loaded = true
    if (state.pendingOpen) {
      const { dirPath, activeFile } = state.pendingOpen
      state.pendingOpen = null
      win.webContents.send('open-project', { dirPath, activeFile })
    }
  })

  // Closing one window (red button / Cmd-W / Ctrl-W) prompts for that window only. During an app
  // quit, the 'before-quit' walk has already prompted, so the close goes straight through.
  win.on('close', async e => {
    if (state.readyToClose || quitConfirmed) {
      persistWindowState(win) // flush final size/position before the window goes away
      return
    }
    e.preventDefault()
    if (state.closePromptOpen || quitInProgress) return
    state.closePromptOpen = true
    let mayClose = false
    try {
      mayClose = await confirmCloseWindow(win)
    } finally {
      state.closePromptOpen = false
    }
    if (mayClose && !win.isDestroyed()) {
      state.readyToClose = true
      win.close()
    }
  })

  // Forget the window (and release its project folder) once it's gone.
  win.on('closed', () => {
    windowState.delete(id)
    projects.remove(id)
    syncDevToolsChecked()
  })

  return win
}

// Pick a project directory via dialog (used when no path is provided by the caller)
ipcMain.handle('pick-project-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

// Open project: list all .ggc files in the directory. Refused (with the "Folder already open"
// message on the window that has it) when another window already has this folder open.
ipcMain.handle('open-project', async (event, dirPath) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!claimCheck(dirPath, win)) return { dirPath, files: [], alreadyOpenElsewhere: true }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ggc'))
  // Reserve the folder for this window now; the renderer confirms (or releases) it with
  // report-project-dir once the load finishes or is cancelled.
  if (win) {
    projects.setProjectDir(win.id, dirPath)
    updateWindowTitle(win)
  }
  return { dirPath, files }
})

// Can this window use `dirPath` as its project folder (Save As)? False — after showing the
// "Folder already open" message — when another window has it open.
ipcMain.handle('check-project-dir-available', async (event, dirPath) => {
  return claimCheck(dirPath, BrowserWindow.fromWebContents(event.sender))
})

// The renderer reports which project folder it actually has open (after a load, a cancelled
// load, or Save As), keeping the one-window-per-folder bookkeeping and the window title exact.
ipcMain.on('report-project-dir', (event, dirPath) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || !windowState.has(win.id)) return
  projects.setProjectDir(win.id, dirPath || null)
  updateWindowTitle(win)
})

// Read one circuit file from the project directory
ipcMain.handle('read-circuit-file', async (event, { dirPath, filename }) => {
  return fs.readFileSync(path.join(dirPath, filename), 'utf8')
})

// Write one circuit file to the project directory
ipcMain.handle('write-circuit-file', async (event, { dirPath, filename, content }) => {
  fs.writeFileSync(path.join(dirPath, filename), content)
  return true
})

// Remove a circuit file after it's been renamed (the Filename field changed). Guard against
// path traversal and non-.ggc targets — only a plain .ggc basename inside the project dir.
ipcMain.handle('delete-circuit-file', async (event, { dirPath, filename }) => {
  if (typeof filename !== 'string' || filename !== path.basename(filename) || !filename.endsWith('.ggc')) {
    return false
  }
  const target = path.join(dirPath, filename)
  if (fs.existsSync(target)) fs.unlinkSync(target)
  return true
})

// Save circuit to disk (fallback for no-project state)
ipcMain.handle('save-circuit', async (event, { content, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Golden Gates Circuit', extensions: ['ggc'] }]
  })
  if (filePath) {
    fs.writeFileSync(filePath, content)
    return filePath
  }
  return null
})
