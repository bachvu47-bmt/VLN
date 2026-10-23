// ============================================================
//  Cài "bộ não chung" của Maika lên Supabase (chạy 1 lần, chạy lại được)
//  node scripts/setup-supabase.mjs
//  Token: biến SUPABASE_ACCESS_TOKEN, hoặc file .supabase-token.local (gitignore)
//  Tuỳ chọn: SUPABASE_PROJECT=<ref hoặc tên>, ADMIN_PIN=<PIN muốn đặt>, BO_QUA_HAM=1 (không deploy hàm)
//  Việc làm:
//   1) chạy supabase/schema.sql (kho tri thức, PIN Admin, đếm lượt)
//   2) đặt PIN Admin → ghi vào .admin-pin.local (KHÔNG in ra màn hình)
//   3) đưa GEMINI_API_KEY / GROQ_API_KEY từ .env.local vào Secrets của Supabase
//   4) deploy hàm máy chủ "maika" (supabase/functions/maika) — app + web cùng gọi
//   5) ghi VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY vào .env.local
//   6) bật đăng nhập Admin bằng mã email (bachvu47@gmail.com), tắt đăng ký tự do → tự kiểm tra
// ============================================================
import { execFileSync } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fileToken = join(ROOT, '.supabase-token.local')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || (existsSync(fileToken) ? readFileSync(fileToken, 'utf8').trim() : '')
if (!TOKEN) throw new Error('Thiếu token: tạo tại supabase.com/dashboard/account/tokens rồi lưu vào .supabase-token.local')

const API = 'https://api.supabase.com/v1'
async function api(duongDan, opts = {}) {
  const res = await fetch(API + duongDan, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...opts.headers },
  })
  const t = await res.text()
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${duongDan} → HTTP ${res.status}: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}
const sql = (ref, query) => api(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query }) })
const ngu = (ms) => new Promise((r) => setTimeout(r, ms))

const envPath = join(ROOT, '.env.local')
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const docEnv = (ten) => (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()

// 1) Chọn project
const projects = await api('/projects')
const muon = process.env.SUPABASE_PROJECT
const p =
  projects.find((x) => muon && (x.id === muon || x.ref === muon || x.name === muon)) ||
  projects.find((x) => ['maika', 'vln-maika'].includes(x.name)) ||
  (projects.length === 1 ? projects[0] : null)
if (!p) throw new Error('Không xác định được project. Có: ' + (projects.map((x) => `${x.name} (${x.id})`).join(', ') || '(chưa có — tạo project "maika" trên dashboard)'))
const ref = p.ref || p.id
console.log(`Project: ${p.name} (${ref}) · ${p.region} · ${p.status}`)
for (let i = 0; i < 40 && (await api(`/projects/${ref}`)).status !== 'ACTIVE_HEALTHY'; i++) {
  if (i === 0) console.log('Đang chờ project khởi động xong…')
  await ngu(15000)
}

// 2) Schema
await sql(ref, readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8'))
console.log('✓ Đã tạo bảng tri_thuc, pgvector, đếm lượt, hàm RPC')

// 3) PIN Admin (chỉ đặt khi chưa có hoặc truyền ADMIN_PIN) — ghi file, không in
const daCoPin = (await sql(ref, 'select count(*)::int as n from public.admin_pin'))[0].n > 0
let pinMoi = process.env.ADMIN_PIN || ''
if (!daCoPin && !pinMoi) {
  const bo = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  pinMoi = Array.from({ length: 10 }, () => bo[randomInt(bo.length)]).join('')
}
if (pinMoi) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(pinMoi)) throw new Error('ADMIN_PIN chỉ gồm chữ/số, 6–32 ký tự')
  await sql(ref, `insert into public.admin_pin (id, pin_hash) values (1, extensions.crypt('${pinMoi}', extensions.gen_salt('bf', 10)))
                  on conflict (id) do update set pin_hash = excluded.pin_hash`)
  writeFileSync(join(ROOT, '.admin-pin.local'), pinMoi + '\n', 'utf8')
  console.log('✓ Đã đặt PIN Admin → lưu ở .admin-pin.local (mở file để xem)')
} else {
  console.log('• Giữ nguyên PIN Admin đang có')
}

function docServiceAccount() {
  const f = readdirSync(ROOT).find((x) => /firebase-adminsdk.*\.json$/i.test(x))
  if (!f) return ''
  const sa = JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
  if (!sa.private_key || !sa.client_email) throw new Error(`${f} không phải file khoá service account`)
  console.log(`• Khoá Firebase: ${f} (project ${sa.project_id})`)
  return JSON.stringify(sa)
}
// Tạo 1 lần, giữ trong .env.local (KV_WEBHOOK_SECRET) để GitHub Secret và Supabase Secret luôn trùng nhau
function khoaWebhookKiotViet() {
  let k = docEnv('KV_WEBHOOK_SECRET')
  if (!k) {
    k = randomBytes(24).toString('hex')
    env = env.replace(/\s*$/, '') + `\n\n# Khoá bí mật webhook hoá đơn KiotViet (trùng GitHub Secret KV_WEBHOOK_SECRET)\nKV_WEBHOOK_SECRET=${k}\n`
    writeFileSync(envPath, env, 'utf8')
    console.log('• Đã tạo KV_WEBHOOK_SECRET trong .env.local — chạy scripts/dat-secret-kho-chung.cjs để đưa lên GitHub')
  }
  return k
}

// 4) Secrets: key AI chỉ nằm trên máy chủ
const secrets = [
  ['GEMINI_API_KEY', docEnv('VITE_GEMINI_API_KEY')],
  ['GROQ_API_KEY', docEnv('VITE_GROQ_API_KEY')],
  // Zalo OA (developers.zalo.me → ứng dụng liên kết OA) — có thì hàm "zalo" mới chạy
  ['ZALO_APP_ID', docEnv('ZALO_APP_ID')],
  ['ZALO_APP_SECRET', docEnv('ZALO_APP_SECRET')],
  ['ZALO_OA_SECRET', docEnv('ZALO_OA_SECRET')],
  // Khoá nội bộ hàm "zalo" → hàm "maika" (đếm lượt theo từng khách Zalo); mỗi lần cài tạo mới
  ['MAIKA_KHOA_NOI', randomBytes(24).toString('hex')],
  // Thông báo đẩy: file khoá service account Firebase (*firebase-adminsdk*.json ở thư mục gốc, gitignore)
  ['FCM_SERVICE_ACCOUNT', docServiceAccount()],
  // Webhook hoá đơn KiotViet: khoá bí mật dùng chung với GitHub Secret KV_WEBHOOK_SECRET
  ['KV_WEBHOOK_SECRET', khoaWebhookKiotViet()],
].filter(([, v]) => v)
if (secrets.length) {
  await api(`/projects/${ref}/secrets`, { method: 'POST', body: JSON.stringify(secrets.map(([name, value]) => ({ name, value }))) })
  console.log(`✓ Đã cất ${secrets.map(([n]) => n).join(', ')} vào Secrets của Supabase`)
} else {
  console.log('⚠ .env.local chưa có VITE_GEMINI_API_KEY / VITE_GROQ_API_KEY — hàm maika sẽ chưa trả lời được')
}

// 5) Deploy hàm "maika" (Supabase CLI bundle trên máy chủ, không cần Docker)
if (!process.env.BO_QUA_HAM) {
  for (const ham of ['maika', 'zalo', 'kiotviet', 'thong-bao']) {
    if (!existsSync(join(ROOT, 'supabase', 'functions', ham))) continue
    execFileSync('npx', ['--yes', 'supabase@latest', 'functions', 'deploy', ham, '--project-ref', ref, '--use-api', '--no-verify-jwt'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
    })
    console.log(`✓ Đã deploy hàm ${ham}`)
  }
}

// 6) Key public (ưu tiên publishable key mới, fallback anon legacy) → .env.local
const keys = await api(`/projects/${ref}/api-keys?reveal=true`)
const k = keys.find((x) => x.type === 'publishable') || keys.find((x) => x.name === 'anon')
if (!k?.api_key) throw new Error('Không lấy được key public của project')
const url = `https://${ref}.supabase.co`
const datBien = (ten, giaTri) => {
  const dong = `${ten}=${giaTri}`
  env = new RegExp(`^${ten}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${ten}=.*$`, 'm'), dong) : env.replace(/\s*$/, '') + `\n${dong}\n`
}
if (!env.includes('VITE_SUPABASE_URL')) env = env.replace(/\s*$/, '') + '\n\n# Bộ não chung Maika (Supabase) — key public, chỉ đọc; ghi cần PIN Admin\n'
datBien('VITE_SUPABASE_URL', url)
datBien('VITE_SUPABASE_ANON_KEY', k.api_key)
writeFileSync(envPath, env, 'utf8')
console.log(`✓ Đã ghi VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (${k.type || k.name}) vào .env.local`)

// Khung chat web gọi đúng hàm maika của project này
const widgetPath = join(ROOT, 'web', 'maika-widget.js')
if (existsSync(widgetPath)) {
  const w = readFileSync(widgetPath, 'utf8')
  const moi = w.replace(/var URL_MAIKA = CAU_HINH\.url \|\| '[^']*'/, `var URL_MAIKA = CAU_HINH.url || '${url}/functions/v1/maika'`)
  if (moi !== w) writeFileSync(widgetPath, moi, 'utf8')
  console.log('✓ web/maika-widget.js trỏ tới ' + `${url}/functions/v1/maika`)
}

// 6b) Đăng nhập email Admin (thay PIN trên app): mã 6 số qua email, KHÔNG cho đăng ký tự do,
//     tạo sẵn tài khoản đã xác minh cho email Admin. Máy chủ chỉ nhận đúng email này (schema.sql: _la_email_admin).
const EMAIL_ADMIN = 'bachvu47@gmail.com'
await api(`/projects/${ref}/config/auth`, {
  method: 'PATCH',
  body: JSON.stringify({ external_email_enabled: true, disable_signup: true, mailer_otp_length: 6, mailer_otp_exp: 600 }),
})
// Mẫu email có MÃ 6 số: gói Free + hộp thư mặc định của Supabase KHÔNG cho sửa mẫu (email chỉ có link)
// → khi đó app ẩn đăng nhập bằng email, Admin dùng PIN. Cấu hình SMTP riêng rồi chạy lại script là bật được.
let coMaEmail = true
try {
  await api(`/projects/${ref}/config/auth`, {
    method: 'PATCH',
    body: JSON.stringify({
      mailer_subjects_magic_link: 'Mã đăng nhập Admin Vật Liệu Nhà: {{ .Token }}',
      mailer_templates_magic_link_content:
        '<h2>Mã đăng nhập Admin</h2><p>Nhập mã này trong app Vật Liệu Nhà (Duyệt kiến thức / Tài khoản):</p>' +
        '<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>' +
        '<p>Mã hết hạn sau 10 phút. Không phải bạn yêu cầu? Bỏ qua email này.</p>',
    }),
  })
} catch (e) {
  coMaEmail = false
  console.log(`⚠ Chưa đặt được mẫu email có mã (${/free tier|custom SMTP/i.test(e.message) ? 'gói Free cần SMTP riêng' : e.message.slice(0, 120)}) — app dùng PIN Admin`)
}
await sql(ref, `insert into public.cau_hinh (khoa, gia_tri, cap_nhat_luc) values ('dang_nhap_email', '${coMaEmail ? '1' : '0'}', now())
                on conflict (khoa) do update set gia_tri = excluded.gia_tri, cap_nhat_luc = now()`)
const khoaBiMat = keys.find((x) => x.name === 'service_role') || keys.find((x) => x.type === 'secret')
if (!khoaBiMat?.api_key) throw new Error('Không lấy được key service_role/secret để tạo tài khoản Admin')
const taoAdmin = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: khoaBiMat.api_key, Authorization: `Bearer ${khoaBiMat.api_key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL_ADMIN, email_confirm: true }),
})
if (!taoAdmin.ok && taoAdmin.status !== 422) throw new Error(`Tạo tài khoản Admin lỗi HTTP ${taoAdmin.status}: ${(await taoAdmin.text()).slice(0, 200)}`)
console.log(`✓ Tài khoản Admin ${EMAIL_ADMIN} (${taoAdmin.ok ? 'vừa tạo' : 'đã có'}) · đã tắt đăng ký tự do · đăng nhập bằng mã email: ${coMaEmail ? 'BẬT' : 'TẮT (dùng PIN)'}`)

// 7) Tự kiểm tra bằng đúng key app/web sẽ dùng
const hdr = { apikey: k.api_key, Authorization: `Bearer ${k.api_key}`, 'Content-Type': 'application/json' }
const doc = await fetch(`${url}/rest/v1/tri_thuc?select=id&limit=1`, { headers: hdr })
const ghi = await fetch(`${url}/rest/v1/tri_thuc`, { method: 'POST', headers: hdr, body: JSON.stringify({ id: 'hack', loai: 'web', trang_thai: 'da_duyet' }) })
const luot = await fetch(`${url}/rest/v1/rpc/dem_luot`, { method: 'POST', headers: hdr, body: JSON.stringify({ p_khoa: 'x', p_gioi_han: 1, p_khoa_tong: 'y', p_gioi_han_tong: 1 }) })
console.log(`✓ Kiểm tra: đọc HTTP ${doc.status} (kỳ vọng 200) · ghi bằng key public HTTP ${ghi.status} (kỳ vọng 401/403) · gọi dem_luot bằng key public HTTP ${luot.status} (kỳ vọng 401/403/404)`)
if (!process.env.BO_QUA_HAM) {
  const r = await fetch(`${url}/functions/v1/maika`, { method: 'POST', headers: hdr, body: JSON.stringify({ cheDo: 'khach', lichSu: [{ tu: 'user', text: 'Chống thấm sàn vệ sinh nên dùng vật liệu gì?' }] }) })
  const j = await r.json().catch(() => ({}))
  console.log(`✓ Thử hỏi Maika (chế độ khách): HTTP ${r.status} · ${j.nhaCungCap || ''} · ${(j.text || j.loi || '').slice(0, 160).replace(/\s+/g, ' ')}…`)
}
console.log(`URL=${url}`)
