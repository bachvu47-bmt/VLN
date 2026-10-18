// Electron main process — đóng gói ứng dụng thành .exe cho PC
const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

// ---- Auto Update (electron-updater) ----
autoUpdater.autoDownload = false // tự quyết định khi nào tải (theo nút bấm)

function dangKyAutoUpdate(win) {
  const guiTienDo = (p) => win?.webContents.send('update:progress', Math.round(p.percent))
  autoUpdater.on('download-progress', guiTienDo)

  // Renderer gọi: kiểm tra cập nhật
  ipcMain.handle('update:check', async () => {
    const kq = await autoUpdater.checkForUpdates()
    const info = kq?.updateInfo
    const coCapNhat = info && info.version !== app.getVersion()
    return {
      coCapNhat: !!coCapNhat,
      hienTai: app.getVersion(),
      moi: coCapNhat
        ? {
            phienBan: info.version,
            ngayPhatHanh: info.releaseDate,
            tieuDe: info.releaseName || 'Bản cập nhật mới',
            batBuoc: false,
            kichThuocMB: { exe: Math.round((info.files?.[0]?.size || 0) / 1024 / 1024) },
            changelog: [{ loai: 'moi', noiDung: info.releaseNotes || 'Xem chi tiết trên server.' }],
          }
        : null,
    }
  })

  // Renderer gọi: tải bản cập nhật
  ipcMain.handle('update:download', async () => {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  })

  // Renderer gọi: cài đặt & khởi động lại
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
    return { ok: true }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 860,
    minWidth: 380,
    minHeight: 640,
    title: 'Vật Liệu Nhà — Hệ thống bán hàng nội bộ',
    backgroundColor: '#dc2626',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (!app.isPackaged) {
    // Chế độ phát triển: nạp từ Vite dev server
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Chế độ sản phẩm (.exe đã đóng gói): nạp từ file tĩnh
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return win
}

// Ẩn menu bar mặc định
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  const win = createWindow()
  dangKyAutoUpdate(win)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
