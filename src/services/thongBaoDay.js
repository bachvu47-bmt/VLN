// ============================================================
//  THÔNG BÁO ĐẨY (Android, Firebase Cloud Messaging) — máy chủ báo xuống cả khi app đang tắt
//  - Hoá đơn KiotViet mới (chỉ máy Admin), có bản app mới (mọi máy), bản tin báo cáo (Admin)
//  - Token FCM → bảng thiet_bi trên kho chung (kèm PIN Admin nếu máy đã nhập PIN)
//  - Chạm thông báo → onMo(duLieu) để App mở đúng màn ({ man: 'baocao' | 'cap-nhat' | 'home' })
//  PC/web: không có FCM — app đang mở vẫn thấy hoá đơn qua KiotViet 15 phút/lần như cũ.
// ============================================================
import { coKhoChung, dangKyThietBi, LS_FCM, LS_FCM_TEN } from './khoChung'

const KENH = [
  { id: 'hoa-don', name: 'Hoá đơn mới', description: 'Hoá đơn KiotViet vừa tạo', importance: 5, vibration: true },
  { id: 'cap-nhat', name: 'Bản cập nhật', description: 'VatLieuNha Sales có bản mới', importance: 4 },
  { id: 'ban-tin', name: 'Bản tin Maika', description: 'Bản tin báo cáo hằng ngày', importance: 4 },
  { id: 'chung', name: 'Thông báo chung', description: 'Thông báo khác từ Maika', importance: 3 },
]

const laAndroid = () => typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'

// Gọi khi đã đăng nhập; trả hàm gỡ listener. onDen: thông báo tới lúc app đang mở (hiện toast)
export async function batDauThongBaoDay(user, { onMo, onDen } = {}) {
  if (!laAndroid() || !coKhoChung()) return () => {}
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let quyen = await PushNotifications.checkPermissions()
  if (quyen.receive === 'prompt' || quyen.receive === 'prompt-with-rationale') quyen = await PushNotifications.requestPermissions()
  if (quyen.receive !== 'granted') return () => {}

  for (const k of KENH) await PushNotifications.createChannel({ ...k, visibility: 1 }).catch(() => {})

  const ds = [
    await PushNotifications.addListener('registration', ({ value }) => {
      const ten = user?.ten || user?.id || ''
      try {
        localStorage.setItem(LS_FCM, value) // để nhập PIN Admin sau vẫn đăng ký lại được (khoChung.luuPinAdmin)
        localStorage.setItem(LS_FCM_TEN, ten)
      } catch {
        /* bỏ qua */
      }
      dangKyThietBi(value, ten).catch((e) => console.warn('[Thông báo] đăng ký máy lỗi:', e.message))
    }),
    await PushNotifications.addListener('registrationError', (e) => console.warn('[Thông báo] FCM lỗi:', e?.error)),
    await PushNotifications.addListener('pushNotificationReceived', (n) => onDen?.(n)),
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => onMo?.(notification?.data || {})),
  ]
  await PushNotifications.register()
  return () => ds.forEach((l) => l.remove())
}
