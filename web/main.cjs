// main.js acts as the "backend" of the desktop app.
// It does three things: creates the window, loads your Vue app into it,
// and listens for file save/open requests from the Vue side.


const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path')
app.name = 'Golden Gates'

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
  dialog.showMessageBox(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
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

let mainWindow = null
let pendingFilePath = null  // project dir opened before the renderer is ready

// Save-on-quit state (see the mainWindow 'close' handler in createWindow). readyToClose flips
// true once the user has confirmed the quit (saved or discarded); quitRequested is true while a
// full app quit (Cmd-Q / before-quit) is in progress, so a confirmed close can quit the app
// rather than merely close the window (macOS keeps the app in the dock on a window close).
let readyToClose = false
let quitRequested = false

// Windows/Linux pass the path of an associated file as a command-line argument
// when the app is launched (or re-launched) by double-clicking it. Pick out the
// .ggc path, ignoring the executable and any Chromium/Electron flags.
function getFilePathFromArgv(argv) {
  return (
    argv.find(arg => !arg.startsWith('-') && arg.toLowerCase().endsWith('.ggc')) ||
    null
  )
}

// Send a project directory path (and optionally which file triggered the open)
function openProjectDir(dirPath, activeFile = null) {
  if (!dirPath) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-project', { dirPath, activeFile })
  } else {
    pendingFilePath = { dirPath, activeFile }
  }
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
    if (filePath) openProjectDir(path.dirname(filePath), path.basename(filePath))
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
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
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-new-circuit')
              }
            }
          },
          { type: 'separator' },
          {
            // A project is a folder of .ggc files, so opening is always "open a folder".
            // (Double-clicking a .ggc in Finder still opens its folder via app.on('open-file').)
            label: 'Open Folder...',
            accelerator: 'CmdOrCtrl+O',
            click: async () => {
              const { filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
              })
              if (filePaths.length > 0) {
                openProjectDir(filePaths[0])
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-save-circuit')
              }
            }
          },
          {
            label: 'Save As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-save-circuit-as')
              }
            }
          }
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
          { role: 'selectAll' }
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
            click: () => {
              if (!mainWindow || mainWindow.isDestroyed()) return
              const wc = mainWindow.webContents
              if (wc.isDevToolsOpened()) wc.closeDevTools()
              else wc.openDevTools()
            }
          }
        ]
      },
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

    createWindow()
    maybeCheckForUpdates() // no-op unless this is a signed, tagged build
  })

  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // A full app quit (Cmd-Q, menu Quit) fires before-quit before windows close. Record it so the
  // window 'close' handler, once the user confirms, quits the app instead of just closing the
  // window. Reset on Cancel (below) so a later window close isn't mistaken for a quit.
  app.on('before-quit', () => {
    quitRequested = true
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  })
  mainWindow.loadFile('dist/index.html')

  // Keep the View → Developer Tools checkbox in sync with the real DevTools state,
  // so it reflects reality even when DevTools is closed from its own toolbar or the
  // keyboard accelerator rather than the menu item.
  const syncDevToolsChecked = () => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('toggle-devtools')
    if (item && mainWindow && !mainWindow.isDestroyed()) {
      item.checked = mainWindow.webContents.isDevToolsOpened()
    }
  }
  mainWindow.webContents.on('devtools-opened', syncDevToolsChecked)
  mainWindow.webContents.on('devtools-closed', syncDevToolsChecked)

  // Once renderer is ready, send any queued project directory
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePath) {
      const { dirPath, activeFile } = pendingFilePath
      pendingFilePath = null
      openProjectDir(dirPath, activeFile)
    }
  })

  // Proceed with the close/quit that was interrupted by the save prompt.
  const finishClose = () => {
    readyToClose = true
    if (quitRequested) app.quit()
    else mainWindow.close()
  }

  // Save-on-quit: unsaved circuit changes must not silently vanish (they'd never reach the
  // .ggc project files a student commits). Intercept the close, ask the renderer whether
  // anything is unsaved, and if so prompt Save / Don't Save / Cancel. Disk is the source of
  // truth, so "Save" writes the whole project before quitting, and a failed/cancelled save
  // keeps the app open so nothing is lost.
  mainWindow.on('close', async e => {
    if (readyToClose) return
    e.preventDefault()

    let dirty = false
    try {
      dirty = await mainWindow.webContents.executeJavaScript(
        'window.__ggHasUnsavedChanges ? window.__ggHasUnsavedChanges() : false'
      )
    } catch {
      dirty = false
    }
    if (!dirty) {
      finishClose()
      return
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Save changes before quitting?',
      detail:
        'Your circuit has unsaved changes. Anything not saved is not written to your project ' +
        'files, so it will not be committed or graded.'
    })

    if (response === 2) {
      // Cancel: stay open, and abandon any in-progress quit.
      quitRequested = false
      return
    }
    if (response === 1) {
      // Don't Save: discard and close.
      finishClose()
      return
    }

    // Save: write the project files; only close if the save actually succeeded.
    let saved = false
    try {
      saved = await mainWindow.webContents.executeJavaScript(
        'window.__ggSaveAll ? window.__ggSaveAll() : false'
      )
    } catch {
      saved = false
    }
    if (saved) finishClose()
    else quitRequested = false
  })

  // Clear the reference when the window is closed so open-file doesn't
  // try to use a destroyed webContents
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}


// Pick a project directory via dialog (used when no path is provided by the caller)
ipcMain.handle('pick-project-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

// Open project: list all .ggc files in the directory
ipcMain.handle('open-project', async (event, dirPath) => {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ggc'))
  return { dirPath, files }
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
