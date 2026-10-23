// ============================================================
//  MAIKA AI — điều phối trợ lý AI
//  - ONLINE: truy xuất tri thức liên quan từ bộ nhớ vector (RAG: đính chính
//    của Admin + tài liệu nạp + dữ liệu vatlieunha.vn) → gửi kèm TOÀN BỘ lịch sử
//    trò chuyện lên Google Gemini. Lỗi thì báo lỗi thật, không trả dữ liệu cứng.
//  - OFFLINE (mất mạng): tra bộ nhớ đã học (từ khoá) + kho nội bộ; không có thì
//    báo rõ "chưa có dữ liệu offline" chứ KHÔNG đoán sang sản phẩm khác.
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { laySanPhamWeb } from '../data/productStore'
import { aiCoCauHinh, geminiChat, mayChuMaikaCoCauHinh } from './maikaChatbot'
import { dangKyTheoDoi as dangKyTheoDoiTriThuc, phienBanTriThuc, truyXuat } from './vectorStore'
import { duLieuKV, goiYSanPhamTuCau, tienVN } from './kiotViet'
import { cauTruyVan } from '../../supabase/functions/_shared/maikaNao.js'
import { canTimWeb, timInternetTrenMay } from './timWeb'

function coMang() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function maikaCheDo() {
  if (!coMang()) return 'offline'
  if (aiCoCauHinh() || mayChuMaikaCoCauHinh()) return 'ai'
  return 'chuaCauHinh'
}

// Tìm sản phẩm trong kho (nội bộ + web) theo tên/hãng/tag — khớp chính xác, không đoán
function timSP(text = '') {
  const k = text.toLowerCase()
  const noiBo = SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
  return noiBo || laySanPhamWeb().find((sp) => sp.ten.length > 6 && k.includes(sp.ten.toLowerCase()))
}

function tomTatSP(sp) {
  return [
    `${sp.ten} (${sp.hang}) — ${sp.tenNgan}.`,
    'Tính năng: ' + sp.tinhNang.join('; ') + '.',
    'Tỷ lệ pha: ' + sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | '),
    `Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu}).`,
    '⚠️ Lưu ý: ' + sp.canhBao.join(' | '),
  ].join('\n')
}

function khoNoiBo() {
  return SAN_PHAM.map((sp) =>
    [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma})`,
      `- Công dụng: ${sp.tenNgan}. Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu}). ⚠️ ${sp.canhBao.join(' | ')}`,
    ].join('\n'),
  ).join('\n\n')
}

// Hàng hoá KiotViet khớp câu hỏi → giá bán & tồn kho THẬT cho Maika (chỉ khi máy đã nhập mã dữ liệu)
function khoKiotViet(cau) {
  const kv = duLieuKV()
  const ds = kv ? goiYSanPhamTuCau(cau, 6) : []
  if (!ds.length) return ''
  const luc = new Date(kv.capNhat).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  return `\n\nGIÁ BÁN & TỒN KHO KIOTVIET (cập nhật ${luc} — số liệu thật, ưu tiên khi hỏi giá/còn hàng):\n${ds
    .map((p) => `- ${p.ten} (mã ${p.ma}): ${tienVN(p.gia)}/${p.dvt} · ${p.ton > 0 ? `còn ${p.ton} ${p.dvt}` : 'HẾT HÀNG'}`)
    .join('\n')}`
}

// Câu truy vấn RAG dùng chung với máy chủ: câu nối tiếp ("thương hiệu nào?") tự ghép chủ đề đang nói

// Người dùng xin tài liệu/link → mới đính kèm (không tự động gắn link vào mọi câu trả lời)
const XIN_TAI_LIEU = /(tài liệu|tai lieu|link|đường dẫn|tds|msds|catalog|datasheet|hướng dẫn thi công chi tiết)/i

function gomTaiLieu(thamKhao, sp) {
  const web = laySanPhamWeb()
  const ds = []
  const them = (ten, url) => url && !ds.some((x) => x.url === url) && ds.push({ ten, url })
  const spIds = [...new Set([...thamKhao.map((t) => t.spId), sp?.id].filter(Boolean))]
  for (const id of spIds) {
    const p = web.find((x) => x.id === id)
    if (!p) continue
    p.taiLieu?.forEach((tl) => typeof tl === 'object' && them(`📄 ${tl.ten}`, tl.url))
    if (p.video) them(`▶ Video: ${p.ten}`, p.video)
    them(`🌐 ${p.ten}`, p.url)
  }
  return ds.slice(0, 8)
}

// ============================================================
//  CACHE CÂU TRẢ LỜI — tri thức public (câu hỏi kỹ thuật lặp lại: "định mức Sika Latex?")
//  trả ngay < 1s. Chỉ cache câu hỏi mở đầu (không lịch sử, không ảnh) và KHÔNG chứa giá/tồn
//  KiotViet (số liệu thay đổi). Tri thức mới được duyệt → xoá cache để Maika trả lời theo bản mới.
// ============================================================
const _cacheTraLoi = new Map()
const TUOI_CACHE_MS = 6 * 3600 * 1000
const TOI_DA_CACHE = 150
const khoaCache = (s) => s.toLowerCase().normalize('NFC').replace(/[?.!,\s]+/g, ' ').trim()
let _phienBan = ''
dangKyTheoDoiTriThuc(() => {
  const pb = phienBanTriThuc()
  if (pb !== _phienBan) {
    _phienBan = pb
    _cacheTraLoi.clear()
  }
})

function layCache(khoa) {
  const c = _cacheTraLoi.get(khoa)
  if (!c || Date.now() - c.luc > TUOI_CACHE_MS) return null
  return c.kq
}
function ghiCache(khoa, kq) {
  if (_cacheTraLoi.size >= TOI_DA_CACHE) _cacheTraLoi.delete(_cacheTraLoi.keys().next().value)
  _cacheTraLoi.set(khoa, { kq, luc: Date.now() })
}

const THONG_BAO_OFFLINE =
  'Maika chưa có dữ liệu offline về nội dung này. Vui lòng bật mạng để Maika tra cứu qua Gemini.'

// ============================================================
//  Hội thoại — nhận TOÀN BỘ lịch sử [{tu:'user'|'maika', text, anh?}]
//  (anh = { mime, base64 } của tin nhắn đang hỏi — ảnh hiện trường)
//  Trả về { text, sp?, nguon, taiLieu?, loi? } — taiLieu chỉ có khi người dùng xin
// ============================================================
export async function maikaChatAI(lichSu) {
  const nt = maikaCheDo()
  const tinCuoi = [...lichSu].reverse().find((m) => m.tu === 'user')
  const cauHoiCuoi = tinCuoi?.text || ''

  if (nt === 'offline' && tinCuoi?.anh) {
    return { text: 'Phân tích ảnh cần kết nối mạng. Vui lòng bật mạng rồi gửi lại ảnh cho Maika.', nguon: 'offline' }
  }

  if (nt === 'offline') {
    const [tt] = await truyXuat(cauHoiCuoi, { k: 1, dungVector: false })
    if (tt) return { text: tt.noiDung, nguon: 'offline' }
    const sp = timSP(cauHoiCuoi)
    return sp ? { text: tomTatSP(sp), sp, nguon: 'offline' } : { text: THONG_BAO_OFFLINE, nguon: 'offline' }
  }

  if (nt === 'chuaCauHinh') {
    return {
      text: 'Maika chưa được cấu hình trợ lý AI. Vui lòng thêm VITE_GEMINI_API_KEY (lấy free tại aistudio.google.com/apikey) vào .env.local rồi build lại app.',
      nguon: 'chuaCauHinh',
    }
  }

  try {
    const truyVan = cauTruyVan(lichSu)
    const kv = khoKiotViet(truyVan)
    const laCauDau = !tinCuoi?.anh && lichSu.filter((m) => m.tu === 'user').length === 1
    const khoa = laCauDau && !kv && cauHoiCuoi.trim() ? khoaCache(cauHoiCuoi) : ''
    const daCo = khoa && layCache(khoa)
    if (daCo) return { ...daCo, tuCache: true }

    const thamKhao = truyVan.trim() ? await truyXuat(truyVan, { k: 6 }) : []
    // "Tìm trên mạng…" → điện thoại tự tìm internet (song song với truy xuất tri thức đã xong ở trên)
    const timWeb = canTimWeb(cauHoiCuoi)
    const ketQuaInternet = timWeb ? await timInternetTrenMay(lichSu).catch(() => '') : ''
    const { text, nhaCungCap, kienThucChung } = await geminiChat(lichSu, { khoNoiBo: khoNoiBo() + kv, triThuc: thamKhao, timWeb, ketQuaInternet })
    const sp = timSP(cauHoiCuoi)
    const taiLieu = XIN_TAI_LIEU.test(cauHoiCuoi) ? gomTaiLieu(thamKhao, sp) : undefined
    const kq = { text: text || '(Maika chưa có câu trả lời)', sp, nguon: nhaCungCap, taiLieu, kienThucChung }
    // Không cache câu tìm web (thông tin mới) — kiến thức chung thì cache được, Admin duyệt bản chuẩn sẽ xoá cache
    if (khoa && text && nhaCungCap !== 'groq-web') ghiCache(khoa, kq)
    return kq
  } catch (e) {
    console.warn('[Maika AI] Lỗi gọi AI:', e.message)
    if (!coMang()) {
      return { text: 'Mất kết nối mạng khi đang hỏi Maika. Vui lòng kiểm tra mạng và thử lại.', nguon: 'offline' }
    }
    if (e.status === 429) {
      return { text: `Maika đã dùng hết lượt AI miễn phí (Gemini + Groq) trong lúc này. Vui lòng thử lại sau ~${Math.min(e.choGiay || 30, 3600)} giây.`, nguon: 'loi', loi: true }
    }
    if (e.status >= 500 || e.name === 'TimeoutError' || e instanceof TypeError) {
      return { text: 'Máy chủ Google Gemini đang quá tải (Maika đã thử tất cả model dự phòng). Vui lòng hỏi lại sau 1–2 phút.', nguon: 'loi', loi: true }
    }
    return { text: `Maika gặp lỗi khi gọi AI: ${e.message || e}. Kiểm tra API key / mạng rồi thử lại.`, nguon: 'loi', loi: true }
  }
}
