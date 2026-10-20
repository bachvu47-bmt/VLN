// ============================================================
//  GỬI THÔNG BÁO ĐẨY (Firebase Cloud Messaging HTTP v1) — dùng chung cho các hàm máy chủ
//  Secret FCM_SERVICE_ACCOUNT = nội dung file khoá service account (JSON) của project Firebase.
//  Ký JWT RS256 bằng WebCrypto → đổi lấy access token OAuth (cache ~55 phút) → gửi từng máy.
//  Token máy đã gỡ app / hết hạn (404 UNREGISTERED) → xoá khỏi bảng thiet_bi.
// ============================================================
const SA = (() => {
  try {
    return JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '{}')
  } catch {
    return {}
  }
})()

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer)
  let s = ''
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let _token = { gia: '', het: 0 }
async function accessToken() {
  if (_token.gia && Date.now() < _token.het) return _token.gia
  if (!SA.private_key || !SA.client_email) throw new Error('Chưa cấu hình FCM_SERVICE_ACCOUNT')
  const pem = SA.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const khoa = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const bayGio = Math.floor(Date.now() / 1000)
  const dau = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const than = b64url(JSON.stringify({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: bayGio,
    exp: bayGio + 3600,
  }))
  const ky = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', khoa, new TextEncoder().encode(`${dau}.${than}`)))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${than}.${ky}` }),
  })
  const d = await r.json()
  if (!d.access_token) throw new Error(`FCM OAuth lỗi: ${JSON.stringify(d).slice(0, 200)}`)
  _token = { gia: d.access_token, het: Date.now() + 55 * 60 * 1000 }
  return _token.gia
}

export type ThongBao = {
  tieuDe: string
  noiDung: string
  kenh?: 'hoa-don' | 'cap-nhat' | 'ban-tin' | 'chung' // kênh Android (app tạo sẵn, âm thanh/ưu tiên khác nhau)
  duLieu?: Record<string, string> // app đọc khi người dùng chạm vào thông báo (vd { man: 'home' })
}

// sql: kết nối postgres của hàm gọi. chiAdmin: chỉ máy đã đăng ký kèm PIN Admin
export async function guiThongBao(sql: any, tb: ThongBao, { chiAdmin = false } = {}) {
  const ds = chiAdmin
    ? await sql`select token from public.thiet_bi where la_admin`
    : await sql`select token from public.thiet_bi`
  if (!ds.length) return { gui: 0, loi: 0 }
  const at = await accessToken()
  let gui = 0
  const hong: string[] = []
  await Promise.all(ds.map(async ({ token }: { token: string }) => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: tb.tieuDe.slice(0, 120), body: tb.noiDung.slice(0, 900) },
          data: { ...(tb.duLieu || {}) },
          android: { priority: 'high', notification: { channel_id: tb.kenh || 'chung', sound: 'default' } },
        },
      }),
    })
    if (r.ok) gui++
    else {
      const t = await r.text()
      // Chỉ xoá khi lỗi đúng là token chết — lỗi nội dung (INVALID_ARGUMENT khác) không được xoá cả danh sách máy
      if (r.status === 404 || /UNREGISTERED|not a valid FCM registration token/i.test(t)) hong.push(token)
      else console.warn('[fcm] gửi lỗi', r.status, t.slice(0, 200))
    }
  }))
  if (hong.length) await sql`delete from public.thiet_bi where token = any(${hong})`
  return { gui, loi: ds.length - gui }
}
