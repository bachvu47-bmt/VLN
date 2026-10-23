// ============================================================
//  TRA CỨU SẢN PHẨM — ghép 2 nguồn thật thành 1 thẻ (không còn dữ liệu minh hoạ)
//  · vatlieunha.vn (WooCommerce): tên, ảnh, mô tả, hướng dẫn sử dụng, định mức, tài liệu PDF, video
//  · KiotViet (bản công khai): giá bán, tồn kho, quy cách — mỗi mã KiotViet 1L/5L/20L… là 1 biến thể
//  Mã KiotViet khớp sản phẩm web theo tên (bỏ phần quy cách); hàng chỉ có trên KiotViet vẫn thành thẻ riêng.
//  Ảnh: Admin đặt → website → KiotViet → logo thương hiệu → logo Vật Liệu Nhà (components/AnhSanPham).
// ============================================================
import { laySanPhamWeb } from '../data/productStore'
import { anhGhiDe } from './anhSanPham'
import { duLieuKV } from './kiotViet'

// ---- Thương hiệu (ô logo khi thiếu ảnh) ----
export const THUONG_HIEU = [
  { ten: 'Sika', re: /\bsika/i, nen: '#FFC20E', chu: '#D7182A' },
  { ten: 'Maxbond', re: /\bmaxbond/i, nen: '#0B4EA2', chu: '#FFFFFF' },
  { ten: 'Neotex', re: /\bneotex/i, nen: '#00843D', chu: '#FFFFFF' },
  { ten: 'Jotun', re: /\bjotun/i, nen: '#E30613', chu: '#FFFFFF' },
  { ten: 'Kova', re: /\bkova\b/i, nen: '#005BAC', chu: '#FFFFFF' },
  { ten: 'Dulux', re: /\bdulux/i, nen: '#003B71', chu: '#FFFFFF' },
  { ten: 'Weber', re: /\bweber/i, nen: '#FFD100', chu: '#1D1D1B' },
  { ten: 'Mapei', re: /\bmapei/i, nen: '#0057A8', chu: '#FFFFFF' },
  { ten: 'Bestmix', re: /\bbestmix/i, nen: '#E2001A', chu: '#FFFFFF' },
  { ten: 'Intoc', re: /\bintoc/i, nen: '#1B5E20', chu: '#FFFFFF' },
  { ten: 'Kansai', re: /\bkansai/i, nen: '#C8102E', chu: '#FFFFFF' },
  { ten: 'Nippon', re: /\bnippon/i, nen: '#D52B1E', chu: '#FFFFFF' },
  { ten: 'Conwood', re: /\bconwood/i, nen: '#5D4037', chu: '#FFFFFF' },
  { ten: 'Cemboard', re: /\bcemboard|smartboard/i, nen: '#455A64', chu: '#FFFFFF' },
  { ten: 'Vĩnh Tường', re: /vĩnh tường|vinh tuong/i, nen: '#004B8D', chu: '#FFFFFF' },
]
export function nhanDienThuongHieu(...chuoi) {
  const s = chuoi.filter(Boolean).join(' ')
  return THUONG_HIEU.find((t) => t.re.test(s)) || null
}

// ---- Quy cách trong tên hàng KiotViet: "Sika Latex TH 5L" / "… 5 lít" / "(20 kg)" / "thùng 18L" ----
const DON_VI = { l: 'L', lit: 'L', lít: 'L', kg: 'kg', g: 'g', ml: 'ml', m2: 'm²', 'm²': 'm²', m: 'm', mm: 'mm', cm: 'cm' }
const RE_QUY_CACH = /(?:^|[\s(\-/x×])(\d+(?:[.,]\d+)?)\s*(lít|lit|kg|ml|m2|m²|mm|cm|l|g|m)(?=$|[\s)\-/,.])/gi
export function tachQuyCach(ten = '') {
  const ds = [...ten.matchAll(RE_QUY_CACH)]
  const m = ds[ds.length - 1] // quy cách thường nằm cuối tên
  if (!m) return { nhan: '', giaTri: 0, goc: ten.trim() }
  const dv = DON_VI[m[2].toLowerCase()] || m[2]
  const so = Number(m[1].replace(',', '.'))
  // Quy về 1 thang để sắp xếp (g→kg, ml→L)
  const giaTri = dv === 'g' || dv === 'ml' ? so / 1000 : so
  const goc = (ten.slice(0, m.index) + ' ' + ten.slice(m.index + m[0].length))
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(thùng|lon|can|bao|hộp|tuýp|xô|chai|cuộn)$/i, '') // "Maxbond 722 thùng 18L" → "Maxbond 722"
  return { nhan: `${m[1].replace('.', ',')}${dv === 'L' ? 'L' : ' ' + dv}`.replace(' L', 'L'), giaTri, goc }
}

// ---- Khớp tên: bỏ dấu, bỏ từ chung → tập từ ----
const BO_DAU = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const TU_CHUNG = new Set('va cho cua loai mau tam thanh san go nhua son mm cm kg lit bo hop cuon thung bao cay vien chiec lon can xo goi'.split(' '))
const tuCua = (s) => new Set(BO_DAU(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG.has(w) && !/^\d+(l|kg|g|ml|m)?$/.test(w)))

function mapDanhMucKV(nhom = '') {
  const t = nhom.toLowerCase()
  if (/cemboard|tấm|thạch cao|conwood/.test(t)) return 'tam'
  if (/sơn|jotun|dulux|kova/.test(t)) return 'son'
  if (/xi măng|gạch|cát|đá|thép/.test(t)) return 'xaytho'
  return 'hoachat'
}

// Biến thể KiotViet → { ma, nhan, giaTri, gia, ton, dvt, anh }
const bienTheTu = (p) => {
  const qc = tachQuyCach(p.ten)
  return { ma: p.ma, nhan: qc.nhan || p.dvt || p.ma, giaTri: qc.giaTri, gia: p.gia || 0, ton: p.ton || 0, dvt: p.dvt || '', anh: p.anh || '' }
}
const sapBienThe = (ds) => ds.sort((a, b) => a.giaTri - b.giaTri || a.gia - b.gia)

// Thẻ cho hàng CHỈ có trên KiotViet (website chưa đăng) — đủ trường cho ProductCard / ProductDetail
function theTuKiotViet(goc, ds) {
  const p0 = ds[0]
  const th = nhanDienThuongHieu(goc, p0.nhom)
  return {
    id: 'kv-' + BO_DAU(goc).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
    ma: p0.ma,
    ten: goc,
    hang: th?.ten || p0.nhom || 'Vật Liệu Nhà',
    danhMuc: mapDanhMucKV(p0.nhom),
    tenNgan: p0.nhom || 'Hàng có tại cửa hàng',
    tinhNang: ['Hàng có tại cửa hàng (KiotViet) — chưa có hồ sơ trên vatlieunha.vn'],
    mucDich: [],
    canhBao: ['Tham khảo TDS / hướng dẫn nhà sản xuất trước khi thi công.'],
    tyLePha: [{ buoc: 'Pha trộn & thi công', noiDung: 'Theo hướng dẫn trên bao bì & TDS sản phẩm.' }],
    dinhMuc: { giaTri: 0, donVi: '—', ghiChu: 'Chưa có định mức — xem TDS sản phẩm.' },
    moTa: `${goc}${p0.nhom ? ` — nhóm ${p0.nhom}` : ''}. Sản phẩm chưa có trang trên vatlieunha.vn.`,
    taiLieu: [],
    video: '',
    url: '',
    tags: [p0.nhom.toLowerCase()].filter(Boolean),
    nhom: p0.nhom,
    nutTaiLieu: 'Chi tiết sản phẩm',
    nutPhu: { label: 'Danh mục', icon: 'image' },
    tuKV: true,
    anhWeb: '',
    bienThe: sapBienThe(ds.map(bienTheTu)),
  }
}

// ---- Ghép (nhớ kết quả theo phiên bản 2 nguồn) ----
let _memo = { web: null, kv: null, ds: [] }
export function danhSachTraCuu() {
  const web = laySanPhamWeb()
  const kv = duLieuKV()
  if (_memo.web === web && _memo.kv === kv?.capNhat) return _memo.ds

  // Chỉ mục từ → sản phẩm web (để không so mỗi mã KiotViet với cả 668 sản phẩm)
  const tuWeb = web.map((sp) => tuCua(sp.ten))
  const chiMuc = new Map()
  tuWeb.forEach((tu, i) => tu.forEach((t) => (chiMuc.get(t) || chiMuc.set(t, []).get(t)).push(i)))

  const bienTheWeb = new Map() // chỉ số web → [biến thể KiotViet]
  const conLai = new Map() // tên gốc (bỏ quy cách) → [hàng KiotViet chưa khớp web]
  for (const p of kv?.sanPham || []) {
    const qc = tachQuyCach(p.ten)
    const tu = tuCua(qc.goc)
    const ungVien = new Set()
    tu.forEach((t) => chiMuc.get(t)?.forEach((i) => ungVien.add(i)))
    let tot = -1
    let diemTot = 0
    for (const i of ungVien) {
      let chung = 0
      for (const t of tu) if (tuWeb[i].has(t)) chung++
      const ty = chung / Math.min(tu.size, tuWeb[i].size || 1)
      if (chung >= 2 && ty > diemTot) {
        diemTot = ty
        tot = i
      }
    }
    if (tot >= 0 && diemTot >= 0.6) (bienTheWeb.get(tot) || bienTheWeb.set(tot, []).get(tot)).push(p)
    else {
      const k = qc.goc.toLowerCase()
      ;(conLai.get(k) || conLai.set(k, []).get(k)).push({ ...p, _goc: qc.goc })
    }
  }

  const ds = web.map((sp, i) => {
    const kvDs = bienTheWeb.get(i)
    const bienThe = kvDs ? sapBienThe(kvDs.map(bienTheTu)) : []
    return {
      ...sp,
      anhWeb: sp.anh || '',
      bienThe,
      // Quy cách: theo KiotViet (có giá/tồn từng loại) nếu có, không thì thuộc tính website
      quyCach: bienThe.length ? bienThe.map((b) => b.nhan) : sp.quyCach,
      quyCachMacDinh: bienThe.length ? (bienThe.find((b) => b.ton > 0) || bienThe[0]).nhan : sp.quyCachMacDinh,
    }
  })
  for (const nhom of conLai.values()) ds.push(theTuKiotViet(nhom[0]._goc, nhom))
  for (const sp of ds) {
    if (!sp.quyCach && sp.bienThe?.length) {
      sp.quyCach = sp.bienThe.map((b) => b.nhan)
      sp.quyCachMacDinh = (sp.bienThe.find((b) => b.ton > 0) || sp.bienThe[0]).nhan
    }
  }
  // Hàng còn tồn lên trước, rồi hàng có trên KiotViet, rồi phần còn lại
  const diem = (sp) => (sp.bienThe?.some((b) => b.ton > 0) ? 0 : sp.bienThe?.length ? 1 : 2)
  ds.sort((a, b) => diem(a) - diem(b))
  _memo = { web, kv: kv?.capNhat, ds }
  return ds
}

// Thẻ theo id (màn Hôm nay "xem gần đây", mở lại chi tiết)
export const timTheoId = (id) => danhSachTraCuu().find((sp) => sp.id === id) || null

// Chuỗi ảnh theo thứ tự ưu tiên — AnhSanPham thử lần lượt, ảnh lỗi thì chuyển ảnh sau
export function chuoiAnh(sp) {
  return [...new Set([anhGhiDe(sp.id), sp.anhWeb ?? sp.anh, ...(sp.bienThe || []).map((b) => b.anh)].filter(Boolean))]
}

// Sản phẩm chưa có ảnh thật nào (Admin cần bổ sung)
export const thieuAnh = (sp) => chuoiAnh(sp).length === 0

// Tìm kiếm: tên, thương hiệu, mô tả ngắn, tag, mã web/KiotViet (bỏ dấu)
export function timTraCuu(ds, q, cat = 'all') {
  const k = BO_DAU(q.trim())
  return ds.filter((sp) => {
    if (cat !== 'all' && sp.danhMuc !== cat) return false
    if (!k) return true
    const chu = BO_DAU([sp.ten, sp.hang, sp.tenNgan, sp.ma, ...(sp.tags || []), ...(sp.bienThe || []).map((b) => b.ma)].join(' '))
    return k.split(/\s+/).every((w) => chu.includes(w))
  })
}
