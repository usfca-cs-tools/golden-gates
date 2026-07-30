// main.js acts as the "backend" of the desktop app.
// It does three things: creates the window, loads your Vue app into it,
// and listens for file save/open requests from the Vue side.


const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path')
app.name = 'Golden Gates'

let mainWindow = null
let pendingFilePath = null  // project dir opened before the renderer is ready

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

    // Native menu bar with File menu for Open/Save
    const menuTemplate = [
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
          {
            label: 'Open...',
            accelerator: 'CmdOrCtrl+O',
            click: async () => {
              const { filePaths } = await dialog.showOpenDialog({
                properties: ['openFile', 'openDirectory'],
                filters: [{ name: 'Golden Gates Circuit', extensions: ['ggc'] }]
              })
              if (filePaths.length > 0) {
                const selected = filePaths[0]
                if (selected.endsWith('.ggc')) {
                  // Single file selected — open its parent directory, focus this file's tab
                  openProjectDir(path.dirname(selected), path.basename(selected))
                } else {
                  // Directory selected — open it, top-level circuit gets focus
                  openProjectDir(selected)
                }
              }
            }
          },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-save-circuit')
              }
            }
          }
        ]
      }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

    createWindow()
  })

  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
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

  // Once renderer is ready, send any queued project directory
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePath) {
      const { dirPath, activeFile } = pendingFilePath
      pendingFilePath = null
      openProjectDir(dirPath, activeFile)
    }
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
