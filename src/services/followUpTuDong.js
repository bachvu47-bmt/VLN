// ============================================================
//  JOB FOLLOW-UP TỰ ĐỘNG (Proactive Agent · Maika 2.0)
//  Google Sheet báo cáo bán hàng hằng ngày → mỗi khách lấy trạng thái MỚI NHẤT:
//    (Hôm nay − Ngày báo giá ≥ 2 ngày) VÀ (Trạng thái = chưa chốt)
//    → Maika tự tạo việc "Follow-up báo giá" vào "Việc cần làm hôm nay"
//      của đúng sales phụ trách (cột Nhân viên trên sheet).
//  - Mỗi báo giá (khách + ngày báo giá) chỉ tạo nhắc 1 lần, kể cả khi đã xoá việc.
//  - Lấy "≥ 2 ngày" (tối đa 7) thay vì "= 2 ngày": sales không mở app đúng ngày
//    thứ 2 thì lần mở app sau vẫn nhận nhắc, không bị sót báo giá.
//  - Việc nằm trên máy từng sales (IndexedDB) → job chạy trên máy của chính người đó:
//    khi mở app, mỗi 15 phút, và khi quay lại app.
// ============================================================
import { idbGet, idbPut, STORE_KV } from '../data/idb'
import { NGUOI_DUNG } from '../data/mockData'
import { dauNgay, layViec, sanSang } from '../data/viecStore'
import { coNguonBaoCao, laChuaChot, taiBaoCao } from './baoCaoSheets'
import { taoViec } from './troLyChuDong'

export const SO_NGAY_FOLLOW_UP = 2
const TOI_DA_NGAY = 7 // báo giá im lặng lâu hơn → để màn Báo cáo xử lý hàng loạt
// 15 phút/lần: sheet ~1.000 dòng tải < 1s → nhắc gần thời gian thực khi sales cập nhật báo cáo
const CHU_KY_MS = 15 * 60 * 1000
const KEY_DA_TAO = 'vln_fu_tu_dong' // khoá "khách|ngày báo giá" đã tạo nhắc
const KEY_LAN_CUOI = 'vln_fu_tu_dong_luc'

const boDau = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()

// Tên nhân viên trên sheet ↔ tài khoản app: khớp đủ họ tên (hoặc tenTrenSheet);
// sheet chỉ ghi tên/tên đệm ("Tuấn", "Minh Tuấn") → khớp đuôi họ tên nếu chỉ 1 người trùng.
export function khopNhanVien(tenSheet, user) {
  const t = boDau(tenSheet)
  if (!t || !user) return false
  const tenUser = (u) => [u.tenTrenSheet, u.hoTen].filter(Boolean).map(boDau)
  if (tenUser(user).includes(t)) return true
  const khopDuoi = (u) => tenUser(u).some((ten) => ten.endsWith(' ' + t))
  const ung = NGUOI_DUNG.filter(khopDuoi)
  return ung.length === 1 && ung[0].id === user.id
}

const khoaKhach = (r) => r.sdt || r.khach.toLowerCase()

// Báo giá chưa chốt của 1 sales đến hạn follow-up hôm nay (chưa tạo nhắc)
export function baoGiaDenHan(rows, user, daTao = new Set(), bayGio = Date.now()) {
  const cuoi = new Map()
  for (const r of rows) {
    const k = khoaKhach(r)
    if (!k) continue
    const c = cuoi.get(k)
    if (!c || r.lienHe >= c.lienHe) cuoi.set(k, r)
  }
  const homNay = dauNgay(bayGio)
  const kq = []
  for (const [k, r] of cuoi) {
    if (!laChuaChot(r.tinhTrang) || !khopNhanVien(r.nhanVien, user)) continue
    const ngayBaoGia = dauNgay(r.lienHe)
    const soNgay = Math.round((homNay - ngayBaoGia) / 864e5)
    if (soNgay < SO_NGAY_FOLLOW_UP || soNgay > TOI_DA_NGAY) continue
    const khoa = `${k}|${ngayBaoGia}`
    if (!daTao.has(khoa)) kq.push({ r, khoa, soNgay, ngayBaoGia })
  }
  return kq.sort((a, b) => b.soNgay - a.soNgay)
}

let _dangQuet = null

// Chạy 1 lượt quét → trả về danh sách việc vừa tạo
export function quetFollowUp(user, { batBuoc = false } = {}) {
  if (!user || !coNguonBaoCao()) return Promise.resolve([])
  if (_dangQuet) return _dangQuet
  _dangQuet = (async () => {
    await sanSang
    const { rows } = await taiBaoCao({ batBuoc })
    const daTao = new Set((await idbGet(STORE_KV, KEY_DA_TAO).catch(() => null)) || [])
    const denHan = baoGiaDenHan(rows, user, daTao)
    // Việc báo giá đã có (đang chờ, hoặc đã xong từ sau ngày báo giá) — khớp theo SĐT hoặc tên không dấu
    const viecBaoGia = layViec(user.id).filter((v) => v.loai === 'baogia')
    const daCoNhac = (r, ngayBaoGia) =>
      viecBaoGia.some(
        (v) =>
          (v.trangThai === 'cho' || (v.taoLuc || 0) >= ngayBaoGia) &&
          ((r.sdt && v.sdt && v.sdt.replace(/\D/g, '') === r.sdt.replace(/\D/g, '')) ||
            (r.khach && boDau(v.khach) === boDau(r.khach))),
      )
    const han9h = new Date(dauNgay())
    han9h.setHours(9, 0, 0, 0)
    const daTaoViec = []
    for (const { r, khoa, soNgay, ngayBaoGia } of denHan) {
      daTao.add(khoa)
      const ten = r.khach || r.sdt
      if (daCoNhac(r, ngayBaoGia)) continue // đã có nhắc follow-up (tạo tay / từ Báo cáo / đã gọi xong)
      daTaoViec.push(
        await taoViec({
          loai: 'baogia',
          tieuDe: `Follow-up báo giá ${ten}`,
          khach: ten,
          sdt: r.sdt,
          sanPham: r.sanPham,
          ghiChu: [
            `Báo giá ngày ${new Date(ngayBaoGia).toLocaleDateString('vi-VN')} · ${soNgay} ngày chưa chốt`,
            r.tinhTrang && `Trạng thái: ${r.tinhTrang}`,
            r.doanhThu > 0 && `Giá trị: ${r.doanhThu.toLocaleString('vi-VN')}đ`,
            r.lyDo && `Lý do: ${r.lyDo}`,
          ]
            .filter(Boolean)
            .join(' · '),
          // 9:00 hôm nay; quá 9h thì nhắc ngay sau 1–2 phút (giãn cách từng việc)
          hanLuc: Math.max(han9h.getTime(), Date.now() + (daTaoViec.length + 1) * 60000),
          nguon: 'sheet',
          khoaNguon: khoa,
          nguoiTao: user.id,
        }),
      )
    }
    if (denHan.length) await idbPut(STORE_KV, [...daTao].slice(-3000), KEY_DA_TAO).catch(() => {})
    await idbPut(STORE_KV, Date.now(), KEY_LAN_CUOI).catch(() => {})
    return daTaoViec
  })().finally(() => {
    _dangQuet = null
  })
  return _dangQuet
}

export async function lanQuetCuoi() {
  return (await idbGet(STORE_KV, KEY_LAN_CUOI).catch(() => 0)) || 0
}

// Lịch chạy: ngay khi mở app, mỗi 15 phút, và khi quay lại app sau ≥ 15 phút
export function batDauJobFollowUp(user, onTao) {
  // Không kiểm tra coNguonBaoCao() ở đây: Admin dán link sheet giữa phiên thì lượt quét kế tiếp tự chạy
  // (quetFollowUp tự bỏ qua khi chưa có nguồn)
  if (!user) return () => {}
  let luc = 0
  const chay = (batBuoc = false) => {
    luc = Date.now()
    quetFollowUp(user, { batBuoc })
      .then((ds) => ds.length && onTao?.(ds))
      .catch((e) => console.warn('[Follow-up tự động]', e.message))
  }
  const khiQuayLai = () => document.visibilityState !== 'hidden' && Date.now() - luc > CHU_KY_MS && chay(true)
  const t0 = setTimeout(() => chay(false), 3000) // nhường app tải xong
  const id = setInterval(() => chay(true), CHU_KY_MS)
  document.addEventListener('visibilitychange', khiQuayLai)
  return () => {
    clearTimeout(t0)
    clearInterval(id)
    document.removeEventListener('visibilitychange', khiQuayLai)
  }
}
