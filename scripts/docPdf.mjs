// ============================================================
//  ĐỌC CHỮ TỪ PDF (TDS / hướng dẫn thi công của nhà sản xuất) — dùng trong GitHub Actions
//  Cần pdfjs-dist@4.10.38: workflow cài riêng vào /tmp/pdfjs (không đụng node_modules của app)
//  rồi trỏ PDFJS=<…/legacy/build/pdf.mjs>. Không có thư viện → trả '' (bỏ qua TDS).
// ============================================================
import { pathToFileURL } from 'node:url'

let _pdfjs
async function pdfjs() {
  if (_pdfjs === undefined) {
    const duongDan = process.env.PDFJS ? pathToFileURL(process.env.PDFJS).href : 'pdfjs-dist/legacy/build/pdf.mjs'
    _pdfjs = await import(duongDan).catch(() => null)
    if (!_pdfjs) console.warn('⚠ Không có pdfjs-dist — bỏ qua đọc TDS')
  }
  return _pdfjs
}

// url PDF → chữ (tối đa toiDa ký tự). Lỗi / quá nặng / PDF scan không có chữ → ''
export async function docPdf(url, { toiDa = 6000, ua = 'VLN-Maika-Bot/1.0', nangToiDaMB = 12 } = {}) {
  const lib = await pdfjs()
  if (!lib) return ''
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(30000) })
    if (!r.ok) return ''
    const buf = new Uint8Array(await r.arrayBuffer())
    if (buf.length > nangToiDaMB * 1024 * 1024 || String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') return ''
    const doc = await lib.getDocument({ data: buf, isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise
    let text = ''
    for (let i = 1; i <= Math.min(doc.numPages, 8) && text.length < toiDa; i++) {
      const trang = await (await doc.getPage(i)).getTextContent()
      // Font tiếng Việt hay tách từng ký tự có dấu thành mục riêng → ghép liền nếu 2 mục sát nhau
      let dong = ''
      let cuoi = null
      for (const x of trang.items) {
        if (!('str' in x)) continue
        const [, , , , xx, yy] = x.transform
        const sat = cuoi && Math.abs(yy - cuoi.y) < 2 && xx - cuoi.x < Math.max(1.5, (x.height || 8) * 0.18)
        dong += (cuoi && !sat && !cuoi.eol && !/\s$/.test(dong) && !/^\s/.test(x.str) ? ' ' : '') + x.str
        if (x.hasEOL) dong += '\n'
        cuoi = { x: xx + (x.width || 0), y: yy, eol: x.hasEOL }
      }
      text += dong + '\n'
    }
    await doc.destroy()
    return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, toiDa)
  } catch {
    return ''
  }
}

// Link PDF trong HTML trang sản phẩm: ưu tiên TDS/PDS (bảng dữ liệu) rồi tới hướng dẫn thi công (MS)
export function linkPdf(html, goc) {
  const ds = [...new Set([...html.matchAll(/href="([^"]+?\.pdf)"/gi)].map((m) => m[1]))]
    .map((u) => {
      try {
        return new URL(u.replace(/&amp;/g, '&'), goc).href
      } catch {
        return ''
      }
    })
    .filter(Boolean)
  const diem = (u) => (/\/(ms[\s_%-]|method)|ms%20|huong-dan/i.test(u) ? 1 : /catalog|brochure|chung-nhan|certificate/i.test(u) ? 2 : 0)
  // Cùng một tệp hay có 2 đường dẫn (/content/dam/… và /dam/…) → gộp theo tên tệp
  const theoTen = new Map(ds.map((u) => [decodeURIComponent(u.split('/').pop()).toLowerCase().replace(/[\s_-]+/g, ''), u]))
  return [...theoTen.values()].sort((a, b) => diem(a) - diem(b)).slice(0, 2)
}
