// ============================================================
//  ĐỒNG BỘ KIOTVIET → bản sao MÃ HOÁ cho app (chạy trên GitHub Actions)
//  - Key KiotViet (toàn quyền) chỉ nằm trong GitHub Secrets, KHÔNG bao giờ vào app.
//  - Chỉ ĐỌC: hàng hoá + tồn kho + giá, hoá đơn 180 ngày, khách hàng.
//  - Gzip + AES-256-GCM, khoá dẫn xuất PBKDF2 từ "Mã dữ liệu cửa hàng"
//    (nhân viên nhập 1 lần trên máy) → file .apk công khai không giải mã được.
//  Định dạng: "VLN1" | salt(16) | iv(12) | ciphertext+tag
//  Dùng: KV_CLIENT_ID=… KV_CLIENT_SECRET=… KV_MA_DU_LIEU=… node scripts/kiotviet-sync.mjs <file-ra>
// ============================================================
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const { KV_CLIENT_ID, KV_CLIENT_SECRET, KV_MA_DU_LIEU } = process.env
const RA = process.argv[2] || 'kiotviet.bin'
const SO_NGAY_HOA_DON = 180
const VONG_PBKDF2 = 150000 // app dùng đúng số vòng này
if (!KV_CLIENT_ID || !KV_CLIENT_SECRET || !KV_MA_DU_LIEU) throw new Error('Thiếu KV_CLIENT_ID / KV_CLIENT_SECRET / KV_MA_DU_LIEU')

const tk = await (await fetch('https://id.kiotviet.vn/connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: KV_CLIENT_ID, client_secret: KV_CLIENT_SECRET }),
})).json()
if (!tk.access_token) throw new Error('Không lấy được token KiotViet')
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

const duLieu = { capNhat: new Date().toISOString(), retailer, chiNhanh, sanPham, hoaDon, khach }
const goc = gzipSync(Buffer.from(JSON.stringify(duLieu)), { level: 9 })
const salt = randomBytes(16)
const iv = randomBytes(12)
const khoa = pbkdf2Sync(KV_MA_DU_LIEU, salt, VONG_PBKDF2, 32, 'sha256')
const c = createCipheriv('aes-256-gcm', khoa, iv)
const ma = Buffer.concat([c.update(goc), c.final(), c.getAuthTag()]) // WebCrypto: tag nối cuối ciphertext
writeFileSync(RA, Buffer.concat([Buffer.from('VLN1'), salt, iv, ma]))
console.log(`✓ ${sanPham.length} hàng hoá · ${hoaDon.length} hoá đơn (${SO_NGAY_HOA_DON} ngày) · ${khach.length} khách → ${RA} (${(goc.length / 1024).toFixed(0)}KB nén)`)
