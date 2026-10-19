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

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
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
const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', them: { reasoning_effort: 'low' } },
  { id: 'qwen/qwen3.8-27b', them: { reasoning_format: 'hidden' } },
  { id: 'openai/gpt-oss-20b', them: { reasoning_effort: 'low' } },
]

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

async function groqChat(system, lichSu) {
  const messages = [
    { role: 'system', content: system },
    ...toContents(lichSu).map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts[0].text })),
  ]
  let loiCuoi
  for (const { id, them } of GROQ_MODELS) {
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

  return `Bạn là Maika — CHUYÊN GIA KỸ THUẬT CHỐNG THẤM & VẬT LIỆU XÂY DỰNG của Vật Liệu Nhà (thuộc Khôi Anh Home Center). Bạn là trợ lý nội bộ cho đội ngũ kinh doanh.

NGUYÊN TẮC TRẢ LỜI:
- Tiếng Việt, thông mượt, chính xác, đi thẳng vấn đề; dùng gạch đầu dòng + số liệu (định mức, tỷ lệ pha, độ ẩm, nhiệt độ, thời gian khô) khi phù hợp.
- Thứ tự ưu tiên nguồn: (1) ĐÍNH CHÍNH TỪ ADMIN → (2) TRI THỨC NỘI BỘ / WEBSITE vatlieunha.vn → (3) kiến thức chuyên môn của bạn (Gemini).
- Thiếu dữ kiện quan trọng (bề mặt, độ ẩm, trong/ngoài trời, hạng mục, diện tích, ngân sách) → HỎI LẠI ngắn gọn trước khi chốt phương án.
- Khi tư vấn giải pháp: nêu (1) chẩn đoán/giải pháp, (2) sản phẩm phù hợp + định mức, (3) tỷ lệ pha & trình tự thi công, (4) ⚠️ cảnh báo bắt buộc (vd: CẤM lăn PU khi sàn ẩm > 8%).
- TRẢ LỜI ĐÚNG SẢN PHẨM KHÁCH HỎI. Sản phẩm chưa có trong tri thức nội bộ → dùng kiến thức thực tế về CHÍNH sản phẩm/thương hiệu đó; TUYỆT ĐỐI không lái sang sản phẩm khác. Không chắc → nói thẳng là chưa đủ dữ liệu, không bịa.
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

// Lịch sử [{tu:'user'|'maika', text}] → contents của Gemini (bắt đầu bằng lượt user)
function toContents(lichSu) {
  const contents = (lichSu || [])
    .filter((m) => m.text)
    .map((m) => ({ role: m.tu === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))
  while (contents.length && contents[0].role !== 'user') contents.shift()
  return contents
}

// Chat: gửi TOÀN BỘ lịch sử + system prompt (đã nhúng tri thức RAG)
// Gemini trước (tiếng Việt tốt nhất) → hết lượt/lỗi tạm thời thì Groq.
// Trả về { text, nhaCungCap: 'gemini' | 'groq' }
export async function geminiChat(lichSu, nguCanh) {
  if (API_KEY) {
    try {
      const text = await sinhNoiDung({
        systemInstruction: { parts: [{ text: systemPrompt(nguCanh) }] },
        contents: toContents(lichSu),
        // Model Flash mới "suy nghĩ" trước khi trả lời → chừa đủ token
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      })
      return { text, nhaCungCap: 'gemini' }
    } catch (e) {
      if (!GROQ_KEY) throw e // kể cả key Gemini bị thu hồi (400/403) → vẫn còn Groq đỡ
      console.warn('[Maika] Gemini không dùng được → chuyển sang Groq:', e.message)
    }
  }
  return { text: await groqChat(systemPrompt(rutGonNguCanh(nguCanh)), lichSu), nhaCungCap: 'groq' }
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
