// ============================================================
//  NẠP TRI THỨC SẢN PHẨM vatlieunha.vn LÊN KHO CHUNG (Supabase) — cho Maika app + web
//  node scripts/nap-kho-chung.mjs
//  Cần: .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY) + .admin-pin.local
//  Việc làm (giống hệt nút "Đồng bộ website" trên máy Admin, cùng hàm src/services/sanPhamWeb.js):
//   1) lấy toàn bộ sản phẩm WooCommerce Store API → đoạn tri thức 'web'
//   2) ghi đoạn mới/đổi qua RPC admin_ghi (PIN Admin), xoá đoạn của SP đã gỡ khỏi web
//   3) HỒ SƠ SẢN PHẨM (bán gì học nấy): Groq đọc mô tả từng SP → 1 thẻ 'hs:<spId>' theo khung
//      công dụng · thi công ở đâu · định mức · chống chỉ định · điểm mạnh · giải pháp đi kèm.
//      loai 'tai_lieu' để nút "Đồng bộ website" (chỉ xoá loai 'web') không xoá mất. Mỗi lần
//      ≤ HO_SO_MOI_LAN SP (giới hạn token/phút gói free) → phủ dần; mô tả không đổi thì không viết lại.
//   4) vector hoá đoạn chưa có vector (Gemini embedding 768 chiều) — gặp giới hạn free thì
//      dừng lịch sự, lần chạy sau / máy Admin học nốt (Maika vẫn tìm theo từ khoá khi thiếu vector)
// ============================================================
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bam, doanTuSanPham, mapSanPham } from '../src/services/sanPhamWeb.js'
import { diemBanChay } from './banChay.mjs'
import { trichNoiDung } from './nguonNSX.mjs'
import { SO_CHIEU_VECTOR } from '../supabase/functions/_shared/maikaNao.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : ''
const docEnv = (ten) => process.env[ten] || (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()
const URL_KHO = docEnv('VITE_SUPABASE_URL').replace(/\/$/, '')
const KEY = docEnv('VITE_SUPABASE_ANON_KEY')
const GEMINI = docEnv('VITE_GEMINI_API_KEY')
const GROQ = docEnv('VITE_GROQ_API_KEY')
const HO_SO_MOI_LAN = Number(process.env.HO_SO_MOI_LAN || 300)
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

// 3) Hồ sơ sản phẩm theo khung
const KHUNG_HO_SO = 2 // đổi khung/lời dặn → tăng số này để viết lại toàn bộ hồ sơ
const NHAN_HO_SO = [
  ['congDung', 'Công dụng'],
  ['viTriThiCong', 'Thi công ở đâu'],
  ['dinhMuc', 'Định mức'],
  ['chongChiDinh', 'Chống chỉ định'],
  ['diemManh', 'Điểm mạnh'],
  ['giaiPhapDiKem', 'Giải pháp đi kèm'],
]
const SYS_HO_SO = `Bạn là kỹ sư vật liệu xây dựng của cửa hàng "Vật Liệu Nhà". Đọc thông tin MỘT sản phẩm cửa hàng đang bán và lập HỒ SƠ SẢN PHẨM để tư vấn bán hàng.
Trả về DUY NHẤT JSON: {"congDung": "Để làm gì, giải quyết vấn đề gì", "viTriThiCong": "Thi công ở đâu: hạng mục (sàn mái, WC, tầng hầm, tường ngoài…), loại bề mặt, trong nhà/ngoài trời", "dinhMuc": "Định mức tiêu thụ, giữ nguyên số + đơn vị + số lớp/độ dày", "chongChiDinh": "Không dùng cho/khi nào: bề mặt, điều kiện (độ ẩm, nhiệt độ, ngâm nước, nước uống…), giới hạn của sản phẩm", "diemManh": "Điểm mạnh nổi bật", "giaiPhapDiKem": "Sản phẩm/vật tư đi kèm mà bài NÊU RÕ (tên sản phẩm hoặc loại vật tư cụ thể): lớp lót, lớp phủ, lưới gia cường, băng cản nước, phụ gia…"}
CHỈ dùng thông tin có trong bài. Không viết câu chung chung kiểu "có thể dùng… nếu cần", "thường đi kèm…" — bài không nêu thì để "". Mục nào bài KHÔNG nói tới → chuỗi rỗng "". TUYỆT ĐỐI không suy đoán, không bịa số liệu, không lấy thông tin của sản phẩm khác. Mỗi mục 1-3 câu ngắn, tiếng Việt.`
const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
let vongModel = 0
async function vietHoSo(baiSP) {
  for (let lan = 0; lan < 9; lan++) {
    const model = GROQ_MODELS[vongModel % GROQ_MODELS.length]
    let r
    try {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          ...(model.includes('qwen') ? { reasoning_format: 'hidden' } : { reasoning_effort: 'low' }),
          messages: [{ role: 'system', content: SYS_HO_SO }, { role: 'user', content: baiSP }],
        }),
        signal: AbortSignal.timeout(60000),
      })
    } catch {
      await ngu(10000)
      continue
    }
    if (r.status === 429) {
      // giới hạn token/phút theo từng model → đổi model, cả vòng đều nghẽn thì chờ
      vongModel++
      if (lan % GROQ_MODELS.length === GROQ_MODELS.length - 1) await ngu(Math.max(Number(r.headers.get('retry-after')) || 0, 20) * 1000)
      continue
    }
    if (!r.ok) throw new Error(`Groq ${model} HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`)
    const raw = (await r.json()).choices?.[0]?.message?.content || ''
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  }
  throw new Error('Groq bận quá lâu')
}

const hoSoCu = new Map()
for (let tu = 0; ; tu += 1000) {
  const rows = await fetch(`${URL_KHO}/rest/v1/tri_thuc?select=id,hash,da_xoa,co_vector,sp_id,tieu_de,noi_dung&id=like.hs:*&order=id&offset=${tu}&limit=1000`, { headers: hdr }).then((r) => r.json())
  rows.forEach((r) => hoSoCu.set(r.id, r))
  if (rows.length < 1000) break
}
const spCon = new Set(sanPham.map((sp) => sp.id))
const hoSoXoa = [...hoSoCu.values()].filter((r) => !r.da_xoa && !spCon.has(r.sp_id)).map((r) => r.id)
if (hoSoXoa.length) await rest('rpc/admin_xoa', { p_pin: PIN, p_ids: hoSoXoa })
const baiCua = (sp) =>
  [`Tên: ${sp.ten}`, `Thương hiệu: ${sp.hang}`, `Danh mục: ${sp.nhom}`, sp.quyCach.length && `Quy cách: ${sp.quyCach.join(', ')}`, `Mô tả: ${sp.moTa}`]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
// Bán chạy trước: doanh số KiotViet 180 ngày (sản phẩm chưa bán xếp sau, giữ thứ tự website)
const banChay = await diemBanChay(sanPham)
const choViet = sanPham
  .filter((sp) => {
    if ((sp.moTa || '').length < 120) return false // mô tả quá ngắn → không có gì để lập hồ sơ
    const cu = hoSoCu.get('hs:' + sp.id)
    return !cu || cu.da_xoa || cu.hash !== bam(KHUNG_HO_SO + baiCua(sp))
  })
  .sort((a, b) => (banChay.get(b.id) || 0) - (banChay.get(a.id) || 0))
const hoSoMoi = []
if (!GROQ) {
  console.log('⚠ Thiếu VITE_GROQ_API_KEY — bỏ qua hồ sơ sản phẩm')
} else {
  console.log(`• Hồ sơ sản phẩm: ${choViet.length} SP cần viết (lần này ≤ ${HO_SO_MOI_LAN})`)
  for (const sp of choViet.slice(0, HO_SO_MOI_LAN)) {
    const bai = baiCua(sp)
    let hs
    try {
      hs = await vietHoSo(bai)
    } catch (e) {
      console.log(`  ✗ ${sp.ten}: ${e.message}`)
      if (/bận quá lâu/.test(e.message)) break
      continue
    }
    const dong = NHAN_HO_SO.filter(([k]) => String(hs[k] || '').trim()).map(([k, nhan]) => `${nhan}: ${String(hs[k]).trim()}`)
    if (!dong.length) continue
    const rec = {
      id: 'hs:' + sp.id,
      loai: 'tai_lieu',
      trang_thai: 'da_duyet',
      tieu_de: `Hồ sơ sản phẩm: ${sp.ten}`,
      noi_dung: `Hồ sơ sản phẩm: ${sp.ten} (${sp.nhom}).\n${dong.join('\n')}${sp.video ? `\nVideo hướng dẫn: ${sp.video}` : ''}`,
      tags: ['ho-so-san-pham'],
      nguon: sp.url,
      sp_id: sp.id,
      hash: bam(KHUNG_HO_SO + bai),
      nguoi_tao: 'Maika · hồ sơ SP',
      tao_luc: new Date().toISOString(),
      embedding: null,
    }
    await rest('rpc/admin_ghi', { p_pin: PIN, p_rows: [rec] })
    hoSoMoi.push(rec)
    console.log(`  ✓ ${sp.ten} (${dong.length}/6 mục)`)
  }
  console.log(`✓ Hồ sơ: viết ${hoSoMoi.length} · xoá ${hoSoXoa.length} của SP đã gỡ · còn ${Math.max(choViet.length - hoSoMoi.length, 0)} chờ lần sau`)
}

// 3b) BÀI VIẾT vatlieunha.vn (hướng dẫn, tư vấn, giải pháp) → đoạn tri thức 'blog:<id>:<i>' kèm link bài
//     loai 'tai_lieu' để nút "Đồng bộ website" (chỉ xoá loai 'web') không đụng tới
const baiViet = []
for (let page = 1; page <= 20; page++) {
  const r = await fetch(`https://vatlieunha.vn/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,link,title,content`, { headers: { 'User-Agent': 'VLN-Maika-Sync/1.0' } })
  if (!r.ok) break // hết trang → WordPress trả 400
  const ds = await r.json()
  if (!Array.isArray(ds) || !ds.length) break
  baiViet.push(...ds)
  if (ds.length < 100) break
}
const doanBlog = baiViet.flatMap((p) => {
  const tieuDe = trichNoiDung(p.title?.rendered || '')
  const than = trichNoiDung(p.content?.rendered || '').replace(/\n+/g, ' ')
  if (than.length < 200) return []
  const phan = []
  for (let i = 0; i < than.length && phan.length < 4; i += 1200) phan.push(than.slice(i, i + 1200))
  return phan.map((noiDung, i) => ({
    id: `blog:${p.id}:${i}`,
    tieuDe: i === 0 ? tieuDe : `${tieuDe} (phần ${i + 1})`,
    noiDung: `${tieuDe}. ${noiDung}`,
    nguon: p.link,
  }))
})
const blogCu = new Map()
for (let tu = 0; ; tu += 1000) {
  const rows = await fetch(`${URL_KHO}/rest/v1/tri_thuc?select=id,hash,da_xoa,co_vector&id=like.blog:*&order=id&offset=${tu}&limit=1000`, { headers: hdr }).then((r) => r.json())
  rows.forEach((r) => blogCu.set(r.id, r))
  if (rows.length < 1000) break
}
const blogGhi = doanBlog.filter((d) => blogCu.get(d.id)?.hash !== bam(d.noiDung) || blogCu.get(d.id)?.da_xoa)
for (let i = 0; i < blogGhi.length; i += 200) {
  await rest('rpc/admin_ghi', {
    p_pin: PIN,
    p_rows: blogGhi.slice(i, i + 200).map((d) => ({
      id: d.id, loai: 'tai_lieu', trang_thai: 'da_duyet', tieu_de: d.tieuDe, noi_dung: d.noiDung, tags: ['bai-viet'], nguon: d.nguon,
      hash: bam(d.noiDung), nguoi_tao: 'vatlieunha.vn · bài viết', tao_luc: new Date().toISOString(), embedding: null,
    })),
  })
}
const idBlog = new Set(doanBlog.map((d) => d.id))
const blogXoa = baiViet.length ? [...blogCu.values()].filter((r) => !r.da_xoa && !idBlog.has(r.id)).map((r) => r.id) : []
for (let i = 0; i < blogXoa.length; i += 500) await rest('rpc/admin_xoa', { p_pin: PIN, p_ids: blogXoa.slice(i, i + 500) })
console.log(`✓ Bài viết: ${baiViet.length} bài → ${doanBlog.length} đoạn · ghi ${blogGhi.length} mới/đổi · xoá ${blogXoa.length}`)

// 4) Vector hoá đoạn còn thiếu
if (!GEMINI) {
  console.log('⚠ Thiếu VITE_GEMINI_API_KEY — bỏ qua vector hoá (Maika vẫn tìm theo từ khoá)')
  process.exit(0)
}
const thieu = new Set(canGhi.map((d) => d.id))
daCo.forEach((r, id) => !r.co_vector && !r.da_xoa && idMoi.has(id) && thieu.add(id))
// Hồ sơ (gọn, đúng khung) học trước đoạn mô tả thô
const hoSoCanHoc = [
  ...hoSoMoi,
  ...[...hoSoCu.values()].filter((r) => !r.co_vector && !r.da_xoa && spCon.has(r.sp_id) && !hoSoMoi.some((m) => m.id === r.id)),
].map((r) => ({ id: r.id, tieuDe: r.tieu_de, noiDung: r.noi_dung }))
// Tri thức khác chưa có vector (thẻ chính hãng nsx:, Maika tự học tu-hoc:, đính chính…) → học trước nhất
const khacThieu = await fetch(
  `${URL_KHO}/rest/v1/tri_thuc?select=id,tieu_de,noi_dung&trang_thai=eq.da_duyet&da_xoa=eq.false&co_vector=eq.false&id=not.like.web:*&id=not.like.hs:*&id=not.like.blog:*&limit=500`,
  { headers: hdr },
).then((r) => r.json())
// Hồ sơ theo thứ tự bán chạy
const hangHoSo = (id) => -(banChay.get(String(id).replace(/^hs:/, '')) || 0)
hoSoCanHoc.sort((a, b) => hangHoSo(a.id) - hangHoSo(b.id))
const blogCanHoc = doanBlog.filter((d) => blogGhi.includes(d) || !blogCu.get(d.id)?.co_vector)
// Thứ tự học vector: đính chính/tự học → hồ sơ SP bán chạy → bài viết → đoạn mô tả thô
const canHoc = [
  ...khacThieu.map((r) => ({ id: r.id, tieuDe: r.tieu_de, noiDung: r.noi_dung })),
  ...hoSoCanHoc,
  ...blogCanHoc,
  ...doan.filter((d) => thieu.has(d.id)),
]
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
