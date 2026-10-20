// ============================================================
//  SẢN PHẨM vatlieunha.vn → Flashcard & đoạn tri thức cho Maika (hàm THUẦN, không I/O)
//  Dùng chung: app (webSyncService, vectorStore) và scripts/nap-kho-chung.mjs (Node)
//  → id/hash đoạn tri thức giống hệt nhau, máy Admin không nạp lại thứ kho chung đã có.
// ============================================================
const THUC_THE = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…' }

// "Maxbond 722 &#8211; Vữa" → "Maxbond 722 – Vữa" (WooCommerce trả tên/danh mục còn mã HTML)
function giaiMa(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (_, t) => THUC_THE[t.toLowerCase()] ?? ' ')
}

function stripHtml(s = '') {
  return giaiMa(
    s
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|li|h[1-6]|tr|div)>|<br\s*\/?>/gi, '. ') // giữ ranh giới câu cho việc chia đoạn tri thức
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/^[.\s]+/, '')
    .trim()
}

// Tài liệu kỹ thuật (PDF: TDS/MSDS/catalogue) nhúng trong mô tả sản phẩm
function layTaiLieu(html = '') {
  const urls = [...new Set(html.match(/https?:\/\/[^"'\s<>]+\.pdf/gi) || [])]
  return urls.map((url) => ({ ten: decodeURIComponent(url.split('/').pop()), url }))
}

function layVideo(html = '') {
  const m = html.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : ''
}

// "Định mức: 1,2 – 1,5 kg/m2" → { giaTri: 1.2, donVi: 'kg/m²' }
function layDinhMuc(text = '') {
  const m = text.match(/định mức[^.\d]{0,60}?(\d+(?:[.,]\d+)?)\s*(?:[-–~]\s*\d+(?:[.,]\d+)?\s*)?(kg|lít|l|g|ml)\s*\/\s*m(?:2|²)/i)
  if (!m) return { giaTri: 0, donVi: '—', ghiChu: 'Chưa có định mức — xem TDS sản phẩm.' }
  return { giaTri: Number(m[1].replace(',', '.')), donVi: `${m[2]}/m²`, ghiChu: 'Trích từ mô tả sản phẩm trên vatlieunha.vn.' }
}

function mapDanhMuc(cats = []) {
  const t = cats.map((c) => (c.name || '').toLowerCase()).join(' ')
  if (/cemboard|tấm|thạch cao|conwood/.test(t)) return 'tam'
  if (/sơn|jotun/.test(t)) return 'son'
  if (/xi măng|gạch|cát|đá|cốt thép/.test(t)) return 'xaytho'
  return 'hoachat' // mặc định: hóa chất (chống thấm, keo, phụ gia...)
}

function chiaDong(s = '') {
  return s.split(/[.;\n•]/).map((x) => x.trim()).filter((x) => x.length > 2)
}

// Sản phẩm WooCommerce Store API → Flashcard của app
export function mapSanPham(p) {
  const cats = (p.categories || []).map((c) => ({ ...c, name: giaiMa(c.name) }))
  const htmlDay = `${p.short_description || ''} ${p.description || ''}`
  const nganH = stripHtml(p.short_description || '')
  const moTa = stripHtml(p.description || '')
  const tinhNang = chiaDong(nganH || moTa).slice(0, 3)
  const hang = giaiMa(p.brands?.[0]?.name || '') || cats[0]?.name || 'Vật Liệu Nhà'
  // Quy cách lấy từ thuộc tính WooCommerce (vd "Dung Tích = 10 Lít / 5 Lít")
  const quyCach = (p.attributes || []).flatMap((a) => (a.terms || []).map((t) => giaiMa(t.name))).slice(0, 6)
  const taiLieu = layTaiLieu(htmlDay)
  const dv = p.prices?.currency_minor_unit ?? 0
  return {
    id: 'wc-' + p.id,
    ma: p.sku || 'WC-' + p.id,
    ten: giaiMa(p.name),
    hang,
    danhMuc: mapDanhMuc(cats),
    icon: '🧱',
    anh: p.images?.[0]?.src || p.images?.[0]?.thumbnail || '',
    anhPhu: (p.images || []).slice(1, 6).map((i) => i.src),
    anhBg: 'bg-gray-50',
    tenNgan: (nganH || moTa).slice(0, 130),
    tinhNang: tinhNang.length ? tinhNang : ['Xem mô tả chi tiết'],
    quyCach,
    quyCachMacDinh: quyCach[0] || '',
    nutTaiLieu: taiLieu.length ? `Tài liệu (${taiLieu.length})` : 'Chi tiết sản phẩm',
    nutPhu: { label: 'Danh mục', icon: 'image' },
    hangSX: hang,
    donVi: '',
    nhom: cats.map((c) => c.name).join(', ') || 'Sản phẩm website',
    moTa: moTa || nganH || p.name,
    mucDich: chiaDong(nganH || moTa).slice(0, 4),
    canhBao: ['Tham khảo TDS / hướng dẫn nhà sản xuất trước khi thi công.'],
    tyLePha: [{ buoc: 'Pha trộn & thi công', noiDung: 'Theo hướng dẫn trên bao bì & TDS sản phẩm.' }],
    dinhMuc: layDinhMuc(moTa),
    video: layVideo(htmlDay),
    taiLieu,
    tags: [...cats.map((c) => (c.name || '').toLowerCase()), ...(p.tags || []).map((t) => giaiMa(t.name || '').toLowerCase())],
    gia: p.prices?.price ? Number(p.prices.price) / 10 ** dv : null,
    url: p.permalink || '',
    tuWeb: true,
  }
}

// Băm nhanh (djb2) — phát hiện đoạn tri thức đổi nội dung
export function bam(s = '') {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const DO_DAI_DOAN = 1200
const SO_DOAN_TOI_DA = 3 // mỗi SP tối đa 3 đoạn — cân bằng độ phủ & quota embedding free

function chiaDoan(text, doDai) {
  const cau = text.split(/(?<=[.!?;])\s+/)
  const doan = []
  let hienTai = ''
  for (const c of cau) {
    if ((hienTai + ' ' + c).length > doDai && hienTai) {
      doan.push(hienTai.trim())
      hienTai = ''
    }
    hienTai += ' ' + c
  }
  if (hienTai.trim()) doan.push(hienTai.trim())
  return doan
}

// Flashcard → các đoạn tri thức 'web' (đã duyệt) cho bộ nhớ Maika
export function doanTuSanPham(sp) {
  const dau = [
    `${sp.ten} — thương hiệu ${sp.hang}.`,
    sp.nhom && `Danh mục: ${sp.nhom}.`,
    sp.quyCach?.length && `Quy cách: ${sp.quyCach.join(', ')}.`,
    sp.dinhMuc?.giaTri && `Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}.`,
    sp.tenNgan,
  ]
    .filter(Boolean)
    .join(' ')
  const moTa = sp.moTa && sp.moTa !== sp.tenNgan ? sp.moTa : ''
  const phan = moTa ? chiaDoan(moTa, DO_DAI_DOAN) : []
  const doan = [`${dau}\n${(phan.shift() || '').slice(0, DO_DAI_DOAN)}`.trim(), ...phan].slice(0, SO_DOAN_TOI_DA)
  return doan.map((noiDung, i) => ({
    id: `web:${sp.id}:${i}`,
    loai: 'web',
    trangThai: 'da_duyet',
    tieuDe: i === 0 ? sp.ten : `${sp.ten} (phần ${i + 1})`,
    noiDung,
    spId: sp.id,
    nguon: sp.url,
    hash: bam(noiDung),
  }))
}
