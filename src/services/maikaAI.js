// ============================================================
//  MAIKA AI — kết nối Claude API (Anthropic SDK)
//  - Ưu tiên gọi qua PROXY (an toàn, không lộ API key).
//  - Hoặc gọi trực tiếp từ trình duyệt (dangerouslyAllowBrowser) — CHỈ cho
//    môi trường nội bộ/thử nghiệm, vì key sẽ bị lộ trong bundle.
//  - Không có key/proxy → tự động dùng engine offline (maika.js).
//
//  ⚠️ BẢO MẬT: Ứng dụng này chạy ở client (web/Electron/Capacitor). API key
//  nhúng vào client LUÔN có thể bị trích xuất. Khuyến nghị dùng PROXY server
//  giữ key (xem server/maika-proxy.example.mjs). Chỉ bật đường trực tiếp khi
//  chấp nhận rủi ro cho mạng nội bộ.
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { MAIKA, maikaTraLoi } from './maika'

// Cấu hình qua biến môi trường Vite (.env.local — đã được gitignore)
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''
const PROXY_URL = import.meta.env.VITE_MAIKA_PROXY_URL || ''
const MODEL = import.meta.env.VITE_MAIKA_MODEL || 'claude-opus-4-8'

// Chế độ hoạt động: proxy > api (trực tiếp) > offline
export function maikaCheDo() {
  if (PROXY_URL) return 'proxy'
  if (API_KEY) return 'api'
  return 'offline'
}

// ---- Kho kiến thức sản phẩm → chèn vào system prompt ----
function buildKB() {
  return SAN_PHAM.map((sp) => {
    const dong = [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma}, nhóm ${sp.danhMuc})`,
      `- Công dụng: ${sp.tenNgan}.`,
      `- Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Quy cách: ${sp.quyCach.join(', ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu})`,
      `- ⚠️ Cảnh báo/chống chỉ định: ${sp.canhBao.join(' | ')}`,
    ]
    return dong.join('\n')
  }).join('\n\n')
}

const SYSTEM_PROMPT = `Bạn là ${MAIKA.ten} — trợ lý kỹ thuật & bán hàng ảo của thương hiệu Vật Liệu Nhà.

NGUYÊN TẮC:
- Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, chính xác; ưu tiên gạch đầu dòng khi liệt kê.
- CHỈ tư vấn dựa trên KHO KIẾN THỨC bên dưới. Không bịa số liệu. Nếu thiếu dữ liệu, hướng dẫn nhân viên tra TDS hoặc hỏi bộ phận kỹ thuật.
- LUÔN nhắc ⚠️ cảnh báo/chống chỉ định khi liên quan (ví dụ: CẤM lăn PU khi sàn ẩm > 8%).
- Khi khách nêu nhu cầu (chống thấm, dán gạch, sơn, cấy thép...), gợi ý đúng sản phẩm trong kho và nêu định mức + lưu ý thi công.
- Là trợ lý nội bộ cho nhân viên kinh doanh; văn phong hỗ trợ đồng nghiệp, không phải chatbot bán hàng cho khách cuối.
- Nếu câu hỏi nằm ngoài phạm vi vật liệu xây dựng của Vật Liệu Nhà, lịch sự từ chối và nêu rõ phạm vi hỗ trợ.

KHO KIẾN THỨC SẢN PHẨM:
${buildKB()}`

// Lazy-load Anthropic SDK: chỉ tải (code-split) khi thực sự gọi API trực tiếp,
// tránh nhét SDK vào bundle của người dùng chế độ proxy/offline.
let _clientPromise = null
function getClient() {
  if (!_clientPromise) {
    _clientPromise = import('@anthropic-ai/sdk').then(
      ({ default: Anthropic }) => new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true }),
    )
  }
  return _clientPromise
}

// Thân request dùng chung cho cả đường trực tiếp và proxy.
function buildBody(messages) {
  return {
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    // cache_control: cache phần system (persona + kho kiến thức) ổn định — chỉ
    // kích hoạt khi prefix đủ dài (opus: ≥4096 token); không đủ thì bỏ qua, vô hại.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  }
}

// Phát hiện sản phẩm được nhắc tới để đính thẻ sản phẩm trong câu trả lời.
function timSP(text = '') {
  const k = text.toLowerCase()
  return SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
}

function layText(resp) {
  return (resp?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ============================================================
//  Hội thoại chính — nhận lịch sử [{tu:'user'|'maika', text}]
//  Trả về { text, sp?, goiY?, calc?, nguon }
// ============================================================
export async function maikaChatAI(lichSu) {
  const nt = maikaCheDo()
  const cauHoiCuoi = [...lichSu].reverse().find((m) => m.tu === 'user')?.text || ''

  // Chuyển về định dạng messages của Claude; đảm bảo bắt đầu bằng 'user'.
  const messages = lichSu.map((m) => ({
    role: m.tu === 'user' ? 'user' : 'assistant',
    content: m.text,
  }))
  while (messages.length && messages[0].role !== 'user') messages.shift()

  // Không cấu hình AI, hoặc chưa có lượt người dùng → engine offline.
  if (nt === 'offline' || messages.length === 0) {
    await delay(400)
    return { ...maikaTraLoi(cauHoiCuoi), nguon: 'offline' }
  }

  try {
    if (nt === 'proxy') {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(messages)),
      })
      if (!res.ok) throw new Error(`Proxy trả về ${res.status}`)
      const data = await res.json()
      const text = layText(data) || '(Maika chưa có câu trả lời)'
      return { text, sp: timSP(cauHoiCuoi + ' ' + text), nguon: 'proxy' }
    }

    // Gọi trực tiếp Anthropic (key lộ ở client — chỉ dùng nội bộ)
    const client = await getClient()
    const resp = await client.messages.create(buildBody(messages))
    const text = layText(resp) || '(Maika chưa có câu trả lời)'
    return { text, sp: timSP(cauHoiCuoi + ' ' + text), nguon: 'api' }
  } catch (e) {
    console.warn('[Maika AI] Lỗi gọi Claude, chuyển sang offline:', e.message)
    return { ...maikaTraLoi(cauHoiCuoi), nguon: 'offline', loi: true }
  }
}
