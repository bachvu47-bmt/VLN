// ============================================================
//  TÌM INTERNET TRÊN ĐIỆN THOẠI — DuckDuckGo Lite bằng IP điện thoại (IP máy chủ Supabase bị chặn)
//  → khối kết quả gửi kèm câu hỏi cho máy chủ Maika (body.ketQuaInternet). Cách đọc kết quả dùng chung
//  với máy chủ (_shared/maikaNao.js). PC/web (không phải Android) → máy chủ tự tìm.
// ============================================================
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { cauTimWeb, khoiInternet, phanTichDdg, RE_TIM_WEB, UA_WEB, urlTimDdg, vanBanTrang } from '../../supabase/functions/_shared/maikaNao.js'

export const canTimWeb = (cau = '') => RE_TIM_WEB.test(cau)

const layHtml = (url, ms) =>
  CapacitorHttp.get({ url, headers: { 'User-Agent': UA_WEB, 'Accept-Language': 'vi-VN,vi;q=0.9' }, connectTimeout: ms, readTimeout: ms, responseType: 'text' })
    .then((r) => (r.status < 400 && typeof r.data === 'string' ? r.data : ''))
    .catch(() => '')

export async function timInternetTrenMay(lichSu) {
  if (!Capacitor.isNativePlatform()) return ''
  const cau = cauTimWeb(lichSu)
  if (!cau) return ''
  const kq = phanTichDdg(await layHtml(urlTimDdg(cau), 5000))
  if (!kq.length) return ''
  // Đọc nhanh 3 trang đầu song song — trang chậm/lỗi thì chỉ dùng đoạn tóm tắt
  const noiDung = await Promise.all(kq.slice(0, 3).map((x) => layHtml(x.url, 4000).then((h) => vanBanTrang(h).slice(0, 1500))))
  return khoiInternet(kq, noiDung)
}
