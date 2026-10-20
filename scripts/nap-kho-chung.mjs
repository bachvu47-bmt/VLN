// ============================================================
//  NẠP TRI THỨC SẢN PHẨM vatlieunha.vn LÊN KHO CHUNG (Supabase) — cho Maika app + web
//  node scripts/nap-kho-chung.mjs
//  Cần: .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY) + .admin-pin.local
//  Việc làm (giống hệt nút "Đồng bộ website" trên máy Admin, cùng hàm src/services/sanPhamWeb.js):
//   1) lấy toàn bộ sản phẩm WooCommerce Store API → đoạn tri thức 'web'
//   2) ghi đoạn mới/đổi qua RPC admin_ghi (PIN Admin), xoá đoạn của SP đã gỡ khỏi web
//   3) vector hoá đoạn chưa có vector (Gemini embedding 768 chiều) — gặp giới hạn free thì
//      dừng lịch sự, lần chạy sau / máy Admin học nốt (Maika vẫn tìm theo từ khoá khi thiếu vector)
// ============================================================
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { doanTuSanPham, mapSanPham } from '../src/services/sanPhamWeb.js'
import { SO_CHIEU_VECTOR } from '../supabase/functions/_shared/maikaNao.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : ''
const docEnv = (ten) => process.env[ten] || (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()
const URL_KHO = docEnv('VITE_SUPABASE_URL').replace(/\/$/, '')
const KEY = docEnv('VITE_SUPABASE_ANON_KEY')
const GEMINI = docEnv('VITE_GEMINI_API_KEY')
const PIN = process.env.ADMIN_PIN || (existsSync(join(ROOT, '.admin-pin.local')) ? readFileSync(join(ROOT, '.admin-pin.local'), 'utf8').trim() : '')
if (!URL_KHO || !KEY || !PIN) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / PIN Admin — chạy scripts/setup-supabase.mjs trước')

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const hdr = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
async function rest(duongDan, body) {
  const res = await fetch(`${URL_KHO}/rest/v1/${duongDan}`, { method: body ? 'POST' : 'GET', headers: hdr, body: body && JSON.stringify(body) })
  const t = await res.text()
  if (!res.ok) throw new Error(`${duongDan} HTTP ${res.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

// 1) Sản phẩm
const API = 'https://vatlieunha.vn/wp-json/wc/store/v1/products'
const sanPham = []
for (let page = 1; page <= 20; page++) {
  const res = await fetch(`${API}?per_page=100&page=${page}`, { headers: { Accept: 'application/json', 'User-Agent': 'VLN-Maika-Sync/1.0' } })
  if (!res.ok) throw new Error(`WooCommerce HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) break
  sanPham.push(...data.map(mapSanPham))
  if (data.length < 100) break
}
if (!sanPham.length) throw new Error('Không lấy được sản phẩm nào')
const doan = sanPham.flatMap(doanTuSanPham)
console.log(`• ${sanPham.length} sản phẩm → ${doan.length} đoạn tri thức`)

// 2) So với kho chung: ghi đoạn mới/đổi, xoá đoạn thừa
const daCo = new Map()
for (let tu = 0; ; tu += 1000) {
  const rows = await fetch(`${URL_KHO}/rest/v1/tri_thuc?select=id,hash,da_xoa,co_vector&loai=eq.web&order=id&offset=${tu}&limit=1000`, { headers: hdr }).then((r) => r.json())
  rows.forEach((r) => daCo.set(r.id, r))
  if (rows.length < 1000) break
}
const canGhi = doan.filter((d) => daCo.get(d.id)?.hash !== d.hash || daCo.get(d.id)?.da_xoa)
const idMoi = new Set(doan.map((d) => d.id))
const canXoa = [...daCo.values()].filter((r) => !r.da_xoa && !idMoi.has(r.id)).map((r) => r.id)
const bayGio = new Date().toISOString()
for (let i = 0; i < canGhi.length; i += 200) {
  await rest('rpc/admin_ghi', {
    p_pin: PIN,
    p_rows: canGhi.slice(i, i + 200).map((d) => ({
      id: d.id, loai: 'web', trang_thai: 'da_duyet', tieu_de: d.tieuDe, noi_dung: d.noiDung, tags: [], nguon: d.nguon,
      sp_id: d.spId, hash: d.hash, nguoi_tao: 'vatlieunha.vn', tao_luc: bayGio, embedding: null,
    })),
  })
}
for (let i = 0; i < canXoa.length; i += 500) await rest('rpc/admin_xoa', { p_pin: PIN, p_ids: canXoa.slice(i, i + 500) })
console.log(`✓ Ghi ${canGhi.length} đoạn mới/đổi · xoá ${canXoa.length} đoạn của SP đã gỡ`)

// 3) Vector hoá đoạn còn thiếu
if (!GEMINI) {
  console.log('⚠ Thiếu VITE_GEMINI_API_KEY — bỏ qua vector hoá (Maika vẫn tìm theo từ khoá)')
  process.exit(0)
}
const thieu = new Set(canGhi.map((d) => d.id))
daCo.forEach((r, id) => !r.co_vector && !r.da_xoa && idMoi.has(id) && thieu.add(id))
const canHoc = doan.filter((d) => thieu.has(d.id))
console.log(`• Vector hoá ${canHoc.length} đoạn…`)
let xong = 0
let rotMang = 0
for (let i = 0; i < canHoc.length; ) {
  const lo = canHoc.slice(i, i + 50)
  let res
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI },
    body: JSON.stringify({
      requests: lo.map((d) => ({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: `${d.tieuDe}\n${d.noiDung}`.slice(0, 8000) }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: SO_CHIEU_VECTOR,
      })),
    }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (e) {
    // Rớt mạng / DNS chập chờn → chờ rồi thử lại lô này (tối đa 10 lần liên tiếp)
    if (++rotMang > 10) throw e
    console.log(`\n  mạng lỗi (${e.cause?.code || e.message}) → thử lại sau 20s`)
    await ngu(20000)
    continue
  }
  rotMang = 0
  if (res.status === 429) {
    const t = await res.text()
    if (/PerDay|per day|daily/i.test(t)) {
      console.log(`⚠ Hết lượt embedding miễn phí hôm nay sau ${xong} đoạn — chạy lại ngày mai để học nốt`)
      break
    }
    await ngu(30000) // giới hạn theo phút → chờ rồi thử lại lô này
    continue
  }
  if (!res.ok) throw new Error(`Gemini embedding HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const { embeddings = [] } = await res.json()
  const cap = embeddings.map((e, j) => {
    const v = e.values
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return { id: lo[j].id, embedding: v.map((x) => x / n) }
  })
  await rest('rpc/admin_gan_vector', { p_pin: PIN, p_rows: cap })
  xong += cap.length
  i += 50
  console.log(`  đã học ${xong}/${canHoc.length}`)
  await ngu(20000) // gói free giới hạn embedding theo phút → giãn nhịp
}
console.log(`\n✓ Xong: ${xong} đoạn có vector mới`)
