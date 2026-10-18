// Kho sản phẩm đồng bộ từ website vatlieunha.vn (trộn vào Flashcard — màn Tra cứu)
// Lưu IndexedDB (668 SP × mô tả dài vượt quota localStorage); đọc đồng bộ qua cache RAM.
import { idbGet, idbPut, STORE_KV } from './idb'

const KEY = 'vln_synced_products'
let cache = []
let listeners = []

const baoThayDoi = () => listeners.forEach((f) => f())

// Nạp cache từ IndexedDB 1 lần khi mở app (+ chuyển dữ liệu cũ từ localStorage sang)
export const sanSang = (async () => {
  try {
    const cu = localStorage.getItem(KEY)
    if (cu) {
      await idbPut(STORE_KV, JSON.parse(cu), KEY)
      localStorage.removeItem(KEY)
    }
  } catch {
    /* bỏ qua */
  }
  try {
    cache = (await idbGet(STORE_KV, KEY)) || []
  } catch {
    cache = []
  }
  baoThayDoi()
})()

export function laySanPhamWeb() {
  return cache
}

export async function luuSanPhamWeb(arr) {
  cache = arr
  baoThayDoi()
  try {
    await idbPut(STORE_KV, arr, KEY)
  } catch {
    /* bỏ qua — vẫn còn trong RAM cho phiên này */
  }
}

export async function xoaSanPhamWeb() {
  await luuSanPhamWeb([])
}

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}
