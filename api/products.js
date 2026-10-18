// ============================================================
//  PROXY đồng bộ sản phẩm — Vercel Serverless (endpoint: /api/products?url=...)
//  Vượt CORS cho bản PC/web khi lấy dữ liệu từ vatlieunha.vn.
//  Dùng: đặt VITE_VLN_PROXY=https://<app>.vercel.app/api/products
//  (App sẽ gọi .../api/products?url=<WooCommerce Store API url>)
//  Nếu KHÔNG đặt → app tự dùng public proxy allorigins.win.
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const target = req.query.url
  // Chỉ cho phép lấy từ vatlieunha.vn (chặn lạm dụng proxy)
  if (!target || !/^https:\/\/vatlieunha\.vn\//.test(target)) {
    return res.status(400).json({ error: 'Tham số url không hợp lệ (chỉ cho phép vatlieunha.vn)' })
  }
  try {
    const r = await fetch(target, { headers: { Accept: 'application/json' } })
    const body = await r.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(r.status).send(body)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
