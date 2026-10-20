// ============================================================
//  ĐƯA CẤU HÌNH "BỘ NÃO CHUNG" MAIKA LÊN GITHUB SECRETS (chạy lại được)
//  - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (từ .env.local): bản build .apk/.exe dùng kho chung
//  - MAIKA_ADMIN_PIN (từ .admin-pin.local): workflow nap-kho-chung.yml ghi tri thức hằng ngày
//  Chạy: node scripts/dat-secret-kho-chung.cjs   (token: GH_TOKEN hoặc .gh-token.local)
//  Không in giá trị bí mật ra màn hình.
// ============================================================
const fs = require('fs')
const path = require('path')
const sodium = require('libsodium-wrappers')

const ROOT = path.join(__dirname, '..')
const REPO = process.env.GH_REPO || 'bachvu47-bmt/VLN'
const docFile = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '')
const TOKEN = (process.env.GH_TOKEN || docFile('.gh-token.local')).trim()
if (!TOKEN) throw new Error('Thiếu token GitHub: GH_TOKEN hoặc .gh-token.local')

const env = docFile('.env.local')
const docEnv = (ten) => (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()
const secrets = {
  VITE_SUPABASE_URL: docEnv('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: docEnv('VITE_SUPABASE_ANON_KEY'),
  MAIKA_ADMIN_PIN: docFile('.admin-pin.local').trim(),
}
for (const [ten, v] of Object.entries(secrets)) if (!v) throw new Error(`Thiếu giá trị ${ten} — chạy scripts/setup-supabase.mjs trước`)

async function api(method, duongDan, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${duongDan}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'vln-kho-chung', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`GitHub ${method} ${duongDan} → HTTP ${r.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

;(async () => {
  await sodium.ready
  const { key, key_id } = await api('GET', '/actions/secrets/public-key')
  const khoa = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  for (const [ten, v] of Object.entries(secrets)) {
    const enc = sodium.crypto_box_seal(sodium.from_string(v), khoa)
    await api('PUT', `/actions/secrets/${ten}`, { encrypted_value: sodium.to_base64(enc, sodium.base64_variants.ORIGINAL), key_id })
    console.log(`✓ GitHub Secret ${ten}`)
  }
})().catch((e) => {
  console.error('✗', e.message || e)
  process.exit(1)
})
