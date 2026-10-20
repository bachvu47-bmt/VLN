// ============================================================
//  NGUỒN NHÀ SẢN XUẤT Maika được đọc (dùng chung: cao-tri-thuc.mjs, maika-tu-hoc.mjs)
// ============================================================
export const UA = 'Mozilla/5.0 (compatible; VLN-Maika-Bot/1.0; +https://vatlieunha.vn)'

export const NGUON = [
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

export async function lay(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.5' }, signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

export async function docSitemap(url) {
  const x = await lay(url)
  const con = [...x.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  if (con.length) return (await Promise.all(con.map(docSitemap))).flat() // sitemap index
  return [...x.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>(?:[\s\S]*?<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ url: m[1].trim(), lastmod: m[2] || '' }))
}

const THUC_THE = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export function trichNoiDung(html) {
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

// Khoá so khớp tên: bỏ dấu, chỉ giữ chữ-số. "Sikaproof® Membrane" → "sikaproofmembrane"
export const khoa = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
