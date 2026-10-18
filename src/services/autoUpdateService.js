// ============================================================
//  AUTO UPDATE SERVICE (Mobile) — cập nhật APK NGAY TRONG APP
//  Tải file .apk từ GitHub Release về máy (có tiến độ) rồi mở trình cài đặt
//  mặc định của Android. KHÔNG mở trình duyệt / không trỏ ra web.
//  Chỉ chạy trên Android native (Capacitor); nền tảng khác bỏ qua.
// ============================================================

export function laNativeAndroid() {
  return (
    typeof window !== 'undefined' &&
    window.Capacitor?.getPlatform?.() === 'android' &&
    !!window.Capacitor?.isNativePlatform?.()
  )
}

// Tải .apk + mở trình cài đặt. onProgress(daTaiBytes, tongBytes)
export async function taiVaCaiApk(url, onProgress) {
  if (!url) throw new Error('Không có link .apk để tải')

  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { FileOpener } = await import('@capacitor-community/file-opener')
  const TEN_FILE = 'vln-update.apk'

  let listener
  try {
    // Lắng nghe tiến độ tải thực tế (native download, không dính CORS)
    listener = await Filesystem.addListener('progress', (p) => {
      onProgress?.(p.bytes || 0, p.contentLength || 0)
    })

    const kq = await Filesystem.downloadFile({
      url,
      path: TEN_FILE,
      directory: Directory.Cache,
      progress: true,
    })

    const filePath = kq?.path
    if (!filePath) throw new Error('Tải xong nhưng không lấy được đường dẫn file')

    // Mở .apk → Android bật trình cài đặt mặc định (tự hỏi quyền "nguồn
    // không xác định" nếu chưa cấp). Cần quyền REQUEST_INSTALL_PACKAGES trong manifest.
    await FileOpener.open({
      filePath,
      contentType: 'application/vnd.android.package-archive',
    })

    return { ok: true, path: filePath }
  } finally {
    try {
      await listener?.remove?.()
    } catch {
      /* bỏ qua */
    }
  }
}
