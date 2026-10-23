// ============================================================
//  ẢNH SẢN PHẨM DO ADMIN ĐẶT — ưu tiên cao nhất khi hiển thị (thay ảnh thiếu/sai)
//  Kho chung (Supabase anh_san_pham): mọi máy đọc, chỉ Admin ghi. Lưu bản sao trên máy để mở nhanh.
//  Không có kho chung → chỉ lưu trên máy này.
// ============================================================
import { adminDatAnh, coKhoChung, docAnhSanPham } from './khoChung'

const LS = 'vln_anh_san_pham'
let _anh = (() => {
  try {
    return JSON.parse(localStorage.getItem(LS) || '{}')
  } catch {
    return {}
  }
})()
let listeners = []
const bao = () => listeners.forEach((f) => f())
const luu = () => {
  try {
    localStorage.setItem(LS, JSON.stringify(_anh))
  } catch {
    /* bỏ qua */
  }
}

export function dangKyAnh(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

export const anhGhiDe = (khoa) => _anh[khoa] || ''
export const soAnhGhiDe = () => Object.keys(_anh).length

let _lanTai = 0
export async function napAnhSanPham({ batBuoc = false } = {}) {
  if (!coKhoChung() || (!batBuoc && Date.now() - _lanTai < 10 * 60 * 1000)) return
  _lanTai = Date.now()
  const rows = await docAnhSanPham()
  _anh = Object.fromEntries(rows.map((r) => [r.khoa, r.url]))
  luu()
  bao()
}

// url rỗng = bỏ ảnh đã đặt
export async function datAnhSanPham(khoa, url) {
  const u = (url || '').trim()
  if (u && !/^https:\/\//.test(u)) throw new Error('Link ảnh phải bắt đầu bằng https://')
  if (coKhoChung()) await adminDatAnh(khoa, u)
  if (u) _anh[khoa] = u
  else delete _anh[khoa]
  luu()
  bao()
}
