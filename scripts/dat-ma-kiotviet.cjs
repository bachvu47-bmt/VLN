// ============================================================
//  ĐẶT LẠI "MÃ DỮ LIỆU CỬA HÀNG" KIOTVIET — tự động trọn gói
//  1) Sinh mã mới ngẫu nhiên → nạp vào GitHub Secret KV_MA_DU_LIEU
//  2) Chạy workflow "Đồng bộ KiotViet" để mã hoá lại dữ liệu bằng mã mới
//  3) Tải file mới về, THỬ GIẢI MÃ bằng mã mới → in mã ra để nhập vào app
//  Client ID / Secret KiotViet giữ nguyên trong GitHub Secrets, script không đụng tới.
//  Chạy: GH_TOKEN=<token> node scripts/dat-ma-kiotviet.cjs
//  (hoặc lưu token vào file .gh-token.local — đã gitignore)
//  Token fine-grained, chỉ repo VLN, quyền: Secrets (Read/Write) + Actions (Read/Write).
// ============================================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')
const sodium = require('libsodium-wrappers')

const REPO = process.env.GH_REPO || 'bachvu47-bmt/VLN'
const FILE_TOKEN = path.join(__dirname, '..', '.gh-token.local')
// Token: GH_TOKEN → .gh-token.local → phiên đăng nhập GitHub CLI (`gh auth login`)
function tokenTuGhCli() {
  try {
    return require('child_process').execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}
const TOKEN = (process.env.GH_TOKEN || (fs.existsSync(FILE_TOKEN) ? fs.readFileSync(FILE_TOKEN, 'utf8') : '') || tokenTuGhCli()).trim()
const WORKFLOW = 'kiotviet-sync.yml'
const URL_BIN = `https://raw.githubusercontent.com/${REPO}/du-lieu/kiotviet.bin`
const VONG_PBKDF2 = 150000 // khớp scripts/kiotviet-sync.mjs & app

if (!TOKEN) {
  console.error('Thiếu token GitHub: đặt GH_TOKEN hoặc tạo file .gh-token.local')
  process.exit(1)
}

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(method, duongDan, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${duongDan}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'vln-ma-kiotviet', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`GitHub ${method} ${duongDan} → HTTP ${r.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

// Mã dễ đọc/gõ trên điện thoại: bỏ ký tự dễ nhầm (0/O, 1/l/I)
function sinhMa() {
  const bang = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const b = crypto.randomBytes(16)
  const s = [...b].map((x) => bang[x % bang.length]).join('')
  return `VLN-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`
}

function giaiMa(buf, ma) {
  if (buf.subarray(0, 4).toString() !== 'VLN1') throw new Error('File dữ liệu không hợp lệ')
  const salt = buf.subarray(4, 20)
  const iv = buf.subarray(20, 32)
  const tag = buf.subarray(buf.length - 16)
  const khoa = crypto.pbkdf2Sync(ma, salt, VONG_PBKDF2, 32, 'sha256')
  const d = crypto.createDecipheriv('aes-256-gcm', khoa, iv)
  d.setAuthTag(tag)
  const nen = Buffer.concat([d.update(buf.subarray(32, buf.length - 16)), d.final()])
  return JSON.parse(zlib.gunzipSync(nen).toString())
}

async function main() {
  const ma = sinhMa()

  // 1) Nạp secret
  await sodium.ready
  const { key, key_id } = await api('GET', '/actions/secrets/public-key')
  const enc = sodium.crypto_box_seal(sodium.from_string(ma), sodium.from_base64(key, sodium.base64_variants.ORIGINAL))
  await api('PUT', '/actions/secrets/KV_MA_DU_LIEU', { encrypted_value: sodium.to_base64(enc, sodium.base64_variants.ORIGINAL), key_id })
  console.log('✓ Đã nạp mã mới vào GitHub Secret KV_MA_DU_LIEU')
  // In NGAY sau khi nạp — bước sau lỗi/treo thì vẫn còn mã (secret không đọc lại được)
  console.log(`  → MÃ MỚI: ${ma}`)

  // 2) Chạy workflow đồng bộ
  const { default_branch } = await api('GET', '')
  const batDau = Date.now()
  await api('POST', `/actions/workflows/${WORKFLOW}/dispatches`, { ref: default_branch })
  console.log('⏳ Đã chạy workflow "Đồng bộ KiotViet" — chờ hoàn tất (thường 1–2 phút)…')
  let run = null
  for (let i = 0; i < 120; i++) {
    await ngu(10000)
    const { workflow_runs } = await api('GET', `/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=5`)
    run = workflow_runs.find((r) => Date.parse(r.created_at) >= batDau - 60000)
    if (run?.status === 'completed') break
  }
  if (!run || run.status !== 'completed') throw new Error(`Workflow chưa xong sau 20 phút — xem tab Actions trên GitHub. Mã ${ma} vẫn hiệu lực khi workflow chạy xong.`)
  if (run.conclusion !== 'success') throw new Error(`Workflow lỗi (${run.conclusion}): ${run.html_url}`)
  console.log('✓ Workflow chạy thành công')

  // 3) Kiểm tra giải mã thật bằng mã mới (CDN raw có thể trễ vài chục giây)
  let duLieu = null
  for (let i = 0; i < 12 && !duLieu; i++) {
    try {
      const buf = Buffer.from(await (await fetch(`${URL_BIN}?t=${Date.now()}`, { cache: 'no-store' })).arrayBuffer())
      duLieu = giaiMa(buf, ma)
    } catch {
      await ngu(10000)
    }
  }
  if (!duLieu) throw new Error('Chưa giải mã được file mới bằng mã mới (CDN GitHub còn bản cũ?) — thử nhập mã vào app sau 5 phút')
  console.log(`✓ Giải mã thử thành công: ${duLieu.sanPham.length} hàng hoá · ${duLieu.hoaDon.length} hoá đơn · ${duLieu.khach.length} khách`)
  console.log('\n==============================================')
  console.log(`  MÃ DỮ LIỆU CỬA HÀNG MỚI:  ${ma}`)
  console.log('==============================================')
  console.log('Nhập mã này vào app: Tài khoản → Kết nối dữ liệu KiotViet. Mã cũ không còn dùng được.')
}

main().catch((e) => {
  console.error('✗', e.message || e)
  process.exit(1)
})
