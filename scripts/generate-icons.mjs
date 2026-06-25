import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import png2icons from 'png2icons'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'resources/icon.svg')
const svg = readFileSync(svgPath)

async function renderPng(size) {
  return sharp(svg, { density: Math.ceil((size / 1024) * 384) })
    .resize(size, size)
    .png()
    .toBuffer()
}

async function main() {
  const png512 = await renderPng(512)
  const png1024 = await renderPng(1024)

  writeFileSync(join(root, 'resources/icon.png'), png512)
  writeFileSync(join(root, 'build/icon.png'), png512)

  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoBuffers = await Promise.all(icoSizes.map(renderPng))
  const ico = await pngToIco(icoBuffers)
  writeFileSync(join(root, 'build/icon.ico'), ico)

  const icns = png2icons.createICNS(png1024, png2icons.BILINEAR, 0)
  if (!icns) {
    throw new Error('Failed to generate icon.icns')
  }
  writeFileSync(join(root, 'build/icon.icns'), icns)

  console.log('Generated icon assets in resources/ and build/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
