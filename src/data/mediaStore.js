// ============================================================
//  KHO MEDIA — ảnh & âm thoại gửi cho Maika (IndexedDB, lưu Blob gốc)
//  Bản ghi: { id, loai: 'anh'|'am_thanh', mime, blob, kichThuoc, sku?, nguoi, taoLuc, banGhi? }
//  sku: mã sản phẩm liên quan (Maika tự gán khi nhận ra sản phẩm trong câu trả lời)
// ============================================================
import { idbDeleteMany, idbGet, idbPut, STORE_MEDIA } from './idb'

const _url = new Map() // id → objectURL (giữ trong phiên để hiển thị lại nhanh)

export async function luuMedia(blob, { loai, sku = '', nguoi = '', banGhi = '' }) {
  const rec = {
    id: `${loai}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    loai,
    mime: blob.type || (loai === 'anh' ? 'image/jpeg' : 'audio/webm'),
    blob,
    kichThuoc: blob.size,
    sku,
    nguoi,
    banGhi, // lời thoại đã chuyển thành chữ (âm thanh)
    taoLuc: Date.now(),
  }
  await idbPut(STORE_MEDIA, rec)
  _url.set(rec.id, URL.createObjectURL(blob))
  return rec
}

export async function layMedia(id) {
  return idbGet(STORE_MEDIA, id)
}

// URL hiển thị <img>/<audio> cho 1 media id (null nếu đã bị xoá)
export async function layUrlMedia(id) {
  if (_url.has(id)) return _url.get(id)
  const rec = await idbGet(STORE_MEDIA, id)
  if (!rec?.blob) return null
  const url = URL.createObjectURL(rec.blob)
  _url.set(id, url)
  return url
}

export async function capNhatMedia(id, thayDoi) {
  const rec = await idbGet(STORE_MEDIA, id)
  if (rec) await idbPut(STORE_MEDIA, { ...rec, ...thayDoi })
}

export async function xoaMedia(ids = []) {
  ids.forEach((id) => {
    if (_url.has(id)) URL.revokeObjectURL(_url.get(id))
    _url.delete(id)
  })
  await idbDeleteMany(STORE_MEDIA, ids)
}

export function blobSangBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

// Thu nhỏ ảnh chụp điện thoại (thường 3–8MB) → JPEG ≤ 1600px: gửi AI nhanh, đỡ tốn quota
export async function thuNhoAnh(file, canhDai = 1600, chatLuong = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file)
    const tile = Math.min(1, canhDai / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * tile)
    canvas.height = Math.round(bmp.height * tile)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', chatLuong))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
