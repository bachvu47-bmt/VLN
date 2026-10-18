// Tạo keystore ký APK (PKCS12) + nạp 4 GitHub Actions secrets.
// Chạy: node scripts/setup-signing.cjs   (cần env: GH_TOKEN, GH_REPO, KS_PASSWORD, KS_ALIAS)
const fs = require('fs')
const path = require('path')
const https = require('https')
const forge = require('node-forge')
const sodium = require('libsodium-wrappers')

const TOKEN = process.env.GH_TOKEN
const REPO = process.env.GH_REPO // "owner/repo"
const PASSWORD = process.env.KS_PASSWORD
const ALIAS = process.env.KS_ALIAS || 'vatlieunha'
const ROOT = path.join(__dirname, '..')
const SIGN_DIR = path.join(ROOT, 'signing')
const P12_PATH = path.join(SIGN_DIR, 'vatlieunha-release.p12')

if (!TOKEN || !REPO || !PASSWORD) {
  console.error('Thiếu env GH_TOKEN / GH_REPO / KS_PASSWORD')
  process.exit(1)
}

// ---- 1) Tạo keystore PKCS12 (RSA 2048, hiệu lực 30 năm) ----
function taoKeystore() {
  if (!fs.existsSync(SIGN_DIR)) fs.mkdirSync(SIGN_DIR, { recursive: true })
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30)
  const attrs = [
    { name: 'commonName', value: 'Vat Lieu Nha' },
    { name: 'organizationName', value: 'Vat Lieu Nha' },
    { name: 'countryName', value: 'VN' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSWORD, {
    friendlyName: ALIAS,
    algorithm: '3des',
  })
  const der = forge.asn1.toDer(p12Asn1).getBytes()
  const buf = Buffer.from(der, 'binary')
  fs.writeFileSync(P12_PATH, buf)
  console.log(`✓ Tạo keystore: signing/vatlieunha-release.p12 (${buf.length} bytes)`)
  return buf.toString('base64')
}

// ---- 2) Gọi GitHub API ----
function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'User-Agent': 'vln-signing-setup',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = ''
        res.on('data', (d) => (chunks += d))
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }))
      },
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  const b64 = taoKeystore()

  await sodium.ready
  const [owner, repo] = REPO.split('/')
  const pk = await api('GET', `/repos/${owner}/${repo}/actions/secrets/public-key`)
  if (pk.status !== 200) {
    console.error('✗ Không lấy được public key (có thể token thiếu quyền). HTTP', pk.status, pk.body)
    console.error('→ Keystore vẫn đã tạo tại signing/. Bạn có thể tự thêm secrets thủ công.')
    process.exit(2)
  }
  const { key, key_id } = JSON.parse(pk.body)

  const seal = (value) => {
    const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
    const enc = sodium.crypto_box_seal(sodium.from_string(value), keyBytes)
    return sodium.to_base64(enc, sodium.base64_variants.ORIGINAL)
  }

  const secrets = {
    ANDROID_KEYSTORE_BASE64: b64,
    ANDROID_KEYSTORE_PASSWORD: PASSWORD,
    ANDROID_KEY_ALIAS: ALIAS,
    ANDROID_KEY_PASSWORD: PASSWORD,
  }

  for (const [name, value] of Object.entries(secrets)) {
    const r = await api('PUT', `/repos/${owner}/${repo}/actions/secrets/${name}`, {
      encrypted_value: seal(value),
      key_id,
    })
    if (r.status === 201 || r.status === 204) {
      console.log(`✓ Secret ${name} đã nạp (HTTP ${r.status})`)
    } else {
      console.error(`✗ Lỗi nạp ${name}: HTTP ${r.status} ${r.body}`)
      process.exit(3)
    }
  }
  console.log('HOÀN TẤT: 4 secrets đã nạp vào GitHub.')
}

main().catch((e) => {
  console.error('LỖI:', e)
  process.exit(1)
})
