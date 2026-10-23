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
import { layText, laYouTube, trichTrang } from './taiWeb'
// Bộ não chung với Maika trên web (lời dặn, model, cách ghép lịch sử) — sửa ở file này cho cả 2 nơi
import {
  GEMINI_MODELS, gonLichSu, GROQ_MODELS, NHIET_DO, rutGonNguCanh, sangMessagesGroq, SO_CHIEU_VECTOR, systemPrompt, tachDanhDau, toContents,
} from '../../supabase/functions/_shared/maikaNao.js'

export { SO_CHIEU_VECTOR, systemPrompt }

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
// Multimodal (ảnh hiện trường, âm thanh dự phòng, tài liệu) — Gemini Flash: đọc ảnh tốt & nhanh
const MODEL_MULTIMODAL = import.meta.env.VITE_GEMINI_MULTIMODAL_MODEL || 'gemini-flash-latest'
const EMBED_MODEL = import.meta.env.VITE_GEMINI_EMBED_MODEL || 'gemini-embedding-001'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Model dự phòng Gemini & danh sách model Groq: xem _shared/maikaNao.js (dùng chung với web)
const MODEL_DU_PHONG = GEMINI_MODELS

// Groq (OpenAI-compatible) — brain chính cho chat chữ. Mỗi model ~1.000 câu/ngày,
// nhưng chỉ 8.000 token/phút → gửi prompt rút gọn.
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
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

async function goi(duongDan, body, timeoutMs = 30000) {
  const url = `${BASE}/${duongDan}`
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY }
  if (laNative()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({ url, headers, data: body, connectTimeout: Math.min(15000, timeoutMs), readTimeout: timeoutMs })
    if (res.status >= 400) throw new GeminiLoi(res.status, JSON.stringify(res.data))
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  }
  // Google đôi khi treo request → quá hạn thì bỏ, chuyển model khác (WebView Android cũ không có timeout())
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout?.(timeoutMs) })
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
async function sinhNoiDung(body, modelDau = MODEL, timeoutMs = 30000) {
  const thuTu = [...new Set([modelDau, ...MODEL_DU_PHONG])]
  let loiCuoi
  for (let vong = 0; vong < 2; vong++) {
    if (vong > 0) await ngu(2000) // mọi model đều quá tải → đợi rồi thử thêm 1 vòng
    const conDung = thuTu.filter((x) => !_modelDaGo.has(x) && !((_hetQuotaDen.get(x) || 0) > Date.now()))
    for (const m of conDung) {
      try {
        const data = await goi(`models/${m}:generateContent`, body, timeoutMs)
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
  // Groq thường trả < 3s; treo quá 25s thì chuyển model/nhà cung cấp khác cho kịp mục tiêu phản hồi nhanh
  const res = await fetch(GROQ_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout?.(25000) })
  if (!res.ok) throw new GeminiLoi(res.status, await res.text().catch(() => ''), 'Groq', Number(res.headers.get('retry-after')) || 0)
  return res.json()
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
      const data = await goiGroq({ model: id, messages, temperature: NHIET_DO, max_tokens: 2048, ...them })
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

// System prompt, toContents, sangMessagesGroq, rutGonNguCanh: xem _shared/maikaNao.js (chung với web)

// ============================================================
//  GIỌNG NÓI → CHỮ: Groq Whisper (free, nhanh) → dự phòng Gemini (hiểu âm thanh)
// ============================================================
// File thoại tải từ Zalo/điện thoại hay có type rỗng → suy ra từ đuôi tệp
const MIME_AM_THANH = { m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac', amr: 'audio/amr' }

export async function chuyenGiongNoi(blob) {
  let loiCuoi
  const duoiTen = (blob.name || '').split('.').pop().toLowerCase()
  const mime = (blob.type || MIME_AM_THANH[duoiTen] || 'audio/webm').split(';')[0]
  if (GROQ_KEY) {
    try {
      const fd = new FormData()
      const duoi = MIME_AM_THANH[duoiTen] ? duoiTen : mime.split('/')[1]
      fd.append('file', blob, `ghi-am.${duoi === 'mp4' ? 'm4a' : duoi === 'mpeg' ? 'mp3' : duoi}`)
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
            { inline_data: { mime_type: mime, data: await blobSangBase64(blob) } },
            { text: 'Chép lại NGUYÊN VĂN lời nói tiếng Việt trong đoạn ghi âm. Chỉ trả về lời thoại, không thêm gì khác.' },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }, MODEL_MULTIMODAL)
  }
  throw loiCuoi || new Error('Chưa cấu hình dịch vụ chuyển giọng nói (VITE_GROQ_API_KEY / VITE_GEMINI_API_KEY)')
}

// Chat: gửi TOÀN BỘ lịch sử + system prompt (đã nhúng tri thức RAG). Theo kiến trúc Maika 2.0:
//  - Câu hỏi chữ: Groq chính (~1.000 câu/ngày/model) → Gemini dự phòng
//  - Câu hỏi có ảnh: Gemini chính (đọc ảnh tốt nhất) → Groq qwen dự phòng
//  → dành ~100 lượt Gemini free/ngày cho phân tích ảnh hiện trường.
// Trả về { text, nhaCungCap: 'gemini' | 'groq' }
//
// MÁY CHỦ CHUNG (Supabase Edge Function "maika") — cùng bộ não với Maika trên vatlieunha.vn:
// có cấu hình VITE_SUPABASE_URL thì hỏi qua máy chủ trước (key AI nằm trên máy chủ);
// máy chủ lỗi / mất kết nối → gọi thẳng Groq/Gemini bằng key trong app như cũ.
const URL_MAIKA = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/maika'
const KEY_PUBLIC = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function mayChuMaikaCoCauHinh() {
  return !!(import.meta.env.VITE_SUPABASE_URL && KEY_PUBLIC)
}

async function hoiMayChu(lichSu, nguCanh) {
  // Chỉ tin nhắn cuối giữ ảnh; 30 tin (15 lượt) gần nhất để Maika nhớ chủ đề đang nói
  const gon = gonLichSu(lichSu).map((m, i, a) => ({ tu: m.tu, text: m.text || '', coAnh: !!(m.coAnh || m.anh), ...(i === a.length - 1 && m.anh ? { anh: m.anh } : {}) }))
  const body = { cheDo: 'noi-bo', lichSu: gon, khoNoiBo: nguCanh?.khoNoiBo || '', triThuc: (nguCanh?.triThuc || []).map(({ loai, tieuDe, noiDung, nguon }) => ({ loai, tieuDe, noiDung, nguon })) }
  const headers = { 'Content-Type': 'application/json', apikey: KEY_PUBLIC, Authorization: `Bearer ${KEY_PUBLIC}` }
  let status, data
  if (laNative()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({ url: URL_MAIKA, headers, data: body, connectTimeout: 10000, readTimeout: 45000 })
    status = res.status
    data = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data
  } else {
    const res = await fetch(URL_MAIKA, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout?.(45000) })
    status = res.status
    data = await res.json().catch(() => ({}))
  }
  if (status >= 400 || !data?.text) throw new GeminiLoi(status || 500, data?.loi || 'Máy chủ Maika không trả nội dung', 'Máy chủ Maika', data?.choGiay)
  return { text: data.text, nhaCungCap: data.nhaCungCap || 'may-chu', kienThucChung: !!data.kienThucChung }
}

export async function geminiChat(lichSuDayDu, nguCanh) {
  const lichSu = gonLichSu(lichSuDayDu)
  if (mayChuMaikaCoCauHinh()) {
    try {
      return await hoiMayChu(lichSu, nguCanh)
    } catch (e) {
      // Hết lượt trong ngày ở máy chủ thì key trong app cũng là cùng key → báo luôn, khỏi gọi lại
      if (e.status === 429 || !aiCoCauHinh()) throw e
      console.warn('[Maika] Máy chủ chung lỗi → gọi AI trực tiếp:', e.message)
    }
  }
  const coAnh = (lichSu || []).some((m) => m.anh)
  const quaGemini = async () => ({
    text: await sinhNoiDung({
      systemInstruction: { parts: [{ text: systemPrompt(nguCanh) }] },
      contents: toContents(lichSu),
      // Model Flash mới "suy nghĩ" trước khi trả lời → chừa đủ token
      generationConfig: { temperature: NHIET_DO, maxOutputTokens: 8192 },
    }, coAnh ? MODEL_MULTIMODAL : MODEL),
    nhaCungCap: 'gemini',
  })
  const quaGroq = async () => ({ text: await groqChat(systemPrompt(rutGonNguCanh(nguCanh)), lichSu), nhaCungCap: 'groq' })

  const thuTu = [
    ...(coAnh ? [API_KEY && quaGemini, GROQ_KEY && quaGroq] : [GROQ_KEY && quaGroq, API_KEY && quaGemini]),
  ].filter(Boolean)
  let loiCuoi
  for (const thu of thuTu) {
    try {
      const kq = await thu()
      const { text, kienThucChung } = tachDanhDau(kq.text) // ẩn dấu [[KIEN_THUC_CHUNG]]
      return { ...kq, text, kienThucChung }
    } catch (e) {
      loiCuoi = e // kể cả key bị thu hồi (400/403) → vẫn còn nhà cung cấp kia đỡ
      console.warn('[Maika] Nhà cung cấp AI lỗi → thử nguồn còn lại:', e.message)
    }
  }
  throw loiCuoi || new Error('Chưa cấu hình AI')
}

// Gọi AI 1 lượt ngắn (không RAG) — dùng cho trợ lý chủ động: tách việc từ câu nói, soạn tin follow-up.
// json: true → yêu cầu trả JSON. Groq trước (rẻ lượt), Gemini dự phòng.
export async function aiNhanh(system, cauHoi, { json = false, maxTokens = 1024 } = {}) {
  const lich = [{ tu: 'user', text: cauHoi }]
  const thuTu = [
    GROQ_KEY &&
      (async () => {
        const messages = sangMessagesGroq(system, lich)
        for (const { id, them } of GROQ_MODELS.filter((m) => !m.docAnh)) {
          const khoa = 'groq:' + id
          if ((_hetQuotaDen.get(khoa) || 0) > Date.now()) continue
          try {
            const data = await goiGroq({ model: id, messages, temperature: 0.2, max_tokens: maxTokens, ...them, ...(json ? { response_format: { type: 'json_object' } } : {}) })
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

// timeoutMs: truy vấn khi chat nên ngắn (vd 4s) — chậm thì bỏ vector, dùng từ khoá cho kịp trả lời
export async function nhungVector(texts, taskType = 'RETRIEVAL_DOCUMENT', { timeoutMs = 30000 } = {}) {
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
    }, timeoutMs)
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

export const GIOI_HAN_FILE_MB = 14 // gửi kèm trực tiếp (inline) — nhanh
export const GIOI_HAN_TAI_LEN_MB = 200 // lớn hơn 14MB → tải lên Gemini Files API (video dài, PDF dày)

const HE_THONG_BIEN_TAP = 'Bạn là kỹ sư vật liệu xây dựng của Vật Liệu Nhà, chuyên biên tập tri thức kỹ thuật chính xác. Trả lời bằng tiếng Việt, đúng schema JSON.'

// Với link: ngoài ý kỹ thuật, Maika "suy ngẫm" — rút ý áp dụng cho tư vấn/bán hàng (có cơ sở từ nội dung)
const SUY_NGAM = ' Sau các ý kỹ thuật, thêm 1–3 ý bắt đầu bằng "Áp dụng cho Vật Liệu Nhà:" (gợi ý tư vấn, bán kèm, cảnh báo cho khách) — CHỈ khi nội dung có cơ sở, không suy diễn quá đà.'

function yeuCauTrichXuat(text, file, { link = false } = {}) {
  const loai = file?.youtube
    ? `video YouTube ${file.ten} (xem cả hình ảnh lẫn lời nói: thao tác thi công, thứ tự bước, dụng cụ, vật liệu, lỗi thường gặp)`
    : file?.mimeType?.startsWith('video/')
    ? `video "${file.ten}" (xem cả hình ảnh lẫn lời nói: thao tác thi công, thứ tự bước, dụng cụ, vật liệu, lỗi thường gặp)`
    : file?.mimeType?.startsWith('image/')
      ? `ảnh "${file.ten}" (đọc chữ trên bao bì/nhãn/bảng thông số; mô tả hiện trạng, hư hỏng nếu là ảnh công trình)`
      : file?.mimeType?.startsWith('audio/')
        ? `ghi âm "${file.ten}" (nghe và chép lại ý kỹ thuật)`
        : file
          ? `tệp "${file.ten}"`
          : ''
  return `Phân tích nội dung ${loai ? loai + ' và ' : ''}ghi chú dưới đây, trích xuất KIẾN THỨC KỸ THUẬT (chống thấm, vật liệu xây dựng, nội thất, kinh nghiệm bán hàng) để nạp vào bộ nhớ của trợ lý Maika. Giữ nguyên số liệu, đơn vị, điều kiện thi công, cảnh báo. Bỏ phần quảng cáo/giá bán. Ghi chú có thể là lời nói chép lại (văn nói, thiếu dấu câu) — hãy hiểu ý và viết lại gọn gàng, KHÔNG bịa thêm số liệu.${link || file?.youtube ? SUY_NGAM : ''}\n\n${link ? 'Nội dung trang web' : 'Ghi chú của Admin'}:\n${text || '(không có)'}`
}

const MO_TA_JSON = 'Trả về DUY NHẤT JSON: {"tieuDe": "tiêu đề ngắn", "tomTat": "1-2 câu", "cacY": ["ý kỹ thuật rời, có số liệu cụ thể"], "tags": ["từ khoá"], "sanPhamLienQuan": ["tên sản phẩm/thương hiệu"], "doTinCay": 0-100}'
const docJSON = (raw) => JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))

// Đảm bảo đủ trường dù model trả thiếu (Groq không có responseSchema như Gemini)
function chuanHoaPhanTich(j) {
  const mang = (x) => (Array.isArray(x) ? x.map(String).filter(Boolean) : [])
  return {
    tieuDe: String(j.tieuDe || 'Tri thức mới').slice(0, 150),
    tomTat: String(j.tomTat || ''),
    cacY: mang(j.cacY),
    tags: mang(j.tags),
    sanPhamLienQuan: mang(j.sanPhamLienQuan),
    doTinCay: Math.max(0, Math.min(100, Number(j.doTinCay) || 0)),
  }
}

// file: { ten, mimeType, base64 } (inline ≤ 14MB) | { ten, mimeType, uri } (đã tải lên Files API)
export async function phanTichTaiLieu({ text = '', file = null, link = false }) {
  // Chỉ có chữ → Groq (brain chính, nhiều lượt free) trước; Gemini dự phòng
  if (!file && GROQ_KEY) {
    try {
      const raw = await aiNhanh(`${HE_THONG_BIEN_TAP}\n${MO_TA_JSON}`, yeuCauTrichXuat(text, null, { link }), { json: true, maxTokens: 3000 })
      return chuanHoaPhanTich(docJSON(raw))
    } catch (e) {
      if (!API_KEY) throw e
      console.warn('[Maika] Groq phân tích chữ lỗi → Gemini:', e.message)
    }
  }
  if (!API_KEY) throw new Error(file ? 'Phân tích ảnh/video/tệp cần VITE_GEMINI_API_KEY' : 'Chưa cấu hình AI')
  const parts = []
  if (file?.uri) parts.push({ file_data: { ...(file.mimeType ? { mime_type: file.mimeType } : {}), file_uri: file.uri } })
  else if (file) parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } })
  parts.push({ text: yeuCauTrichXuat(text, file, { link }) })
  const raw = await sinhNoiDung(
    {
      systemInstruction: { parts: [{ text: HE_THONG_BIEN_TAP }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA_PHAN_TICH },
    },
    file ? MODEL_MULTIMODAL : MODEL,
    file?.mimeType?.startsWith('video/') || file?.uri ? 180000 : 60000, // video: Gemini cần xem hết → chờ lâu hơn
  )
  return chuanHoaPhanTich(JSON.parse(raw))
}

// ============================================================
//  DẠY MAIKA BẰNG LINK — Maika vào đọc trang rồi "suy ngẫm"
//  1) YouTube → Gemini xem thẳng video (không tải về máy)
//  2) Trang thường → app tự tải & bóc nội dung → Groq trích tri thức (nhanh, nhiều lượt)
//  3) Trang cần JavaScript/đăng nhập, bóc không ra chữ → Gemini tự vào đọc (url_context)
//  Trả về { ...tri thức, tieuDeTrang, cach: 'youtube'|'doc'|'gemini' }
// ============================================================
export async function phanTichLink(url, ghiChu = '', onTienDo = () => {}) {
  if (laYouTube(url)) {
    onTienDo('Gemini đang xem video YouTube… (video dài có thể mất 1–2 phút)')
    return { ...(await phanTichTaiLieu({ text: ghiChu, file: { ten: url, uri: url, youtube: true } })), cach: 'youtube' }
  }
  let trang = null
  try {
    onTienDo('Maika đang mở trang…')
    trang = trichTrang(await layText(url))
  } catch (e) {
    console.warn('[Maika] Không tự tải được trang → nhờ Gemini đọc:', e.message)
  }
  if (trang && trang.noiDung.length >= 300) {
    onTienDo('Maika đang đọc & suy ngẫm…')
    const text = `Tiêu đề trang: ${trang.tieuDe || '(không rõ)'}\nLink: ${url}\n${ghiChu ? `Ghi chú của Admin: ${ghiChu}\n` : ''}\n${trang.noiDung.slice(0, 9000)}`
    return { ...(await phanTichTaiLieu({ text, link: true })), tieuDeTrang: trang.tieuDe, cach: 'doc' }
  }
  if (!API_KEY) throw new Error('Trang này không đọc trực tiếp được (cần đăng nhập/JavaScript) — dán nội dung chữ hoặc chụp ảnh màn hình thay thế')
  onTienDo('Trang khó đọc — đang nhờ Gemini vào xem…')
  const raw = await sinhNoiDung(
    {
      systemInstruction: { parts: [{ text: HE_THONG_BIEN_TAP }] },
      contents: [{ role: 'user', parts: [{ text: `${yeuCauTrichXuat(ghiChu, null, { link: true })}\n\nHãy đọc trang: ${url}\nNếu không truy cập được trang, trả về JSON với "doTinCay": 0 và "tomTat" nêu lý do.\n${MO_TA_JSON}` }] }],
      tools: [{ url_context: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    },
    MODEL,
    90000,
  )
  const kq = chuanHoaPhanTich(docJSON(raw))
  if (!kq.cacY.length || kq.doTinCay === 0) throw new Error(`Không đọc được trang: ${kq.tomTat || 'trang yêu cầu đăng nhập hoặc chặn bot'}. Dán nội dung chữ hoặc chụp ảnh màn hình thay thế.`)
  return { ...kq, cach: 'gemini' }
}

// ============================================================
//  TẢI TỆP LỚN LÊN GEMINI FILES API (video dài, PDF dày ≤ 200MB, lưu 48 giờ phía Google)
//  Resumable upload: start → upload+finalize → chờ xử lý xong (video cần vài chục giây)
// ============================================================
const MIME_TEP = { pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', txt: 'text/plain' }

export async function taiLenGemini(blob, ten, onTienDo = () => {}) {
  if (!API_KEY) throw new Error('Chưa cấu hình VITE_GEMINI_API_KEY')
  // Tệp từ Zalo/điện thoại hay có type rỗng → suy từ đuôi tệp (Gemini từ chối application/octet-stream)
  const duoi = (blob.name || ten || '').split('.').pop().toLowerCase()
  const mime = blob.type || MIME_AM_THANH[duoi] || MIME_TEP[duoi] || 'application/octet-stream'
  onTienDo('Đang tải tệp lên Gemini…')
  const batDau = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: ten.slice(0, 100) } }),
  })
  const urlTai = batDau.headers.get('x-goog-upload-url')
  if (!batDau.ok || !urlTai) throw new GeminiLoi(batDau.status || 500, (await batDau.text().catch(() => '')) || 'Không mở được phiên tải lên')
  const tai = await fetch(urlTai, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: blob,
  })
  if (!tai.ok) throw new GeminiLoi(tai.status, await tai.text().catch(() => ''))
  let { file } = await tai.json()
  // Video phải ở trạng thái ACTIVE mới phân tích được
  for (let i = 0; file.state === 'PROCESSING' && i < 90; i++) {
    onTienDo(`Gemini đang xử lý ${mime.startsWith('video/') ? 'video' : 'tệp'}… ${i * 2}s`)
    await ngu(2000)
    const r = await fetch(`${BASE}/${file.name}`, { headers: { 'x-goog-api-key': API_KEY } })
    if (r.ok) file = await r.json()
  }
  if (file.state !== 'ACTIVE') throw new Error(`Gemini chưa xử lý xong tệp (trạng thái ${file.state || '?'}) — thử lại sau ít phút`)
  return { ten, mimeType: file.mimeType || mime, uri: file.uri }
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
