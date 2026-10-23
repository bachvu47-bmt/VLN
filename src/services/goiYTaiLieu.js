// ============================================================
//  MAIKA GỢI Ý TÀI LIỆU (Smart Cards) cho màn "Gửi tài liệu cho khách"
//  Câu sales gõ ("khách hỏi Maxbond 1211 thi công sao") → nhận diện sản phẩm (danh sách Tra cứu:
//  vatlieunha.vn + KiotViet) → gom tài liệu THẬT, không bịa link:
//   · PDF hướng dẫn / TDS / catalogue nhúng trong trang sản phẩm vatlieunha.vn
//   · Video YouTube gắn trong trang sản phẩm
//   · Trang sản phẩm (thông số) trên vatlieunha.vn
//   · Trang nhà sản xuất Maika đã học & Admin đã duyệt (bộ nhớ Maika)
//  Thiếu video → thẻ "Tìm clip thi công" (mở YouTube cho sales tự chọn, không tự đính kèm).
// ============================================================
import { danhSachTraCuu } from './traCuuSanPham'
import { danhSach } from './vectorStore'

const BO_DAU = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const TU_CHUNG = new Set(
  'khach hoi gui cho em anh chi minh ban shop tai lieu huong dan thi cong video clip file pdf link the nao sao gi co khong loai san pham cua va voi nhe a oi can muon xem ve tds thong so bao nhieu dung lam'.split(' '),
)
const tuCua = (s) => BO_DAU(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG.has(w))

const lien = (s) => BO_DAU(s).replace(/[^a-z0-9]/g, '')
const HANG = ['sika', 'maxbond', 'neotex', 'neoproof', 'jotun', 'kova', 'dulux', 'weber', 'mapei', 'bestmix', 'intoc', 'kansai', 'nippon', 'toa', 'moolar', 'gps', 'conwood', 'cemboard']

// Sản phẩm được nhắc trong câu — khớp tên (cả kiểu viết liền "SikaLatex");
// mã số ("1211") và hãng ("Sika") phải đúng; cụm liền nhau ("Neoproof PU W") được cộng điểm
export function nhanDienSanPham(cau, n = 3) {
  const tu = [...new Set(tuCua(cau))]
  if (!tu.length) return []
  const coSo = tu.filter((w) => /\d/.test(w))
  const hangHoi = HANG.filter((h) => lien(cau).includes(h))
  // Cụm 2–3 từ liền nhau trong câu (giữ cả từ 1 ký tự như "W") → "neoproofpuw"
  const tho = BO_DAU(cau).split(/[^a-z0-9]+/).filter(Boolean)
  const cum = [] // [chuỗi liền, số từ]
  for (let i = 0; i < tho.length; i++) for (const k of [3, 2]) if (i + k <= tho.length) cum.push([tho.slice(i, i + k).join(''), k])
  return danhSachTraCuu()
    .map((sp) => {
      const ten = new Set(tuCua(sp.ten))
      const tenLien = lien(sp.ten)
      const trung = (w) => ten.has(w) || (w.length >= 5 && tenLien.includes(w)) // "sikalatex" ⊂ "sikalatexth…"
      const khop = tu.filter(trung)
      const soTu = khop.reduce((s, w) => s + (ten.has(w) ? 1 : 2), 0) // từ viết liền = 2 từ
      // Cụm dài nhất trùng tên: "neoproofpuw" (3 từ) thắng "neoproofpu" (2 từ) → PU W đứng trước PU Fiber
      const thuong = Math.max(0, ...cum.filter(([c]) => c.length >= 6 && tenLien.includes(c)).map(([, k]) => k))
      return {
        sp,
        diem: soTu + khop.filter((w) => /\d/.test(w)).length + thuong,
        du: soTu >= Math.min(2, ten.size),
        sai: (coSo.length > 0 && !coSo.some(trung)) || (hangHoi.length > 0 && !hangHoi.some((h) => tenLien.includes(h))),
      }
    })
    .filter((x) => x.du && !x.sai) // hỏi "1211" bỏ Maxbond 722; hỏi "Sika" bỏ GPS
    .sort((a, b) => b.diem - a.diem || coTaiLieu(b.sp) - coTaiLieu(a.sp))
    .slice(0, n)
    .map((x) => x.sp)
}
const coTaiLieu = (sp) => (sp.taiLieu?.length ? 2 : 0) + (sp.video ? 1 : 0) + (sp.url ? 1 : 0)

const laTDS = (ten = '') => /tds|technical|data ?sheet|thong so|thông số|pds/i.test(ten)
const tenPdf = (ten = '') => decodeURIComponent(ten).replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()

// Thẻ gợi ý: { id, loai: 'pdf'|'tds'|'video'|'web'|'nsx'|'timvideo', ten, url, nguon, sp, dinhKem }
export function goiYTaiLieu(sps) {
  const the = []
  const them = (t) => !the.some((x) => x.url === t.url) && the.push({ dinhKem: true, ...t, id: t.loai + ':' + t.url })
  const daDuyet = danhSach({ trangThai: 'da_duyet' })
  for (const sp of sps) {
    for (const tl of sp.taiLieu || []) {
      if (typeof tl !== 'object' || !tl.url) continue
      them({ loai: laTDS(tl.ten) ? 'tds' : 'pdf', ten: tenPdf(tl.ten), url: tl.url, nguon: 'vatlieunha.vn', sp })
    }
    if (sp.video) them({ loai: 'video', ten: `Video thi công ${sp.ten}`, url: sp.video, nguon: 'YouTube', sp })
    if (sp.url) them({ loai: 'web', ten: `Thông số & hướng dẫn: ${sp.ten}`, url: sp.url, nguon: 'vatlieunha.vn', sp })
    // Trang nhà sản xuất Maika đã học (thẻ cào đã duyệt / tri thức có link nguồn)
    const tuSp = new Set(tuCua(sp.ten))
    for (const r of daDuyet) {
      if (!/^https?:\/\//.test(r.nguon || '') || /vatlieunha\.vn/.test(r.nguon) || r.loai === 'web') continue
      const khop = tuCua(r.tieuDe || '').filter((w) => tuSp.has(w)).length
      if (khop >= Math.min(2, tuSp.size)) {
        let mien = ''
        try {
          mien = new URL(r.nguon).hostname.replace(/^www\./, '')
        } catch {
          /* bỏ qua */
        }
        them({ loai: 'nsx', ten: r.tieuDe, url: r.nguon, nguon: `Nhà sản xuất · ${mien}`, sp })
      }
    }
    if (!sp.video) {
      them({
        loai: 'timvideo',
        ten: `Tìm clip thi công ${sp.ten}`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(sp.ten + ' thi công')}`,
        nguon: 'YouTube — chọn clip rồi dán link vào khung chat',
        sp,
        dinhKem: false,
      })
    }
  }
  // TDS & hướng dẫn trước, video, trang web, nhà sản xuất
  const THU_TU = { tds: 0, pdf: 1, video: 2, web: 3, nsx: 4, timvideo: 5 }
  return the.sort((a, b) => THU_TU[a.loai] - THU_TU[b.loai])
}

// Link sales tự dán (YouTube, PDF, trang web) → thẻ đính kèm
export function theTuLink(url) {
  const yt = /youtu\.?be/.test(url)
  const pdf = /\.pdf(\?|#|$)/i.test(url)
  let mien = ''
  try {
    mien = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  return { id: 'link:' + url, loai: yt ? 'video' : pdf ? 'pdf' : 'web', ten: yt ? 'Video YouTube' : pdf ? tenPdf(url.split('/').pop().split('?')[0]) : mien, url, nguon: mien, dinhKem: true }
}

// ---- Link rút gọn thương hiệu: vatlieunha.vn/tai-lieu/<slug sản phẩm> ----
// Cần plugin nhỏ trên website (web/vln-tai-lieu.php). App tự kiểm tra plugin đã cài chưa.
const GOC_LINK = 'https://vatlieunha.vn/tai-lieu/'
let _coLinkThuongHieu = null
export async function kiemTraLinkThuongHieu() {
  if (_coLinkThuongHieu !== null) return _coLinkThuongHieu
  try {
    const r = await fetch(GOC_LINK + '?kiem-tra=1', { signal: AbortSignal.timeout(8000) })
    _coLinkThuongHieu = r.ok && (await r.text()).includes('vln-tai-lieu')
  } catch {
    _coLinkThuongHieu = false
  }
  return _coLinkThuongHieu
}
const slugSp = (sp) => (sp?.tuWeb && sp.url ? decodeURIComponent(new URL(sp.url).pathname.replace(/\/$/, '').split('/').pop()) : '')
// PDF/TDS → /tai-lieu/<slug>/pdf (tệp đầu tiên) · trang sản phẩm → /tai-lieu/<slug>
export function linkThuongHieu(the) {
  const slug = slugSp(the.sp)
  if (!slug) return ''
  if (the.loai === 'web') return GOC_LINK + slug
  if ((the.loai === 'tds' || the.loai === 'pdf') && the.sp.taiLieu?.[0]?.url === the.url) return `${GOC_LINK}${slug}/pdf`
  return ''
}

const NHAN = { tds: '📊 TDS', pdf: '📄 Hướng dẫn', video: '▶ Video', web: '🌐 Thông số', nsx: '🏭 Nhà sản xuất', anh: '🖼️ Ảnh', tep: '📎 Tệp' }
export const nhanLoai = (loai) => NHAN[loai] || '🔗'

// Tin nhắn gửi khách: lời chào + danh sách link (link ghép bằng code, AI không đụng vào link)
export function soanTinNhan({ khach = '', loiDau = '', the = [], tep = [], dungLinkThuongHieu = false, kyTen = '' }) {
  const goi = khach.trim() ? `anh/chị ${khach.trim()}` : 'anh/chị'
  const dau = loiDau.trim() || `Dạ em chào ${goi}, em gửi ${goi} tài liệu sản phẩm để tham khảo ạ:`
  const dong = the.map((t) => `• ${nhanLoai(t.loai).replace(/^\S+\s/, '')}${t.sp ? ` ${t.sp.ten}` : ''}: ${(dungLinkThuongHieu && linkThuongHieu(t)) || t.url}`)
  const dinhKem = tep.length ? [`(Kèm ${tep.length} tệp: ${tep.map((f) => f.name).join(', ')})`] : []
  const cuoi = `Cần tư vấn thêm ${goi} cứ nhắn em nhé.${kyTen ? `\n${kyTen} – Vật Liệu Nhà` : '\nVật Liệu Nhà'} · Hotline 0947 844 446`
  return [dau, ...dong, ...dinhKem, '', cuoi].join('\n')
}
