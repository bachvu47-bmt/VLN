// ============================================================
//  SẢN PHẨM TRA CỨU GẦN ĐÂY — ghi lại khi người dùng mở chi tiết SP (thay dữ liệu minh hoạ)
//  localStorage: [id sản phẩm] mới nhất trước, tối đa 10
// ============================================================
import { SAN_PHAM } from './mockData'
import { laySanPhamWeb } from './productStore'

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
  const tatCa = [...laySanPhamWeb(), ...SAN_PHAM]
  return docIds()
    .map((id) => tatCa.find((sp) => sp.id === id))
    .filter(Boolean)
}
