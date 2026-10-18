// ============================================================
//  DỊCH VỤ CẬP NHẬT OTA — dùng chung cho PC (.exe) & Mobile (.apk)
//  - PC:    cầu nối tới electron-updater qua window.desktop.updater
//  - Mobile: tải .apk từ server nội bộ & mở trình cài đặt đè (in-app)
//  - Web/Dev: mô phỏng (mock) để test giao diện
// ============================================================
import { BAN_CAP_NHAT_SERVER, PHIEN_BAN_HIEN_TAI } from '../data/appInfo'

// Nhận biết nền tảng đang chạy
export function nhanDienNenTang() {
  if (typeof window !== 'undefined' && window.desktop?.updater) return 'pc'
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return 'mobile'
  return 'web'
}

// So sánh phiên bản dạng "1.2.3"
function moiHon(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// 1) KIỂM TRA CẬP NHẬT
export async function kiemTraCapNhat() {
  const nt = nhanDienNenTang()

  // PC thật: gọi electron-updater
  if (nt === 'pc') {
    try {
      const res = await window.desktop.updater.check()
      return { ...res, nenTang: nt }
    } catch {
      // nếu lỗi server, rơi về dữ liệu mock bên dưới
    }
  }

  await delay(900) // mô phỏng gọi mạng
  const coMoi = moiHon(BAN_CAP_NHAT_SERVER.phienBan, PHIEN_BAN_HIEN_TAI)
  return {
    nenTang: nt,
    coCapNhat: coMoi,
    hienTai: PHIEN_BAN_HIEN_TAI,
    moi: coMoi ? BAN_CAP_NHAT_SERVER : null,
  }
}

// 2) TẢI BẢN CẬP NHẬT (báo tiến độ qua onProgress 0..100)
export async function taiBanCapNhat(onProgress) {
  const nt = nhanDienNenTang()

  if (nt === 'pc') {
    // electron-updater sẽ tự tải & phát sự kiện tiến độ
    return window.desktop.updater.download(onProgress)
  }

  // Mobile & Web: mô phỏng tải file (.apk) theo %
  for (let p = 0; p <= 100; p += 5) {
    onProgress?.(p)
    await delay(90)
  }
  return { ok: true }
}

// 3) CÀI ĐẶT & KHỞI ĐỘNG LẠI
export async function caiDatVaKhoiDongLai() {
  const nt = nhanDienNenTang()

  if (nt === 'pc') {
    // electron-updater: thoát app và cài bản mới, rồi tự mở lại
    return window.desktop.updater.install()
  }

  if (nt === 'mobile') {
    // Mở trình cài đặt .apk đè lên bản cũ (Android Package Installer)
    // Bản thật dùng plugin mở Intent ACTION_VIEW tới file .apk đã tải.
    alert('Đang mở trình cài đặt .apk để cập nhật đè phiên bản mới...')
    return { ok: true }
  }

  // Web: không cài được — chỉ tải lại trang
  alert('Bản Web sẽ tự áp dụng bản mới sau khi tải lại trang.')
  return { ok: true }
}
