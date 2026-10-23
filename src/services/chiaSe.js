// ============================================================
//  CHIA SẺ CHO KHÁCH — mở bảng chia sẻ của máy (Zalo, Messenger…) kèm tin nhắn + tệp thật
//  · Android (Capacitor): ghi tệp vào bộ nhớ đệm → @capacitor/share (Zalo nhận cả ảnh, video, PDF)
//  · Trình duyệt hỗ trợ Web Share: navigator.share
//  · Còn lại (PC): chép tin nhắn vào bộ nhớ tạm để dán vào Zalo
// ============================================================
import { Capacitor } from '@capacitor/core'

export const TOI_DA_MB = 50

const sangBase64 = (file) =>
  new Promise((ok, loi) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1])
    r.onerror = () => loi(r.error)
    r.readAsDataURL(file)
  })

// → 'da-mo' (đã mở bảng chia sẻ) | 'da-chep' (đã chép tin nhắn) | 'huy'
export async function chiaSeChoKhach({ text, tep = [] }) {
  const qua = tep.find((f) => f.size > TOI_DA_MB * 1024 * 1024)
  if (qua) throw new Error(`Tệp "${qua.name}" lớn hơn ${TOI_DA_MB}MB — gửi link thay vì tệp`)

  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const files = []
    for (const f of tep) {
      const { uri } = await Filesystem.writeFile({
        path: `gui-khach/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`,
        data: await sangBase64(f),
        directory: Directory.Cache,
        recursive: true,
      })
      files.push(uri)
    }
    try {
      await Share.share({ title: 'Tài liệu Vật Liệu Nhà', text, ...(files.length ? { files } : {}), dialogTitle: 'Gửi cho khách qua…' })
      return 'da-mo'
    } catch (e) {
      if (/cancel/i.test(e?.message || '')) return 'huy'
      throw e
    }
  }

  if (navigator.share) {
    const duLieu = { title: 'Tài liệu Vật Liệu Nhà', text, ...(tep.length && navigator.canShare?.({ files: tep }) ? { files: tep } : {}) }
    try {
      await navigator.share(duLieu)
      return 'da-mo'
    } catch (e) {
      if (e?.name === 'AbortError') return 'huy'
    }
  }

  await navigator.clipboard.writeText(text)
  return 'da-chep'
}
