// ============================================================
//  SẢN PHẨM BÁN CHẠY (KiotViet 180 ngày) → điểm ưu tiên cho từng sản phẩm trên vatlieunha.vn
//  Đọc bản sao MÃ HOÁ do kiotviet-sync.yml đăng ở nhánh du-lieu, giải mã bằng KV_MA_DU_LIEU
//  (chỉ có trong GitHub Secrets). Chỉ dùng tổng doanh số theo tên hàng — không in, không lưu
//  hoá đơn / khách hàng. Thiếu mã hoặc lỗi → trả Map rỗng (giữ thứ tự cũ).
// ============================================================
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const URL_BAN_SAO = 'https://raw.githubusercontent.com/bachvu47-bmt/VLN/du-lieu/kiotviet.bin'
const VONG_PBKDF2 = 150000 // giống kiotviet-sync.mjs

const BO_DAU = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const TU_CHUNG = new Set('va cho cua loai mau tam thanh san go nhua son mm cm m m2 kg lit l bo hop cuon thung bao cay vien chiec'.split(' '))
const tuCua = (s) => new Set(BO_DAU(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG.has(w)))

async function docBanSao(ma) {
  const r = await fetch(URL_BAN_SAO, { signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`tải bản sao KiotViet HTTP ${r.status}`)
  const b = Buffer.from(await r.arrayBuffer())
  if (b.subarray(0, 4).toString() !== 'VLN1') throw new Error('bản sao KiotViet sai định dạng')
  const salt = b.subarray(4, 20)
  const iv = b.subarray(20, 32)
  const than = b.subarray(32)
  const d = createDecipheriv('aes-256-gcm', pbkdf2Sync(ma, salt, VONG_PBKDF2, 32, 'sha256'), iv)
  d.setAuthTag(than.subarray(than.length - 16))
  return JSON.parse(gunzipSync(Buffer.concat([d.update(than.subarray(0, than.length - 16)), d.final()])).toString())
}

// sanPhamWeb: [{ id, ten }] → Map(id → doanh số 180 ngày, đã quy về VNĐ) — khớp tên theo từ chung
export async function diemBanChay(sanPhamWeb, ma = process.env.KV_MA_DU_LIEU) {
  const diem = new Map()
  if (!ma) {
    console.log('⚠ Thiếu KV_MA_DU_LIEU — chưa xếp theo doanh số KiotViet')
    return diem
  }
  let duLieu
  try {
    duLieu = await docBanSao(ma)
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
