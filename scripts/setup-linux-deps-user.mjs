#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const LIB_DIR = join(process.cwd(), '.electron-libs')
const EXTRACT_DIR = join(LIB_DIR, 'extracted', 'usr/lib/x86_64-linux-gnu')

/** @type {string[]} */
const PACKAGE_CANDIDATES = ['libnspr4', 'libnss3', 'libasound2t64', 'libasound2']

/**
 * @returns {string[]}
 */
function resolvePackages() {
  /** @type {string[]} */
  const selected = []

  for (const name of PACKAGE_CANDIDATES) {
    if (name === 'libasound2' && selected.includes('libasound2t64')) continue
    if (name === 'libasound2t64' && selected.includes('libasound2')) continue

    try {
      execSync(`apt-cache show ${name}`, { stdio: 'ignore' })
      if (name === 'libasound2' || name === 'libasound2t64') {
        if (!selected.some((pkg) => pkg.startsWith('libasound2'))) {
          selected.push(name)
        }
      } else {
        selected.push(name)
      }
    } catch {
      // package not available on this distro
    }
  }

  if (!selected.includes('libnspr4') || !selected.includes('libnss3')) {
    throw new Error('Required packages libnspr4 and libnss3 are not available via apt-cache.')
  }

  if (!selected.some((pkg) => pkg.startsWith('libasound2'))) {
    throw new Error('No ALSA package found (libasound2 or libasound2t64).')
  }

  return selected
}

function downloadAndExtract(packages) {
  mkdirSync(LIB_DIR, { recursive: true })
  const downloadDir = join(LIB_DIR, 'downloads')
  mkdirSync(downloadDir, { recursive: true })

  console.log('Downloading packages (no sudo required):')
  for (const pkg of packages) {
    console.log(`  - ${pkg}`)
  }

  execSync(`apt-get download ${packages.join(' ')}`, {
    cwd: downloadDir,
    stdio: 'inherit'
  })

  const extractRoot = join(LIB_DIR, 'extracted')
  rmSync(extractRoot, { recursive: true, force: true })
  mkdirSync(extractRoot, { recursive: true })

  for (const file of readdirSync(downloadDir)) {
    if (!file.endsWith('.deb')) continue
    execSync(`dpkg-deb -x "downloads/${file}" extracted`, {
      cwd: LIB_DIR,
      stdio: 'inherit'
    })
  }

  if (!existsSync(join(EXTRACT_DIR, 'libnspr4.so'))) {
    throw new Error('Failed to extract libnspr4.so into .electron-libs')
  }
}

function verifyElectron() {
  const electronBin = join(process.cwd(), 'node_modules/electron/dist/electron')
  if (!existsSync(electronBin)) {
    throw new Error('Electron binary not found. Run npm install first.')
  }

  const output = execSync(`LD_LIBRARY_PATH="${EXTRACT_DIR}" ldd "${electronBin}"`, {
    encoding: 'utf8'
  })
  const missing = output.split('\n').filter((line) => line.includes('not found'))
  if (missing.length > 0) {
    throw new Error(`Electron still missing libraries:\n${missing.join('\n')}`)
  }

  const version = execSync(`LD_LIBRARY_PATH="${EXTRACT_DIR}" "${electronBin}" --version`, {
    encoding: 'utf8'
  }).trim()

  console.log()
  console.log(`Electron OK (${version})`)
  console.log(`Libraries installed to: ${EXTRACT_DIR}`)
  console.log('Run: npm run dev')
}

function main() {
  if (process.platform !== 'linux') {
    console.log('setup:linux:user is only needed on Linux / WSL.')
    return
  }

  const packages = resolvePackages()
  downloadAndExtract(packages)
  verifyElectron()
}

main()
