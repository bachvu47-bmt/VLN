// ============================================================
//  MAIKA PROXY (mẫu) — giữ ANTHROPIC_API_KEY ở phía server
//  App client gọi proxy này thay vì gọi thẳng Anthropic, nên API key
//  KHÔNG bao giờ nằm trong bundle client.
//
//  Chạy riêng (KHÔNG thuộc app Vite):
//    1) mkdir maika-proxy && cd maika-proxy
//    2) npm init -y
//    3) npm install express cors @anthropic-ai/sdk
//    4) đặt ANTHROPIC_API_KEY trong môi trường:
//         PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."
//    5) node maika-proxy.example.mjs
//    6) trong app, đặt .env.local:  VITE_MAIKA_PROXY_URL=http://localhost:8787/maika
//
//  Triển khai thật: deploy lên server nội bộ / serverless (Vercel, Cloudflare
//  Workers, Render...), bật HTTPS, giới hạn CORS origin, và thêm xác thực
//  (token nội bộ) để chỉ nhân viên đã đăng nhập mới gọi được.
// ============================================================
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // tự đọc ANTHROPIC_API_KEY từ môi trường

const app = express()
app.use(cors({ origin: true })) // ⚠️ production: giới hạn origin cụ thể
app.use(express.json({ limit: '1mb' }))

app.post('/maika', async (req, res) => {
  try {
    const { model, max_tokens, system, messages, thinking, output_config } = req.body
    // Chỉ chuyển tiếp các trường cho phép (tránh client truyền tham số lạ)
    const resp = await client.messages.create({
      model,
      max_tokens,
      system,
      messages,
      thinking,
      output_config,
    })
    res.json(resp)
  } catch (e) {
    console.error('[maika-proxy] lỗi:', e.message)
    res.status(e.status || 500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => console.log(`Maika proxy đang chạy tại http://localhost:${PORT}/maika`))
