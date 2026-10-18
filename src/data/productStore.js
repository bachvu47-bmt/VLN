// Kho sản phẩm đồng bộ từ website vatlieunha.vn (lưu localStorage, trộn vào Flashcard)
const KEY = 'vln_synced_products'
let listeners = []

export function laySanPhamWeb() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function luuSanPhamWeb(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr))
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((f) => f())
}

export function xoaSanPhamWeb() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((f) => f())
}

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}
