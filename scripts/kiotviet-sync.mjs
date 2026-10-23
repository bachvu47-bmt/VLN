// ============================================================
//  ĐỒNG BỘ KIOTVIET (chạy trên GitHub Actions, 30 phút/lần) — kết nối ở cấp hệ thống,
//  không ai phải nhập gì trên app.
//  - Key KiotViet (toàn quyền) chỉ nằm trong GitHub Secrets, KHÔNG bao giờ vào app.
//  - Chỉ ĐỌC KiotViet. Tách 2 phần:
//    · CÔNG KHAI: hàng hoá + tồn kho + giá bán → <thư-mục-ra>/kiotviet-cong-khai.json
//      (nhánh du-lieu) → mọi máy app + Maika trên web tự tải.
//    · RIÊNG TƯ — CHỈ ADMIN: hoá đơn 180 ngày + khách hàng (tên, SĐT, địa chỉ, công nợ)
//      → bảng kv_rieng trên Supabase (admin_ghi_kiotviet, PIN). App chỉ đọc được khi là Admin.
//  Dùng: KV_CLIENT_ID=… KV_CLIENT_SECRET=… VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… ADMIN_PIN=…
//        node scripts/kiotviet-sync.mjs <thư-mục-ra>
// ============================================================
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// Lỗi → annotation "::error::" (đọc được trên GitHub không cần đăng nhập, log thì cần) — không bao giờ in khoá/PIN
const baoLoi = (e) => {
  console.log(`::error title=Đồng bộ KiotViet::${String(e?.message || e).replace(/\r?\n/g, ' ').slice(0, 500)}`)
  process.exit(1)
}
process.on('uncaughtException', baoLoi)
process.on('unhandledRejection', baoLoi)

const { KV_CLIENT_ID, KV_CLIENT_SECRET, VITE_SUPABASE_ANON_KEY, ADMIN_PIN } = process.env
const RA = process.argv[2] || 'du-lieu'
const SO_NGAY_HOA_DON = 180
if (!KV_CLIENT_ID || !KV_CLIENT_SECRET) throw new Error('Thiếu KV_CLIENT_ID / KV_CLIENT_SECRET')
const KHO = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const thieu = [!KHO && 'VITE_SUPABASE_URL', !VITE_SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY', !ADMIN_PIN && 'MAIKA_ADMIN_PIN'].filter(Boolean)

const rTk = await fetch('https://id.kiotviet.vn/connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: KV_CLIENT_ID, client_secret: KV_CLIENT_SECRET }),
})
const tk = await rTk.json().catch(() => ({}))
if (!tk.access_token) throw new Error(`Không lấy được token KiotViet (HTTP ${rTk.status} ${tk.error || ''})`)
const retailer = JSON.parse(Buffer.from(tk.access_token.split('.')[1], 'base64url')).client_RetailerCode
const H = { Retailer: retailer, Authorization: 'Bearer ' + tk.access_token }

async function get(duongDan) {
  for (let thu = 0; ; thu++) {
    const r = await fetch('https://public.kiotapi.com' + duongDan, { headers: H })
    if (r.ok) return r.json()
    if (r.status === 429 && thu < 5) {
      await new Promise((ok) => setTimeout(ok, 2000 * (thu + 1)))
      continue
    }
    throw new Error(`KiotViet ${duongDan} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  }
}

// Lấy hết các trang (pageSize tối đa 100)
async function layHet(duongDan, dung = () => false) {
  const ds = []
  for (let tu = 0; ; tu += 100) {
    const p = await get(`${duongDan}${duongDan.includes('?') ? '&' : '?'}pageSize=100&currentItem=${tu}`)
    const trang = p.data || []
    ds.push(...trang)
    if (trang.length < 100 || ds.length >= (p.total ?? Infinity) || trang.some(dung)) break
  }
  return ds
}

// Webhook hoá đơn → hàm máy chủ "kiotviet" đẩy thông báo cho Admin NGAY khi có hoá đơn (không chờ 30 phút).
// Tự đăng ký nếu chưa có; mô tả chứa dấu vân tay khoá bí mật → đổi khoá thì xoá webhook cũ, đăng ký lại.
async function damBaoWebhook() {
  const { KV_WEBHOOK_SECRET, VITE_SUPABASE_URL } = process.env
  if (!KV_WEBHOOK_SECRET || !VITE_SUPABASE_URL) return console.log('• Bỏ qua webhook hoá đơn (thiếu KV_WEBHOOK_SECRET / VITE_SUPABASE_URL)')
  const url = VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/kiotviet'
  const moTa = 'Maika bao hoa don ' + createHash('sha256').update(KV_WEBHOOK_SECRET).digest('hex').slice(0, 10)
  const ds = (await get('/webhooks')).data || []
  const cua = ds.filter((w) => (w.url || w.Url) === url)
  if (cua.some((w) => (w.description || w.Description) === moTa && (w.isActive ?? w.IsActive))) return
  for (const w of cua) await fetch(`https://public.kiotapi.com/webhooks/${w.id || w.Id}`, { method: 'DELETE', headers: H })
  const r = await fetch('https://public.kiotapi.com/webhooks', {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Webhook: { Type: 'invoice.update', Url: url, IsActive: true, Description: moTa, Secret: Buffer.from(KV_WEBHOOK_SECRET).toString('base64') } }),
  })
  console.log(`• Đăng ký webhook hoá đơn → ${r.status} ${(await r.text()).slice(0, 150)}`)
}
await damBaoWebhook().catch((e) => console.warn('⚠ Webhook hoá đơn:', e.message))

const chiNhanh = (await get('/branches?pageSize=100')).data.map((b) => ({ id: b.id, ten: b.branchName }))

const sanPham = (await layHet('/products?includeInventory=true&isActive=true'))
  .filter((p) => p.allowsSale !== false)
  .map((p) => ({
    ma: p.code,
    ten: p.fullName || p.name,
    nhom: p.categoryName || '',
    gia: p.basePrice || 0,
    dvt: p.unit || '',
    ton: (p.inventories || []).reduce((s, i) => s + (i.onHand || 0), 0),
    tonCN: (p.inventories || []).map((i) => [i.branchId, i.onHand || 0]),
    anh: p.images?.[0] || '',
  }))

const moc = new Date(Date.now() - SO_NGAY_HOA_DON * 864e5).toISOString().slice(0, 10)
const hoaDon = (await layHet(`/invoices?fromPurchaseDate=${moc}&orderBy=purchaseDate&orderDirection=Desc&includePayment=true`))
  .filter((i) => i.status !== 2) // bỏ hoá đơn đã huỷ
  .map((i) => ({
    ma: i.code,
    ngay: i.purchaseDate,
    maKH: i.customerCode || '',
    khach: i.customerName || 'Khách lẻ',
    tong: i.total || 0,
    daTra: i.totalPayment || 0,
    tt: i.statusValue || '',
    nv: (i.soldByName || '').replace(/^sales\d+\s*-\s*/i, ''),
    ct: (i.invoiceDetails || []).map((d) => [d.productCode, d.productName, d.quantity, d.price]),
    // Thanh toán: [[phương thức (Cash|Transfer|Card|...), số tiền]] → Báo cáo tách Tiền mặt / Chuyển khoản
    // (khoá 'ttoan' — 'tt' đã là trạng thái hoá đơn, ConsultScreen hiển thị)
    ttoan: (i.payments || []).filter((p) => p.status !== 2).map((p) => [p.method || '', p.amount || 0]),
  }))

const khach = (await layHet('/customers?orderBy=createdDate&orderDirection=Desc')).map((c) => ({
  ma: c.code,
  ten: c.name,
  sdt: c.contactNumber || '',
  dc: [c.address, c.wardName, c.locationName].filter(Boolean).join(', '),
  no: c.debt || 0,
  nhom: c.groups || '',
  tao: c.createdDate,
}))

const capNhat = new Date().toISOString()

// Phần CÔNG KHAI → tệp JSON cho mọi máy + web (không có khách hàng, hoá đơn, công nợ)
mkdirSync(RA, { recursive: true })
writeFileSync(join(RA, 'kiotviet-cong-khai.json'), JSON.stringify({ capNhat, retailer, chiNhanh, sanPham }))
console.log(`✓ Công khai: ${sanPham.length} hàng hoá → ${join(RA, 'kiotviet-cong-khai.json')}`)

// Phần RIÊNG TƯ → Supabase. Lỗi thì báo annotation nhưng VẪN đăng phần công khai (nhân viên vẫn có giá/tồn);
// máy Admin giữ bản riêng tư lần trước tới khi sửa xong.
const rieng = gzipSync(Buffer.from(JSON.stringify({ capNhat, hoaDon, khach })), { level: 9 })
if (thieu.length) {
  console.log(`::error title=KiotViet riêng tư::Thiếu GitHub Secret ${thieu.join(', ')} — chưa lưu khách hàng & hoá đơn cho Admin`)
} else {
  const r = await fetch(`${KHO}/rest/v1/rpc/admin_ghi_kiotviet`, {
    method: 'POST',
    headers: { apikey: VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pin: ADMIN_PIN, p_du_lieu: rieng.toString('base64') }),
  })
  if (r.ok) {
    console.log(`✓ Riêng tư (chỉ Admin): ${hoaDon.length} hoá đơn (${SO_NGAY_HOA_DON} ngày) · ${khach.length} khách → Supabase (${(rieng.length / 1024).toFixed(0)}KB nén)`)
  } else {
    const t = (await r.text()).replace(/\s+/g, ' ').slice(0, 200)
    const goiY = /PIN/i.test(t) ? ' → Secret MAIKA_ADMIN_PIN khác PIN trên máy chủ' : r.status === 401 ? ' → Secret VITE_SUPABASE_ANON_KEY sai/hết hạn' : /admin_ghi_kiotviet/.test(t) ? ' → máy chủ chưa chạy schema mới (setup-supabase)' : ''
    console.log(`::error title=KiotViet riêng tư::Ghi Supabase HTTP ${r.status}${goiY}: ${t}`)
  }
}
