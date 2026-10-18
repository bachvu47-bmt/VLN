// Electron main process — đóng gói ứng dụng thành .exe cho PC
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

// ---- Auto Update (electron-updater) ----
// Tự tải bản mới ở nền; cài khi thoát app (hoặc khi người dùng bấm khởi động lại).
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function dangKyAutoUpdate(win) {
  autoUpdater.on('download-progress', (p) =>
    win?.webContents.send('update:progress', Math.round(p.percent)),
  )
  autoUpdater.on('error', (e) => win?.webContents.send('update:error', String(e?.message || e)))

  // Khi đã tải xong bản mới → hỏi khởi động lại để cài ngay
  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('update:downloaded', info.version)
    dialog
      .showMessageBox(win, {
        type: 'info',
        buttons: ['Khởi động lại & cài ngay', 'Để lần sau'],
        defaultId: 0,
        cancelId: 1,
        title: 'Cập nhật Vật Liệu Nhà',
        message: `Đã tải xong bản ${info.version}.`,
        detail: 'Khởi động lại ứng dụng để hoàn tất cài đặt? (Nếu để lần sau, bản mới sẽ tự cài khi bạn thoát app.)',
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall()
      })
  })

  // Renderer gọi: kiểm tra cập nhật (cho modal trong app)
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
            changelog: [{ loai: 'moi', noiDung: info.releaseNotes || 'Xem chi tiết trên GitHub Release.' }],
          }
        : null,
    }
  })

  // Renderer gọi: tải bản cập nhật — phải checkForUpdates trước khi downloadUpdate
  ipcMain.handle('update:download', async () => {
    await autoUpdater.checkForUpdates()
    await autoUpdater.downloadUpdate()
    return { ok: true }
  })

  // Renderer gọi: cài đặt & khởi động lại
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
    return { ok: true }
  })

  // Tự động kiểm tra + tải bản mới khi mở app (chỉ khi đã đóng gói)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((e) =>
      console.warn('[auto-update] lỗi kiểm tra:', e?.message || e),
    )
  }
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
