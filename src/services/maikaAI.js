// ============================================================
//  MAIKA AI — điều phối trợ lý AI
//  - ONLINE: truy xuất tri thức liên quan từ bộ nhớ vector (RAG: đính chính
//    của Admin + tài liệu nạp + dữ liệu vatlieunha.vn) → gửi kèm TOÀN BỘ lịch sử
//    trò chuyện lên Google Gemini. Lỗi thì báo lỗi thật, không trả dữ liệu cứng.
//  - OFFLINE (mất mạng): tra bộ nhớ đã học (từ khoá) + kho nội bộ; không có thì
//    báo rõ "chưa có dữ liệu offline" chứ KHÔNG đoán sang sản phẩm khác.
// ============================================================
import { SAN_PHAM } from '../data/mockData'
import { laySanPhamWeb } from '../data/productStore'
import { geminiChat, geminiCoCauHinh } from './maikaChatbot'
import { truyXuat } from './vectorStore'

function coMang() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function maikaCheDo() {
  if (!coMang()) return 'offline'
  if (geminiCoCauHinh()) return 'gemini'
  return 'chuaCauHinh'
}

// Tìm sản phẩm trong kho (nội bộ + web) theo tên/hãng/tag — khớp chính xác, không đoán
function timSP(text = '') {
  const k = text.toLowerCase()
  const noiBo = SAN_PHAM.find(
    (sp) =>
      k.includes(sp.ten.toLowerCase()) ||
      k.includes(sp.hang.toLowerCase()) ||
      sp.tags.some((t) => k.includes(t.toLowerCase())),
  )
  return noiBo || laySanPhamWeb().find((sp) => sp.ten.length > 6 && k.includes(sp.ten.toLowerCase()))
}

function tomTatSP(sp) {
  return [
    `${sp.ten} (${sp.hang}) — ${sp.tenNgan}.`,
    'Tính năng: ' + sp.tinhNang.join('; ') + '.',
    'Tỷ lệ pha: ' + sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | '),
    `Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu}).`,
    '⚠️ Lưu ý: ' + sp.canhBao.join(' | '),
  ].join('\n')
}

function khoNoiBo() {
  return SAN_PHAM.map((sp) =>
    [
      `### ${sp.ten} (hãng ${sp.hang}, mã ${sp.ma})`,
      `- Công dụng: ${sp.tenNgan}. Tính năng: ${sp.tinhNang.join('; ')}.`,
      `- Tỷ lệ pha: ${sp.tyLePha.map((t) => `${t.buoc} — ${t.noiDung}`).join(' | ')}`,
      `- Định mức: ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi} (${sp.dinhMuc.ghiChu}). ⚠️ ${sp.canhBao.join(' | ')}`,
    ].join('\n'),
  ).join('\n\n')
}

// Câu truy vấn RAG: câu hỏi cuối + câu hỏi trước đó (giữ ngữ cảnh "còn loại kia thì sao?")
function cauTruyVan(lichSu) {
  const hoi = lichSu.filter((m) => m.tu === 'user').map((m) => m.text)
  return hoi.slice(-2).join('\n')
}

const THONG_BAO_OFFLINE =
  'Maika chưa có dữ liệu offline về nội dung này. Vui lòng bật mạng để Maika tra cứu qua Gemini.'

// ============================================================
//  Hội thoại — nhận TOÀN BỘ lịch sử [{tu:'user'|'maika', text}]
//  Trả về { text, sp?, nguon, thamKhao?, loi? }
// ============================================================
export async function maikaChatAI(lichSu) {
  const nt = maikaCheDo()
  const cauHoiCuoi = [...lichSu].reverse().find((m) => m.tu === 'user')?.text || ''

  if (nt === 'offline') {
    const [tt] = await truyXuat(cauHoiCuoi, { k: 1, dungVector: false })
    if (tt) return { text: tt.noiDung, nguon: 'offline', thamKhao: [tt] }
    const sp = timSP(cauHoiCuoi)
    return sp ? { text: tomTatSP(sp), sp, nguon: 'offline' } : { text: THONG_BAO_OFFLINE, nguon: 'offline' }
  }

  if (nt === 'chuaCauHinh') {
    return {
      text: 'Maika chưa được cấu hình trợ lý AI. Vui lòng thêm VITE_GEMINI_API_KEY (lấy free tại aistudio.google.com/apikey) vào .env.local rồi build lại app.',
      nguon: 'chuaCauHinh',
    }
  }

  try {
    const thamKhao = await truyXuat(cauTruyVan(lichSu), { k: 6 })
    const text = (await geminiChat(lichSu, { khoNoiBo: khoNoiBo(), triThuc: thamKhao })) || '(Maika chưa có câu trả lời)'
    return { text, sp: timSP(cauHoiCuoi), nguon: nt, thamKhao }
  } catch (e) {
    console.warn('[Maika AI] Lỗi gọi AI:', e.message)
    if (!coMang()) {
      return { text: 'Mất kết nối mạng khi đang hỏi Maika. Vui lòng kiểm tra mạng và thử lại.', nguon: 'offline' }
    }
    if (e.status === 429) {
      return { text: `Maika đang bị Google giới hạn tần suất (gói free). Vui lòng thử lại sau ~${e.choGiay || 30} giây.`, nguon: 'loi', loi: true }
    }
    return { text: `Maika gặp lỗi khi gọi AI: ${e.message || e}. Kiểm tra API key / mạng rồi thử lại.`, nguon: 'loi', loi: true }
  }
}
