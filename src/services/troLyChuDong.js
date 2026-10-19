// ============================================================
//  TRỢ LÝ CHỦ ĐỘNG (Proactive Agent) — Maika 2.0 · Bước 2
//  - Tự nhắc việc đúng hạn: Android → thông báo hệ thống (kể cả khi đã tắt app,
//    @capacitor/local-notifications); PC/web → thông báo Windows + toast khi app đang mở.
//  - Tạo việc bằng câu nói tự nhiên ("Nhắc tôi gọi chị Mai 10h sáng mai") qua AI.
//  - Báo giá → tự sinh việc follow-up sau N ngày; đơn hàng → hẹn chăm sóc sau bán.
//  - Soạn sẵn tin nhắn follow-up gửi khách (Zalo/SMS).
// ============================================================
import { capNhatViec, dauNgay, layViec, LOAI_VIEC, nhanThoiGian, sanSang, themViec } from '../data/viecStore'
import { aiCoCauHinh, aiNhanh } from './maikaChatbot'

const SO_NGAY_FOLLOW_UP_BAO_GIA = 2
const CHU_KY_KIEM_TRA = 30 * 1000

function laNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

// id việc (chuỗi) → id thông báo Android (int32 dương)
function maThongBao(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483647 || 1
}

async function pluginThongBao() {
  if (!laNative()) return null
  try {
    return (await import('@capacitor/local-notifications')).LocalNotifications
  } catch {
    return null
  }
}

export async function xinQuyenThongBao() {
  const ln = await pluginThongBao()
  if (ln) {
    const q = await ln.checkPermissions()
    if (q.display === 'granted') return true
    return (await ln.requestPermissions()).display === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

const noiDungNhac = (v) => ({
  title: `${LOAI_VIEC[v.loai]?.icon || '⏰'} Maika nhắc: ${v.tieuDe}`,
  body: [v.khach, v.sanPham, v.ghiChu].filter(Boolean).join(' · ') || nhanThoiGian(v.hanLuc),
})

// Đặt lịch thông báo hệ thống Android cho 1 việc (PC dùng bộ đếm trong app)
export async function lenLichNhac(v) {
  const ln = await pluginThongBao()
  if (!ln || v.trangThai !== 'cho' || v.hanLuc <= Date.now()) return
  try {
    await ln.schedule({
      notifications: [{ id: maThongBao(v.id), ...noiDungNhac(v), schedule: { at: new Date(v.hanLuc), allowWhileIdle: true }, extra: { viecId: v.id } }],
    })
  } catch (e) {
    console.warn('[Trợ lý] Không đặt được thông báo:', e.message)
  }
}

export async function huyNhac(v) {
  const ln = await pluginThongBao()
  if (!ln) return
  try {
    await ln.cancel({ notifications: [{ id: maThongBao(v.id) }] })
  } catch {
    /* bỏ qua */
  }
}

// ---- Tạo / cập nhật việc (luôn đi qua đây để lịch nhắc khớp dữ liệu) ----
export async function taoViec(v) {
  const viec = await themViec(v)
  await lenLichNhac(viec)
  return viec
}

export async function xongViec(v) {
  await huyNhac(v)
  return capNhatViec(v.id, { trangThai: 'xong', xongLuc: Date.now() })
}

export async function moLaiViec(v) {
  const moi = await capNhatViec(v.id, { trangThai: 'cho', xongLuc: undefined })
  await lenLichNhac(moi)
  return moi
}

// Dời hạn (snooze): phut > 0 → +phút từ bây giờ; hoặc truyền mốc thời gian tuyệt đối
export async function doiHan(v, { phut, luc }) {
  await huyNhac(v)
  const hanLuc = luc || Date.now() + phut * 60000
  const moi = await capNhatViec(v.id, { hanLuc, daNhac: false })
  await lenLichNhac(moi)
  return moi
}

// Báo giá vừa gửi → việc follow-up sau N ngày lúc 9:00
export async function taoFollowUpBaoGia({ khach, sdt = '', sanPham = '', giaTri = '', nguoiTao, soNgay = SO_NGAY_FOLLOW_UP_BAO_GIA }) {
  const han = new Date(dauNgay() + soNgay * 864e5)
  han.setHours(9, 0, 0, 0)
  const ngayGui = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  return taoViec({
    loai: 'baogia',
    tieuDe: `Follow-up báo giá ${khach} (gửi ${ngayGui})`,
    khach,
    sdt,
    sanPham,
    ghiChu: giaTri ? `Giá trị báo giá: ${giaTri}` : '',
    hanLuc: han.getTime(),
    nguon: 'baogia',
    nguoiTao,
  })
}

// Đơn đã giao → hẹn hỏi thăm sau bán
export async function taoChamSocSauBan({ don, nguoiTao, soNgay = 3 }) {
  const han = new Date(dauNgay() + soNgay * 864e5)
  han.setHours(9, 30, 0, 0)
  return taoViec({
    loai: 'sauban',
    tieuDe: `Hỏi thăm sau bán ${don.khach}`,
    khach: don.khach,
    sdt: don.sdt || '',
    sanPham: don.sanPham.map((s) => s.ten).join(', '),
    ghiChu: `Đơn ${don.maDon}${don.goiY ? ' · ' + don.goiY : ''}`,
    hanLuc: han.getTime(),
    nguon: 'donhang',
    nguoiTao,
  })
}

// ============================================================
//  BỘ ĐẾM NHẮC VIỆC (khi app đang mở) — mọi nền tảng
//  Android đã có thông báo hệ thống → ở đây chỉ báo toast trong app.
// ============================================================
let _timer = null
export function batDauTheoDoi(userId, onDenHan) {
  dungTheoDoi()
  const kiemTra = async () => {
    await sanSang
    const denHan = layViec(userId).filter((v) => v.trangThai === 'cho' && !v.daNhac && v.hanLuc <= Date.now())
    for (const v of denHan) {
      await capNhatViec(v.id, { daNhac: true })
      if (!laNative() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const { title, body } = noiDungNhac(v)
          new Notification(title, { body, tag: v.id })
        } catch {
          /* bỏ qua */
        }
      }
      onDenHan?.(v)
    }
  }
  kiemTra()
  _timer = setInterval(kiemTra, CHU_KY_KIEM_TRA)
  return dungTheoDoi
}

export function dungTheoDoi() {
  clearInterval(_timer)
  _timer = null
}

// Mở app lại (Android) → đặt lại lịch cho mọi việc còn chờ (phòng khi bị xoá lịch)
export async function dongBoLichNhac(userId) {
  await sanSang
  const ln = await pluginThongBao()
  if (!ln) return
  for (const v of layViec(userId).filter((x) => x.trangThai === 'cho' && x.hanLuc > Date.now())) await lenLichNhac(v)
}

// ============================================================
//  TÓM TẮT HÔM NAY (không tốn lượt AI)
// ============================================================
export function tomTatHomNay(userId) {
  const ds = layViec(userId).filter((v) => v.trangThai === 'cho')
  const homNay = dauNgay()
  const quaHan = ds.filter((v) => v.hanLuc < Date.now())
  const trongNgay = ds.filter((v) => v.hanLuc >= Date.now() && v.hanLuc < homNay + 864e5)
  const sapToi = ds.filter((v) => v.hanLuc >= homNay + 864e5 && v.hanLuc < homNay + 3 * 864e5)
  const followUp = ds.filter((v) => v.loai === 'baogia' && v.hanLuc < homNay + 864e5)
  return { quaHan, trongNgay, sapToi, followUp, tong: ds.length }
}

// ============================================================
//  AI: tách việc từ câu nói tự nhiên
// ============================================================
const MAU_CAU_NHAC = /^\s*(maika\s*[,:]?\s*)?(nhắc|nhớ nhắc|hẹn|tạo việc|thêm việc|lên lịch|đặt lịch|ghi nhớ|follow[- ]?up)\b/i

export function laCauTaoViec(text = '') {
  return MAU_CAU_NHAC.test(text)
}

function moTaBayGio() {
  const d = new Date()
  const thu = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()]
  const pad = (n) => String(n).padStart(2, '0')
  return `${thu}, ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SYS_TACH_VIEC = `Bạn trích xuất NHẮC VIỆC từ câu nói tiếng Việt của nhân viên kinh doanh vật liệu xây dựng.
Trả về DUY NHẤT một JSON: {"loai": "baogia|goi|tailieu|hen|sauban|khac", "tieuDe": "câu ngắn gọn bắt đầu bằng động từ", "khach": "tên khách hoặc ''", "sanPham": "sản phẩm hoặc ''", "ghiChu": "chi tiết thêm hoặc ''", "han": "YYYY-MM-DDTHH:mm (giờ địa phương)"}
Quy tắc thời gian: "sáng" = 09:00, "trưa" = 12:00, "chiều" = 15:00, "tối" = 19:00; chỉ có ngày không có giờ → 09:00; "mai" = ngày kế tiếp; "tuần sau" = cùng thứ tuần sau; không nói thời gian → 1 giờ nữa. Giờ đã qua trong hôm nay mà không nói ngày → hiểu là ngày mai.
loai: báo giá/follow-up báo giá → baogia; gọi điện → goi; gửi tài liệu/catalogue/TDS → tailieu; gặp/khảo sát công trình → hen; hỏi thăm sau khi mua → sauban.`

export async function tachViecTuCau(cau, nguoiTao) {
  if (!aiCoCauHinh()) throw new Error('Chưa cấu hình AI')
  const raw = await aiNhanh(`${SYS_TACH_VIEC}\nBây giờ là: ${moTaBayGio()}.`, cau, { json: true })
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  let han = Date.parse(j.han)
  if (!Number.isFinite(han)) han = Date.now() + 3600e3
  return {
    loai: LOAI_VIEC[j.loai] ? j.loai : 'khac',
    tieuDe: String(j.tieuDe || cau).slice(0, 120),
    khach: String(j.khach || ''),
    sanPham: String(j.sanPham || ''),
    ghiChu: String(j.ghiChu || ''),
    hanLuc: han,
    nguon: 'maika',
    nguoiTao,
  }
}

// ============================================================
//  AI: soạn tin follow-up gửi khách
// ============================================================
export async function soanTinFollowUp(v, tenNhanVien = '') {
  const sys = `Bạn là nhân viên kinh doanh của cửa hàng vật liệu xây dựng "Vật Liệu Nhà". Soạn 1 tin nhắn Zalo ngắn (3–5 câu), lịch sự, thân thiện, xưng "em" gọi khách "anh/chị" (hoặc theo tên khách). Không dùng markdown, không bịa giá hay khuyến mãi. Kết thúc bằng lời mời phản hồi.${tenNhanVien ? ` Ký tên: ${tenNhanVien} - Vật Liệu Nhà.` : ''}`
  const yeuCau = `Mục đích: ${LOAI_VIEC[v.loai]?.nhan || v.tieuDe}. Việc: ${v.tieuDe}. Khách: ${v.khach || 'khách hàng'}. Sản phẩm: ${v.sanPham || 'không rõ'}. Ghi chú: ${v.ghiChu || 'không'}.`
  return (await aiNhanh(sys, yeuCau)).replace(/\*\*/g, '').trim()
}
