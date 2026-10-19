// ============================================================
//  Cài kho tri thức chung của Maika lên Supabase (chạy 1 lần, chạy lại được)
//  $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/setup-supabase.mjs
//  Tuỳ chọn: SUPABASE_PROJECT=<ref hoặc tên>, ADMIN_PIN=<PIN muốn đặt>
//  Việc làm: chạy supabase/schema.sql → đặt PIN Admin → lấy URL + key public
//  → ghi VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY vào .env.local → tự kiểm tra.
// ============================================================
import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) throw new Error('Thiếu SUPABASE_ACCESS_TOKEN (tạo tại supabase.com/dashboard/account/tokens)')

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

// 1) Chọn project
const projects = await api('/projects')
const muon = process.env.SUPABASE_PROJECT
const p =
  projects.find((x) => muon && (x.id === muon || x.ref === muon || x.name === muon)) ||
  projects.find((x) => x.name === 'vln-maika') ||
  (projects.length === 1 ? projects[0] : null)
if (!p) throw new Error('Không xác định được project. Có: ' + projects.map((x) => `${x.name} (${x.id})`).join(', '))
const ref = p.ref || p.id
console.log(`Project: ${p.name} (${ref}) · ${p.region} · ${p.status}`)
for (let i = 0; i < 40 && (await api(`/projects/${ref}`)).status !== 'ACTIVE_HEALTHY'; i++) {
  if (i === 0) console.log('Đang chờ project khởi động xong…')
  await ngu(15000)
}

// 2) Schema
await sql(ref, readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8'))
console.log('✓ Đã tạo bảng tri_thuc, pgvector, hàm RPC')

// 3) PIN Admin (chỉ đặt khi chưa có hoặc truyền ADMIN_PIN)
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
  console.log('✓ Đã đặt PIN Admin')
} else {
  console.log('• Giữ nguyên PIN Admin đang có')
}

// 4) Key public (ưu tiên publishable key mới, fallback anon legacy)
const keys = await api(`/projects/${ref}/api-keys?reveal=true`)
const k = keys.find((x) => x.type === 'publishable') || keys.find((x) => x.name === 'anon')
if (!k?.api_key) throw new Error('Không lấy được key public của project')
const url = `https://${ref}.supabase.co`

// 5) Ghi .env.local
const envPath = join(ROOT, '.env.local')
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const datBien = (ten, giaTri) => {
  const dong = `${ten}=${giaTri}`
  env = new RegExp(`^${ten}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${ten}=.*$`, 'm'), dong) : env.replace(/\s*$/, '') + `\n${dong}\n`
}
if (!env.includes('VITE_SUPABASE_URL')) env = env.replace(/\s*$/, '') + '\n\n# Kho tri thức chung của Maika (Supabase) — key public, chỉ đọc; ghi cần PIN Admin\n'
datBien('VITE_SUPABASE_URL', url)
datBien('VITE_SUPABASE_ANON_KEY', k.api_key)
writeFileSync(envPath, env, 'utf8')
console.log(`✓ Đã ghi VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (${k.type || k.name}) vào .env.local`)

// 6) Tự kiểm tra bằng đúng key app sẽ dùng
const rest = (path, body) =>
  fetch(`${url}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: k.api_key, Authorization: `Bearer ${k.api_key}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
const doc = await rest('tri_thuc?select=id&limit=1')
const ghiTrucTiep = await rest('tri_thuc', { id: 'hack', loai: 'web', trang_thai: 'da_duyet' })
console.log(`✓ Kiểm tra: đọc bảng HTTP ${doc.status} (kỳ vọng 200) · ghi trực tiếp bằng key public HTTP ${ghiTrucTiep.status} (kỳ vọng 401/403 = bị chặn)`)
if (pinMoi) {
  const ok = await (await rest('rpc/kiem_tra_pin', { p_pin: pinMoi })).json()
  console.log(`✓ PIN Admin xác thực qua API: ${ok}`)
  console.log(`\n>>> PIN ADMIN: ${pinMoi}   (nhập ở app: Tài khoản → Kho tri thức chung)\n`)
}
console.log(`URL=${url}`)
