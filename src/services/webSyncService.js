// ============================================================
//  WEB SYNC SERVICE — đồng bộ dải sản phẩm từ vatlieunha.vn
//  Nguồn: WooCommerce Store API (public): /wp-json/wc/store/v1/products
//  Trên Android native dùng CapacitorHttp để bỏ qua CORS; web/dev dùng fetch
//  (có thể bị CORS chặn — khi đó báo lỗi để dùng proxy).
// ============================================================
import { luuSanPhamWeb } from '../data/productStore'
import { mapSanPham } from './sanPhamWeb'
import { dongBoTriThucWeb } from './vectorStore'

const BASE = import.meta.env.VITE_VLN_API || 'https://vatlieunha.vn/wp-json/wc/store/v1'

// mapSanPham (WooCommerce → Flashcard): xem sanPhamWeb.js — dùng chung với scripts/nap-kho-chung.mjs

const PROXY = import.meta.env.VITE_VLN_PROXY || '' // proxy tự host (tùy chọn)

function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

// Qua main process Electron (bản .exe) — không dính CORS
async function viaDesktop(url) {
  const r = await window.desktop.webFetch(url)
  if (r.status >= 400) throw new Error('HTTP ' + r.status)
  return typeof r.body === 'string' ? JSON.parse(r.body) : r.body
}

// Qua CapacitorHttp (native Android) — không dính CORS
async function viaNative(url) {
  const { CapacitorHttp } = await import('@capacitor/core')
  const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } })
  if (res.status >= 400) throw new Error('HTTP ' + res.status)
  return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
}

// Gọi trực tiếp (chỉ chạy nếu site mở CORS)
async function viaDirect(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// Qua proxy vượt CORS: proxy tự host (VITE_VLN_PROXY?url=) hoặc public allorigins
async function viaProxy(url) {
  const base = PROXY || 'https://api.allorigins.win/raw'
  const proxUrl = `${base}${base.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`
  const res = await fetch(proxUrl, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Proxy HTTP ' + res.status)
  return res.json()
}

async function layJSON(url) {
  if (typeof window !== 'undefined' && window.desktop?.webFetch) return viaDesktop(url) // .exe
  if (isNative()) return viaNative(url) // .apk: CapacitorHttp
  try {
    return await viaDirect(url) // web: thử trực tiếp (nếu CORS cho phép)
  } catch {
    return await viaProxy(url) // bị CORS → proxy (tự host / public)
  }
}

// Đồng bộ TOÀN BỘ sản phẩm — onProgress(soSanPhamDaLay).
export async function dongBoWebsite(onProgress) {
  const ketQua = []
  const perPage = 100 // WooCommerce Store API tối đa 100/trang
  for (let page = 1; page <= 15; page++) {
    let data
    try {
      data = await layJSON(`${BASE}/products?per_page=${perPage}&page=${page}`)
    } catch (e) {
      if (page === 1) throw e // lỗi ngay trang đầu → ném ra
      break
    }
    if (!Array.isArray(data) || data.length === 0) break
    data.forEach((p) => ketQua.push(mapSanPham(p)))
    onProgress?.(ketQua.length)
    if (data.length < perPage) break
  }
  if (ketQua.length === 0) throw new Error('Không lấy được sản phẩm nào từ website')
  return ketQua
}

// Đồng bộ website → lưu Flashcard (màn Tra cứu) → nạp tri thức vào bộ nhớ vector
// của Maika (học nền). Trả về { soSanPham, tongDoan, doanMoi, doanXoa }.
export async function dongBoVaHoc(onProgress) {
  const sp = await dongBoWebsite(onProgress)
  await luuSanPhamWeb(sp)
  const tt = await dongBoTriThucWeb(sp)
  return { soSanPham: sp.length, ...tt }
}
