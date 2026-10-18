// Electron main process — đóng gói ứng dụng thành .exe cho PC
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

// Tắt tăng tốc phần cứng — tránh màn hình trống/1 màu trên máy có driver GPU lỗi,
// máy ảo, hoặc chạy qua Remote Desktop (buộc dùng software rendering ổn định hơn).
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

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

  // Renderer gọi: fetch URL qua main process (Node) — không dính CORS.
  // Dùng để đồng bộ sản phẩm từ vatlieunha.vn trên bản .exe.
  ipcMain.handle('web:fetch', async (_e, url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    return { status: r.status, body: await r.text() }
  })

  // Tự động kiểm tra + tải bản mới — lùi ~5s để UI hiện trước, không chặn khởi động
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((e) =>
        console.warn('[auto-update] lỗi kiểm tra:', e?.message || e),
      )
    }, 5000)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 860,
    minWidth: 380,
    minHeight: 640,
    title: 'Vật Liệu Nhà — Hệ thống bán hàng nội bộ',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Log chẩn đoán lỗi nạp renderer (giúp bắt màn hình trống)
  win.webContents.on('did-fail-load', (_e, code, desc, url) =>
    console.error('[DID-FAIL-LOAD]', code, desc, url),
  )
  win.webContents.on('render-process-gone', (_e, d) => console.error('[RENDER-GONE]', JSON.stringify(d)))

  // Link ngoài (PDF tài liệu kỹ thuật, trang SP vatlieunha.vn, video) → mở bằng trình duyệt mặc định
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('console-message', (_e, level, message, line, source) =>
    console.log(`[RENDERER:${level}] ${message} (${source}:${line})`),
  )

  if (!app.isPackaged && !process.env.MAIKA_FORCE_FILE) {
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
