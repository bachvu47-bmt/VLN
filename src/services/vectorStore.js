// ============================================================
//  BỘ NHỚ VECTOR CỦA MAIKA — Giao thức AI tự học + HITL (Human-in-the-loop)
//
//  Mỗi "mẩu tri thức" = 1 bản ghi IndexedDB kèm vector embedding (Gemini).
//  Nguồn tri thức (loai):
//   - 'web'      : AI cào từ vatlieunha.vn (nguồn chính thức → tự duyệt)
//   - 'sua_sai'  : Admin đính chính câu trả lời sai của Maika (ưu tiên cao nhất)
//   - 'tai_lieu' : Admin nạp tài liệu/ảnh/PDF qua Cổng AI Admin
//  Trạng thái: 'da_duyet' (Maika dùng ngay) | 'cho_duyet' (đề xuất từ nhân viên,
//  chờ Admin duyệt ở màn Duyệt kiến thức).
//
//  Học ngay: bản ghi được duyệt → embed liền; lỗi mạng/quota → xếp hàng, hocNen()
//  tự học lại. Truy xuất: cosine similarity trên RAM (đủ nhanh cho vài nghìn mẩu);
//  thiếu vector / offline → tìm theo từ khoá (không dấu).
// ============================================================
import { idbDeleteMany, idbGetAll, idbPutMany, STORE_TRI_THUC } from '../data/idb'
import { geminiCoCauHinh, nhungVector } from './maikaChatbot'

const cache = new Map()
let listeners = []
const hoc = { dangHoc: false, daXong: 0, tong: 0, loi: '', choDen: 0 }

const baoThayDoi = () => listeners.forEach((f) => f())

export const sanSang = (async () => {
  try {
    ;(await idbGetAll(STORE_TRI_THUC)).forEach((r) => cache.set(r.id, r))
  } catch (e) {
    console.warn('[Bộ nhớ Maika] Không mở được IndexedDB:', e.message)
  }
  baoThayDoi()
})()

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

export function trangThaiHoc() {
  return { ...hoc }
}

export function thongKe() {
  const tk = { tong: 0, web: 0, suaSai: 0, taiLieu: 0, choDuyet: 0, daNhung: 0, chuaNhung: 0 }
  for (const r of cache.values()) {
    if (r.trangThai === 'cho_duyet') {
      tk.choDuyet++
      continue
    }
    tk.tong++
    if (r.loai === 'web') tk.web++
    if (r.loai === 'sua_sai') tk.suaSai++
    if (r.loai === 'tai_lieu') tk.taiLieu++
    if (r.vec) tk.daNhung++
    else tk.chuaNhung++
  }
  return tk
}

// Danh sách (mới nhất trước) — lọc theo loai / trangThai
export function danhSach({ loai, trangThai } = {}) {
  return [...cache.values()]
    .filter((r) => (!loai || r.loai === loai) && (!trangThai || r.trangThai === trangThai))
    .sort((a, b) => (b.taoLuc || 0) - (a.taoLuc || 0))
}

function maMoi(tienTo) {
  return `${tienTo}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function bam(s = '') {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

async function luu(recs) {
  recs.forEach((r) => cache.set(r.id, r))
  baoThayDoi()
  await idbPutMany(STORE_TRI_THUC, recs)
}

// ============================================================
//  GHI TRI THỨC
// ============================================================

// Admin sửa sai ngay trong khung chat → duyệt & học tức thì
export async function adminSuaSai({ cauHoi, traLoiSai, traLoiDung, nguoi }) {
  const rec = {
    id: maMoi('sua'),
    loai: 'sua_sai',
    trangThai: 'da_duyet',
    tieuDe: 'Đính chính: ' + cauHoi.slice(0, 80),
    noiDung: `Câu hỏi: ${cauHoi}\nTrả lời ĐÚNG: ${traLoiDung}`,
    cauHoi,
    traLoiSai,
    traLoiDung,
    nguoiTao: nguoi,
    duyetBoi: nguoi,
    taoLuc: Date.now(),
    duyetLuc: Date.now(),
    vec: null,
  }
  await luu([rec])
  return hocNgay(rec)
}

// Nhân viên báo Maika trả lời sai → đề xuất chờ Admin duyệt
export async function deXuatSuaSai({ cauHoi, traLoiSai, traLoiDung, nguoi }) {
  const rec = {
    id: maMoi('dx'),
    loai: 'sua_sai',
    trangThai: 'cho_duyet',
    tieuDe: 'Đề xuất đính chính: ' + cauHoi.slice(0, 80),
    noiDung: `Câu hỏi: ${cauHoi}\nTrả lời ĐÚNG: ${traLoiDung}`,
    cauHoi,
    traLoiSai,
    traLoiDung,
    nguoiTao: nguoi,
    taoLuc: Date.now(),
    vec: null,
  }
  await luu([rec])
  return rec
}

// Admin nạp tài liệu đã phân tích (Cổng AI Admin) → duyệt & học tức thì
export async function napTaiLieu({ tieuDe, noiDung, tags = [], nguon = '', nguoi }) {
  const rec = {
    id: maMoi('tl'),
    loai: 'tai_lieu',
    trangThai: 'da_duyet',
    tieuDe,
    noiDung,
    tags,
    nguon,
    nguoiTao: nguoi,
    duyetBoi: nguoi,
    taoLuc: Date.now(),
    duyetLuc: Date.now(),
    vec: null,
  }
  await luu([rec])
  return hocNgay(rec)
}

// Admin duyệt đề xuất (có thể sửa lại câu trả lời đúng trước khi duyệt)
export async function duyetDeXuat(id, { traLoiDung, nguoi }) {
  const cu = cache.get(id)
  if (!cu) throw new Error('Không tìm thấy đề xuất')
  const dung = (traLoiDung ?? cu.traLoiDung).trim()
  const rec = {
    ...cu,
    trangThai: 'da_duyet',
    tieuDe: 'Đính chính: ' + cu.cauHoi.slice(0, 80),
    traLoiDung: dung,
    noiDung: `Câu hỏi: ${cu.cauHoi}\nTrả lời ĐÚNG: ${dung}`,
    duyetBoi: nguoi,
    duyetLuc: Date.now(),
    vec: null,
  }
  await luu([rec])
  return hocNgay(rec)
}

export async function xoaTriThuc(id) {
  cache.delete(id)
  baoThayDoi()
  await idbDeleteMany(STORE_TRI_THUC, [id])
}

// Embed 1 bản ghi ngay; thất bại thì để vec=null cho hocNen() xử lý sau
async function hocNgay(rec) {
  if (!geminiCoCauHinh()) return { ...rec, daHoc: false }
  try {
    const [vec] = await nhungVector([`${rec.tieuDe}\n${rec.noiDung}`])
    const moi = { ...rec, vec }
    await luu([moi])
    return { ...moi, daHoc: true }
  } catch (e) {
    console.warn('[Bộ nhớ Maika] Chưa embed được, sẽ học lại sau:', e.message)
    return { ...rec, daHoc: false }
  }
}

// ============================================================
//  ĐỒNG BỘ TRI THỨC TỪ WEBSITE (sản phẩm → các đoạn tri thức)
// ============================================================
const DO_DAI_DOAN = 1200
const SO_DOAN_TOI_DA = 3 // mỗi SP tối đa 3 đoạn — cân bằng độ phủ & quota embedding free

function chiaDoan(text, doDai) {
  const cau = text.split(/(?<=[.!?;])\s+/)
  const doan = []
  let hienTai = ''
  for (const c of cau) {
    if ((hienTai + ' ' + c).length > doDai && hienTai) {
      doan.push(hienTai.trim())
      hienTai = ''
    }
    hienTai += ' ' + c
  }
  if (hienTai.trim()) doan.push(hienTai.trim())
  return doan
}

function doanTuSanPham(sp) {
  const dau = [
    `${sp.ten} — thương hiệu ${sp.hang}.`,
    sp.nhom && `Danh mục: ${sp.nhom}.`,
    sp.quyCach?.length && `Quy cách: ${sp.quyCach.join(', ')}.`,
    sp.dinhMuc?.giaTri && `Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}.`,
    sp.tenNgan,
  ]
    .filter(Boolean)
    .join(' ')
  const moTa = sp.moTa && sp.moTa !== sp.tenNgan ? sp.moTa : ''
  const phan = moTa ? chiaDoan(moTa, DO_DAI_DOAN) : []
  const doan = [`${dau}\n${(phan.shift() || '').slice(0, DO_DAI_DOAN)}`.trim(), ...phan].slice(0, SO_DOAN_TOI_DA)
  return doan.map((noiDung, i) => ({
    id: `web:${sp.id}:${i}`,
    loai: 'web',
    trangThai: 'da_duyet',
    tieuDe: i === 0 ? sp.ten : `${sp.ten} (phần ${i + 1})`,
    noiDung,
    spId: sp.id,
    nguon: sp.url,
    hash: bam(noiDung),
  }))
}

// Upsert: chỉ ghi đoạn mới/thay đổi (giữ vector cũ nếu nội dung y nguyên),
// xoá đoạn của SP không còn trên website. Trả về số đoạn cần học mới.
export async function dongBoTriThucWeb(sanPhams) {
  await sanSang
  const moi = sanPhams.flatMap(doanTuSanPham)
  const idMoi = new Set(moi.map((r) => r.id))
  const canGhi = []
  for (const r of moi) {
    const cu = cache.get(r.id)
    if (cu && cu.hash === r.hash) continue
    canGhi.push({ ...r, taoLuc: Date.now(), nguoiTao: 'vatlieunha.vn', vec: null })
  }
  const canXoa = [...cache.values()].filter((r) => r.loai === 'web' && !idMoi.has(r.id)).map((r) => r.id)
  canXoa.forEach((id) => cache.delete(id))
  await idbDeleteMany(STORE_TRI_THUC, canXoa)
  await luu(canGhi)
  hocNen() // học nền, không chặn UI
  return { tongDoan: moi.length, doanMoi: canGhi.length, doanXoa: canXoa.length }
}

// ============================================================
//  HỌC NỀN — embed mọi tri thức đã duyệt còn thiếu vector
//  Tự giãn nhịp khi gặp giới hạn tần suất (HTTP 429) của gói free.
// ============================================================
const LO_NHUNG = 50
const ngu = (ms) => new Promise((r) => setTimeout(r, ms))

export async function hocNen() {
  if (hoc.dangHoc || !geminiCoCauHinh()) return
  await sanSang
  const hangDoi = [...cache.values()].filter((r) => r.trangThai === 'da_duyet' && !r.vec)
  if (!hangDoi.length) return
  // Ưu tiên đính chính & tài liệu admin trước dữ liệu web
  hangDoi.sort((a, b) => (a.loai === 'web') - (b.loai === 'web'))
  Object.assign(hoc, { dangHoc: true, daXong: 0, tong: hangDoi.length, loi: '', choDen: 0 })
  baoThayDoi()
  let thuLai = 0
  try {
    for (let i = 0; i < hangDoi.length; ) {
      const lo = hangDoi.slice(i, i + LO_NHUNG).filter((r) => cache.has(r.id))
      try {
        const vecs = await nhungVector(lo.map((r) => `${r.tieuDe}\n${r.noiDung}`))
        await luu(lo.map((r, j) => ({ ...cache.get(r.id), vec: vecs[j] })))
        i += LO_NHUNG
        hoc.daXong = Math.min(i, hangDoi.length)
        thuLai = 0
        baoThayDoi()
      } catch (e) {
        if (e.status === 429 && thuLai < 20) {
          thuLai++
          hoc.choDen = Date.now() + e.choGiay * 1000
          baoThayDoi()
          await ngu(e.choGiay * 1000)
          hoc.choDen = 0
          continue
        }
        throw e
      }
    }
  } catch (e) {
    hoc.loi = e.message || String(e)
    console.warn('[Bộ nhớ Maika] Học nền dừng:', hoc.loi)
  } finally {
    hoc.dangHoc = false
    baoThayDoi()
    // Có tri thức mới được thêm trong lúc đang học → học tiếp
    if (!hoc.loi && [...cache.values()].some((r) => r.trangThai === 'da_duyet' && !r.vec)) setTimeout(hocNen, 1000)
  }
}

// ============================================================
//  TRUY XUẤT (RAG) — trả về các mẩu tri thức liên quan nhất
// ============================================================
function boDau(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

function tachTu(s) {
  return boDau(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
}

function diemTuKhoa(tuHoi, r) {
  if (!tuHoi.length) return 0
  const kho = new Set(tachTu(`${r.tieuDe} ${r.noiDung}`))
  return tuHoi.filter((w) => kho.has(w)).length / tuHoi.length
}

function cosine(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

const NGUONG_VECTOR = 0.55
const NGUONG_TU_KHOA = 0.5
const THUONG_SUA_SAI = 0.08 // ưu tiên đính chính của Admin

export async function truyXuat(cauHoi, { k = 6, dungVector = true } = {}) {
  await sanSang
  const daDuyet = [...cache.values()].filter((r) => r.trangThai === 'da_duyet')
  if (!daDuyet.length || !cauHoi.trim()) return []

  const tuHoi = [...new Set(tachTu(cauHoi))]
  let vecHoi = null
  if (dungVector && geminiCoCauHinh() && daDuyet.some((r) => r.vec)) {
    try {
      ;[vecHoi] = await nhungVector([cauHoi], 'RETRIEVAL_QUERY')
    } catch (e) {
      console.warn('[Bộ nhớ Maika] Truy xuất vector lỗi → dùng từ khoá:', e.message)
    }
  }

  const ketQua = []
  for (const r of daDuyet) {
    const thuong = r.loai === 'sua_sai' ? THUONG_SUA_SAI : 0
    if (vecHoi && r.vec) {
      const d = cosine(vecHoi, r.vec) + thuong
      if (d >= NGUONG_VECTOR) ketQua.push({ r, d })
    } else {
      // Bản ghi chưa có vector (đang chờ học) hoặc offline → so khớp từ khoá
      const d = diemTuKhoa(tuHoi, r)
      if (d >= NGUONG_TU_KHOA) ketQua.push({ r, d: d * 0.7 + thuong })
    }
  }
  return ketQua
    .sort((a, b) => b.d - a.d)
    .slice(0, k)
    .map(({ r, d }) => ({ id: r.id, loai: r.loai, tieuDe: r.tieuDe, noiDung: r.noiDung, nguon: r.nguon, spId: r.spId, diem: d }))
}
