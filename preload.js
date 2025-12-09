
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (path) => ipcRenderer.invoke('media:scanDirectory', path),
  selectImageFolder: () => ipcRenderer.invoke('dialog:openImageDirectory'),
  parseMetadata: (filePath) => ipcRenderer.invoke('media:parseMetadata', filePath),
  writeMetadata: (filePath, metadata) => ipcRenderer.invoke('media:writeMetadata', filePath, metadata),
  isElectron: true,
  
  // Listen for Main Process commands (Shortcuts/Taskbar clicks)
  onGlobalPlayPause: (callback) => ipcRenderer.on('media:playpause', () => callback()),
  onGlobalNext: (callback) => ipcRenderer.on('media:next', () => callback()),
  onGlobalPrev: (callback) => ipcRenderer.on('media:prev', () => callback()),

  // Send state back to Main Process (Update Taskbar icons)
  setThumbarState: (isPlaying) => ipcRenderer.send('media:status-change', isPlaying)
});
