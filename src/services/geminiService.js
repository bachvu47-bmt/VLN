// ============================================================
//  GEMINI SERVICE — Google Gemini API (REST, free)
//  Maika: Trợ lý Kỹ thuật Vật Liệu Nhà (Khôi Anh Home Center).
//  Truyền TOÀN BỘ lịch sử trò chuyện (context) lên Gemini.
//  Native (.apk) dùng CapacitorHttp để tránh CORS; .exe/web dùng fetch.
//  Key free: https://aistudio.google.com/apikey → VITE_GEMINI_API_KEY
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { laySanPhamWeb } from '../data/productStore'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

export function geminiCoCauHinh() {
  return !!API_KEY
}

function buildKB() {
  const noiBo = SAN_PHAM.map((sp) =>
    [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma})`,
      `- Công dụng: ${sp.tenNgan}.`,
      `- Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu})`,
      `- ⚠️ Chống chỉ định: ${sp.canhBao.join(' | ')}`,
    ].join('\n'),
  )
  // Thêm danh sách sản phẩm đã đồng bộ từ website (nếu có)
  const web = laySanPhamWeb()
  if (web.length) {
    noiBo.push(
      '### Sản phẩm đồng bộ từ vatlieunha.vn (' +
        web.length +
        ' SP):\n' +
        web.slice(0, 120).map((p) => `- ${p.ten} (${p.hang})`).join('\n'),
    )
  }
  return noiBo.join('\n\n')
}

function systemPrompt() {
  return `Bạn là Maika — TRỢ LÝ KỸ THUẬT của Vật Liệu Nhà (Khôi Anh Home Center), chuyên sâu về CHỐNG THẤM và VẬT LIỆU XÂY DỰNG / NỘI THẤT.

NGUYÊN TẮC TRẢ LỜI:
- Trả lời bằng tiếng Việt, chính xác, có cơ sở kỹ thuật, đi thẳng vấn đề; dùng gạch đầu dòng + số liệu khi phù hợp.
- Thiếu dữ kiện quan trọng (bề mặt, độ ẩm, trong/ngoài trời, hạng mục, ngân sách) → HỎI LẠI ngắn gọn trước khi chốt phương án.
- Khi tư vấn: nêu (1) chẩn đoán/giải pháp, (2) sản phẩm phù hợp + định mức, (3) tỷ lệ pha & trình tự thi công, (4) ⚠️ cảnh báo bắt buộc (vd: CẤM lăn PU khi sàn ẩm > 8%).

RẤT QUAN TRỌNG — TRẢ LỜI ĐÚNG SẢN PHẨM KHÁCH HỎI:
- Nếu sản phẩm khách hỏi CHƯA CÓ trong "KHO KIẾN THỨC NỘI BỘ" bên dưới (ví dụ: "Sơn giả gỗ Lotus"), hãy dùng kiến thức thực tế của bạn để trả lời ĐÚNG nhà sản xuất / đặc tính kỹ thuật của CHÍNH sản phẩm/thương hiệu đó.
- TUYỆT ĐỐI KHÔNG trả lời lan man sang một sản phẩm khác (ví dụ khách hỏi "Lotus" mà lại đi nói về "Jotun"). Nếu không chắc chắn về sản phẩm đó, hãy nói thẳng là chưa có đủ dữ liệu và đề nghị khách cung cấp thêm thông tin, thay vì bịa sang sản phẩm khác.
- Khi khách CHỈNH LẠI (ví dụ: "Tôi hỏi sơn Lotus chứ không hỏi Jotun"), phải hiểu ngữ cảnh và SỬA NGAY câu trả lời cho đúng sản phẩm họ nhắc đến.

Khi xưng danh với khách, chỉ dùng thương hiệu "Vật Liệu Nhà". Bạn là trợ lý nội bộ cho nhân viên kinh doanh.

KHO KIẾN THỨC NỘI BỘ:
${buildKB()}`
}

// Lịch sử [{tu:'user'|'maika', text}] → contents của Gemini (giữ nguyên thứ tự)
function toContents(lichSu) {
  const contents = (lichSu || []).map((m) => ({
    role: m.tu === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }))
  while (contents.length && contents[0].role !== 'user') contents.shift()
  return contents
}

async function goiGemini(body) {
  // Native Android: CapacitorHttp (POST, không dính CORS)
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({
      url: ENDPOINT,
      headers: { 'Content-Type': 'application/json' },
      data: body,
    })
    if (res.status >= 400) throw new Error(`Gemini HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`)
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  }
  // .exe / web: fetch trực tiếp (Gemini cho phép CORS)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 200)}`)
  }
  return res.json()
}

// Gửi TOÀN BỘ lịch sử lên Gemini → trả về chuỗi text
export async function geminiChat(lichSu) {
  const data = await goiGemini({
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: toContents(lichSu),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1536 },
  })
  const cand = data?.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text && cand?.finishReason) {
    throw new Error('Gemini không trả nội dung (finishReason: ' + cand.finishReason + ')')
  }
  return text.trim()
}
