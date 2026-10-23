// ============================================================
//  CÀO TIN TỨC NGÀNH HẰNG NGÀY — chạy trên GitHub Actions, sau cao-tri-thuc.mjs
//  RSS (Google News theo từ khoá + báo có RSS) → lọc từ khoá ngành → đọc bài gốc
//  → bóc tiêu đề / nội dung / ngày đăng → Groq tóm tắt thành "thẻ tin tức" (trích dẫn phải khớp bài)
//  → bảng tri_thuc (Supabase) với trang_thai 'cho_duyet' = Pending Cards của Admin.
//  HITL TUYỆT ĐỐI: tin tức KHÔNG BAO GIỜ nạp thẳng — Maika chỉ đọc 'da_duyet', Admin bấm Duyệt mới học.
//  Siêu dữ liệu thẻ trong tags: 'tin-tuc', 'bao:<tên báo>', 'ngay:YYYY-MM-DD', 'tin-cay:NN' (app: thongTinTin()).
//  Mỗi ngày 1 lần (lần chạy đầu tiên trong ngày giờ VN); BAT_BUOC=1 để chạy lại.
//  Lịch sự với nguồn: tự xưng bot, nghỉ 1.2s/bài, ≤ GIOI_HAN_TIN bài/lần, chỉ tin ≤ TUOI_TOI_DA ngày.
//  Dùng: GROQ_API_KEY=… node scripts/cao-tin-tuc.mjs <thư-mục-dữ-liệu>
//  Thử nguồn + lọc (không gọi Groq, không ghi tệp): DRY_RUN=1 node scripts/cao-tin-tuc.mjs
// ============================================================
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { lay, trichNoiDung, UA } from './nguonNSX.mjs'

const THU_MUC = process.argv[2] || 'tri-thuc'
const GROQ_KEY = process.env.GROQ_API_KEY
const GIOI_HAN = Number(process.env.GIOI_HAN_TIN || 12)
const TUOI_TOI_DA = 3 // ngày — tin cũ hơn bỏ qua
const DRY_RUN = !!process.env.DRY_RUN
const BAT_BUOC = !!process.env.BAT_BUOC
const KHO = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KHO_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
const PIN = process.env.ADMIN_PIN || ''
if (!DRY_RUN && !GROQ_KEY) throw new Error('Thiếu GROQ_API_KEY')
if (!DRY_RUN && !(KHO && KHO_KEY && PIN)) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / ADMIN_PIN')

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const bam = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16)
const ngayVN = (t = Date.now()) => new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10)

// ---- Nguồn tin ----
const gnews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=vi&gl=VN&ceid=VN:vi`
export const NGUON_TIN = [
  { ten: 'Google News · chống thấm', rss: gnews('"chống thấm" OR "thấm dột"'), google: true },
  { ten: 'Google News · sơn, keo, hoàn thiện', rss: gnews('"sơn chống thấm" OR "keo dán gạch" OR "vật liệu hoàn thiện" OR "sơn nhà"'), google: true },
  { ten: 'Google News · vật liệu mới', rss: gnews('"vật liệu xây dựng" (mới OR xanh OR "công nghệ" OR "tiêu chuẩn")'), google: true },
  { ten: 'Google News · Sika', rss: gnews('Sika "xây dựng"'), google: true },
  { ten: 'Google News · giá VLXD', rss: gnews('"giá xi măng" OR "giá thép xây dựng" OR "giá vật liệu xây dựng"'), google: true },
  { ten: 'VnExpress · Bất động sản', rss: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { ten: 'Tuổi Trẻ · Nhà đất', rss: 'https://tuoitre.vn/rss/nha-dat.rss' },
]
// Tiêu đề/mô tả phải chạm ít nhất 1 từ khoá ngành (báo tổng hợp có nhiều tin không liên quan)
const TU_KHOA = /chống thấm|thấm dột|dột|vật liệu xây dựng|vlxd|xi măng|bê tông|vữa|keo dán gạch|gạch ốp|sơn (nước|chống|ngoại|nội|nhà)|sika|jotun|maxbond|thép xây dựng|giá thép|tiêu chuẩn xây dựng|tcvn|vật liệu (mới|xanh|thấm|hoàn thiện)|nứt (tường|sàn|trần)|mái (tôn|nhà)|sàn mái|tầng hầm|xây nhà|sửa nhà/i
// Nhiễu thường gặp: khai thác mỏ/cát đá cho công trình công, thể thao, tử vi, vi phạm giao thông
const LOAI_BO = /khoáng sản|khai thác|mỏ đá|cát sỏi|bãi tập kết|điều phối|con giáp|phong thuỷ|phong thủy|bóng đá|giành chiến thắng|vòng \d|xử phạt|tai nạn|làm theo lời bác/i
// Ưu tiên khi vượt GIOI_HAN: chống thấm / sản phẩm cửa hàng bán trước, rồi kỹ thuật, cuối cùng giá & thị trường
// ("sơn" phải kèm loại sơn — tránh địa danh Lạng Sơn, Sơn La…)
const UU_TIEN = [/chống thấm|thấm dột|dột|sika|jotun|maxbond|keo dán|sơn (nước|chống|phủ|lót|nhà|epoxy|ngoại|nội)/i, /bê tông|vữa|vật liệu (mới|xanh|hoàn thiện)|tiêu chuẩn|tcvn|nứt|mái|tầng hầm/i]
const diemUuTien = (x) => {
  const s = `${x.tieuDe} ${x.moTa}`
  const i = UU_TIEN.findIndex((re) => re.test(s))
  return i < 0 ? UU_TIEN.length : i
}

// ---- Đọc RSS (đủ cho RSS 2.0 của các nguồn trên, không cần thư viện) ----
const boCDATA = (s = '') => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim()
const giaiThucThe = (s = '') =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
const the = (xml, ten) => boCDATA(xml.match(new RegExp(`<${ten}[^>]*>([\\s\\S]*?)</${ten}>`))?.[1] || '')
const chu = (html) => giaiThucThe(giaiThucThe(html)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function docRSS(ng) {
  const xml = await lay(ng.rss)
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([it]) => {
    let tieuDe = chu(the(it, 'title'))
    const bao = chu(the(it, 'source')) || ng.ten
    // Google News gắn " - Tên báo" cuối tiêu đề
    if (ng.google && bao && tieuDe.endsWith(' - ' + bao)) tieuDe = tieuDe.slice(0, -(bao.length + 3))
    return {
      tieuDe,
      link: chu(the(it, 'link')),
      guid: chu(the(it, 'guid')),
      moTa: chu(the(it, 'description')),
      ngayDang: Date.parse(the(it, 'pubDate')) || 0,
      bao,
      google: !!ng.google,
    }
  })
}

// Link Google News (news.google.com/rss/articles/…) → URL bài gốc, qua batchexecute như trình duyệt.
// Endpoint không chính thức: lỗi thì trả '' và bài bị bỏ qua (không đoán).
async function urlGoc(link) {
  try {
    const id = new URL(link).pathname.split('/').pop()
    const h = await (await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(20000) })).text()
    const sg = h.match(/data-n-a-sg="([^"]+)"/)?.[1]
    const ts = h.match(/data-n-a-ts="([^"]+)"/)?.[1]
    if (!sg || !ts) return ''
    const req = [[['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg])]]]
    const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
      body: 'f.req=' + encodeURIComponent(JSON.stringify(req)),
      signal: AbortSignal.timeout(20000),
    })
    const u = JSON.parse(JSON.parse((await r.text()).split('\n\n')[1])[0][2])[1]
    return /^https?:\/\//.test(u) ? u : ''
  } catch {
    return ''
  }
}

// Ngày đăng trong trang bài (chuẩn hơn pubDate của bộ gom tin)
function ngayTrongTrang(html) {
  const m =
    html.match(/<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|datePublished|pubdate|publishdate)["'][^>]+content=["']([^"']+)/i) ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)
  return (m && Date.parse(m[1])) || 0
}

// ---- Groq tóm tắt (xoay model khi gặp giới hạn token/phút) ----
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
const SYS = `Bạn là kỹ sư vật liệu xây dựng của cửa hàng "Vật Liệu Nhà" (chống thấm, sơn, keo, vật liệu hoàn thiện). Đọc một BÀI BÁO và lập THẺ TIN TỨC để nhân viên/Maika dùng khi tư vấn khách.
Trả về DUY NHẤT JSON: {"laTinNganh": true|false, "tieuDe": "tiêu đề ngắn gọn, đúng nội dung bài", "tomTat": "1-2 câu: chuyện gì, ở đâu, khi nào",
"cacY": ["ý chính hữu ích khi tư vấn: xu hướng/giải pháp kỹ thuật, tiêu chuẩn/quy định mới, biến động giá & nguồn cung, sự cố thấm-nứt và bài học, sản phẩm/công nghệ mới — giữ NGUYÊN số liệu, đơn vị, mốc thời gian như trong bài"],
"trichDan": ["2-3 câu chép NGUYÊN VĂN từ bài, làm căn cứ cho các ý trên"], "sanPham": ["tên sản phẩm/thương hiệu được nhắc"], "doTinCay": 0-100}
laTinNganh=false nếu bài không liên quan vật liệu xây dựng/chống thấm/sơn/hoàn thiện nhà, hoặc chỉ là bài PR quảng cáo một thương hiệu mà không có thông tin kỹ thuật/thị trường, hoặc tin đất đai/giá nhà thuần tuý.
cacY CHỈ ghi điều bài viết nói ra — KHÔNG thêm lời khuyên, giải pháp, quy chuẩn hay sản phẩm của riêng bạn. Không suy đoán, không bịa số. doTinCay thấp nếu bài mơ hồ, thiếu nguồn hoặc là ý kiến cá nhân. Viết tiếng Việt.`

// Chốt kiểm chứng (giống maika-tu-hoc): trích dẫn phải có nguyên văn trong bài
const chuan = (s = '') => s.normalize('NFC').toLowerCase().replace(/[“”"'‘’«»]/g, '').replace(/\s+/g, ' ').trim()
const soTrichKhop = (trichDan, text) => {
  const goc = chuan(text)
  return (trichDan || []).map(String).filter((c) => chuan(c).length >= 25 && goc.includes(chuan(c))).length
}

async function tomTat(text, url, ngay) {
  for (let vong = 0; vong < 6; vong++) {
    const model = MODELS[vong % MODELS.length]
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        ...(model.includes('qwen') ? { reasoning_format: 'hidden' } : { reasoning_effort: 'low' }),
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `URL: ${url}\nNGÀY ĐĂNG: ${ngay}\n\nNỘI DUNG BÀI:\n${text.slice(0, 9000)}` },
        ],
      }),
    })
    if (r.status === 429) {
      await ngu(Math.max(Number(r.headers.get('retry-after')) || 0, 5) * 1000)
      continue
    }
    if (!r.ok) throw new Error(`Groq ${model} HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`)
    const raw = (await r.json()).choices?.[0]?.message?.content || ''
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  }
  throw new Error('Groq bận quá lâu')
}

// ---- Kho chung: đọc bằng key public, ghi qua admin_ghi (PIN kiểm tra trên máy chủ) ----
const hdr = { apikey: KHO_KEY, Authorization: `Bearer ${KHO_KEY}`, 'Content-Type': 'application/json' }
// Có rồi (kể cả đã duyệt / đã từ chối = da_xoa) → không ghi lại: admin_ghi sẽ "hồi sinh" thẻ đã từ chối
async function daCoTrongKho(id) {
  const r = await fetch(`${KHO}/rest/v1/tri_thuc?select=id&id=eq.${encodeURIComponent(id)}`, { headers: hdr })
  if (!r.ok) throw new Error(`đọc kho HTTP ${r.status}`)
  return (await r.json()).length > 0
}
async function ghiChoDuyet(row) {
  const r = await fetch(`${KHO}/rest/v1/rpc/admin_ghi`, { method: 'POST', headers: hdr, body: JSON.stringify({ p_pin: PIN, p_rows: [row] }) })
  if (!r.ok) throw new Error(`admin_ghi HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`)
}

// ---- Trạng thái chung với cao-tri-thuc.mjs (trang-thai.json): khoá "tin:<url gốc>" / "gn:<guid>" ----
mkdirSync(THU_MUC, { recursive: true })
const fTrangThai = join(THU_MUC, 'trang-thai.json')
const trangThai = existsSync(fTrangThai) ? JSON.parse(readFileSync(fTrangThai, 'utf8')) : {}

const homNay = ngayVN()
if (!DRY_RUN && !BAT_BUOC && trangThai._tinTucNgay === homNay) {
  console.log(`Tin tức hôm nay (${homNay}) đã cào — bỏ qua. BAT_BUOC=1 để cào lại.`)
  process.exit(0)
}

// Dọn khoá tin cũ (> 30 ngày) để trang-thai.json không phình mãi
const HAN_DON = Date.now() - 30 * 86400000
for (const [k, v] of Object.entries(trangThai)) if (/^(tin|gn):/.test(k) && v.t < HAN_DON) delete trangThai[k]

// 1) Gom tin từ mọi nguồn → lọc tuổi + từ khoá + đã xử lý → bỏ trùng tiêu đề
const moiNhat = Date.now() - TUOI_TOI_DA * 86400000
let ds = []
for (const ng of NGUON_TIN) {
  try {
    const tin = await docRSS(ng)
    const hop = tin.filter((x) => x.link && x.ngayDang >= moiNhat && TU_KHOA.test(`${x.tieuDe} ${x.moTa}`) && !LOAI_BO.test(x.tieuDe))
    console.log(`[${ng.ten}] ${tin.length} tin · ${hop.length} hợp lệ`)
    ds.push(...hop)
  } catch (e) {
    console.warn(`[${ng.ten}] đọc RSS lỗi: ${e.message}`)
  }
  await ngu(800)
}
const tieuDeDaCo = new Set()
ds = ds
  .filter((x) => !trangThai[x.google ? 'gn:' + (x.guid || x.link) : 'tin:' + x.link])
  .sort((a, b) => diemUuTien(a) - diemUuTien(b) || b.ngayDang - a.ngayDang)
  .filter((x) => {
    const k = x.tieuDe.toLowerCase().replace(/\W+/g, '')
    if (tieuDeDaCo.has(k)) return false
    tieuDeDaCo.add(k)
    return true
  })
console.log(`• ${ds.length} tin mới chưa xử lý · xử lý tối đa ${GIOI_HAN}`)
if (DRY_RUN) {
  ds.forEach((x) => console.log(`    ${new Date(x.ngayDang).toLocaleString('vi-VN')} · ${x.bao} · ${x.tieuDe}`))
  process.exit(0)
}

// 2) Đọc bài gốc → Groq → thẻ chờ duyệt
let soMoi = 0
let lam = 0
for (const x of ds) {
  if (lam >= GIOI_HAN) break
  lam++
  const khoaNguon = x.google ? 'gn:' + (x.guid || x.link) : 'tin:' + x.link
  trangThai[khoaNguon] = { t: Date.now() }
  try {
    const url = x.google ? await urlGoc(x.link) : x.link
    if (!url) {
      console.log(`  · bỏ (không giải được link Google News): ${x.tieuDe}`)
      continue
    }
    if (trangThai['tin:' + url]) continue // cùng bài đã đến từ nguồn khác
    trangThai['tin:' + url] = { t: Date.now() }
    const id = 'tin:' + bam(url)
    if (await daCoTrongKho(id)) continue
    const html = await lay(url)
    const text = trichNoiDung(html)
    if (text.length < 500) {
      console.log(`  · bỏ (bài quá ngắn / không đọc được): ${url}`)
      continue
    }
    const ngayDang = ngayTrongTrang(html) || x.ngayDang
    const kq = await tomTat(`${x.tieuDe}\n\n${text}`, url, new Date(ngayDang).toLocaleDateString('vi-VN'))
    const cacY = (kq.cacY || []).map(String).filter((y) => y.trim())
    if (!kq.laTinNganh || !cacY.length) {
      console.log(`  · bỏ (không phải tin ngành): ${x.tieuDe}`)
      continue
    }
    const khop = soTrichKhop(kq.trichDan, text)
    if (!khop) {
      console.log(`  · bỏ (trích dẫn không khớp nguyên văn bài — nghi bịa): ${x.tieuDe}`)
      continue
    }
    const tieuDe = String(kq.tieuDe || x.tieuDe).slice(0, 120)
    const tomTatTin = String(kq.tomTat || '').trim()
    const sanPham = (kq.sanPham || []).map(String).slice(0, 8)
    const trich = (kq.trichDan || []).map(String).slice(0, 3)
    const ngay = ngayVN(ngayDang)
    // Chỉ 1 trích dẫn khớp → hạ độ tin cậy để Admin đọc kỹ hơn
    const doTinCay = Math.min(Number(kq.doTinCay) || 0, khop >= 2 ? 100 : 60)
    const banNhap = [tomTatTin, ...cacY.slice(0, 10).map((y) => '• ' + y)].filter(Boolean).join('\n')
    await ghiChoDuyet({
      id,
      loai: 'tai_lieu',
      trang_thai: 'cho_duyet', // không bao giờ 'da_duyet' — chỉ Admin duyệt
      tieu_de: tieuDe,
      // Bản nháp; khi Admin duyệt, app ghi lại noi_dung = tiêu đề (theo báo, tin ngày …) + nội dung đã chỉnh
      noi_dung: `${tieuDe} (theo ${x.bao}, tin ngày ${ngay.split('-').reverse().join('/')})\n${banNhap}`,
      cau_hoi: tieuDe,
      tra_loi_sai: [tomTatTin, sanPham.length ? `Sản phẩm/thương hiệu: ${sanPham.join(', ')}` : '', trich.length ? `\nTrích nguyên văn bài:\n${trich.map((c) => `“${c}”`).join('\n')}` : '']
        .filter(Boolean).join('\n'),
      tra_loi_dung: banNhap,
      tags: ['tin-tuc', 'bao:' + x.bao, 'ngay:' + ngay, 'tin-cay:' + doTinCay],
      nguon: url,
      nguoi_tao: `Maika cào tin · ${x.bao}`.slice(0, 100),
      embedding: null,
    })
    soMoi++
    console.log(`  ✓ ${kq.tieuDe} (${x.bao}) → chờ duyệt`)
  } catch (e) {
    console.warn(`  ✗ ${x.tieuDe}: ${e.message}`)
  }
  await ngu(1200)
}

trangThai._tinTucNgay = homNay
writeFileSync(fTrangThai, JSON.stringify(trangThai))
console.log(`Xong tin tức: ${soMoi} thẻ mới vào Pending Cards (kho chung, chờ Admin duyệt)`)
