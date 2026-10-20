// ============================================================
//  KHO VIỆC CẦN LÀM — nền của Trợ lý chủ động (Maika 2.0 · Bước 2)
//  Viec: { id, loai, tieuDe, khach, sdt, sanPham, ghiChu, hanLuc (ms), trangThai: 'cho'|'xong',
//          daNhac, nguon: 'tay'|'maika'|'baogia'|'donhang'|'sheet', khoaNguon?, nguoiTao (user id), taoLuc, xongLuc }
//  nguon 'sheet': job follow-up tự động tạo từ Google Sheet báo cáo (services/followUpTuDong.js)
//  Lưu IndexedDB (KV) + cache RAM để đọc đồng bộ như productStore.
// ============================================================
import { idbGet, idbPut, STORE_KV } from './idb'

const KEY = 'vln_viec'
let cache = []
let listeners = []

const baoThayDoi = () => listeners.forEach((f) => f())

export const LOAI_VIEC = {
  baogia: { nhan: 'Follow-up báo giá', icon: '📑' },
  goi: { nhan: 'Gọi khách', icon: '📞' },
  tailieu: { nhan: 'Gửi tài liệu', icon: '📄' },
  hen: { nhan: 'Hẹn gặp / công trình', icon: '📍' },
  sauban: { nhan: 'Chăm sóc sau bán', icon: '💬' },
  khac: { nhan: 'Việc khác', icon: '📝' },
}

export const sanSang = (async () => {
  try {
    cache = (await idbGet(STORE_KV, KEY)) || []
  } catch {
    cache = []
  }
  baoThayDoi()
})()

async function luu(ds) {
  cache = ds
  baoThayDoi()
  try {
    await idbPut(STORE_KV, ds, KEY)
  } catch {
    /* còn trong RAM cho phiên này */
  }
}

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

// Việc của 1 người dùng, sắp theo hạn (việc xong xuống cuối)
export function layViec(userId) {
  return cache
    .filter((v) => !userId || v.nguoiTao === userId)
    .sort((a, b) => (a.trangThai === 'xong') - (b.trangThai === 'xong') || a.hanLuc - b.hanLuc)
}

export function layViecTheoId(id) {
  return cache.find((v) => v.id === id)
}

export async function themViec(v) {
  const viec = {
    id: `viec:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    loai: 'khac',
    tieuDe: '',
    khach: '',
    sdt: '',
    sanPham: '',
    ghiChu: '',
    trangThai: 'cho',
    daNhac: false,
    nguon: 'tay',
    taoLuc: Date.now(),
    ...v,
  }
  await luu([...cache, viec])
  return viec
}

export async function capNhatViec(id, thayDoi) {
  let moi = null
  await luu(cache.map((v) => (v.id === id ? (moi = { ...v, ...thayDoi }) : v)))
  return moi
}

export async function xoaViec(id) {
  await luu(cache.filter((v) => v.id !== id))
}

// ---- Tiện ích thời gian ----
export function dauNgay(t = Date.now()) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function nhanThoiGian(t) {
  const d = new Date(t)
  const gio = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const ngay = dauNgay(t)
  const homNay = dauNgay()
  if (ngay === homNay) return `Hôm nay ${gio}`
  if (ngay === homNay + 864e5) return `Mai ${gio}`
  if (ngay === homNay - 864e5) return `Hôm qua ${gio}`
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${gio}`
}
