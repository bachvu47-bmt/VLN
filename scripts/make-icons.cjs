// Sinh icon cho .exe (và PNG nguồn cho Android) từ logo SVG thương hiệu.
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIcoMod = require('png-to-ico')
const pngToIco = typeof pngToIcoMod === 'function' ? pngToIcoMod : pngToIcoMod.default

const ROOT = path.join(__dirname, '..')
const SVG = path.join(ROOT, 'assets', 'logo.svg')
const BUILD = path.join(ROOT, 'build')
const ASSETS = path.join(ROOT, 'assets')

async function main() {
  if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true })
  const svg = fs.readFileSync(SVG)

  // 1024px PNG nguồn (dùng cho Android + favicon png nếu cần)
  await sharp(svg, { density: 384 })
    .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(ASSETS, 'icon.png'))
  console.log('✓ assets/icon.png (1024)')

  // PNG 512 cho build + các kích thước cho .ico
  const sizes = [256, 128, 64, 48, 32, 16]
  const icoBuffers = []
  for (const s of sizes) {
    const buf = await sharp(svg, { density: 384 })
      .resize(s, s, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer()
    icoBuffers.push(buf)
  }

  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(path.join(BUILD, 'icon.png'))
  console.log('✓ build/icon.png (512)')

  const ico = await pngToIco(icoBuffers)
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico)
  console.log('✓ build/icon.ico (16..256)')
}

main().catch((e) => {
  console.error('LỖI tạo icon:', e)
  process.exit(1)
})
