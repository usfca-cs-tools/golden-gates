// preload.js is the security bridge. It exposes only the specific 
// functions you want. The Vue app can't access all of Node.js, 
// just what you explicitly allow here.

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Project-based operations
  pickProjectDirectory: () => ipcRenderer.invoke('pick-project-directory'),
  openProject: (dirPath) => ipcRenderer.invoke('open-project', dirPath),
  // Real filesystem path of a dropped File/folder. Electron removed File.path, so a dropped
  // .ggc / folder is resolved to its directory to reuse the open-project loader.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  readCircuitFile: (dirPath, filename) => ipcRenderer.invoke('read-circuit-file', { dirPath, filename }),
  writeCircuitFile: (dirPath, filename, content) => ipcRenderer.invoke('write-circuit-file', { dirPath, filename, content }),
  deleteCircuitFile: (dirPath, filename) => ipcRenderer.invoke('delete-circuit-file', { dirPath, filename }),

  // Fallback save-as for no-project state
  saveCircuitAs: (content, defaultName) => ipcRenderer.invoke('save-circuit', { content, defaultName }),

  // Events from main process
  onOpenProject: (callback) => ipcRenderer.on('open-project', (_event, payload) => callback(payload)),
  onMenuNewCircuit: (callback) => ipcRenderer.on('menu-new-circuit', () => callback()),
  onMenuSaveCircuit: (callback) => ipcRenderer.on('menu-save-circuit', () => callback()),
  onMenuSaveCircuitAs: (callback) => ipcRenderer.on('menu-save-circuit-as', () => callback())
})