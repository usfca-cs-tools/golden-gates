// preload.js is the security bridge. It exposes only the specific 
// functions you want. The Vue app can't access all of Node.js, 
// just what you explicitly allow here.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Project-based operations
  pickProjectDirectory: () => ipcRenderer.invoke('pick-project-directory'),
  openProject: (dirPath) => ipcRenderer.invoke('open-project', dirPath),
  readCircuitFile: (dirPath, filename) => ipcRenderer.invoke('read-circuit-file', { dirPath, filename }),
  writeCircuitFile: (dirPath, filename, content) => ipcRenderer.invoke('write-circuit-file', { dirPath, filename, content }),

  // Fallback save-as for no-project state
  saveCircuitAs: (content, defaultName) => ipcRenderer.invoke('save-circuit', { content, defaultName }),

  // Events from main process
  onOpenProject: (callback) => ipcRenderer.on('open-project', (_event, payload) => callback(payload)),
  onMenuNewCircuit: (callback) => ipcRenderer.on('menu-new-circuit', () => callback()),
  onMenuSaveCircuit: (callback) => ipcRenderer.on('menu-save-circuit', () => callback())
})