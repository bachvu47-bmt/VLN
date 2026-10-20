// ============================================================
//  KHO MEDIA — ảnh & âm thoại gửi cho Maika (IndexedDB, lưu Blob gốc)
//  Bản ghi: { id, loai: 'anh'|'am_thanh', mime, du (ArrayBuffer), kichThuoc, sku?, nguoi, taoLuc, banGhi? }
//  sku: mã sản phẩm liên quan (Maika tự gán khi nhận ra sản phẩm trong câu trả lời)
//  Lưu ArrayBuffer thay vì Blob: WebView Android cũ / Electron ném DataCloneError khi ghi Blob
//  vào IndexedDB (lỗi "không đọc/ghi được ảnh"). Bản ghi cũ (có .blob) vẫn đọc được.
// ============================================================
import { idbDeleteMany, idbGet, idbPut, STORE_MEDIA } from './idb'

const _url = new Map() // id → objectURL (giữ trong phiên để hiển thị lại nhanh)

function blobCua(rec) {
  if (rec?.blob) return rec.blob
  if (rec?.du) return new Blob([rec.du], { type: rec.mime })
  return null
}

export async function luuMedia(blob, { loai, sku = '', nguoi = '', banGhi = '' }) {
  const rec = {
    id: `${loai}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    loai,
    mime: blob.type || (loai === 'anh' ? 'image/jpeg' : 'audio/webm'),
    du: await blob.arrayBuffer(),
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
  const blob = blobCua(rec)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
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

// Đọc NGAY file người dùng vừa chọn vào RAM. Android cấp quyền đọc content:// URI tạm thời —
// đọc trễ (lúc bấm gửi) có thể bị NotReadableError / "permission denied".
const MIME_THEO_DUOI = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp' }

export async function chepFileVaoBoNho(file) {
  const du = await file.arrayBuffer()
  const duoi = (file.name || '').split('.').pop().toLowerCase()
  return new Blob([du], { type: file.type || MIME_THEO_DUOI[duoi] || 'image/jpeg' })
}

// Thu nhỏ ảnh chụp điện thoại (thường 3–8MB) → JPEG ≤ 1280px: gửi Gemini Flash nhanh, đỡ tốn quota
export async function thuNhoAnh(file, canhDai = 1280, chatLuong = 0.82) {
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
