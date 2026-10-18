// Preload — cầu nối an toàn giữa trình duyệt và Electron.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  nenTang: process.platform,
  phienBan: process.versions.electron,

  // API cập nhật tự động (electron-updater)
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (onProgress) => {
      if (onProgress) {
        ipcRenderer.removeAllListeners('update:progress')
        ipcRenderer.on('update:progress', (_e, p) => onProgress(p))
      }
      return ipcRenderer.invoke('update:download')
    },
    install: () => ipcRenderer.invoke('update:install'),
  },
})
