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

let _lanCuoi = 0

// Gọi khi máy Admin mở app; trả về số thẻ mới đưa vào hàng chờ
export async function napTheCao({ batBuoc = false } = {}) {
  if (!batBuoc && Date.now() - _lanCuoi < CHU_KY_MS) return 0
  _lanCuoi = Date.now()
  const res = await fetch(`${URL_THE}?t=${Math.floor(Date.now() / 600000)}`)
  if (res.status === 404) return 0 // workflow chưa chạy lần nào
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const { the = [] } = await res.json()
  const daNhan = new Set((await idbGet(STORE_KV, KEY_DA_NHAN).catch(() => null)) || [])
  const moi = the.filter((t) => !daNhan.has(t.id))
  // Cũ nhất trước → thẻ mới nhất nằm đầu danh sách chờ duyệt
  for (const t of moi.reverse()) {
    await themTheCao(t)
    daNhan.add(t.id)
  }
  if (moi.length) await idbPut(STORE_KV, [...daNhan].slice(-2000), KEY_DA_NHAN).catch(() => {})
  return moi.length
}
