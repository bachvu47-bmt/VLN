// ============================================================
//  BÁO CÁO BÁN HÀNG — Google Sheets → Maika phân tích (Maika 2.0)
//  Nguồn: sheet "Báo cáo bán hàng ngày (nhập trực tiếp)" — mỗi dòng 1 lượt
//  tư vấn/bán hàng (nhân viên, doanh thu, khách, kênh, sản phẩm, tình trạng...).
//  Đọc qua endpoint CSV công khai của Google (gviz) — sheet cần chia sẻ
//  "Bất kỳ ai có link · Người xem". Số liệu tính bằng code (chính xác tuyệt đối);
//  AI chỉ dùng để hiểu câu hỏi tự nhiên → bộ lọc.
// ============================================================
import { idbGet, idbPut, STORE_KV } from '../data/idb'
import { aiCoCauHinh, aiNhanh } from './maikaChatbot'
import { layText } from './taiWeb'

const ID_MAC_DINH = import.meta.env.VITE_SHEET_BAO_CAO_ID || ''
const TAB_MAC_DINH = import.meta.env.VITE_SHEET_BAO_CAO_TAB || 'Báo cáo ngày'
const LS_NGUON = 'vln_sheet_bao_cao' // Admin dán link sheet khác (ghi đè cấu hình build)
const KEY_CACHE = 'vln_bao_cao_cache'
const TUOI_CACHE_MS = 30 * 60 * 1000

export const TT_BAO_GIA = 'Đã gửi báo giá - KH đang xem xét'
const TT_CHOT = ['Hoàn thành', 'Đã lên đơn hàng']
const TT_MO = [TT_BAO_GIA, 'Đang tư vấn']

// "Chưa chốt": báo giá/tư vấn còn mở (kể cả sheet ghi tay "Chưa chốt"), không phải đã chốt/huỷ
export function laChuaChot(tinhTrang = '') {
  if (TT_CHOT.includes(tinhTrang)) return false
  return TT_MO.includes(tinhTrang) || (/chưa chốt|đang xem xét|chờ (khách|kh)/i.test(tinhTrang) && !/huỷ|hủy|không mua|từ chối/i.test(tinhTrang))
}

// ---- Cấu hình nguồn ----
export function layNguon() {
  let tuy = ''
  try {
    tuy = localStorage.getItem(LS_NGUON) || ''
  } catch {
    /* bỏ qua */
  }
  const id = (tuy.match(/\/d\/([\w-]{20,})/) || [])[1] || (/^[\w-]{20,}$/.test(tuy) ? tuy : '') || ID_MAC_DINH
  return { id, tab: TAB_MAC_DINH }
}

export function coNguonBaoCao() {
  return !!layNguon().id
}

export function datNguon(linkHoacId) {
  try {
    if (linkHoacId) localStorage.setItem(LS_NGUON, linkHoacId.trim())
    else localStorage.removeItem(LS_NGUON)
  } catch {
    /* bỏ qua */
  }
  _ram = null
}

// CSV chuẩn RFC 4180: ô có dấu phẩy / xuống dòng / "" nằm trong ngoặc kép
export function docCSV(text) {
  const rows = []
  let row = []
  let o = ''
  let trongNgoac = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (trongNgoac) {
      if (c === '"' && text[i + 1] === '"') {
        o += '"'
        i++
      } else if (c === '"') trongNgoac = false
      else o += c
    } else if (c === '"') trongNgoac = true
    else if (c === ',') {
      row.push(o)
      o = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(o)
      rows.push(row)
      row = []
      o = ''
    } else o += c
  }
  if (o || row.length) {
    row.push(o)
    rows.push(row)
  }
  return rows
}

// "07/07/2026 16:03" (dd/mm/yyyy) → ms
function docNgay(s = '') {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!m) return NaN
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
}

const docSo = (s = '') => Number(String(s).replace(/[^\d-]/g, '')) || 0
const gon = (s = '') => s.replace(/\s+/g, ' ').trim()

// Tìm cột theo tiêu đề (chịu được khi sheet thêm/bớt/đổi thứ tự cột).
// Mảng = thứ tự ưu tiên: vd sheet có cả "Số tiền nợ" và "Công nợ" → lấy "Số tiền nợ".
const COT = {
  thoiGian: /thời gian/i,
  nhanVien: /nhân viên/i,
  doanhThu: /doanh thu|doanh số/i,
  congNo: [/số tiền nợ/i, /công nợ/i, /tiền nợ|dư nợ/i],
  // "Tên khách hàng" | "Khách hàng" | "Khách hàng (Cty X / Anh Hùng)" — KHÔNG khớp "Loại khách hàng"
  khach: /^\s*(tên\s+)?khách(\s+hàng)?\s*(\(|$)/i,
  hinhThucTT: [/hình thức.*(thanh toán|tt\b)/i, /phương thức.*thanh toán/i, /^\s*thanh toán\s*$/i, /^\s*httt\s*$/i],
  maDon: /mã\s*(đơn|hđ|hoá đơn|hóa đơn)|số\s*(hđ|hoá đơn|hóa đơn)/i,
  loaiKH: /loại khách/i,
  doiTuong: /đối tượng/i,
  sdt: /điện thoại/i,
  kenh: /kênh/i,
  diaChi: /địa chỉ/i,
  sanPham: /sản phẩm/i,
  loaiCT: /công trình/i,
  chiTiet: /chi tiết/i,
  tinhTrang: /tình trạng/i,
  lyDo: /lý do/i,
  lienHe: /liên hệ gần nhất/i,
}

function viTriCot(tieuDe, mau) {
  for (const re of [mau].flat()) {
    const i = tieuDe.findIndex((h) => re.test(h))
    if (i >= 0) return i
  }
  return -1
}

// Hình thức thanh toán (ô tự do) → nhóm chuẩn để cộng tiền
export const NHOM_TT = { tienMat: 'Tiền mặt', chuyenKhoan: 'Chuyển khoản', no: 'Ghi nợ', khac: 'Khác', chuaGhi: 'Chưa ghi' }
export function phanLoaiTT(s = '') {
  const t = s.toLowerCase()
  if (!t.trim()) return 'chuaGhi'
  if (/tiền mặt|tien mat|\btm\b|cash/.test(t)) return 'tienMat'
  if (/chuyển khoản|chuyen khoan|\bck\b|banking|ngân hàng|\bqr\b|stk/.test(t)) return 'chuyenKhoan'
  if (/nợ|công nợ|ghi sổ|trả sau/.test(t)) return 'no'
  return 'khac'
}

export function chuanHoa(bang) {
  const [tieuDe, ...dong] = bang
  const vt = Object.fromEntries(Object.entries(COT).map(([k, mau]) => [k, viTriCot(tieuDe, mau)]))
  const lay = (r, k) => (vt[k] >= 0 ? gon(r[vt[k]] || '') : '')
  return dong
    .map((r) => {
      const thoiGian = docNgay(lay(r, 'thoiGian'))
      const lienHe = docNgay(lay(r, 'lienHe'))
      return {
        thoiGian,
        lienHe: Number.isFinite(lienHe) ? lienHe : thoiGian,
        nhanVien: lay(r, 'nhanVien'),
        doanhThu: docSo(lay(r, 'doanhThu')),
        congNo: docSo(lay(r, 'congNo')),
        khach: lay(r, 'khach'),
        loaiKH: lay(r, 'loaiKH'),
        doiTuong: lay(r, 'doiTuong'),
        sdt: lay(r, 'sdt').replace(/\D/g, ''),
        kenh: lay(r, 'kenh') || 'Khác',
        diaChi: lay(r, 'diaChi'),
        sanPham: lay(r, 'sanPham'),
        loaiCT: lay(r, 'loaiCT'),
        chiTiet: lay(r, 'chiTiet'),
        tinhTrang: lay(r, 'tinhTrang') || '(chưa ghi)',
        lyDo: lay(r, 'lyDo'),
        hinhThucTT: lay(r, 'hinhThucTT'),
        nhomTT: phanLoaiTT(lay(r, 'hinhThucTT')),
        maDon: lay(r, 'maDon'),
      }
    })
    .filter((r) => Number.isFinite(r.thoiGian) && (r.khach || r.sanPham || r.doanhThu))
}

// ---- Tải + cache (IndexedDB) ----
// Đổi khi cấu trúc dòng đã chuẩn hoá thay đổi → bỏ bản lưu cũ (vd v2: thêm hinhThucTT, maDon)
const PHIEN_BAN_DONG = 2
// Bản trong RAM: mở màn Báo cáo / hỏi Maika lần 2 không phải đọc IndexedDB + dựng lại 1.000+ dòng
let _ram = null

export async function layBaoCaoCache() {
  if (_ram) return _ram
  try {
    const c = (await idbGet(STORE_KV, KEY_CACHE)) || null
    return c?.pb === PHIEN_BAN_DONG ? (_ram = c) : null
  } catch {
    return null
  }
}

export async function taiBaoCao({ batBuoc = false, tuoiToiDa = TUOI_CACHE_MS } = {}) {
  const { id, tab } = layNguon()
  if (!id) throw new Error('Chưa cấu hình Google Sheet báo cáo')
  const cache = await layBaoCaoCache()
  if (!batBuoc && cache?.id === id && Date.now() - cache.luc < tuoiToiDa) return cache
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  let text
  try {
    text = await layText(url)
  } catch (e) {
    if (cache?.id === id) return { ...cache, loiMang: e.message } // mất mạng → dùng bản cũ
    throw new Error('Không đọc được Google Sheet (' + e.message + '). Kiểm tra mạng & quyền chia sẻ "Bất kỳ ai có link".')
  }
  if (/^\s*<!DOCTYPE|<html/i.test(text)) throw new Error('Sheet chưa chia sẻ công khai — đặt "Bất kỳ ai có link · Người xem".')
  const rows = chuanHoa(docCSV(text))
  if (!rows.length) throw new Error('Sheet không có dữ liệu hợp lệ (kiểm tra tên tab "' + tab + '")')
  const ketQua = { id, luc: Date.now(), rows, pb: PHIEN_BAN_DONG }
  _ram = ketQua
  try {
    await idbPut(STORE_KV, ketQua, KEY_CACHE)
  } catch {
    /* bỏ qua */
  }
  return ketQua
}

// ============================================================
//  PHÂN TÍCH (thuần code — số liệu chính xác)
// ============================================================
export const dauNgay = (t) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const khoaKhach = (r) => r.sdt || r.khach.toLowerCase()

export function loc(rows, { tu, den, nhanVien, kenh, khach } = {}) {
  const k = khach?.toLowerCase()
  return rows.filter(
    (r) =>
      (!tu || r.thoiGian >= tu) &&
      (!den || r.thoiGian < den) &&
      (!nhanVien || r.nhanVien.toLowerCase() === nhanVien.toLowerCase()) &&
      (!kenh || r.kenh.toLowerCase() === kenh.toLowerCase()) &&
      (!k || r.khach.toLowerCase().includes(k) || r.sdt.includes(k)),
  )
}

export function tongHop(rows) {
  const khach = new Set(rows.map(khoaKhach).filter(Boolean))
  // Trạng thái MỚI NHẤT của từng khách trong khoảng → tỷ lệ chốt
  const cuoi = new Map()
  for (const r of rows) {
    const k = khoaKhach(r)
    if (!k) continue
    const c = cuoi.get(k)
    if (!c || r.lienHe >= c.lienHe) cuoi.set(k, r)
  }
  const dsCuoi = [...cuoi.values()]
  const chot = dsCuoi.filter((r) => TT_CHOT.includes(r.tinhTrang)).length
  return {
    doanhThu: rows.reduce((s, r) => s + r.doanhThu, 0),
    congNo: rows.reduce((s, r) => s + r.congNo, 0),
    soLuot: rows.length,
    soKhach: khach.size,
    soDon: rows.filter((r) => r.doanhThu > 0).length,
    soKhachChot: chot,
    tyLeChot: dsCuoi.length ? chot / dsCuoi.length : 0,
    soBaoGiaCho: dsCuoi.filter((r) => r.tinhTrang === TT_BAO_GIA).length,
    ...theoThanhToan(rows),
  }
}

// Doanh thu tách theo hình thức thanh toán. coCot=false → sheet chưa có cột "Hình thức thanh toán"
export function theoThanhToan(rows) {
  const kq = { tienMat: 0, chuyenKhoan: 0, no: 0, khac: 0, chuaGhi: 0 }
  let coCot = false
  for (const r of rows) {
    if (!r.doanhThu) continue
    const nhom = r.nhomTT || 'chuaGhi'
    kq[nhom] += r.doanhThu
    if (nhom !== 'chuaGhi') coCot = true
  }
  return { thanhToan: kq, coCotTT: coCot }
}

// Ngày gần nhất (trong các dòng) có phát sinh doanh thu / công nợ → "Doanh số ngày", "Công nợ ngày"
export function ngayGanNhat(rows, truong = 'doanhThu') {
  const t = rows.filter((r) => r[truong] > 0).reduce((m, r) => Math.max(m, r.thoiGian), 0)
  return t ? dauNgay(t) : 0
}

export function tongTrongNgay(rows, ngay, truong) {
  return rows.filter((r) => r.thoiGian >= ngay && r.thoiGian < ngay + 864e5).reduce((s, r) => s + r[truong], 0)
}

// Dòng phát sinh doanh thu (bảng "Chi tiết doanh số") — mới nhất trước
export function chiTietDoanhSo(rows) {
  return rows.filter((r) => r.doanhThu > 0).sort((a, b) => b.thoiGian - a.thoiGian)
}

// Dòng phát sinh công nợ (bảng "Chi tiết công nợ") — mới nhất trước
export function chiTietCongNo(rows) {
  return rows.filter((r) => r.congNo > 0).sort((a, b) => b.thoiGian - a.thoiGian)
}

// Người nợ nhiều nhất: gom theo khách (SĐT hoặc tên) → [{ ten, soTien, soDon }]
export function topNguoiNo(rows, n = 5) {
  const m = new Map()
  for (const r of rows) {
    if (!(r.congNo > 0)) continue
    const k = khoaKhach(r) || '(không tên)'
    const g = m.get(k) || { ten: r.khach || r.sdt || '(không tên)', soTien: 0, soDon: 0 }
    g.soTien += r.congNo
    g.soDon++
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => b.soTien - a.soTien).slice(0, n)
}

// Gom theo 1 trường → [{ nhan, giaTri }] (chiSo: 'doanhThu' | 'soLuot' | 'soKhach')
export function nhomTheo(rows, truong, chiSo = 'doanhThu') {
  const m = new Map()
  for (const r of rows) {
    const nhan = r[truong] || '(trống)'
    const g = m.get(nhan) || { nhan, doanhThu: 0, soLuot: 0, khach: new Set() }
    g.doanhThu += r.doanhThu
    g.soLuot++
    g.khach.add(khoaKhach(r))
    m.set(nhan, g)
  }
  return [...m.values()]
    .map((g) => ({ nhan: g.nhan, giaTri: chiSo === 'soKhach' ? g.khach.size : g[chiSo] }))
    .sort((a, b) => b.giaTri - a.giaTri)
}

// Chuỗi thời gian liền mạch (kể cả ngày không bán) — buoc: 'ngay' | 'tuan' | 'thang'
export function theoThoiGian(rows, tu, den, buoc = 'ngay', chiSo = 'doanhThu') {
  const moc = []
  const d = new Date(dauNgay(tu))
  if (buoc === 'tuan') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // về thứ 2
  if (buoc === 'thang') d.setDate(1)
  while (d.getTime() < den) {
    const bd = d.getTime()
    if (buoc === 'ngay') d.setDate(d.getDate() + 1)
    else if (buoc === 'tuan') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    moc.push([bd, d.getTime()])
  }
  const fmt = (t) => {
    const x = new Date(t)
    return buoc === 'thang' ? `T${x.getMonth() + 1}/${String(x.getFullYear()).slice(2)}` : `${x.getDate()}/${x.getMonth() + 1}`
  }
  return moc.map(([a, b]) => {
    const trong = rows.filter((r) => r.thoiGian >= a && r.thoiGian < b)
    return { nhan: fmt(a), giaTri: chiSo === 'soLuot' ? trong.length : trong.reduce((s, r) => s + r.doanhThu, 0), tu: a }
  })
}

// Sản phẩm khách quan tâm (ô tự do, nhiều SP cách nhau bởi dấu phẩy) → đếm lượt hỏi
export function topSanPham(rows, n = 8) {
  const m = new Map()
  for (const r of rows) {
    for (const sp of r.sanPham.split(/[,;+\n]/).map((x) => gon(x).toLowerCase()).filter((x) => x.length > 2)) {
      m.set(sp, (m.get(sp) || 0) + 1)
    }
  }
  return [...m.entries()]
    .map(([nhan, giaTri]) => ({ nhan: nhan[0].toUpperCase() + nhan.slice(1), giaTri }))
    .sort((a, b) => b.giaTri - a.giaTri)
    .slice(0, n)
}

// Báo giá / tư vấn còn mở mà quá N ngày chưa liên hệ lại → cần follow-up.
// Xét trạng thái MỚI NHẤT của từng khách (khách đã chốt/huỷ ở dòng sau thì bỏ qua).
// toiDa: chỉ lấy khách im lặng ≤ toiDa ngày (còn "nóng"); khách cũ hơn đếm riêng (soNguoi).
export function canFollowUp(rows, { soNgay = 3, toiDa = 30, nhanVien } = {}) {
  const cuoi = new Map()
  for (const r of nhanVien ? loc(rows, { nhanVien }) : rows) {
    const k = khoaKhach(r)
    if (!k) continue
    const c = cuoi.get(k)
    if (!c || r.lienHe >= c.lienHe) cuoi.set(k, r)
  }
  const nguong = Date.now() - soNgay * 864e5
  const mo = [...cuoi.values()]
    .filter((r) => TT_MO.includes(r.tinhTrang) && r.lienHe < nguong)
    .map((r) => ({ ...r, soNgayIm: Math.floor((Date.now() - r.lienHe) / 864e5) }))
    .sort((a, b) => a.soNgayIm - b.soNgayIm) // gần nhất trước — còn "nóng", dễ chốt hơn
  const nong = mo.filter((r) => r.soNgayIm <= toiDa)
  nong.soNguoi = mo.length - nong.length
  return nong
}

export function danhSachNhanVien(rows) {
  return [...new Set(rows.map((r) => r.nhanVien).filter(Boolean))]
}

export const vnd = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2).replace(/\.?0+$/, '')} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} tr` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n))
export const vndDay = (n) => n.toLocaleString('vi-VN') + 'đ'

// ============================================================
//  HỎI ĐÁP TỰ NHIÊN — AI hiểu câu hỏi → bộ lọc; code tính số liệu
// ============================================================
const MAU_CAU_BAO_CAO = /(doanh thu|doanh số|bán được|báo cáo|công nợ|người nợ|ai (đang )?nợ|còn nợ|số tiền nợ|tiền mặt|chuyển khoản|thanh toán|tỷ lệ chốt|chốt (được|đơn)|top sản phẩm|bán chạy|hỏi nhiều|bao nhiêu (khách|đơn|lượt)|kênh nào|nhân viên nào|thống kê|báo giá (nào|chưa|đang)|cần follow|chưa follow)/i

export function laCauBaoCao(text = '') {
  return MAU_CAU_BAO_CAO.test(text)
}

function moTaHomNay() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (thứ ${d.getDay() === 0 ? 'CN' : d.getDay() + 1})`
}

// Cache "câu hỏi → bộ lọc" trong ngày: hỏi lại câu cũ không tốn lượt AI, trả lời < 1s
// (số liệu vẫn tính lại từ dữ liệu sheet mới nhất)
const _cacheBoLoc = new Map()

export async function hoiBaoCao(cauHoi) {
  if (!aiCoCauHinh()) throw new Error('Chưa cấu hình AI')
  const { rows } = await taiBaoCao()
  // Có id sheet trong khoá: đổi sheet giữa ngày thì bộ lọc (tên nhân viên...) của sheet cũ không bị dùng lại
  const khoa = `${layNguon().id}|${dauNgay(Date.now())}|${cauHoi.toLowerCase().replace(/[?.!\s]+/g, ' ').trim()}`
  let q = _cacheBoLoc.get(khoa)
  if (!q) {
    const nvs = danhSachNhanVien(rows)
    const moiNhat = new Date(Math.max(...rows.map((r) => r.thoiGian))).toLocaleDateString('vi-VN')
    const sys = `Chuyển câu hỏi về báo cáo bán hàng thành bộ lọc JSON. Hôm nay: ${moTaHomNay()}. Dữ liệu có đến ${moiNhat}. Nhân viên: ${nvs.join(', ')}.
Trả về DUY NHẤT JSON: {"loai":"tong|theoThoiGian|theoNhanVien|theoKenh|theoTinhTrang|topSanPham|followUp|congNo|thanhToan","tu":"YYYY-MM-DD hoặc ''","den":"YYYY-MM-DD (không gồm ngày này) hoặc ''","nhanVien":"tên đúng trong danh sách hoặc ''","khach":"tên/SĐT khách hoặc ''","chiSo":"doanhThu|soLuot|soKhach","buoc":"ngay|tuan|thang hoặc '' (khi hỏi theo ngày/tuần/tháng → loai theoThoiGian)"}
"hôm nay"=hôm nay→mai; "tuần này"=thứ 2 tuần này→mai; "tháng này"=ngày 1→mai; "tháng 9"=2026-09-01→2026-10-01; không nói thời gian → tu='' den=''. "bao nhiêu khách"→chiSo soKhach; "bao nhiêu lượt/đơn"→soLuot; mặc định doanhThu. Hỏi báo giá chưa chốt/cần follow-up → followUp. Hỏi công nợ / ai đang nợ / số tiền nợ → congNo. Hỏi tiền mặt / chuyển khoản / hình thức thanh toán → thanhToan.`
    const raw = await aiNhanh(sys, cauHoi, { json: true })
    q = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    if (_cacheBoLoc.size > 200) _cacheBoLoc.clear()
    _cacheBoLoc.set(khoa, q)
  }
  return traLoiBaoCao(rows, q)
}

const docNgayISO = (s) => (s ? new Date(s + 'T00:00:00').getTime() : NaN)

// Bộ lọc → câu trả lời (chữ) + biểu đồ — tách riêng để kiểm thử không cần AI
export function traLoiBaoCao(rows, q) {
  let tu = docNgayISO(q.tu)
  let den = docNgayISO(q.den)
  if (!Number.isFinite(tu)) tu = Math.min(...rows.map((r) => r.thoiGian))
  if (!Number.isFinite(den)) den = dauNgay(Date.now()) + 864e5
  const ds = loc(rows, { tu, den, nhanVien: q.nhanVien || undefined, khach: q.khach || undefined })
  const kh = `${new Date(tu).toLocaleDateString('vi-VN')} – ${new Date(den - 1).toLocaleDateString('vi-VN')}${q.nhanVien ? ` · ${q.nhanVien}` : ''}${q.khach ? ` · khách "${q.khach}"` : ''}`
  const th = tongHop(ds)
  const chiSo = q.chiSo || 'doanhThu'
  const donVi = chiSo === 'doanhThu' ? 'vnd' : 'so'

  if (!ds.length && q.loai !== 'followUp') {
    return { text: `Không có dữ liệu trong khoảng ${kh}.`, khoang: kh }
  }
  const dongTong = `📊 ${kh}\n• Doanh thu: ${vndDay(th.doanhThu)} (${th.soDon} đơn)\n• ${th.soLuot} lượt tư vấn · ${th.soKhach} khách · tỷ lệ chốt ${Math.round(th.tyLeChot * 100)}%\n• ${th.soBaoGiaCho} báo giá đang chờ khách quyết${th.congNo ? `\n• Công nợ: ${vndDay(th.congNo)}` : ''}`

  switch (q.loai) {
    case 'theoThoiGian': {
      const soNgay = (den - tu) / 864e5
      const buoc = ['ngay', 'tuan', 'thang'].includes(q.buoc) ? q.buoc : soNgay > 120 ? 'thang' : soNgay > 31 ? 'tuan' : 'ngay'
      const diem = theoThoiGian(ds, tu, den, buoc, chiSo === 'soLuot' ? 'soLuot' : 'doanhThu')
      const dinh = diem.reduce((a, b) => (b.giaTri > a.giaTri ? b : a), diem[0])
      return { text: `${dongTong}\n• Cao nhất: ${dinh.nhan} (${chiSo === 'soLuot' ? dinh.giaTri + ' lượt' : vndDay(dinh.giaTri)})`, bieuDo: { kieu: 'cot', tieuDe: `${chiSo === 'soLuot' ? 'Lượt tư vấn' : 'Doanh thu'} theo ${buoc === 'ngay' ? 'ngày' : buoc === 'tuan' ? 'tuần' : 'tháng'}`, diem, donVi: chiSo === 'soLuot' ? 'so' : 'vnd' } }
    }
    case 'theoNhanVien':
    case 'theoKenh':
    case 'theoTinhTrang': {
      const truong = { theoNhanVien: 'nhanVien', theoKenh: 'kenh', theoTinhTrang: 'tinhTrang' }[q.loai]
      const cs = q.loai === 'theoTinhTrang' ? 'soKhach' : chiSo
      const diem = nhomTheo(ds, truong, cs)
      const ten = { nhanVien: 'nhân viên', kenh: 'kênh', tinhTrang: 'tình trạng' }[truong]
      const fmt = (v) => (cs === 'doanhThu' ? vndDay(v) : `${v} ${cs === 'soKhach' ? 'khách' : 'lượt'}`)
      return {
        text: `${dongTong}\n\nTheo ${ten}:\n${diem.slice(0, 6).map((d) => `• ${d.nhan}: ${fmt(d.giaTri)}`).join('\n')}`,
        bieuDo: { kieu: 'ngang', tieuDe: `${cs === 'doanhThu' ? 'Doanh thu' : cs === 'soKhach' ? 'Số khách' : 'Lượt tư vấn'} theo ${ten}`, diem: diem.slice(0, 8), donVi: cs === 'doanhThu' ? 'vnd' : 'so' },
      }
    }
    case 'topSanPham': {
      const diem = topSanPham(ds)
      return { text: `${dongTong}\n\nSản phẩm khách hỏi nhiều nhất:\n${diem.slice(0, 6).map((d, i) => `${i + 1}. ${d.nhan} — ${d.giaTri} lượt`).join('\n')}`, bieuDo: { kieu: 'ngang', tieuDe: 'Sản phẩm khách quan tâm (lượt hỏi)', diem, donVi: 'so' } }
    }
    case 'congNo': {
      const no = chiTietCongNo(ds)
      const tatCa = topNguoiNo(ds, Infinity)
      const top = tatCa.slice(0, 6)
      const tong = no.reduce((s, r) => s + r.congNo, 0)
      return {
        text: no.length
          ? `💳 Công nợ ${kh}: ${vndDay(tong)} (${no.length} đơn, ${tatCa.length} khách)\nNgười nợ nhiều nhất:\n${top.map((g) => `• ${g.ten}: ${vndDay(g.soTien)}${g.soDon > 1 ? ` (${g.soDon} đơn)` : ''}`).join('\n')}`
          : `✅ Không phát sinh công nợ trong khoảng ${kh}.`,
        bieuDo: top.length ? { kieu: 'ngang', tieuDe: 'Công nợ theo khách', diem: top.map((g) => ({ nhan: g.ten, giaTri: g.soTien })), donVi: 'vnd' } : undefined,
      }
    }
    case 'thanhToan': {
      const { thanhToan: tt, coCotTT } = th
      if (!coCotTT) return { text: `${dongTong}\n\n⚠️ Sheet chưa có cột "Hình thức thanh toán" nên chưa tách được tiền mặt / chuyển khoản.` }
      const diem = Object.entries(tt).filter(([, v]) => v > 0).map(([k, v]) => ({ nhan: NHOM_TT[k], giaTri: v }))
      return {
        text: `💵 Doanh thu ${kh} theo hình thức thanh toán:\n${diem.map((d) => `• ${d.nhan}: ${vndDay(d.giaTri)}`).join('\n')}`,
        bieuDo: { kieu: 'ngang', tieuDe: 'Doanh thu theo hình thức thanh toán', diem, donVi: 'vnd' },
      }
    }
    case 'followUp': {
      const dsFU = canFollowUp(rows, { soNgay: 3, nhanVien: q.nhanVien || undefined })
      return {
        text: dsFU.length
          ? `🔔 ${dsFU.length} khách đang chờ báo giá/tư vấn, 3–30 ngày chưa liên hệ lại${dsFU.soNguoi ? ` (thêm ${dsFU.soNguoi} khách im lặng > 30 ngày)` : ''}. Gần nhất:\n${dsFU.slice(0, 6).map((r) => `• ${r.khach || r.sdt} — ${r.sanPham.slice(0, 40)} (${r.soNgayIm} ngày, ${r.nhanVien})`).join('\n')}\nMở "Báo cáo bán hàng" để tạo nhắc follow-up hàng loạt.`
          : '✅ Không có báo giá nào quá 3 ngày chưa follow-up.',
        followUp: dsFU.slice(0, 20),
      }
    }
    default:
      return { text: dongTong, bieuDo: { kieu: 'cot', tieuDe: 'Doanh thu theo ngày', diem: theoThoiGian(ds, Math.max(tu, den - 30 * 864e5), den, 'ngay'), donVi } }
  }
}
