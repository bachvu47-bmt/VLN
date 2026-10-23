// ============================================================
//  TRI THỨC CÀO TỪ NHÀ SẢN XUẤT → hàng chờ duyệt (HITL)
//  GitHub Actions cào Sika/Jotun/Maxbond 2 lần/ngày → tri-thuc-moi.json (nhánh tri-thuc).
//  Máy Admin tải về, thẻ CHƯA từng nhận → thêm vào "Duyệt kiến thức" (chờ duyệt).
//  Admin duyệt → Maika học; từ chối → không hiện lại.
// ============================================================
import { idbGet, idbPut, STORE_KV } from '../data/idb'
import { themTheCao } from './vectorStore'

const URL_THE = import.meta.env.VITE_TRI_THUC_URL || 'https://raw.githubusercontent.com/bachvu47-bmt/VLN/tri-thuc/tri-thuc-moi.json'
const KEY_DA_NHAN = 'vln_the_cao_da_nhan' // id thẻ đã đưa vào hàng chờ (kể cả đã duyệt/từ chối)
const CHU_KY_MS = 3 * 3600 * 1000

// Mô tả nguồn PUBLIC Maika cào (khớp scripts/cao-tri-thuc.mjs) — hiển thị ở tab Pending Cards
export const NGUON_CAO = [
  { ten: 'Sika Việt Nam', mien: 'vnm.sika.com', phamVi: 'Sản phẩm xây dựng & bán lẻ, phương pháp thi công, Knowledge Hub (bỏ nhóm công nghiệp)' },
  { ten: 'Jotun Việt Nam', mien: 'jotun.com/vn-vi', phamVi: 'Sơn trang trí nội/ngoại thất — trang chi tiết sản phẩm' },
  { ten: 'Maxbond', mien: 'maxbond.vn', phamVi: 'Trang sản phẩm keo dán, chống thấm Maxbond' },
]
// Tin tức ngành (khớp scripts/cao-tin-tuc.mjs) — thẻ ghi thẳng vào kho chung, trạng thái chờ duyệt
export const NGUON_TIN = [
  { ten: 'Google News (tin tức)', mien: 'news.google.com', phamVi: 'Tìm theo từ khoá: chống thấm, sơn/keo/hoàn thiện, vật liệu mới, Sika, giá VLXD — đọc bài gốc, chỉ tin ≤ 3 ngày' },
  { ten: 'VnExpress · Tuổi Trẻ (tin tức)', mien: 'vnexpress.net · tuoitre.vn', phamVi: 'RSS bất động sản / nhà đất, chỉ giữ tin chạm từ khoá ngành' },
]
export const LICH_CAO = '5:30 và 12:30 mỗi ngày; tin tức 1 lần lúc 5:30 (GitHub Actions)'
export const URL_NGUON_THE = URL_THE

let _lanCuoi = 0
const _trangThai = { lanTai: 0, capNhatNguon: '', tongThe: 0, loi: '' }
export const trangThaiCao = () => ({ ..._trangThai })

// Gọi khi máy Admin mở app; trả về số thẻ mới đưa vào hàng chờ
export async function napTheCao({ batBuoc = false } = {}) {
  if (!batBuoc && Date.now() - _lanCuoi < CHU_KY_MS) return 0
  _lanCuoi = Date.now()
  let res
  try {
    res = await fetch(`${URL_THE}?t=${Math.floor(Date.now() / 600000)}`)
  } catch (e) {
    _trangThai.loi = 'Mất mạng / không tải được nguồn thẻ'
    throw e
  }
  if (res.status === 404) {
    _trangThai.loi = 'Chưa có dữ liệu (workflow cào chưa chạy lần nào)'
    return 0
  }
  if (!res.ok) {
    _trangThai.loi = 'HTTP ' + res.status
    throw new Error('HTTP ' + res.status)
  }
  const { the = [], capNhat = '' } = await res.json()
  Object.assign(_trangThai, { lanTai: Date.now(), capNhatNguon: capNhat, tongThe: the.length, loi: '' })
  const daNhan = new Set((await idbGet(STORE_KV, KEY_DA_NHAN).catch(() => null)) || [])
  const moi = the.filter((t) => !daNhan.has(t.id))
  // Cũ nhất trước → thẻ mới nhất nằm đầu danh sách chờ duyệt
  for (const t of moi.reverse()) {
    // daHoc: thẻ chính hãng đã được nạp thẳng vào kho chung → không cần duyệt lại
    if (!t.daHoc) await themTheCao(t)
    daNhan.add(t.id)
  }
  if (moi.length) await idbPut(STORE_KV, [...daNhan].slice(-2000), KEY_DA_NHAN).catch(() => {})
  return moi.length
}
