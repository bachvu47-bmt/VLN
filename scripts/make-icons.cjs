// Sinh icon app (.exe + Android + nguồn cho capacitor-assets) từ LOGO TRÒN
// chính thức của Vật Liệu Nhà: vòng tròn đỏ + ngôi nhà trắng (assets/vln-logo.png).
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIcoMod = require('png-to-ico')
const pngToIco = typeof pngToIcoMod === 'function' ? pngToIcoMod : pngToIcoMod.default

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'assets', 'vln-logo.png') // logo tròn (nền trong suốt)
const BUILD = path.join(ROOT, 'build')
const ASSETS = path.join(ROOT, 'assets')

async function main() {
  if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true })

  // Cắt sát viền trong suốt → vòng tròn logo; đưa về 880px rồi chừa lề → 1024px
  const base = await sharp(SRC)
    .trim()
    .resize(880, 880, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 72, bottom: 72, left: 72, right: 72, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), base)
  console.log('✓ assets/icon.png (1024, logo tròn)')

  await sharp(base).resize(512, 512).png().toFile(path.join(BUILD, 'icon.png'))
  console.log('✓ build/icon.png (512)')

  const sizes = [256, 128, 64, 48, 32, 16]
  const icoBuffers = []
  for (const s of sizes) icoBuffers.push(await sharp(base).resize(s, s).png().toBuffer())
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), await pngToIco(icoBuffers))
  console.log('✓ build/icon.ico (16..256)')

  // Favicon web (PNG tròn)
  if (!fs.existsSync(path.join(ROOT, 'public'))) fs.mkdirSync(path.join(ROOT, 'public'))
  await sharp(base).resize(256, 256).png().toFile(path.join(ROOT, 'public', 'favicon.png'))
  console.log('✓ public/favicon.png (256)')
}

main().catch((e) => {
  console.error('LỖI tạo icon:', e)
  process.exit(1)
})
