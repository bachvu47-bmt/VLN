// ============================================================
//  KIOTVIET (chỉ đọc) — bản sao mã hoá do GitHub Actions đồng bộ ~30 phút/lần
//  App KHÔNG giữ key KiotViet. Tải file .bin công khai → giải mã bằng
//  "Mã dữ liệu cửa hàng" (Admin cấp, nhập 1 lần/máy) → hàng hoá, tồn kho, giá,
//  hoá đơn 180 ngày, khách hàng.
// ============================================================
import { idbGet, idbPut, STORE_KV } from '../data/idb'

const URL_DU_LIEU = import.meta.env.VITE_KV_DATA_URL || 'https://raw.githubusercontent.com/bachvu47-bmt/VLN/du-lieu/kiotviet.bin'
const LS_MA = 'vln_ma_du_lieu'
const KEY_CACHE = 'vln_kv_bin' // lưu bản MÃ HOÁ (không lưu bản giải mã xuống máy)
const VONG_PBKDF2 = 150000 // khớp scripts/kiotviet-sync.mjs
const TUOI_CACHE_MS = 10 * 60 * 1000

let _duLieu = null // bản giải mã trong RAM của phiên
let listeners = []
const baoThayDoi = () => listeners.forEach((f) => f())

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

export function layMaDuLieu() {
  try {
    return localStorage.getItem(LS_MA) || ''
  } catch {
    return ''
  }
}

export function coMaDuLieu() {
  return !!layMaDuLieu()
}

export function duLieuKV() {
  return _duLieu
}

// ---- Giải mã: "VLN1" | salt16 | iv12 | ciphertext+tag ----
async function giaiMa(buf, ma) {
  const b = new Uint8Array(buf)
  if (String.fromCharCode(...b.slice(0, 4)) !== 'VLN1') throw new Error('Tệp dữ liệu KiotViet không hợp lệ')
  const salt = b.slice(4, 20)
  const iv = b.slice(20, 32)
  const goc = await crypto.subtle.importKey('raw', new TextEncoder().encode(ma), 'PBKDF2', false, ['deriveKey'])
  const khoa = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: VONG_PBKDF2, hash: 'SHA-256' }, goc, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  let nen
  try {
    nen = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, khoa, b.slice(32))
  } catch {
    throw new Error('Mã dữ liệu cửa hàng không đúng')
  }
  const giai = new Blob([nen]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(giai).text())
}

async function taiBin() {
  // Thêm mốc 5 phút vào URL để không dính bản cache cũ của CDN
  const res = await fetch(`${URL_DU_LIEU}?t=${Math.floor(Date.now() / 300000)}`)
  if (!res.ok) throw new Error(res.status === 404 ? 'Chưa có dữ liệu KiotViet (đồng bộ chưa chạy)' : 'HTTP ' + res.status)
  return res.arrayBuffer()
}

// Lưu mã sau khi thử giải mã thành công
export async function luuMaDuLieu(ma) {
  const buf = await taiBin()
  const d = await giaiMa(buf, ma.trim())
  try {
    localStorage.setItem(LS_MA, ma.trim())
  } catch {
    /* bỏ qua */
  }
  await idbPut(STORE_KV, { luc: Date.now(), buf }, KEY_CACHE).catch(() => {})
  _duLieu = d
  baoThayDoi()
  return d
}

export function xoaMaDuLieu() {
  try {
    localStorage.removeItem(LS_MA)
  } catch {
    /* bỏ qua */
  }
  _duLieu = null
  baoThayDoi()
}

// Nạp dữ liệu: bản lưu trên máy (mở app nhanh, dùng được khi mất mạng) → làm mới nếu cũ
export async function napKiotViet({ batBuoc = false } = {}) {
  const ma = layMaDuLieu()
  if (!ma) return null
  const cache = await idbGet(STORE_KV, KEY_CACHE).catch(() => null)
  if (cache?.buf && !_duLieu) {
    try {
      _duLieu = await giaiMa(cache.buf, ma)
      baoThayDoi()
    } catch {
      /* bản lưu hỏng / mã đổi → tải mới */
    }
  }
  if (!batBuoc && cache && Date.now() - cache.luc < TUOI_CACHE_MS && _duLieu) return _duLieu
  try {
    const buf = await taiBin()
    _duLieu = await giaiMa(buf, ma)
    await idbPut(STORE_KV, { luc: Date.now(), buf }, KEY_CACHE).catch(() => {})
    baoThayDoi()
  } catch (e) {
    if (!_duLieu) throw e // không có bản nào dùng được
    console.warn('[KiotViet] Làm mới lỗi, dùng bản lưu:', e.message)
  }
  return _duLieu
}

// ============================================================
//  TRA CỨU
// ============================================================
function boDau(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

// Tìm hàng hoá: mọi từ trong câu tìm phải có trong tên/mã (bỏ dấu)
export function timSanPham(q, n = 20) {
  if (!_duLieu) return []
  const tu = boDau(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
  if (!tu.length) return []
  return _duLieu.sanPham
    .map((p) => ({ p, k: boDau(`${p.ten} ${p.ma} ${p.nhom}`) }))
    .filter(({ k }) => tu.every((w) => k.includes(w)))
    .map(({ p }) => p)
    .sort((a, b) => b.ton - a.ton)
    .slice(0, n)
}

// Gợi ý hàng hoá liên quan câu hỏi chat (khớp ≥ 2 từ "có nghĩa") — cho Maika trả lời tồn kho/giá
const TU_CHUNG = new Set('con bao nhieu gia ton kho hang co khong cua the nao mot cai cuon thung bo tam thanh may loai'.split(' '))
export function goiYSanPhamTuCau(cau, n = 6) {
  if (!_duLieu) return []
  const tu = [...new Set(boDau(cau).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG.has(w)))]
  if (!tu.length) return []
  return _duLieu.sanPham
    .map((p) => {
      const k = boDau(`${p.ten} ${p.ma}`)
      return { p, diem: tu.filter((w) => k.includes(w)).length }
    })
    .filter((x) => x.diem >= Math.min(2, tu.length))
    .sort((a, b) => b.diem - a.diem || b.p.ton - a.p.ton)
    .slice(0, n)
    .map((x) => x.p)
}

// Hoá đơn N ngày gần nhất tính theo ngày lịch (1 = từ 0h hôm nay)
export function hoaDonGanDay(soNgay = 14) {
  if (!_duLieu) return []
  const dau = new Date()
  dau.setHours(0, 0, 0, 0)
  const moc = dau.getTime() - (soNgay - 1) * 864e5
  return _duLieu.hoaDon.filter((h) => Date.parse(h.ngay) >= moc)
}

export function timKhach(q, n = 50) {
  if (!_duLieu) return []
  const k = boDau(q.trim())
  const so = q.replace(/\D/g, '')
  return _duLieu.khach
    .filter((c) => !k || boDau(`${c.ten} ${c.ma}`).includes(k) || (so.length >= 3 && c.sdt.replace(/\D/g, '').includes(so)))
    .slice(0, n)
}

export function lichSuMua(maKH) {
  if (!_duLieu || !maKH) return []
  return _duLieu.hoaDon.filter((h) => h.maKH === maKH)
}

export const tienVN = (n) => (n || 0).toLocaleString('vi-VN') + 'đ'

// ============================================================
//  CÔNG NỢ & THANH TOÁN cho màn Báo cáo (nguồn chuẩn: hoá đơn KiotViet)
// ============================================================

// Hoá đơn còn nợ (tổng − đã trả > 0) → cùng dạng dòng báo cáo Sheet; null nếu máy chưa mở KiotViet
export function hoaDonConNo() {
  if (!_duLieu) return null
  return _duLieu.hoaDon
    .map((h) => ({
      thoiGian: Date.parse(h.ngay),
      khach: h.khach,
      sdt: '',
      maKH: h.maKH,
      maDon: h.ma,
      congNo: Math.max(0, (h.tong || 0) - (h.daTra || 0)),
      nhanVien: h.nv,
    }))
    .filter((r) => r.congNo > 0 && Number.isFinite(r.thoiGian))
}

// Tổng dư nợ hiện tại của mọi khách (theo sổ KiotViet)
export function tongDuNoKhach() {
  if (!_duLieu) return null
  return _duLieu.khach.reduce((s, c) => s + Math.max(0, c.no || 0), 0)
}

// Tiền thu theo phương thức trong [tu, den) — cần bản đồng bộ có thanh toán (h.ttoan); chưa có → null
// h.ttoan: [[phương thức KiotViet, số tiền], ...] vd [['Cash', 500000], ['Transfer', 1200000]]
// (h.tt là trạng thái hoá đơn dạng chuỗi — không nhầm)
export function thanhToanHoaDon(tu, den, nhanVien) {
  if (!_duLieu?.hoaDon.some((h) => Array.isArray(h.ttoan))) return null
  const kq = { tienMat: 0, chuyenKhoan: 0, khac: 0 }
  for (const h of _duLieu.hoaDon) {
    const t = Date.parse(h.ngay)
    if (!(t >= tu && t < den) || !Array.isArray(h.ttoan)) continue
    if (nhanVien && (h.nv || '').toLowerCase() !== nhanVien.toLowerCase()) continue
    for (const [pt, tien] of h.ttoan) {
      const k = /cash/i.test(pt) ? 'tienMat' : /transfer/i.test(pt) ? 'chuyenKhoan' : 'khac'
      kq[k] += tien || 0
    }
  }
  return kq
}
