// ============================================================
//  CẤP QUYỀN CHO MAIKA TRẢ LỜI TRÊN ZALO OA (chạy 1 lần; token hết hạn quá 90 ngày thì chạy lại)
//  node scripts/zalo-cap-quyen.mjs
//  Cần: .env.local có ZALO_APP_ID, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY + .admin-pin.local
//  In ra 1 link → Admin OA mở, bấm "Cho phép" → Zalo gọi lại hàm "zalo" kèm code → hàm tự đổi
//  lấy token và lưu (bảng zalo_token, key public không đọc được). Dùng PKCE (code_verifier).
// ============================================================
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : ''
const docEnv = (ten) => process.env[ten] || (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()
const APP_ID = docEnv('ZALO_APP_ID')
const URL_KHO = docEnv('VITE_SUPABASE_URL').replace(/\/$/, '')
const KEY = docEnv('VITE_SUPABASE_ANON_KEY')
const PIN = process.env.ADMIN_PIN || (existsSync(join(ROOT, '.admin-pin.local')) ? readFileSync(join(ROOT, '.admin-pin.local'), 'utf8').trim() : '')
if (!APP_ID || !URL_KHO || !KEY || !PIN) throw new Error('Thiếu ZALO_APP_ID / VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / PIN Admin')

const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const verifier = b64url(randomBytes(48))
const challenge = b64url(createHash('sha256').update(verifier).digest())
const state = b64url(randomBytes(16))

const r = await fetch(`${URL_KHO}/rest/v1/rpc/admin_zalo_bat_dau`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_pin: PIN, p_state: state, p_verifier: verifier }),
})
if (!r.ok) throw new Error(`Ghi phiên cấp quyền lỗi HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)

const callback = `${URL_KHO}/functions/v1/zalo`
const link = `https://oauth.zaloapp.com/v4/oa/permission?${new URLSearchParams({ app_id: APP_ID, redirect_uri: callback, code_challenge: challenge, state })}`
console.log('Callback URL phải khai báo trong ứng dụng Zalo (Official Account → Thiết lập chung):')
console.log('  ' + callback)
console.log('\nMở link này bằng tài khoản Admin của OA Vật Liệu Nhà rồi bấm "Cho phép" (hiệu lực 1 ngày):')
console.log('  ' + link)
