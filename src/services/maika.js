// ============================================================
//  MAIKA — Trợ lý ảo của Vật Liệu Nhà
//  Engine trợ lý: hội thoại tra cứu kỹ thuật, tư vấn sản phẩm,
//  phân tích đơn hàng & phân loại nội dung nạp.
//  (Rule-based trên kho kiến thức SAN_PHAM — có thể thay bằng
//   gọi LLM thật ở lớp maikaTraLoi mà không đổi UI.)
// ============================================================
import { SAN_PHAM } from '../data/mockData'

export const MAIKA = {
  ten: 'Maika',
  vaiTro: 'Trợ lý kỹ thuật & bán hàng',
  moTa: 'Trợ lý ảo của Vật Liệu Nhà — tra cứu kỹ thuật, tư vấn sản phẩm, phân tích đơn hàng và hỗ trợ CSKH.',
}

export const MAIKA_GOI_Y = [
  'SikaLatex dùng để làm gì?',
  'Tỷ lệ pha Maxbond thế nào?',
  'Chống thấm sàn mái nên dùng gì?',
  'Lưu ý khi thi công PU?',
]

export function maikaChao(user) {
  const ten = user?.hoTen ? ', ' + user.hoTen.split(' ').pop() : ''
  return `Xin chào${ten}! Mình là Maika — trợ lý kỹ thuật của Vật Liệu Nhà. Bạn cần tra cứu sản phẩm, tính vật tư hay tư vấn cho khách? 😊`
}

// ---- Tìm sản phẩm trong câu hỏi ----
function timSP(text) {
  const k = text.toLowerCase()
  return SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
}

function goiYSP(ma, nhuCau) {
  const sp = SAN_PHAM.find((s) => s.ma === ma)
  if (!sp) return null
  return {
    text: `Với nhu cầu ${nhuCau}, mình gợi ý dùng ${sp.ten} (${sp.hang}): ${sp.tenNgan}.`,
    sp,
    goiY: ['Tỷ lệ pha?', 'Định mức?', 'Lưu ý thi công?'],
  }
}

// ============================================================
//  1) HỘI THOẠI — trả lời câu hỏi của nhân viên
// ============================================================
export function maikaTraLoi(cauHoi) {
  const k = cauHoi.toLowerCase()

  if (/(xin chào|hello|^hi\b|chào|giúp|bạn là ai|maika)/.test(k)) return { text: maikaChao() }

  const sp = timSP(cauHoi)

  // Gợi ý theo nhu cầu (khi chưa nêu rõ sản phẩm)
  if (!sp) {
    if (/(mái|sân thượng|lộ thiên).*(thấm)|(thấm).*(mái|sân thượng|lộ thiên)/.test(k)) return goiYSP('NEOPROOF-PU-W', 'chống thấm sàn mái lộ thiên')
    if (/dán gạch|ốp gạch|dán đá|lát gạch/.test(k)) return goiYSP('MAXBOND-1211', 'dán gạch, đá')
    if (/sơn|ngoại thất|bền màu/.test(k)) return goiYSP('JOTUN-JOTASHIELD', 'sơn phủ ngoại thất')
    if (/cấy thép|bu lông|epoxy|neo thép/.test(k)) return goiYSP('RAMSET-G5-PRO', 'cấy thép, neo bu lông')
    if (/xi măng|xây tô|đổ bê tông|bê tông/.test(k)) return goiYSP('INSEE-PCB40', 'xây tô, đổ bê tông')
    if (/sàn gác|vách ngăn|cemboard|làm trần/.test(k)) return goiYSP('CEMBOARD-SCG', 'làm sàn gác, vách ngăn')
    if (/bám dính|kết nối|phụ gia|hồ dầu/.test(k)) return goiYSP('SIKA-LTX-TH', 'tăng bám dính & kết nối')
  }

  if (sp) {
    if (/(tỷ lệ|pha|trộn|công thức)/.test(k))
      return { text: `Tỷ lệ pha trộn ${sp.ten}:\n` + sp.tyLePha.map((t) => `• ${t.buoc}: ${t.noiDung}`).join('\n'), sp }
    if (/(định mức|bao nhiêu|cần dùng|tính|mét|m2|m²|khối lượng)/.test(k))
      return { text: `Định mức ${sp.ten}: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}. ${sp.dinhMuc.ghiChu}`, sp, calc: true }
    if (/(lưu ý|cảnh báo|cấm|chú ý|chống chỉ định|tránh|không nên)/.test(k))
      return { text: `⚠️ Lưu ý khi dùng ${sp.ten}:\n` + sp.canhBao.map((c) => `• ${c}`).join('\n'), sp, canhBao: true }
    if (/(công dụng|để làm gì|dùng|tính năng|là gì|đặc điểm)/.test(k))
      return { text: `${sp.ten} — ${sp.tenNgan}.\nTính năng:\n` + sp.tinhNang.map((t) => `• ${t}`).join('\n'), sp }
    // Mặc định: giới thiệu sản phẩm
    return { text: `${sp.ten} (${sp.hang}): ${sp.moTa}`, sp, goiY: ['Tỷ lệ pha?', 'Định mức?', 'Lưu ý thi công?'] }
  }

  return {
    text: 'Mình chưa rõ ý bạn. Bạn có thể hỏi về công dụng, tỷ lệ pha, định mức hoặc lưu ý của một sản phẩm cụ thể — ví dụ: SikaLatex, Maxbond, Neoproof PU, Jotun...',
    goiY: MAIKA_GOI_Y,
  }
}

// ============================================================
//  2) PHÂN TÍCH ĐƠN HÀNG — gợi ý các bước tư vấn sau bán
// ============================================================
export function maikaPhanTichDon(don) {
  return don.sanPham
    .map((it) => {
      const sp = SAN_PHAM.find((p) => p.ma === it.ma)
      if (!sp) return null
      return {
        sp,
        noiDung: `Gửi khách video thi công "${sp.ten}" và nhắc định mức ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}.`,
        canhBao: sp.canhBao[0],
      }
    })
    .filter(Boolean)
}

// ============================================================
//  3) PHÂN LOẠI NỘI DUNG NẠP — định tuyến vào mã sản phẩm
// ============================================================
export function maikaPhanLoai(text, tenFile) {
  const key = (text + ' ' + (tenFile || '')).toLowerCase()
  const sp = SAN_PHAM.find((p) => p.tags.some((t) => key.includes(t.toLowerCase()))) || SAN_PHAM.find((p) => p.danhMuc === 'son')
  const tags = []
  if (/chống thấm|thấm/.test(key)) tags.push('Chống thấm')
  if (/pu|polyurethane/.test(key)) tags.push('PU')
  if (/ẩm|nhiệt|điều kiện|thi công/.test(key)) tags.push('Điều kiện thi công')
  if (!tags.length) tags.push(sp?.danhMuc === 'son' ? 'Sơn & hoàn thiện' : 'Kỹ thuật')
  return { sp, tags, doTinCay: 82 }
}
