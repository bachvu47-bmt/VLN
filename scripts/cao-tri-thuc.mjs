// ============================================================
//  CÀO TRI THỨC HẰNG NGÀY (Maika 2.0 · Bước 4/5) — chạy trên GitHub Actions
//  Sitemap nhà sản xuất → trang sản phẩm/kỹ thuật MỚI hoặc ĐÃ ĐỔI nội dung
//  → Groq tóm tắt thành "thẻ tri thức" → tri-thuc-moi.json (app Admin nhận vào
//  hàng chờ duyệt HITL; duyệt xong Maika mới học).
//  Lịch sự với nguồn: tự xưng bot, nghỉ 1.2s/trang, tuân robots.txt (không URL có "?"),
//  mỗi lần ≤ GIOI_HAN trang/nguồn → phủ dần cả catalogue trong vài tuần.
//  BÁN GÌ HỌC NẤY: chỉ học trang của sản phẩm đang bán trên vatlieunha.vn; trang hướng dẫn
//  chỉ giữ khi nhắc tới sản phẩm đang bán. Mỗi thẻ theo khung hồ sơ: công dụng · thi công ở đâu
//  · định mức · chống chỉ định · điểm mạnh · giải pháp đi kèm.
//  Dùng: GROQ_API_KEY=… node scripts/cao-tri-thuc.mjs <thư-mục-dữ-liệu>
//  Thử khớp sản phẩm (không gọi Groq): DRY_RUN=1 node scripts/cao-tri-thuc.mjs
// ============================================================
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const THU_MUC = process.argv[2] || 'tri-thuc'
const GROQ_KEY = process.env.GROQ_API_KEY
const GIOI_HAN = Number(process.env.GIOI_HAN_MOI_NGUON || 8)
const GIU_THE = 300 // số thẻ gần nhất giữ trong tri-thuc-moi.json
const UA = 'Mozilla/5.0 (compatible; VLN-Maika-Bot/1.0; +https://vatlieunha.vn)'
const DRY_RUN = !!process.env.DRY_RUN
if (!GROQ_KEY && !DRY_RUN) throw new Error('Thiếu GROQ_API_KEY')

const NGUON = [
  {
    ten: 'Sika Việt Nam',
    sitemaps: [
      'https://vnm.sika.com/vi/products.sitemap.xml',
      'https://vnm.sika.com/vi/phuong-phap-thi-cong-san-pham-sika.sitemap.xml',
      'https://vnm.sika.com/vi/knowledge-hub.sitemap.xml',
    ],
    // Xây dựng + kênh bán lẻ (chống thấm, sửa chữa, hoàn thiện), bỏ nhóm công nghiệp (tàu thuyền, ô tô…)
    loc: /^https:\/\/vnm\.sika\.com\/vi\/(xay-d-ng|kenh-phan-ph-i-banl|phuong-phap-thi-cong-san-pham-sika|knowledge-hub|products)\/.+\.html$/,
    // Trang hướng dẫn/giải pháp (không phải trang 1 sản phẩm) → giữ nếu nhắc SP đang bán
    huongDan: /\/vi\/(phuong-phap-thi-cong-san-pham-sika|knowledge-hub)\//,
  },
  {
    ten: 'Jotun Việt Nam',
    sitemaps: ['https://www.jotun.com/vn-vi/deco-sitemap.xml'],
    // Trang SP nằm dưới .../all-exterior-products/<tên>; chỉ bỏ chính trang danh sách
    loc: /^https:\/\/www\.jotun\.com\/vn-vi\/decorative\/products\/(?!.*all-[a-z-]*products\/?$).+\/.+/,
  },
  {
    ten: 'Maxbond',
    sitemaps: ['https://maxbond.vn/featured_item-sitemap.xml'],
    loc: /^https:\/\/maxbond\.vn\/maxbond-[^/]+\/?$/,
  },
]

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const bam = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16)

// ---- Danh mục ĐANG BÁN (vatlieunha.vn) → khoá so khớp: bỏ dấu, chỉ giữ chữ-số ----
// "Sikaproof® Membrane – Chống thấm" → "sikaproofmembranechongtham"
const khoa = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
const DANG_BAN = []
for (let page = 1; page <= 20; page++) {
  const r = await fetch(`https://vatlieunha.vn/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Không lấy được danh mục đang bán (WooCommerce HTTP ${r.status})`)
  const ds = await r.json()
  if (!Array.isArray(ds) || !ds.length) break
  DANG_BAN.push(...ds.map((p) => khoa(String(p.name || '').replace(/&#\d+;|&[a-z]+;/gi, ' '))).filter(Boolean))
  if (ds.length < 100) break
}
if (!DANG_BAN.length) throw new Error('Danh mục đang bán rỗng — dừng để không học sản phẩm cửa hàng không bán')
const dangBan = (ten) => {
  const k = khoa(ten)
  return k.length >= 4 && DANG_BAN.some((c) => c.includes(k))
}
// Tên SP trong đường dẫn: ".../sikaproof-r-membrane.html" → "sikaproof membrane" (bỏ ®/™)
const tenTuUrl = (url) =>
  decodeURIComponent(url.replace(/\/$/, '').split('/').pop().replace(/\.html$/, ''))
    .split('-')
    .filter((t) => t && !['r', 'tm'].includes(t))
    .join(' ')
console.log(`• Danh mục đang bán: ${DANG_BAN.length} sản phẩm`)

async function lay(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.5' }, signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

async function docSitemap(url) {
  const x = await lay(url)
  const con = [...x.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  if (con.length) return (await Promise.all(con.map(docSitemap))).flat() // sitemap index
  return [...x.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>(?:[\s\S]*?<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ url: m[1].trim(), lastmod: m[2] || '' }))
}

const THUC_THE = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function trichNoiDung(html) {
  const vung = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<body[\s\S]*?<\/body>/i) || [html])[0]
  return vung
    .replace(/<(script|style|noscript|nav|header|footer|form|aside|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|tr|div|section)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (_, t) => THUC_THE[t.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

// ---- Groq tóm tắt (xoay model khi gặp giới hạn 8.000 token/phút) ----
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
const SYS = `Bạn là kỹ sư vật liệu xây dựng của cửa hàng "Vật Liệu Nhà". Đọc nội dung trang web của nhà sản xuất và lập HỒ SƠ SẢN PHẨM dùng để tư vấn bán hàng.
Trả về DUY NHẤT JSON: {"laTriThuc": true|false, "tieuDe": "Tên sản phẩm (đúng tên thương mại)", "tomTat": "1 câu: sản phẩm là gì",
"hoSo": {"congDung": "Sản phẩm để làm gì, giải quyết vấn đề gì", "viTriThiCong": "Thi công ở đâu: hạng mục (sàn mái, WC, tầng hầm, tường ngoài…), loại bề mặt (bê tông, vữa, gạch, kim loại…), trong nhà/ngoài trời", "dinhMuc": "Định mức tiêu thụ, giữ nguyên số + đơn vị + số lớp/độ dày", "chongChiDinh": "Không dùng cho/khi nào: bề mặt, điều kiện (độ ẩm, nhiệt độ, ngâm nước, nước uống, giao thông…), giới hạn của sản phẩm", "diemManh": "Điểm mạnh nổi bật so với cách làm thông thường", "giaiPhapDiKem": "Sản phẩm/hệ đi kèm nhà sản xuất khuyến nghị: lớp lót, lớp phủ, lưới gia cường, băng cản nước, keo xử lý cổ ống, phụ gia…"},
"cacY": ["thông số khác giữ nguyên số liệu: tỷ lệ pha, thời gian khô/chờ giữa lớp, điều kiện thi công, đóng gói, hạn dùng"], "sanPham": ["tên các sản phẩm được nhắc"], "doTinCay": 0-100}
Mục nào trang KHÔNG nói tới → để chuỗi rỗng "", TUYỆT ĐỐI không suy đoán hay bịa số liệu. Trang hướng dẫn/giải pháp (nhiều sản phẩm) → tieuDe là tên giải pháp, hoSo mô tả cả hệ.
laTriThuc=false nếu trang chỉ là danh mục/điều hướng/tin tức sự kiện/tuyển dụng không có thông tin kỹ thuật. Viết tiếng Việt.`

// Đổi khung hồ sơ → tăng số này: trang đã học theo khung cũ được học lại một lần
const KHUNG = 2
const NHAN_HO_SO = [
  ['congDung', 'Công dụng'],
  ['viTriThiCong', 'Thi công ở đâu'],
  ['dinhMuc', 'Định mức'],
  ['chongChiDinh', 'Chống chỉ định'],
  ['diemManh', 'Điểm mạnh'],
  ['giaiPhapDiKem', 'Giải pháp đi kèm'],
]

async function tomTat(text, url) {
  for (let vong = 0; vong < 6; vong++) {
    const model = MODELS[vong % MODELS.length]
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        ...(model.includes('qwen') ? { reasoning_format: 'hidden' } : { reasoning_effort: 'low' }),
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `URL: ${url}\n\nNỘI DUNG TRANG:\n${text.slice(0, 6000)}` },
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

// ---- Trạng thái (URL đã xử lý + hash nội dung) & thẻ đã có ----
mkdirSync(THU_MUC, { recursive: true })
const fTrangThai = join(THU_MUC, 'trang-thai.json')
const fThe = join(THU_MUC, 'tri-thuc-moi.json')
const trangThai = existsSync(fTrangThai) ? JSON.parse(readFileSync(fTrangThai, 'utf8')) : {}
const kho = existsSync(fThe) ? JSON.parse(readFileSync(fThe, 'utf8')) : { the: [] }

let soMoi = 0
for (const ng of NGUON) {
  let urls = []
  try {
    urls = (await Promise.all(ng.sitemaps.map(docSitemap))).flat().filter((x) => ng.loc.test(x.url) && !x.url.includes('?'))
  } catch (e) {
    console.warn(`[${ng.ten}] đọc sitemap lỗi: ${e.message}`)
    continue
  }
  urls = [...new Map(urls.map((x) => [x.url, x])).values()]
  // Bán gì học nấy: trang 1 sản phẩm chỉ giữ khi SP đó đang bán; trang hướng dẫn lọc sau khi đọc
  const tongTrang = urls.length
  urls = urls.map((x) => ({ ...x, huongDan: !!ng.huongDan?.test(x.url) })).filter((x) => x.huongDan || dangBan(tenTuUrl(x.url)))
  // Ưu tiên: trang sản phẩm trước hướng dẫn → chưa từng xử lý → lastmod mới hơn lần xử lý trước
  const canXuLy = urls
    .filter((x) => trangThai[x.url]?.v !== KHUNG || (x.lastmod && Date.parse(x.lastmod) > trangThai[x.url].t))
    .sort((a, b) => a.huongDan - b.huongDan || !!trangThai[a.url] - !!trangThai[b.url] || (b.lastmod || '').localeCompare(a.lastmod || ''))
  const soSP = urls.filter((x) => !x.huongDan).length
  console.log(`[${ng.ten}] ${tongTrang} trang · ${soSP} trang SP đang bán + ${urls.length - soSP} hướng dẫn · ${canXuLy.length} chờ`)
  if (DRY_RUN) {
    urls.filter((x) => !x.huongDan).forEach((x) => console.log(`    ${tenTuUrl(x.url)}`))
    continue
  }

  let lam = 0
  for (const x of canXuLy) {
    if (lam >= GIOI_HAN) break
    lam++
    try {
      const text = trichNoiDung(await lay(x.url))
      const h = bam(text)
      const cu = trangThai[x.url]
      trangThai[x.url] = { h, t: Date.now(), v: KHUNG }
      if ((cu?.h === h && cu?.v === KHUNG) || text.length < 300) continue // nội dung không đổi / trang quá ngắn
      const kq = await tomTat(text, x.url)
      const hoSo = kq.hoSo || {}
      const cacY = [
        ...NHAN_HO_SO.filter(([k]) => String(hoSo[k] || '').trim()).map(([k, nhan]) => `${nhan}: ${String(hoSo[k]).trim()}`),
        ...(kq.cacY || []).map(String),
      ]
      if (!kq.laTriThuc || !cacY.length) {
        console.log(`  · bỏ (không phải tri thức kỹ thuật): ${x.url}`)
        continue
      }
      if (x.huongDan && !(kq.sanPham || []).some((t) => dangBan(String(t)))) {
        console.log(`  · bỏ (hướng dẫn không nhắc SP đang bán): ${x.url}`)
        continue
      }
      kho.the.unshift({
        id: bam(x.url + h),
        nguon: ng.ten,
        url: x.url,
        tieuDe: String(kq.tieuDe || '').slice(0, 120),
        tomTat: String(kq.tomTat || ''),
        cacY: cacY.slice(0, 18),
        sanPham: (kq.sanPham || []).map(String).slice(0, 8),
        doTinCay: Number(kq.doTinCay) || 0,
        capNhat: !!cu, // trang đã có trước đây nhưng nội dung đổi
        luc: new Date().toISOString(),
      })
      soMoi++
      console.log(`  ✓ ${kq.tieuDe}`)
    } catch (e) {
      console.warn(`  ✗ ${x.url}: ${e.message}`)
    }
    await ngu(1200)
  }
}

kho.the = kho.the.slice(0, GIU_THE)
kho.capNhat = new Date().toISOString()
writeFileSync(fThe, JSON.stringify(kho))
writeFileSync(fTrangThai, JSON.stringify(trangThai))
console.log(`Xong: ${soMoi} thẻ tri thức mới · tổng ${kho.the.length} thẻ · ${Object.keys(trangThai).length} trang đã theo dõi`)
