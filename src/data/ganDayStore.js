// ============================================================
//  SẢN PHẨM TRA CỨU GẦN ĐÂY — ghi lại khi người dùng mở chi tiết SP (thay dữ liệu minh hoạ)
//  localStorage: [id sản phẩm] mới nhất trước, tối đa 10
// ============================================================
import { timTheoId } from '../services/traCuuSanPham'

const LS_KEY = 'vln_sp_gan_day'
const TOI_DA = 10

function docIds() {
  try {
    const ds = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(ds) ? ds : []
  } catch {
    return []
  }
}

export function ghiSpGanDay(sp) {
  if (!sp?.id) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([sp.id, ...docIds().filter((id) => id !== sp.id)].slice(0, TOI_DA)))
  } catch {
    /* bỏ qua */
  }
}

export function laySpGanDay() {
  // Chỉ sản phẩm thật (web + KiotViet) — id cũ của dữ liệu minh hoạ tự rơi khỏi danh sách
  return docIds().map(timTheoId).filter(Boolean)
}
