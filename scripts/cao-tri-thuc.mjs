// ============================================================
//  CÀO TRI THỨC HẰNG NGÀY (Maika 2.0 · Bước 4/5) — chạy trên GitHub Actions
//  Sitemap nhà sản xuất → trang sản phẩm/kỹ thuật MỚI hoặc ĐÃ ĐỔI nội dung
//  (+ đọc sâu TDS / hướng dẫn thi công PDF gắn trên trang) → Groq tóm tắt thành "thẻ tri thức"
//  → thẻ trang sản phẩm chính hãng có TDS / tin cậy cao: nạp thẳng kho chung, Maika học ngay;
//  thẻ còn lại → tri-thuc-moi.json → hàng chờ duyệt của Admin.
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
import { docPdf, linkPdf } from './docPdf.mjs'
import { docSitemap, khoa, lay, NGUON, trichNoiDung, UA } from './nguonNSX.mjs'

const THU_MUC = process.argv[2] || 'tri-thuc'
const GROQ_KEY = process.env.GROQ_API_KEY
const GIOI_HAN = Number(process.env.GIOI_HAN_MOI_NGUON || 8)
const GIU_THE = 300 // số thẻ gần nhất giữ trong tri-thuc-moi.json
const DRY_RUN = !!process.env.DRY_RUN
if (!GROQ_KEY && !DRY_RUN) throw new Error('Thiếu GROQ_API_KEY')
// Kho chung (tuỳ chọn): thẻ chính hãng đủ tin cậy → nạp thẳng cho Maika, không chờ duyệt
const KHO = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KHO_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
const PIN = process.env.ADMIN_PIN || ''
const TIN_CAY_TU_HOC = 80

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const bam = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16)

// ---- Danh mục ĐANG BÁN (vatlieunha.vn) → khoá so khớp (khoa: bỏ dấu, chỉ giữ chữ-số) ----
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


// ---- Groq tóm tắt (xoay model khi gặp giới hạn 8.000 token/phút) ----
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
const SYS = `Bạn là kỹ sư vật liệu xây dựng của cửa hàng "Vật Liệu Nhà". Đọc nội dung trang web của nhà sản xuất và lập HỒ SƠ SẢN PHẨM dùng để tư vấn bán hàng.
Trả về DUY NHẤT JSON: {"laTriThuc": true|false, "tieuDe": "Tên sản phẩm (đúng tên thương mại)", "tomTat": "1 câu: sản phẩm là gì",
"hoSo": {"congDung": "Sản phẩm để làm gì, giải quyết vấn đề gì", "viTriThiCong": "Thi công ở đâu: hạng mục (sàn mái, WC, tầng hầm, tường ngoài…), loại bề mặt (bê tông, vữa, gạch, kim loại…), trong nhà/ngoài trời", "dinhMuc": "Định mức tiêu thụ, giữ nguyên số + đơn vị + số lớp/độ dày", "chongChiDinh": "Không dùng cho/khi nào: bề mặt, điều kiện (độ ẩm, nhiệt độ, ngâm nước, nước uống, giao thông…), giới hạn của sản phẩm", "diemManh": "Điểm mạnh nổi bật so với cách làm thông thường", "giaiPhapDiKem": "Sản phẩm/hệ đi kèm nhà sản xuất khuyến nghị: lớp lót, lớp phủ, lưới gia cường, băng cản nước, keo xử lý cổ ống, phụ gia…"},
"cacY": ["thông số khác giữ nguyên số liệu: tỷ lệ pha, thời gian khô/chờ giữa lớp, điều kiện thi công, đóng gói, hạn dùng"], "sanPham": ["tên các sản phẩm được nhắc"], "doTinCay": 0-100}
Mục nào trang KHÔNG nói tới → để chuỗi rỗng "", TUYỆT ĐỐI không suy đoán hay bịa số liệu. Trang hướng dẫn/giải pháp (nhiều sản phẩm) → tieuDe là tên giải pháp, hoSo mô tả cả hệ.
laTriThuc=false nếu trang chỉ là danh mục/điều hướng/tin tức sự kiện/tuyển dụng không có thông tin kỹ thuật. Viết tiếng Việt.`

// Đổi khung hồ sơ → tăng số này: trang đã học theo khung cũ được học lại một lần
const KHUNG = 3
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
          { role: 'user', content: `URL: ${url}\n\nNỘI DUNG TRANG:\n${text.slice(0, 11000)}` },
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

// Ghi thẻ vào kho chung — id theo URL nên trang đổi nội dung thì thay bản cũ; vector do nap-kho-chung học sau
async function napKho(t) {
  const res = await fetch(`${KHO}/rest/v1/rpc/admin_ghi`, {
    method: 'POST',
    headers: { apikey: KHO_KEY, Authorization: `Bearer ${KHO_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_pin: PIN,
      p_rows: [{
        id: 'nsx:' + bam(t.url),
        loai: 'tai_lieu',
        trang_thai: 'da_duyet',
        tieu_de: t.tieuDe,
        noi_dung: [`${t.tieuDe} (theo ${t.nguon})`, t.tomTat, ...t.cacY.map((y) => '• ' + y)].join('\n'),
        tags: ['nha-san-xuat'],
        nguon: t.url,
        nguoi_tao: `Maika tự học · ${t.nguon}`,
        duyet_boi: 'Maika (nguồn chính hãng)',
        duyet_luc: new Date().toISOString(),
        embedding: null,
      }],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`)
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
      const html = await lay(x.url)
      const text = trichNoiDung(html)
      const pdfs = linkPdf(html, x.url)
      const h = bam(text + pdfs.join('|'))
      const cu = trangThai[x.url]
      trangThai[x.url] = { h, t: Date.now(), v: KHUNG }
      if ((cu?.h === h && cu?.v === KHUNG) || text.length < 300) continue // nội dung không đổi / trang quá ngắn
      // Đọc sâu: TDS / hướng dẫn thi công PDF gắn trên trang (định mức, tỷ lệ pha, thời gian khô…)
      let tds = ''
      for (const u of pdfs) tds += (await docPdf(u, { toiDa: 5000 - tds.length, ua: UA })) + '\n'
      tds = tds.trim()
      const kq = await tomTat(text.slice(0, 6000) + (tds ? `\n\nTÀI LIỆU KỸ THUẬT (TDS) CỦA NHÀ SẢN XUẤT — ưu tiên số liệu ở đây:\n${tds}` : ''), x.url)
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
      const the = {
        id: bam(x.url + h),
        nguon: ng.ten,
        url: x.url,
        tieuDe: String(kq.tieuDe || '').slice(0, 120),
        tomTat: String(kq.tomTat || ''),
        cacY: cacY.slice(0, 18),
        sanPham: (kq.sanPham || []).map(String).slice(0, 8),
        doTinCay: Number(kq.doTinCay) || 0,
        coTDS: !!tds,
        capNhat: !!cu, // trang đã có trước đây nhưng nội dung đổi
        luc: new Date().toISOString(),
      }
      // Trang sản phẩm chính hãng (có TDS hoặc độ tin cậy cao) → Maika học ngay; còn lại chờ Admin duyệt
      if (KHO && PIN && !x.huongDan && (the.coTDS || the.doTinCay >= TIN_CAY_TU_HOC)) {
        try {
          await napKho(the)
          the.daHoc = true
        } catch (e) {
          console.warn(`  ⚠ chưa nạp được kho chung: ${e.message}`)
        }
      }
      kho.the.unshift(the)
      soMoi++
      console.log(`  ✓ ${kq.tieuDe}${tds ? ' (+TDS)' : ''}${the.daHoc ? ' → đã học' : ' → chờ duyệt'}`)
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
