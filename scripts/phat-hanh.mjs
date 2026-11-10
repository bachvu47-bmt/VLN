// ============================================================
//  PHÁT HÀNH BẢN MỚI — 1 lệnh: tăng phiên bản (package.json, appInfo.js, build.gradle) + ghi chú
//  cập nhật (scripts/ghi-chu-phat-hanh.json) → build thử → commit → tag vX.Y.Z → push
//  → GitHub Actions build .apk + .exe, app nhân viên tự báo có bản mới.
//  Dùng:   node scripts/phat-hanh.mjs 1.1.21
//  Thử:    node scripts/phat-hanh.mjs 1.1.21 --thu   (chỉ in thay đổi, không ghi, không push)
//  Git lấy từ GitHub Desktop (máy không có git trong PATH).
// ============================================================
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [phienBan, co] = process.argv.slice(2)
const THU = co === '--thu'
if (!/^\d+\.\d+\.\d+$/.test(phienBan || '')) throw new Error('Cách dùng: node scripts/phat-hanh.mjs 1.1.21  (thêm --thu để chạy thử)')

// ---- git của GitHub Desktop ----
const goc = join(process.env.LOCALAPPDATA || '', 'GitHubDesktop')
const app = existsSync(goc) ? readdirSync(goc).filter((d) => d.startsWith('app-')).sort().pop() : ''
const GIT = app ? join(goc, app, 'resources', 'app', 'git', 'cmd', 'git.exe') : 'git'
const git = (...a) => execFileSync(GIT, a, { cwd: ROOT, encoding: 'utf8' }).trim()

// ---- Kiểm tra trước ----
git('fetch', '-q', 'origin')
if (git('tag', '-l', `v${phienBan}`)) throw new Error(`Tag v${phienBan} đã có — chọn số phiên bản khác`)
const sau = git('rev-list', '--count', 'HEAD..origin/main')
if (sau !== '0') throw new Error(`GitHub có ${sau} commit mới hơn máy này — mở GitHub Desktop bấm Pull trước`)

const ghiChu = JSON.parse(readFileSync(join(ROOT, 'scripts', 'ghi-chu-phat-hanh.json'), 'utf8'))
const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

// ---- Sửa 3 file (thay chuỗi, giữ nguyên UTF-8) ----
const sua = (file, ...cap) => {
  const p = join(ROOT, file)
  let s = readFileSync(p, 'utf8')
  for (const [re, moi, ten] of cap) {
    if (!re.test(s)) throw new Error(`${file}: không tìm thấy ${ten}`)
    s = s.replace(re, moi)
  }
  return [p, s]
}
const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8')
const maCu = Number(gradle.match(/versionCode (\d+)/)[1])
const json = (x) => JSON.stringify(x)
const dongChangelog = ghiChu.changelog.map((c) => `    { loai: ${json(c.loai)}, noiDung: ${json(c.noiDung)} },`).join('\n')
const thayDoi = [
  sua('package.json', [/"version": "[^"]+"/, `"version": "${phienBan}"`, 'version']),
  sua('android/app/build.gradle', [/versionCode \d+/, `versionCode ${maCu + 1}`, 'versionCode'], [/versionName "[^"]+"/, `versionName "${phienBan}"`, 'versionName']),
  sua(
    'src/data/appInfo.js',
    [/PHIEN_BAN_HIEN_TAI = '[^']+'/, `PHIEN_BAN_HIEN_TAI = '${phienBan}'`, 'PHIEN_BAN_HIEN_TAI'],
    [/phienBan: '[^']+'/, `phienBan: '${phienBan}'`, 'phienBan'],
    [/ngayPhatHanh: '[^']+'/, `ngayPhatHanh: '${homNay}'`, 'ngayPhatHanh'],
    [/tieuDe: '[^']*'/, `tieuDe: ${json(ghiChu.tieuDe).replace(/^"|"$/g, "'")}`, 'tieuDe'],
    // Giữ kiểu xuống dòng của file (git trên Windows chuyển sang CRLF)
    [/changelog: \[(\r?\n)/, (_, nl) => `changelog: [${nl}${dongChangelog.split('\n').join(nl)}${nl}`, 'changelog'],
  ),
]

console.log(`Phiên bản ${phienBan} · versionCode ${maCu} → ${maCu + 1} · ngày ${homNay}`)
console.log(`Ghi chú: ${ghiChu.tieuDe}\n${ghiChu.changelog.map((c) => '  • ' + c.noiDung).join('\n')}`)
if (THU) {
  console.log('\n(chạy thử) Mọi chỗ cần sửa đều tìm thấy — không ghi file, không push.')
  process.exit(0)
}

for (const [p, s] of thayDoi) writeFileSync(p, s, 'utf8')
execFileSync('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'ignore', shell: true })
console.log('• Build thử…')
execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit', shell: true })

git('add', '-A', '--', '.', ':!web/maika-widget.js.bak')
git('commit', '-q', '-m', `v${phienBan}: ${ghiChu.tieuDe}`)
git('tag', `v${phienBan}`)
git('push', '-q', 'origin', 'main')
git('push', '-q', 'origin', `v${phienBan}`)
console.log(`\n✓ Đã đẩy v${phienBan}. GitHub đang build (~10–15 phút):`)
console.log('  https://github.com/bachvu47-bmt/VLN/actions')
console.log(`  Xong: https://github.com/bachvu47-bmt/VLN/releases/tag/v${phienBan}`)
