// ============================================================
//  TẢI TRANG WEB DẠNG CHỮ — không dính CORS trên .exe/.apk
//  .exe: qua main process Electron · .apk: CapacitorHttp · web: fetch trực tiếp
// ============================================================

export async function layText(url) {
  if (typeof window !== 'undefined' && window.desktop?.webFetch) {
    const r = await window.desktop.webFetch(url)
    if (r.status >= 400) throw new Error('HTTP ' + r.status)
    return typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
  }
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const r = await CapacitorHttp.get({ url, responseType: 'text', connectTimeout: 15000, readTimeout: 20000 })
    if (r.status >= 400) throw new Error('HTTP ' + r.status)
    return typeof r.data === 'string' ? r.data : String(r.data)
  }
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.text()
}

const THUC_THE = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const giaiThucThe = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, t) => THUC_THE[t.toLowerCase()] ?? ' ')

// HTML → { tieuDe, noiDung } (vùng main/article, bỏ menu/script/footer) — giống scripts/cao-tri-thuc.mjs
export function trichTrang(html) {
  const tieuDe = giaiThucThe((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title[^>]*>([^<]+)/i) || [])[1] || '').trim()
  const moTa = giaiThucThe((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || '').trim()
  const vung = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<body[\s\S]*?<\/body>/i) || [html])[0]
  const noiDung = giaiThucThe(
    vung
      .replace(/<(script|style|noscript|nav|header|footer|form|aside|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|li|h[1-6]|tr|div|section)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
  return { tieuDe, noiDung: moTa && !noiDung.includes(moTa) ? `${moTa}\n${noiDung}` : noiDung }
}

export function laYouTube(url) {
  return /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/i.test(url)
}
