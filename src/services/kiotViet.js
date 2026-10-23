// ============================================================
//  KIOTVIET (chỉ đọc) — GitHub Actions kết nối KiotViet ở cấp hệ thống ~30 phút/lần,
//  không máy nào phải nhập mã. Dữ liệu tách 2 phần:
//  · CÔNG KHAI — hàng hoá, tồn kho, giá bán: mọi máy tự tải (nhánh du-lieu).
//  · RIÊNG TƯ — khách hàng, hoá đơn, công nợ: CHỈ Admin. Máy chủ (Supabase) chỉ trả khi máy có
//    quyền Admin (phiên email Admin / PIN); chỉ giữ trong RAM, không lưu xuống máy.
// ============================================================
import { idbGet, idbPut, STORE_KV } from '../data/idb'
import { coKhoChung, coQuyenAdmin, docKiotVietRieng } from './khoChung'

const URL_CONG_KHAI = import.meta.env.VITE_KV_DATA_URL || 'https://raw.githubusercontent.com/bachvu47-bmt/VLN/du-lieu/kiotviet-cong-khai.json'
const KEY_CACHE = 'vln_kv_cong_khai'
const TUOI_CACHE_MS = 10 * 60 * 1000

// Dọn dấu vết cơ chế cũ ("Mã dữ liệu cửa hàng" + bản mã hoá trên máy)
try {
  localStorage.removeItem('vln_ma_du_lieu')
} catch {
  /* bỏ qua */
}
idbPut(STORE_KV, null, 'vln_kv_bin').catch(() => {})

let _congKhai = null // { capNhat, chiNhanh, sanPham }
let _rieng = null // { capNhat, hoaDon, khach } — chỉ máy Admin, chỉ trong RAM
let _duLieu = null
let _dangDongBo = false
let _laAdmin = false // người đang đăng nhập app là Admin (App.jsx đặt) — máy chủ vẫn tự kiểm tra lại
let listeners = []
const baoThayDoi = () => listeners.forEach((f) => f())

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

// { capNhat, chiNhanh, sanPham, hoaDon, khach, coRieng } — hoaDon/khach rỗng nếu máy không phải Admin
export function duLieuKV() {
  return _duLieu
}
export const dangDongBoKV = () => _dangDongBo

// Gọi khi đổi người đăng nhập: không phải Admin → bỏ ngay khách hàng & hoá đơn khỏi RAM
// (phiên email Admin gắn với máy, nhân viên dùng chung máy Admin cũng không thấy)
export function datNguoiDungKV(laAdmin) {
  _laAdmin = !!laAdmin
  if (!_laAdmin && _rieng) {
    _rieng = null
    ghep()
  }
}

function ghep() {
  _duLieu = _congKhai
    ? { ..._congKhai, hoaDon: _rieng?.hoaDon || [], khach: _rieng?.khach || [], coRieng: !!_rieng, capNhatRieng: _rieng?.capNhat || '' }
    : null
  baoThayDoi()
}

async function taiCongKhai() {
  // Mốc 5 phút trong URL để không dính bản cache cũ của CDN
  const res = await fetch(`${URL_CONG_KHAI}?t=${Math.floor(Date.now() / 300000)}`)
  if (!res.ok) throw new Error(res.status === 404 ? 'Chưa có dữ liệu KiotViet (đồng bộ chưa chạy)' : 'HTTP ' + res.status)
  return res.json()
}

async function giaiNen(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const s = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(s).text())
}

// Nạp dữ liệu: bản công khai lưu trên máy (mở app nhanh, dùng được khi mất mạng) → làm mới nếu cũ;
// máy Admin tải thêm phần riêng tư từ máy chủ.
export async function napKiotViet({ batBuoc = false } = {}) {
  _dangDongBo = true
  baoThayDoi()
  try {
    const cache = await idbGet(STORE_KV, KEY_CACHE).catch(() => null)
    if (cache?.d && !_congKhai) {
      _congKhai = cache.d
      ghep()
    }
    if (batBuoc || !cache || Date.now() - cache.luc >= TUOI_CACHE_MS) {
      try {
        _congKhai = await taiCongKhai()
        await idbPut(STORE_KV, { luc: Date.now(), d: _congKhai }, KEY_CACHE).catch(() => {})
      } catch (e) {
        if (!_congKhai) throw e
        console.warn('[KiotViet] Làm mới lỗi, dùng bản lưu:', e.message)
      }
    }
    if (_laAdmin && coKhoChung() && coQuyenAdmin()) {
      try {
        const b64 = await docKiotVietRieng()
        _rieng = b64 ? await giaiNen(b64) : null
      } catch (e) {
        console.warn('[KiotViet] Chưa tải được phần riêng tư:', e.message)
      }
    } else {
      _rieng = null // máy mất quyền Admin → bỏ khỏi RAM ngay
    }
    ghep()
    return _duLieu
  } finally {
    _dangDongBo = false
    baoThayDoi()
  }
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

// ---- Phần dưới đây dùng dữ liệu RIÊNG TƯ: máy không phải Admin luôn nhận rỗng / null ----

// Hoá đơn N ngày gần nhất tính theo ngày lịch (1 = từ 0h hôm nay)
export function hoaDonGanDay(soNgay = 14) {
  if (!_duLieu?.coRieng) return []
  const dau = new Date()
  dau.setHours(0, 0, 0, 0)
  const moc = dau.getTime() - (soNgay - 1) * 864e5
  return _duLieu.hoaDon.filter((h) => Date.parse(h.ngay) >= moc)
}

export function timKhach(q, n = 50) {
  if (!_duLieu?.coRieng) return []
  const k = boDau(q.trim())
  const so = q.replace(/\D/g, '')
  return _duLieu.khach
    .filter((c) => !k || boDau(`${c.ten} ${c.ma}`).includes(k) || (so.length >= 3 && c.sdt.replace(/\D/g, '').includes(so)))
    .slice(0, n)
}

export function lichSuMua(maKH) {
  if (!_duLieu?.coRieng || !maKH) return []
  return _duLieu.hoaDon.filter((h) => h.maKH === maKH)
}

export const tienVN = (n) => (n || 0).toLocaleString('vi-VN') + 'đ'

// ============================================================
//  CÔNG NỢ & THANH TOÁN cho màn Báo cáo (nguồn chuẩn: hoá đơn KiotViet — chỉ Admin)
// ============================================================

// Hoá đơn còn nợ (tổng − đã trả > 0) → cùng dạng dòng báo cáo Sheet; null nếu máy không có phần riêng tư
export function hoaDonConNo() {
  if (!_duLieu?.coRieng) return null
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
  if (!_duLieu?.coRieng) return null
  return _duLieu.khach.reduce((s, c) => s + Math.max(0, c.no || 0), 0)
}

// Tiền thu theo phương thức trong [tu, den) — cần bản đồng bộ có thanh toán (h.ttoan); chưa có → null
// h.ttoan: [[phương thức KiotViet, số tiền], ...] vd [['Cash', 500000], ['Transfer', 1200000]]
// (h.tt là trạng thái hoá đơn dạng chuỗi — không nhầm)
export function thanhToanHoaDon(tu, den, nhanVien) {
  if (!_duLieu?.coRieng || !_duLieu.hoaDon.some((h) => Array.isArray(h.ttoan))) return null
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
