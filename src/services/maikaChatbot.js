// ============================================================
//  MAIKA CHATBOT — đấu nối trực tiếp Google Gemini API (REST, free)
//  - Chat: model Flash (mặc định gemini-flash-latest) + system prompt chuyên gia
//    + tri thức truy xuất từ bộ nhớ vector (RAG). Gemini free chỉ ~20 câu/ngày/model
//    → hết lượt thì chuyển sang Groq (free ~1.000 câu/ngày/model, VITE_GROQ_API_KEY).
//  - Embedding: gemini-embedding-001 → vector cho bộ nhớ tự học.
//  - Phân tích tài liệu (text/PDF/ảnh) → JSON tri thức cho màn AI Admin.
//  Native (.apk) dùng CapacitorHttp; .exe/web dùng fetch (Gemini cho phép CORS).
//  Key free: https://aistudio.google.com/apikey → VITE_GEMINI_API_KEY
// ============================================================
import { blobSangBase64 } from '../data/mediaStore'

const API_KEY =import.meta.env.VITE_GEMINI_API_KEY || ''
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
const EMBED_MODEL = import.meta.env.VITE_GEMINI_EMBED_MODEL || 'gemini-embedding-001'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Model dự phòng — Google hay gỡ model cũ (404) hoặc quá tải tạm thời (503),
// mỗi model có quota riêng (429). Xếp từ mạnh → nhẹ; bản "lite" nhanh, ít quá tải.
const MODEL_DU_PHONG = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest']
export const SO_CHIEU_VECTOR = 768

// Groq (OpenAI-compatible) — dự phòng khi Gemini hết lượt free. Mỗi model 1.000 câu/ngày,
// nhưng chỉ 8.000 token/phút → gửi prompt rút gọn.
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// docAnh: model nhận được ảnh (đã thử: chỉ qwen3.8-27b; gpt-oss chỉ nhận chữ)
const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', them: { reasoning_effort: 'low' } },
  { id: 'qwen/qwen3.8-27b', them: { reasoning_format: 'hidden' }, docAnh: true },
  { id: 'openai/gpt-oss-20b', them: { reasoning_effort: 'low' } },
]
const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export function geminiCoCauHinh() {
  return !!API_KEY
}

export function aiCoCauHinh() {
  return !!(API_KEY || GROQ_KEY)
}

// Lỗi AI có kèm mã HTTP + thời gian chờ khi bị giới hạn tần suất (429)
export class GeminiLoi extends Error {
  constructor(status, chiTiet, nhaCungCap = 'Gemini', choGiay) {
    super(`${nhaCungCap} HTTP ${status}: ${String(chiTiet).slice(0, 200)}`)
    this.status = status
    const m = String(chiTiet).match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)
    this.choGiay = choGiay || (m ? Math.ceil(Number(m[1])) : status === 429 ? 30 : 0)
  }
}

function laNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

async function goi(duongDan, body) {
  const url = `${BASE}/${duongDan}`
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY }
  if (laNative()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({ url, headers, data: body, connectTimeout: 15000, readTimeout: 30000 })
    if (res.status >= 400) throw new GeminiLoi(res.status, JSON.stringify(res.data))
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  }
  // Google đôi khi treo request → 30s chưa xong thì bỏ, chuyển model khác (WebView Android cũ không có timeout())
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout?.(30000) })
  if (!res.ok) throw new GeminiLoi(res.status, await res.text().catch(() => ''))
  return res.json()
}

// Lỗi tạm thời / theo model / mạng chập chờn ("fetch failed" = TypeError) → thử model khác
// (400, 401, 403: lỗi key/request → dừng luôn)
const NEN_DOI_MODEL = (e) => [404, 429, 500, 502, 503, 504].includes(e.status) || e.name === 'TimeoutError' || e instanceof TypeError
const _modelDaGo = new Set() // model trả 404 trong phiên này → bỏ qua
// Gói free: ~20 request/ngày/model → model hết quota (429) bỏ qua tới khi hết retryDelay
const _hetQuotaDen = new Map()
const ngu = (ms) => new Promise((r) => setTimeout(r, ms))

// generateContent: thử model cấu hình trước, lỗi tạm thời thì lần lượt qua các model dự phòng
async function sinhNoiDung(body) {
  const thuTu = [...new Set([MODEL, ...MODEL_DU_PHONG])]
  let loiCuoi
  for (let vong = 0; vong < 2; vong++) {
    if (vong > 0) await ngu(2000) // mọi model đều quá tải → đợi rồi thử thêm 1 vòng
    const conDung = thuTu.filter((x) => !_modelDaGo.has(x) && !((_hetQuotaDen.get(x) || 0) > Date.now()))
    for (const m of conDung) {
      try {
        const data = await goi(`models/${m}:generateContent`, body)
        const cand = data?.candidates?.[0]
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('')
        if (!text) throw new Error('Gemini không trả nội dung (finishReason: ' + (cand?.finishReason || data?.promptFeedback?.blockReason || '?') + ')')
        return text.trim()
      } catch (e) {
        loiCuoi = e
        if (!NEN_DOI_MODEL(e)) throw e
        if (e.status === 404) _modelDaGo.add(m)
        if (e.status === 429) _hetQuotaDen.set(m, Date.now() + Math.max(e.choGiay, 60) * 1000)
        console.warn(`[Maika] Model ${m} lỗi ${e.status || e.name} → thử model khác`)
      }
    }
  }
  // conDung rỗng (mọi model đều đang hết lượt) → vẫn ném lỗi 429 có nghĩa
  throw loiCuoi || new GeminiLoi(429, 'Tất cả model Gemini đã hết lượt free hôm nay')
}

// ---- Groq: chat/completions (OpenAI-compatible) ----
async function goiGroq(body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` }
  if (laNative()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({ url: GROQ_URL, headers, data: body })
    if (res.status >= 400) throw new GeminiLoi(res.status, JSON.stringify(res.data), 'Groq', Number(res.headers?.['retry-after']) || 0)
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  }
  const res = await fetch(GROQ_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout?.(60000) })
  if (!res.ok) throw new GeminiLoi(res.status, await res.text().catch(() => ''), 'Groq', Number(res.headers.get('retry-after')) || 0)
  return res.json()
}

// contents Gemini → messages OpenAI (ảnh inline_data → image_url data URI)
function sangMessagesGroq(system, lichSu) {
  return [
    { role: 'system', content: system },
    ...toContents(lichSu).map((c) => {
      const role = c.role === 'model' ? 'assistant' : 'user'
      const anh = c.parts.find((p) => p.inline_data)
      const text = c.parts.filter((p) => p.text).map((p) => p.text).join('\n')
      if (!anh) return { role, content: text }
      return {
        role,
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: `data:${anh.inline_data.mime_type};base64,${anh.inline_data.data}` } },
        ],
      }
    }),
  ]
}

async function groqChat(system, lichSu) {
  const messages = sangMessagesGroq(system, lichSu)
  const coAnh = messages.some((m) => Array.isArray(m.content))
  const dsModel = GROQ_MODELS.filter((m) => !coAnh || m.docAnh)
  let loiCuoi
  for (const { id, them } of dsModel) {
    const khoa = 'groq:' + id
    if (_modelDaGo.has(khoa) || (_hetQuotaDen.get(khoa) || 0) > Date.now()) continue
    try {
      const data = await goiGroq({ model: id, messages, temperature: 0.4, max_tokens: 2048, ...them })
      const text = (data?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (!text) throw new Error('Groq không trả nội dung')
      return text
    } catch (e) {
      loiCuoi = e
      if (!NEN_DOI_MODEL(e)) throw e
      if (e.status === 404) _modelDaGo.add(khoa)
      if (e.status === 429) _hetQuotaDen.set(khoa, Date.now() + Math.max(e.choGiay, 10) * 1000)
      console.warn(`[Maika] Groq ${id} lỗi ${e.status || e.name} → thử model khác`)
    }
  }
  throw loiCuoi || new GeminiLoi(429, 'Các model Groq đang hết lượt', 'Groq', 30)
}

// Groq chỉ 8.000 token/phút → bớt tri thức truy xuất (4 mẩu, mỗi mẩu ≤ 700 ký tự)
function rutGonNguCanh({ khoNoiBo = '', triThuc = [] } = {}) {
  return {
    khoNoiBo: khoNoiBo.slice(0, 3000),
    triThuc: triThuc.slice(0, 4).map((t) => ({ ...t, noiDung: t.noiDung.slice(0, 700) })),
  }
}

// ============================================================
//  SYSTEM PROMPT — Chuyên gia Kỹ thuật Chống thấm & VLXD
// ============================================================
export function systemPrompt({ khoNoiBo = '', triThuc = [] } = {}) {
  const dinhChinh = triThuc.filter((t) => t.loai === 'sua_sai')
  const thamKhao = triThuc.filter((t) => t.loai !== 'sua_sai')

  return `Bạn là Maika — CHUYÊN GIA KỸ THUẬT CHỐNG THẤM & VẬT LIỆU XÂY DỰNG của Vật Liệu Nhà. Bạn là trợ lý nội bộ cho đội ngũ kinh doanh.

NGUYÊN TẮC TRẢ LỜI:
- Tiếng Việt, thông mượt, chính xác, đi thẳng vấn đề; dùng gạch đầu dòng + số liệu (định mức, tỷ lệ pha, độ ẩm, nhiệt độ, thời gian khô) khi phù hợp.
- Thứ tự ưu tiên nguồn: (1) ĐÍNH CHÍNH TỪ ADMIN → (2) TRI THỨC NỘI BỘ / WEBSITE vatlieunha.vn → (3) kiến thức chuyên môn của bạn.
- KHÔNG CÓ DỮ LIỆU THÌ NÓI DỨT KHOÁT: câu hỏi về một SẢN PHẨM / THƯƠNG HIỆU / MÃ HÀNG / chủ đề cụ thể mà KHÔNG xuất hiện trong đính chính, tri thức truy xuất hay kho sản phẩm nội bộ bên dưới (vd "Luân lotus") → chỉ trả lời: "Maika chưa có dữ liệu về vấn đề này." (có thể thêm 1 câu xin tên đầy đủ, ảnh bao bì hoặc tài liệu). TUYỆT ĐỐI không đoán, không giới thiệu sản phẩm khác thay thế, không kể lan man.
- Câu hỏi kỹ thuật chung (nguyên nhân thấm/nứt, quy trình thi công, xử lý bề mặt, phân tích ảnh hiện trường) → được dùng kiến thức chuyên môn để trả lời.
- Tri thức truy xuất chỉ là "có thể liên quan" — mẩu nào không đúng chủ đề câu hỏi thì BỎ QUA, không nhắc tới.
- KHÔNG chèn đường link, URL, danh sách nguồn hay tên tệp tài liệu vào câu trả lời. Chỉ khi người dùng yêu cầu "cung cấp tài liệu chi tiết" / xin link / xin TDS thì mới nói tài liệu có ở mục "Tài liệu" bên dưới câu trả lời.
- Thiếu dữ kiện quan trọng (bề mặt, độ ẩm, trong/ngoài trời, hạng mục, diện tích, ngân sách) → HỎI LẠI ngắn gọn trước khi chốt phương án.
- Khi tư vấn giải pháp: nêu (1) chẩn đoán/giải pháp, (2) sản phẩm phù hợp + định mức, (3) tỷ lệ pha & trình tự thi công, (4) ⚠️ cảnh báo bắt buộc (vd: CẤM lăn PU khi sàn ẩm > 8%).
- Khi người dùng GỬI ẢNH: mô tả ngắn điều thấy được (loại hư hỏng, vị trí, mức độ — vd nứt chân chim / nứt kết cấu, thấm, bong tróc, nấm mốc), chẩn đoán nguyên nhân khả dĩ, rồi đề xuất giải pháp thi công + vật liệu. Ảnh không đủ rõ → nói rõ cần chụp thêm góc nào.
- Khi người dùng chỉnh lại ("tôi hỏi X chứ không phải Y") → hiểu ngữ cảnh và sửa ngay.
- Khi xưng danh với khách, chỉ dùng thương hiệu "Vật Liệu Nhà".
${
  dinhChinh.length
    ? `
ĐÍNH CHÍNH TỪ ADMIN (ưu tiên TUYỆT ĐỐI — đây là các lỗi bạn từng trả lời sai, phải dùng nội dung đúng dưới đây):
${dinhChinh.map((t, i) => `[Đ${i + 1}] ${t.noiDung}`).join('\n\n')}
`
    : ''
}${
  thamKhao.length
    ? `
TRI THỨC TRUY XUẤT TỪ BỘ NHỚ (liên quan nhất tới câu hỏi):
${thamKhao.map((t, i) => `[T${i + 1}] ${t.tieuDe}\n${t.noiDung}`).join('\n\n')}
`
    : ''
}
KHO SẢN PHẨM NỘI BỘ:
${khoNoiBo}`
}

// Lịch sử [{tu:'user'|'maika', text, anh?: {mime, base64}, coAnh?}] → contents của Gemini.
// Chỉ tin nhắn đang hỏi mới mang dữ liệu ảnh (anh); ảnh cũ chỉ ghi chú "(đã gửi ảnh)" cho đỡ tốn quota.
function toContents(lichSu) {
  const contents = (lichSu || [])
    .filter((m) => m.text || m.anh)
    .map((m) => {
      const text = (m.coAnh && !m.anh ? '(Người dùng đã gửi 1 ảnh ở tin nhắn này) ' : '') + (m.text || 'Phân tích ảnh này giúp tôi.')
      const parts = m.anh ? [{ inline_data: { mime_type: m.anh.mime, data: m.anh.base64 } }, { text }] : [{ text }]
      return { role: m.tu === 'user' ? 'user' : 'model', parts }
    })
  while (contents.length && contents[0].role !== 'user') contents.shift()
  return contents
}

// ============================================================
//  GIỌNG NÓI → CHỮ: Groq Whisper (free, nhanh) → dự phòng Gemini (hiểu âm thanh)
// ============================================================
export async function chuyenGiongNoi(blob) {
  let loiCuoi
  if (GROQ_KEY) {
    try {
      const fd = new FormData()
      const duoi = (blob.type.split('/')[1] || 'webm').split(';')[0]
      fd.append('file', blob, `ghi-am.${duoi === 'mp4' ? 'm4a' : duoi}`)
      fd.append('model', 'whisper-large-v3-turbo')
      fd.append('language', 'vi')
      fd.append('response_format', 'json')
      // Groq cho phép CORS → fetch chạy được cả trên .exe lẫn WebView Android
      const res = await fetch(GROQ_STT_URL, { method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: fd, signal: AbortSignal.timeout?.(45000) })
      if (!res.ok) throw new GeminiLoi(res.status, await res.text().catch(() => ''), 'Groq Whisper')
      const text = ((await res.json()).text || '').trim()
      if (text) return text
    } catch (e) {
      loiCuoi = e
      console.warn('[Maika] Whisper lỗi → thử Gemini:', e.message)
    }
  }
  if (API_KEY) {
    return sinhNoiDung({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: (blob.type || 'audio/webm').split(';')[0], data: await blobSangBase64(blob) } },
            { text: 'Chép lại NGUYÊN VĂN lời nói tiếng Việt trong đoạn ghi âm. Chỉ trả về lời thoại, không thêm gì khác.' },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    })
  }
  throw loiCuoi || new Error('Chưa cấu hình dịch vụ chuyển giọng nói (VITE_GROQ_API_KEY / VITE_GEMINI_API_KEY)')
}

// Chat: gửi TOÀN BỘ lịch sử + system prompt (đã nhúng tri thức RAG). Theo kiến trúc Maika 2.0:
//  - Câu hỏi chữ: Groq chính (~1.000 câu/ngày/model) → Gemini dự phòng
//  - Câu hỏi có ảnh: Gemini chính (đọc ảnh tốt nhất) → Groq qwen dự phòng
//  → dành ~100 lượt Gemini free/ngày cho phân tích ảnh hiện trường.
// Trả về { text, nhaCungCap: 'gemini' | 'groq' }
export async function geminiChat(lichSu, nguCanh) {
  const coAnh = (lichSu || []).some((m) => m.anh)
  const quaGemini = async () => ({
    text: await sinhNoiDung({
      systemInstruction: { parts: [{ text: systemPrompt(nguCanh) }] },
      contents: toContents(lichSu),
      // Model Flash mới "suy nghĩ" trước khi trả lời → chừa đủ token
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    }),
    nhaCungCap: 'gemini',
  })
  const quaGroq = async () => ({ text: await groqChat(systemPrompt(rutGonNguCanh(nguCanh)), lichSu), nhaCungCap: 'groq' })

  const thuTu = [
    ...(coAnh ? [API_KEY && quaGemini, GROQ_KEY && quaGroq] : [GROQ_KEY && quaGroq, API_KEY && quaGemini]),
  ].filter(Boolean)
  let loiCuoi
  for (const thu of thuTu) {
    try {
      return await thu()
    } catch (e) {
      loiCuoi = e // kể cả key bị thu hồi (400/403) → vẫn còn nhà cung cấp kia đỡ
      console.warn('[Maika] Nhà cung cấp AI lỗi → thử nguồn còn lại:', e.message)
    }
  }
  throw loiCuoi || new Error('Chưa cấu hình AI')
}

// Gọi AI 1 lượt ngắn (không RAG) — dùng cho trợ lý chủ động: tách việc từ câu nói, soạn tin follow-up.
// json: true → yêu cầu trả JSON. Groq trước (rẻ lượt), Gemini dự phòng.
export async function aiNhanh(system, cauHoi, { json = false } = {}) {
  const lich = [{ tu: 'user', text: cauHoi }]
  const thuTu = [
    GROQ_KEY &&
      (async () => {
        const messages = sangMessagesGroq(system, lich)
        for (const { id, them } of GROQ_MODELS.filter((m) => !m.docAnh)) {
          const khoa = 'groq:' + id
          if ((_hetQuotaDen.get(khoa) || 0) > Date.now()) continue
          try {
            const data = await goiGroq({ model: id, messages, temperature: 0.2, max_tokens: 1024, ...them, ...(json ? { response_format: { type: 'json_object' } } : {}) })
            const text = (data?.choices?.[0]?.message?.content || '').trim()
            if (text) return text
          } catch (e) {
            if (e.status === 429) _hetQuotaDen.set(khoa, Date.now() + Math.max(e.choGiay, 10) * 1000)
            if (!NEN_DOI_MODEL(e)) throw e
          }
        }
        throw new Error('Groq không phản hồi')
      }),
    API_KEY &&
      (() =>
        sinhNoiDung({
          systemInstruction: { parts: [{ text: system }] },
          contents: toContents(lich),
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096, ...(json ? { responseMimeType: 'application/json' } : {}) },
        })),
  ].filter(Boolean)
  let loiCuoi
  for (const thu of thuTu) {
    try {
      return await thu()
    } catch (e) {
      loiCuoi = e
    }
  }
  throw loiCuoi || new Error('Chưa cấu hình AI')
}

// ============================================================
//  EMBEDDING — vector hoá văn bản (tối đa 100 đoạn / lần gọi)
//  taskType: RETRIEVAL_DOCUMENT (khi nạp) | RETRIEVAL_QUERY (khi hỏi)
// ============================================================
function chuanHoa(arr) {
  const v = Float32Array.from(arr)
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  n = Math.sqrt(n) || 1
  for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

export async function nhungVector(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const kq = []
  for (let i = 0; i < texts.length; i += 100) {
    const lo = texts.slice(i, i + 100)
    const data = await goi(`models/${EMBED_MODEL}:batchEmbedContents`, {
      requests: lo.map((t) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: t.slice(0, 8000) }] },
        taskType,
        outputDimensionality: SO_CHIEU_VECTOR,
      })),
    })
    ;(data.embeddings || []).forEach((e) => kq.push(chuanHoa(e.values)))
  }
  return kq
}

// ============================================================
//  PHÂN TÍCH TÀI LIỆU (AI Admin) — text + file (PDF/ảnh/audio/video ≤ 14MB)
//  → { tieuDe, tomTat, cacY[], tags[], sanPhamLienQuan[], doTinCay }
// ============================================================
const SCHEMA_PHAN_TICH = {
  type: 'OBJECT',
  properties: {
    tieuDe: { type: 'STRING', description: 'Tiêu đề ngắn của mẩu tri thức' },
    tomTat: { type: 'STRING', description: 'Tóm tắt 1-2 câu' },
    cacY: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Các ý kiến thức kỹ thuật rời, có số liệu cụ thể' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    sanPhamLienQuan: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tên sản phẩm/thương hiệu được nhắc tới' },
    doTinCay: { type: 'INTEGER', description: '0-100: mức chắc chắn nội dung là kiến thức kỹ thuật đúng, rõ nguồn' },
  },
  required: ['tieuDe', 'tomTat', 'cacY', 'tags', 'sanPhamLienQuan', 'doTinCay'],
}

export const GIOI_HAN_FILE_MB = 14

export async function phanTichTaiLieu({ text = '', file = null }) {
  const parts = []
  if (file) parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } })
  parts.push({
    text: `Phân tích nội dung ${file ? `tệp "${file.ten}" và ` : ''}ghi chú dưới đây, trích xuất KIẾN THỨC KỸ THUẬT (chống thấm, vật liệu xây dựng, nội thất) để nạp vào bộ nhớ của trợ lý Maika. Giữ nguyên số liệu, đơn vị, điều kiện thi công, cảnh báo. Bỏ phần quảng cáo/giá bán.\n\nGhi chú của Admin:\n${text || '(không có)'}`,
  })
  const raw = await sinhNoiDung({
    systemInstruction: { parts: [{ text: 'Bạn là kỹ sư vật liệu xây dựng của Vật Liệu Nhà, chuyên biên tập tri thức kỹ thuật chính xác. Trả lời bằng tiếng Việt, đúng schema JSON.' }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA_PHAN_TICH },
  })
  return JSON.parse(raw)
}

// File (input type=file) → { ten, mimeType, base64 } để gửi kèm Gemini
export function docFileBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > GIOI_HAN_FILE_MB * 1024 * 1024) {
      return reject(new Error(`Tệp quá lớn (tối đa ${GIOI_HAN_FILE_MB}MB)`))
    }
    const r = new FileReader()
    r.onload = () => resolve({ ten: file.name, mimeType: file.type || 'application/octet-stream', base64: String(r.result).split(',')[1] })
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
