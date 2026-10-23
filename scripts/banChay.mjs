// ============================================================
//  SẢN PHẨM BÁN CHẠY (KiotViet 180 ngày) → điểm ưu tiên cho từng sản phẩm trên vatlieunha.vn
//  Đọc phần RIÊNG TƯ do kiotviet-sync.mjs lưu trên Supabase (admin_doc_kiotviet, cần PIN Admin —
//  chỉ có trong GitHub Secrets). Chỉ dùng tổng doanh số theo tên hàng — không in, không lưu
//  hoá đơn / khách hàng. Thiếu PIN hoặc lỗi → trả Map rỗng (giữ thứ tự cũ).
// ============================================================
import { gunzipSync } from 'node:zlib'

const BO_DAU = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const TU_CHUNG = new Set('va cho cua loai mau tam thanh san go nhua son mm cm m m2 kg lit l bo hop cuon thung bao cay vien chiec'.split(' '))
const tuCua = (s) => new Set(BO_DAU(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG.has(w)))

async function docBanSao(pin) {
  const kho = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!kho || !key) throw new Error('thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  const r = await fetch(`${kho}/rest/v1/rpc/admin_doc_kiotviet`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pin: pin }),
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) throw new Error(`đọc KiotViet riêng tư HTTP ${r.status}`)
  const b64 = (await r.json())?.[0]?.du_lieu
  if (!b64) throw new Error('chưa có bản đồng bộ KiotViet')
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString())
}

// sanPhamWeb: [{ id, ten }] → Map(id → doanh số 180 ngày, đã quy về VNĐ) — khớp tên theo từ chung
export async function diemBanChay(sanPhamWeb, pin = process.env.ADMIN_PIN) {
  const diem = new Map()
  if (!pin) {
    console.log('⚠ Thiếu ADMIN_PIN — chưa xếp theo doanh số KiotViet')
    return diem
  }
  let duLieu
  try {
    duLieu = await docBanSao(pin)
  } catch (e) {
    console.log(`⚠ Không đọc được doanh số KiotViet (${e.message}) — giữ thứ tự cũ`)
    return diem
  }
  // Doanh số theo tên hàng KiotViet
  const theoTen = new Map()
  for (const hd of duLieu.hoaDon || []) {
    for (const [, ten, sl, gia] of hd.ct || []) theoTen.set(ten, (theoTen.get(ten) || 0) + (Number(sl) || 0) * (Number(gia) || 0))
  }
  const hangKV = [...theoTen].map(([ten, ds]) => ({ tu: tuCua(ten), ds }))
  // Mỗi hàng KiotViet → sản phẩm web giống tên nhất (≥ 60% từ của tên ngắn hơn trùng nhau)
  const web = sanPhamWeb.map((sp) => ({ id: sp.id, tu: tuCua(sp.ten) }))
  for (const h of hangKV) {
    if (!h.tu.size) continue
    let tot = null
    let diemTot = 0
    for (const w of web) {
      if (!w.tu.size) continue
      let chung = 0
      for (const t of h.tu) if (w.tu.has(t)) chung++
      const ty = chung / Math.min(h.tu.size, w.tu.size)
      if (chung >= 2 && ty > diemTot) {
        diemTot = ty
        tot = w
      }
    }
    if (tot && diemTot >= 0.6) diem.set(tot.id, (diem.get(tot.id) || 0) + h.ds)
  }
  console.log(`• Doanh số KiotViet: ${theoTen.size} mặt hàng đã bán → khớp ${diem.size} sản phẩm trên website`)
  return diem
}
