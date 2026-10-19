// ============================================================
//  BỘ NHỚ VECTOR CỦA MAIKA — Giao thức AI tự học + HITL (Human-in-the-loop)
//
//  Mỗi "mẩu tri thức" = 1 bản ghi kèm vector embedding (Gemini).
//  Nguồn tri thức (loai):
//   - 'web'      : AI cào từ vatlieunha.vn (nguồn chính thức → tự duyệt)
//   - 'sua_sai'  : Admin đính chính câu trả lời sai của Maika (ưu tiên cao nhất)
//   - 'tai_lieu' : Admin nạp tài liệu/ảnh/PDF qua Cổng AI Admin
//  Trạng thái: 'da_duyet' (Maika dùng ngay) | 'cho_duyet' (đề xuất từ nhân viên,
//  chờ Admin duyệt ở màn Duyệt kiến thức).
//
//  2 chế độ lưu trữ:
//   - KHO CHUNG (có VITE_SUPABASE_*): tri thức + vector nằm trên Supabase, mọi máy
//     dùng chung; tìm kiếm vector chạy trên máy chủ (pgvector). Mỗi máy giữ bản
//     chữ trong IndexedDB để tra cứu khi mất mạng. Ghi của Admin cần PIN.
//   - TỪNG MÁY (không cấu hình): IndexedDB + cosine similarity trên RAM.
// ============================================================
import { idbDeleteMany, idbGet, idbGetAll, idbPut, idbPutMany, STORE_KV, STORE_TRI_THUC } from '../data/idb'
import { geminiCoCauHinh, nhungVector } from './maikaChatbot'
import { xoaMedia } from '../data/mediaStore'
import * as kho from './khoChung'

const CHUNG = kho.coKhoChung()
const KEY_MOC = 'vln_kho_chung_moc'
const CHU_KY_KEO = 2 * 60 * 1000

const cache = new Map()
let listeners = []
// Embedding ~2.000 đoạn web dùng chung quota Gemini của cả công ty → chỉ máy Admin học web
// (bản 1.1.8 để mọi máy cùng học → hết sạch quota embedding)
let _hocWeb = false
export function datQuyenHocWeb(laAdmin) {
  _hocWeb = !!laAdmin
}
const hoc = { dangHoc: false, daXong: 0, tong: 0, loi: '', choDen: 0 }
const dongBo = { lanCuoi: 0, loi: '' }

const baoThayDoi = () => listeners.forEach((f) => f())

export function cheDoLuuTru() {
  return CHUNG ? 'chung' : 'tungMay'
}

export function dangKyTheoDoi(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

export function trangThaiHoc() {
  return { ...hoc }
}

export function trangThaiDongBo() {
  return { ...dongBo }
}

const daCoVector = (r) => !!(r.vec || r.coVec)

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
    if (daCoVector(r)) tk.daNhung++
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

async function luuCucBo(recs) {
  recs.forEach((r) => cache.set(r.id, r))
  baoThayDoi()
  await idbPutMany(STORE_TRI_THUC, recs)
}

async function xoaCucBo(ids) {
  ids.forEach((id) => cache.delete(id))
  baoThayDoi()
  await idbDeleteMany(STORE_TRI_THUC, ids)
}

// ============================================================
//  ĐỒNG BỘ KHO CHUNG (kéo phần thay đổi từ Supabase về IndexedDB)
// ============================================================
let _dangKeo = null
export function keoKhoChung() {
  if (!CHUNG) return Promise.resolve()
  if (_dangKeo) return _dangKeo
  _dangKeo = (async () => {
    try {
      const moc = await idbGet(STORE_KV, KEY_MOC)
      const mocMoi = await kho.keoThayDoi(moc, async (rows) => {
        const xoa = rows.filter((r) => r.daXoa).map((r) => r.id)
        const giu = rows.filter((r) => !r.daXoa)
        await xoaCucBo(xoa)
        await luuCucBo(giu)
      })
      await idbPut(STORE_KV, mocMoi, KEY_MOC)
      Object.assign(dongBo, { lanCuoi: Date.now(), loi: '' })
    } catch (e) {
      dongBo.loi = e.message || String(e)
      console.warn('[Kho chung] Kéo dữ liệu lỗi:', dongBo.loi)
    } finally {
      _dangKeo = null
      baoThayDoi()
    }
  })()
  return _dangKeo
}

// Bản ghi tạo từ bản 1.1.8 (chỉ lưu trên máy) → đẩy lên kho chung khi có thể
async function dayBanGhiCu() {
  const cu = [...cache.values()].filter((r) => !r.capNhatLuc)
  if (!cu.length || dongBo.loi) return // chưa kéo được kho chung → giữ nguyên dữ liệu trên máy
  const web = cu.filter((r) => r.loai === 'web').map((r) => r.id)
  await xoaCucBo(web) // kho chung đã có dữ liệu web do máy Admin nạp
  for (const r of cu.filter((x) => x.loai !== 'web')) {
    try {
      if (r.trangThai === 'cho_duyet') await kho.guiDeXuat(r)
      else if (kho.layPinAdmin()) await kho.adminGhi([r])
      else continue // chưa có PIN → giữ trên máy, đẩy lên sau
      await xoaCucBo([r.id])
    } catch (e) {
      console.warn('[Kho chung] Chưa đẩy được bản ghi cũ', r.id, e.message)
    }
  }
}

export const sanSang = (async () => {
  try {
    ;(await idbGetAll(STORE_TRI_THUC)).forEach((r) => cache.set(r.id, r))
  } catch (e) {
    console.warn('[Bộ nhớ Maika] Không mở được IndexedDB:', e.message)
  }
  baoThayDoi()
  if (CHUNG) {
    await keoKhoChung()
    await dayBanGhiCu()
    if (typeof window !== 'undefined') {
      setInterval(keoKhoChung, CHU_KY_KEO)
      window.addEventListener('focus', () => {
        if (Date.now() - dongBo.lanCuoi > 30000) keoKhoChung()
      })
    }
  }
})()

// Admin vừa nhập PIN → đẩy bản ghi cũ + học phần còn thiếu
export async function sauKhiCoPin() {
  await sanSang
  await dayBanGhiCu()
  await keoKhoChung()
  hocNen()
}

// ============================================================
//  GHI TRI THỨC
// ============================================================

// Tri thức đã duyệt: kho chung → embed rồi gửi máy chủ (cần PIN); từng máy → lưu IndexedDB
async function ghiDaDuyet(rec) {
  let vec = null
  if (geminiCoCauHinh()) {
    try {
      ;[vec] = await nhungVector([`${rec.tieuDe}\n${rec.noiDung}`])
    } catch (e) {
      console.warn('[Bộ nhớ Maika] Chưa embed được, sẽ học lại sau:', e.message)
    }
  }
  if (CHUNG) {
    await kho.adminGhi([{ ...rec, vec }])
    await keoKhoChung()
  } else {
    await luuCucBo([{ ...rec, vec }])
  }
  return { ...rec, daHoc: !!vec }
}

// Admin sửa sai ngay trong khung chat → duyệt & học tức thì
export async function adminSuaSai({ cauHoi, traLoiSai, traLoiDung, nguoi, media = [], sku = '' }) {
  return ghiDaDuyet({
    id: maMoi('sua'),
    loai: 'sua_sai',
    trangThai: 'da_duyet',
    tieuDe: 'Đính chính: ' + cauHoi.slice(0, 80),
    noiDung: `Câu hỏi: ${cauHoi}\nTrả lời ĐÚNG: ${traLoiDung}` + (media.length ? `\n(Kèm ${media.length} ảnh/ghi âm${sku ? ` — SKU ${sku}` : ''})` : ''),
    media,
    sku,
    cauHoi,
    traLoiSai,
    traLoiDung,
    nguoiTao: nguoi,
    duyetBoi: nguoi,
    taoLuc: Date.now(),
    duyetLuc: Date.now(),
  })
}

// Nhân viên báo Maika trả lời sai → đề xuất chờ Admin duyệt.
// media: [{ id, loai: 'anh'|'am_thanh' }] — ảnh/âm thoại của câu hỏi (thẻ tri thức Multimodal)
export async function deXuatSuaSai({ cauHoi, traLoiSai, traLoiDung, nguoi, media = [], sku = '' }) {
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
    media,
    sku,
  }
  // Kho chung chưa lưu file → thẻ có ảnh/âm thanh giữ trên máy này để Admin duyệt kèm media
  if (CHUNG && !media.length) {
    await kho.guiDeXuat(rec)
    await keoKhoChung()
  } else {
    await luuCucBo([rec])
  }
  return rec
}

// Đề xuất lưu 1 câu hỏi có ảnh/âm thoại + câu trả lời tốt của Maika thành tri thức (chờ duyệt)
export async function deXuatTriThucMedia({ cauHoi, traLoi, nguoi, media = [], sku = '' }) {
  const rec = {
    id: maMoi('mm'),
    loai: 'tai_lieu',
    trangThai: 'cho_duyet',
    tieuDe: 'Tri thức hiện trường: ' + (cauHoi || 'ảnh gửi Maika').slice(0, 80),
    noiDung: `Tình huống: ${cauHoi}\nGiải pháp: ${traLoi}`,
    cauHoi,
    traLoiSai: traLoi, // nội dung Maika đã trả lời (hiển thị để Admin đối chiếu)
    traLoiDung: traLoi,
    nguoiTao: nguoi,
    taoLuc: Date.now(),
    media,
    sku,
  }
  await luuCucBo([rec])
  return rec
}

// Admin nạp tài liệu đã phân tích (Cổng AI Admin) → duyệt & học tức thì
export async function napTaiLieu({ tieuDe, noiDung, tags = [], nguon = '', nguoi, media = [] }) {
  return ghiDaDuyet({
    id: maMoi('tl'),
    loai: 'tai_lieu',
    trangThai: 'da_duyet',
    tieuDe,
    noiDung,
    tags,
    nguon,
    media,
    nguoiTao: nguoi,
    duyetBoi: nguoi,
    taoLuc: Date.now(),
    duyetLuc: Date.now(),
  })
}

// Admin duyệt đề xuất (có thể sửa lại câu trả lời đúng trước khi duyệt)
export async function duyetDeXuat(id, { traLoiDung, nguoi }) {
  const cu = cache.get(id)
  if (!cu) throw new Error('Không tìm thấy đề xuất')
  const dung = (traLoiDung ?? cu.traLoiDung).trim()
  const { vec: _v, coVec: _c, capNhatLuc: _m, daXoa: _x, ...goc } = cu
  const laTriThucMedia = cu.loai === 'tai_lieu'
  const coMedia = cu.media?.length > 0
  const ghiChuMedia = coMedia ? `\n(Kèm ${cu.media.map((m) => (m.loai === 'anh' ? 'ảnh hiện trường' : 'ghi âm')).join(', ')}${cu.sku ? ` — SKU ${cu.sku}` : ''})` : ''
  const ketQua = await ghiDaDuyet({
    ...goc,
    trangThai: 'da_duyet',
    tieuDe: laTriThucMedia ? cu.tieuDe.replace(/^Tri thức hiện trường: /, 'Hiện trường: ') : 'Đính chính: ' + cu.cauHoi.slice(0, 80),
    traLoiDung: dung,
    noiDung: (laTriThucMedia ? `Tình huống: ${cu.cauHoi}\nGiải pháp: ${dung}` : `Câu hỏi: ${cu.cauHoi}\nTrả lời ĐÚNG: ${dung}`) + ghiChuMedia,
    duyetBoi: nguoi,
    duyetLuc: Date.now(),
  })
  // Thẻ có media chỉ nằm trên máy này; ở kho chung bản đã duyệt được ghi lên máy chủ → bỏ bản nháp cục bộ
  if (CHUNG && coMedia) await xoaCucBo([id])
  return ketQua
}

export async function xoaTriThuc(id) {
  const r = cache.get(id)
  if (CHUNG && r?.capNhatLuc) {
    await kho.adminXoa([id])
    await keoKhoChung()
  } else {
    await xoaCucBo([id])
  }
  // Từ chối thẻ chờ duyệt → xoá luôn ảnh/âm thoại đi kèm cho nhẹ máy
  if (r?.trangThai === 'cho_duyet' && r.media?.length) await xoaMedia(r.media.map((m) => m.id))
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
// Kho chung: chỉ máy Admin (có PIN) nạp — các máy khác dùng lại kết quả.
export async function dongBoTriThucWeb(sanPhams) {
  await sanSang
  const moi = sanPhams.flatMap(doanTuSanPham)
  if (CHUNG && !kho.layPinAdmin()) return { tongDoan: moi.length, doanMoi: 0, doanXoa: 0, boQua: true }

  const idMoi = new Set(moi.map((r) => r.id))
  const canGhi = moi
    .filter((r) => cache.get(r.id)?.hash !== r.hash)
    .map((r) => ({ ...r, taoLuc: Date.now(), nguoiTao: 'vatlieunha.vn' }))
  const canXoa = [...cache.values()].filter((r) => r.loai === 'web' && !idMoi.has(r.id)).map((r) => r.id)

  if (CHUNG) {
    await kho.adminGhi(canGhi)
    await kho.adminXoa(canXoa)
    await keoKhoChung()
  } else {
    await xoaCucBo(canXoa)
    await luuCucBo(canGhi.map((r) => ({ ...r, vec: null })))
  }
  hocNen() // học nền, không chặn UI
  return { tongDoan: moi.length, doanMoi: canGhi.length, doanXoa: canXoa.length }
}

// ============================================================
//  HỌC NỀN — embed mọi tri thức đã duyệt còn thiếu vector
//  Tự giãn nhịp khi gặp giới hạn tần suất (HTTP 429) của gói free.
//  Kho chung: chỉ máy Admin chạy, vector gửi lên máy chủ cho mọi máy dùng.
// ============================================================
const LO_NHUNG = 50
const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const canHoc = (r) => r.trangThai === 'da_duyet' && !daCoVector(r) && (!CHUNG || r.capNhatLuc) && (r.loai !== 'web' || _hocWeb)

export async function hocNen() {
  if (hoc.dangHoc || !geminiCoCauHinh()) return
  await sanSang
  if (CHUNG && !kho.layPinAdmin()) return
  const hangDoi = [...cache.values()].filter(canHoc)
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
        if (CHUNG) {
          await kho.adminGanVector(lo.map((r, j) => ({ id: r.id, vec: vecs[j] })))
          await luuCucBo(lo.map((r) => ({ ...cache.get(r.id), coVec: true })))
        } else {
          await luuCucBo(lo.map((r, j) => ({ ...cache.get(r.id), vec: vecs[j] })))
        }
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
    if (!hoc.loi && [...cache.values()].some(canHoc)) setTimeout(hocNen, 1000)
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

// Hư từ / từ hỏi tiếng Việt (đã bỏ dấu) — không mang nghĩa tìm kiếm
const HU_TU = new Set(
  'la va cua co khong gi nao the cho voi duoc de khi thi nhu nay do mot cac nhung toi ban em anh chi oi giup hoi dung lam sao bao nhieu ra vao trong tren duoi se dang rat hay hon nen can phai biet minh vay a nhe thoi roi luon ve den tu bi cung chua'.split(' '),
)

function tachTu(s) {
  return boDau(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !HU_TU.has(w))
}

// Tần suất xuất hiện của từ trong kho → từ càng phổ biến ("gia" trong "phụ gia", "da" trong "đá")
// càng ít trọng số. Tính lại khi kho thay đổi.
let _df = null
let _soVanBan = 0
function bangDf() {
  if (_df) return _df
  _df = new Map()
  _soVanBan = 0
  for (const r of cache.values()) {
    if (r.trangThai !== 'da_duyet') continue
    _soVanBan++
    for (const w of new Set(tachTu(`${r.tieuDe} ${r.noiDung}`))) _df.set(w, (_df.get(w) || 0) + 1)
  }
  return _df
}
dangKyTheoDoi(() => {
  _df = null
})

const idf = (w) => Math.log(1 + _soVanBan / (1 + (bangDf().get(w) || 0)))

// Điểm từ khoá có trọng số IDF: tỷ lệ "lượng thông tin" của câu hỏi tìm thấy trong mẩu tri thức
function diemTuKhoa(tuHoi, r) {
  if (!tuHoi.length) return 0
  bangDf()
  const tap = new Set(tachTu(`${r.tieuDe} ${r.noiDung}`))
  let trung = 0
  let tong = 0
  for (const w of tuHoi) {
    const t = idf(w)
    tong += t
    if (tap.has(w)) trung += t
  }
  return tong ? trung / tong : 0
}

function cosine(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// Ngưỡng nâng lên (0.55/0.5 cũ để lọt mẩu không liên quan → Maika kèm thẻ lan man)
const NGUONG_VECTOR = 0.6
const NGUONG_TU_KHOA = 0.6
const THUONG_SUA_SAI = 0.08 // ưu tiên đính chính của Admin

const rutGon = ({ r, d }) => ({ id: r.id, loai: r.loai, tieuDe: r.tieuDe, noiDung: r.noiDung, nguon: r.nguon, spId: r.spId, diem: d })

export async function truyXuat(cauHoi, { k = 6, dungVector = true } = {}) {
  await sanSang
  const daDuyet = [...cache.values()].filter((r) => r.trangThai === 'da_duyet')
  if (!cauHoi.trim()) return []

  const tuHoi = [...new Set(tachTu(cauHoi))]
  let vecHoi = null
  if (dungVector && geminiCoCauHinh() && (CHUNG || daDuyet.some((r) => r.vec))) {
    try {
      ;[vecHoi] = await nhungVector([cauHoi], 'RETRIEVAL_QUERY')
    } catch (e) {
      console.warn('[Bộ nhớ Maika] Truy xuất vector lỗi → dùng từ khoá:', e.message)
    }
  }

  // Kho chung: tìm kiếm vector trên máy chủ; bản ghi chưa có vector bù bằng từ khoá
  if (CHUNG && vecHoi) {
    try {
      const kq = await kho.timTrenMayChu(vecHoi, k)
      const daCo = new Set(kq.map((x) => x.id))
      const bu = daDuyet
        .filter((r) => !r.coVec && !daCo.has(r.id))
        .map((r) => ({ r, d: diemTuKhoa(tuHoi, r) }))
        .filter((x) => x.d >= NGUONG_TU_KHOA)
        .map((x) => ({ ...x, d: x.d * 0.7 + (x.r.loai === 'sua_sai' ? THUONG_SUA_SAI : 0) }))
        .map(rutGon)
      return [...kq, ...bu].sort((a, b) => b.diem - a.diem).slice(0, k)
    } catch (e) {
      console.warn('[Kho chung] Tìm kiếm máy chủ lỗi → dùng bản trên máy:', e.message)
    }
  }

  const ketQua = []
  for (const r of daDuyet) {
    const thuong = r.loai === 'sua_sai' ? THUONG_SUA_SAI : 0
    if (vecHoi && r.vec) {
      const d = cosine(vecHoi, r.vec) + thuong
      if (d >= NGUONG_VECTOR) ketQua.push({ r, d })
    } else {
      // Chưa có vector (đang chờ học), offline, hoặc kho chung không truy cập được → từ khoá
      const d = diemTuKhoa(tuHoi, r)
      if (d >= NGUONG_TU_KHOA) ketQua.push({ r, d: d * 0.7 + thuong })
    }
  }
  return ketQua
    .sort((a, b) => b.d - a.d)
    .slice(0, k)
    .map(rutGon)
}
