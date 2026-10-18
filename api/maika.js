// ============================================================
//  MAIKA PROXY — Vercel Serverless Function  (endpoint: /api/maika)
//  Giữ ANTHROPIC_API_KEY ở phía server (biến môi trường Vercel), app client
//  chỉ gọi tới đây nên KEY KHÔNG BAO GIỜ nằm trong bundle .exe/.apk/web.
//
//  Deploy:
//    1) npm i -g vercel         (nếu chưa có)
//    2) cd D:\VatLieuNha_Sales && vercel          # đăng nhập + chọn project
//    3) vercel env add ANTHROPIC_API_KEY          # dán key Anthropic (bí mật)
//    4) vercel --prod                             # lấy URL, vd https://vln.vercel.app
//    5) trong .env.local:  VITE_MAIKA_PROXY_URL=https://vln.vercel.app/api/maika
//
//  @anthropic-ai/sdk đã có sẵn trong dependencies của dự án.
// ============================================================
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // tự đọc ANTHROPIC_API_KEY từ môi trường Vercel

export default async function handler(req, res) {
  // CORS — cho phép gọi từ app .exe/.apk (origin khác). Siết origin cụ thể nếu cần.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ POST' })

  try {
    const { model, max_tokens, system, messages, thinking, output_config } = req.body || {}
    if (!messages) return res.status(400).json({ error: 'Thiếu messages' })
    const resp = await client.messages.create({
      model,
      max_tokens,
      system,
      messages,
      thinking,
      output_config,
    })
    return res.status(200).json(resp)
  } catch (e) {
    console.error('[maika proxy] lỗi:', e.message)
    return res.status(e.status || 500).json({ error: e.message })
  }
}
