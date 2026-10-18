// ============================================================
//  MAIKA AI — kết nối LLM qua chuẩn OpenAI-compatible
//  Dùng được với nhiều nhà cung cấp MIỄN PHÍ:
//   - Google Gemini (free, không cần thẻ):
//       BASE_URL = https://generativelanguage.googleapis.com/v1beta/openai
//       MODEL    = gemini-2.0-flash
//   - Groq (free, rất nhanh):
//       BASE_URL = https://api.groq.com/openai/v1
//       MODEL    = llama-3.3-70b-versatile
//   - OpenRouter (có model :free), Together, Mistral, Ollama (local)...
//
//  Không cấu hình → tự dùng engine offline (maika.js), không cần mạng.
//  Phát hành .exe/.apk: dùng VITE_MAIKA_PROXY_URL để giấu key phía server.
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { MAIKA, maikaTraLoi } from './maika'

const BASE_URL = (import.meta.env.VITE_MAIKA_BASE_URL || '').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_MAIKA_API_KEY || ''
const MODEL = import.meta.env.VITE_MAIKA_MODEL || 'gemini-2.0-flash'
const PROXY_URL = import.meta.env.VITE_MAIKA_PROXY_URL || ''

export function maikaCheDo() {
  if (PROXY_URL) return 'proxy'
  if (BASE_URL && API_KEY) return 'api'
  return 'offline'
}

// ---- Kho kiến thức sản phẩm → chèn vào system prompt ----
function buildKB() {
  return SAN_PHAM.map((sp) => {
    return [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma}, nhóm ${sp.danhMuc})`,
      `- Công dụng: ${sp.tenNgan}.`,
      `- Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Quy cách: ${sp.quyCach.join(', ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu})`,
      `- ⚠️ Cảnh báo/chống chỉ định: ${sp.canhBao.join(' | ')}`,
    ].join('\n')
  }).join('\n\n')
}

const SYSTEM_PROMPT = `Bạn là ${MAIKA.ten} — CHUYÊN GIA kỹ thuật cấp cao của Vật Liệu Nhà, được xây dựng như một chuyên gia dữ liệu lớn, đặc biệt giỏi về XÂY DỰNG, VẬT LIỆU XÂY DỰNG và NỘI THẤT.

CHUYÊN MÔN CỦA BẠN:
- Kết cấu & thi công: móng, cột, dầm, sàn, chống thấm, cấy thép, xử lý nứt, quy trình & trình tự thi công.
- Vật liệu xây dựng: xi măng, bê tông, cốt thép, gạch, phụ gia, keo, sơn, chống thấm (gốc xi măng/PU/bitum), tấm xi măng/thạch cao — hiểu bản chất hoá – lý, điều kiện áp dụng và chống chỉ định.
- Hoàn thiện & nội thất: ốp lát, sơn hoàn thiện, trần – vách, vật liệu bề mặt, phối hợp vật liệu theo công năng & thẩm mỹ.
- Bóc tách & định mức: ước tính khối lượng vật tư theo diện tích/độ dày, hao hụt, quy đổi đơn vị.

CÁCH LÀM VIỆC:
- Trả lời bằng tiếng Việt, như một kỹ sư dày dạn tư vấn đồng nghiệp: chính xác, có cơ sở kỹ thuật, đi thẳng vào vấn đề; dùng gạch đầu dòng và số liệu khi phù hợp.
- Khi thiếu dữ kiện quan trọng (bề mặt, độ ẩm, trong/ngoài trời, tải trọng, ngân sách...), hãy HỎI LẠI ngắn gọn trước khi chốt phương án.
- Khi tư vấn: nêu (1) giải pháp/sản phẩm phù hợp, (2) định mức & quy cách, (3) tỷ lệ pha & trình tự thi công, (4) ⚠️ cảnh báo/chống chỉ định bắt buộc (ví dụ: CẤM lăn PU khi sàn ẩm > 8%).
- ƯU TIÊN sản phẩm trong KHO KIẾN THỨC của Vật Liệu Nhà. Với kiến thức xây dựng chung ngoài kho, bạn được phép vận dụng chuyên môn nhưng KHÔNG bịa số liệu kỹ thuật của sản phẩm cụ thể — nếu không chắc, khuyên tra TDS/hỏi kỹ thuật.
- Bạn là trợ lý NỘI BỘ cho nhân viên kinh doanh: giúp họ tư vấn khách đúng và chuyên nghiệp.

KHO KIẾN THỨC SẢN PHẨM (Vật Liệu Nhà):
${buildKB()}`

// Thân request chuẩn OpenAI chat-completions
function buildBody(convMessages) {
  return {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...convMessages],
    temperature: 0.4,
    max_tokens: 1536,
  }
}

function timSP(text = '') {
  const k = text.toLowerCase()
  return SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function goiLLM(convMessages) {
  const endpoint = PROXY_URL || `${BASE_URL}/chat/completions`
  const headers = { 'Content-Type': 'application/json' }
  if (!PROXY_URL && API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildBody(convMessages)),
  })
  if (!res.ok) {
    const chiTiet = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${chiTiet.slice(0, 160)}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content || '').trim()
}

// ============================================================
//  Hội thoại — nhận lịch sử [{tu:'user'|'maika', text}]
//  Trả về { text, sp?, goiY?, calc?, nguon }
// ============================================================
export async function maikaChatAI(lichSu) {
  const nt = maikaCheDo()
  const cauHoiCuoi = [...lichSu].reverse().find((m) => m.tu === 'user')?.text || ''

  const convMessages = lichSu.map((m) => ({
    role: m.tu === 'user' ? 'user' : 'assistant',
    content: m.text,
  }))
  while (convMessages.length && convMessages[0].role !== 'user') convMessages.shift()

  if (nt === 'offline' || convMessages.length === 0) {
    await delay(400)
    return { ...maikaTraLoi(cauHoiCuoi), nguon: 'offline' }
  }

  try {
    const text = (await goiLLM(convMessages)) || '(Maika chưa có câu trả lời)'
    return { text, sp: timSP(cauHoiCuoi + ' ' + text), nguon: nt }
  } catch (e) {
    console.warn('[Maika AI] Lỗi gọi LLM, chuyển sang offline:', e.message)
    return { ...maikaTraLoi(cauHoiCuoi), nguon: 'offline', loi: true }
  }
}
