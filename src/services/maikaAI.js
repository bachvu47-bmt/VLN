// ============================================================
//  MAIKA AI — điều phối trợ lý AI
//  - ONLINE: gọi Google Gemini (ưu tiên) với TOÀN BỘ lịch sử trò chuyện.
//    Không fallback về dữ liệu cứng — lỗi thì báo lỗi thật.
//  - OFFLINE (mất mạng): chỉ tra cứu KHO NỘI BỘ; không có thì báo rõ
//    "chưa có dữ liệu offline" chứ KHÔNG đoán sang sản phẩm khác.
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { geminiChat, geminiCoCauHinh } from './geminiService'

// (Tùy chọn) cổng OpenAI-compatible khác (Groq/OpenRouter...) nếu không dùng Gemini
const BASE_URL = (import.meta.env.VITE_MAIKA_BASE_URL || '').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_MAIKA_API_KEY || ''
const MODEL = import.meta.env.VITE_MAIKA_MODEL || 'gemini-2.0-flash'
const PROXY_URL = import.meta.env.VITE_MAIKA_PROXY_URL || ''

function coMang() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function maikaCheDo() {
  if (!coMang()) return 'offline' // mất mạng thực sự
  if (geminiCoCauHinh()) return 'gemini'
  if (PROXY_URL) return 'proxy'
  if (BASE_URL && API_KEY) return 'api'
  return 'chuaCauHinh' // online nhưng chưa gắn AI
}

// Tìm sản phẩm trong KHO NỘI BỘ theo tên/hãng/tag (khớp chính xác, không đoán)
function timSP(text = '') {
  const k = text.toLowerCase()
  return SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
}

// Tóm tắt kỹ thuật 1 sản phẩm (dùng cho chế độ offline)
function tomTatSP(sp) {
  return [
    `${sp.ten} (${sp.hang}) — ${sp.tenNgan}.`,
    'Tính năng: ' + sp.tinhNang.join('; ') + '.',
    'Tỷ lệ pha: ' + sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | '),
    `Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu}).`,
    '⚠️ Lưu ý: ' + sp.canhBao.join(' | '),
  ].join('\n')
}

const THONG_BAO_OFFLINE =
  'Maika chưa có dữ liệu offline về sản phẩm này. Vui lòng bật mạng để Maika tra cứu qua Gemini/Google.'

// ---- Cổng OpenAI-compatible phụ (chỉ khi cấu hình VITE_MAIKA_*) ----
function buildKB() {
  return SAN_PHAM.map((sp) =>
    [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma})`,
      `- Công dụng: ${sp.tenNgan}. Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}. ⚠️ ${sp.canhBao.join(' | ')}`,
    ].join('\n'),
  ).join('\n\n')
}
const SYS_OPENAI = `Bạn là Maika — Trợ lý Kỹ thuật Vật Liệu Nhà (Khôi Anh Home Center), chuyên chống thấm & vật liệu xây dựng. Trả lời tiếng Việt, chính xác. Nếu sản phẩm khách hỏi chưa có trong kho nội bộ, dùng kiến thức thực tế trả lời ĐÚNG sản phẩm đó, TUYỆT ĐỐI không nói sang sản phẩm khác.\n\nKHO NỘI BỘ:\n${buildKB()}`

async function goiLLM(convMessages) {
  const endpoint = PROXY_URL || `${BASE_URL}/chat/completions`
  const headers = { 'Content-Type': 'application/json' }
  if (!PROXY_URL && API_KEY) headers.Authorization = `Bearer ${API_KEY}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYS_OPENAI }, ...convMessages],
      temperature: 0.4,
      max_tokens: 1536,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${t.slice(0, 160)}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content || '').trim()
}

// ============================================================
//  Hội thoại — nhận TOÀN BỘ lịch sử [{tu:'user'|'maika', text}]
//  Trả về { text, sp?, nguon, loi? }
// ============================================================
export async function maikaChatAI(lichSu) {
  const nt = maikaCheDo()
  const cauHoiCuoi = [...lichSu].reverse().find((m) => m.tu === 'user')?.text || ''

  // OFFLINE: chỉ tra kho nội bộ, không đoán sang sản phẩm khác
  if (nt === 'offline') {
    const sp = timSP(cauHoiCuoi)
    return sp
      ? { text: tomTatSP(sp), sp, nguon: 'offline' }
      : { text: THONG_BAO_OFFLINE, nguon: 'offline' }
  }

  // ONLINE nhưng chưa cấu hình AI
  if (nt === 'chuaCauHinh') {
    return {
      text: 'Maika chưa được cấu hình trợ lý AI. Vui lòng thêm VITE_GEMINI_API_KEY (lấy free tại aistudio.google.com/apikey) rồi mở lại app.',
      nguon: 'chuaCauHinh',
    }
  }

  try {
    let text
    if (nt === 'gemini') {
      text = await geminiChat(lichSu) // truyền toàn bộ lịch sử
    } else {
      const convMessages = lichSu.map((m) => ({ role: m.tu === 'user' ? 'user' : 'assistant', content: m.text }))
      while (convMessages.length && convMessages[0].role !== 'user') convMessages.shift()
      text = await goiLLM(convMessages)
    }
    text = text || '(Maika chưa có câu trả lời)'
    return { text, sp: timSP(cauHoiCuoi + ' ' + text), nguon: nt }
  } catch (e) {
    console.warn('[Maika AI] Lỗi gọi AI:', e.message)
    // KHÔNG trả dữ liệu cứng. Mất mạng giữa chừng → báo; còn lại → báo lỗi thật.
    if (!coMang()) {
      return { text: 'Mất kết nối mạng khi đang hỏi Maika. Vui lòng kiểm tra mạng và thử lại.', nguon: 'offline' }
    }
    return { text: `Maika gặp lỗi khi gọi AI: ${e.message || e}. Kiểm tra API key / mạng rồi thử lại.`, nguon: 'loi', loi: true }
  }
}
