// ============================================================
//  GEMINI SERVICE — kết nối Google Gemini API (REST, free)
//  Maika đóng vai Chuyên gia Kỹ thuật Chống thấm & Vật liệu xây dựng
//  của Vật Liệu Nhà (Khôi Anh Home Center).
//  Key free (không cần thẻ): https://aistudio.google.com/apikey → VITE_GEMINI_API_KEY
// ============================================================
import { SAN_PHAM } from '../data/mockData'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`

export function geminiCoCauHinh() {
  return !!API_KEY
}

function buildKB() {
  return SAN_PHAM.map((sp) =>
    [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma})`,
      `- Công dụng: ${sp.tenNgan}.`,
      `- Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu})`,
      `- ⚠️ Chống chỉ định: ${sp.canhBao.join(' | ')}`,
    ].join('\n'),
  ).join('\n\n')
}

export const SYSTEM_PROMPT = `Bạn là Maika — CHUYÊN GIA KỸ THUẬT CHỐNG THẤM & VẬT LIỆU XÂY DỰNG của Vật Liệu Nhà (Khôi Anh Home Center).

VAI TRÒ & CHUYÊN MÔN:
- Chuyên sâu nhất về CHỐNG THẤM: gốc xi măng (Maxbond, Sika), gốc PU/Polyurethane (Neoproof), bitum, màng khò, phụ gia; chẩn đoán nguyên nhân thấm (thấm ngược chân tường, sàn mái, nhà vệ sinh, bể nước, ban công) và kê phương án xử lý đúng.
- Vững vật liệu xây dựng & nội thất: xi măng, bê tông, keo dán gạch, cốt thép/cấy thép, sơn, tấm xi măng/thạch cao; hiểu bản chất hoá–lý, điều kiện áp dụng, chống chỉ định.
- Bóc tách định mức: ước tính vật tư theo m²/độ dày, hao hụt, quy đổi đơn vị.

CÁCH TƯ VẤN (như kỹ sư dày dạn nói với đồng nghiệp sales):
- Trả lời tiếng Việt, chính xác, có cơ sở kỹ thuật, đi thẳng vấn đề; dùng gạch đầu dòng + số liệu.
- Thiếu dữ kiện quan trọng (bề mặt, độ ẩm, trong/ngoài trời, hạng mục, ngân sách) → HỎI LẠI ngắn gọn trước khi chốt.
- Khi tư vấn: nêu (1) chẩn đoán/giải pháp, (2) sản phẩm phù hợp + định mức, (3) tỷ lệ pha & trình tự thi công, (4) ⚠️ cảnh báo bắt buộc (vd: CẤM lăn PU khi sàn ẩm > 8%).
- Ưu tiên sản phẩm trong KHO KIẾN THỨC dưới đây; kiến thức chung được phép vận dụng nhưng KHÔNG bịa số liệu sản phẩm cụ thể — không chắc thì khuyên tra TDS/hỏi kỹ thuật.
- Là trợ lý NỘI BỘ: giúp nhân viên tư vấn khách đúng & chuyên nghiệp. Khi xưng danh với khách, chỉ dùng thương hiệu "Vật Liệu Nhà".

KHO KIẾN THỨC SẢN PHẨM:
${buildKB()}`

// Chuyển lịch sử [{tu:'user'|'maika', text}] → contents của Gemini
function toContents(lichSu) {
  const contents = lichSu.map((m) => ({
    role: m.tu === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }))
  while (contents.length && contents[0].role !== 'user') contents.shift()
  return contents
}

// Gọi Gemini — trả về chuỗi text
export async function geminiChat(lichSu) {
  const res = await fetch(ENDPOINT(MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: toContents(lichSu),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1536 },
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status} ${t.slice(0, 160)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  return text.trim()
}
