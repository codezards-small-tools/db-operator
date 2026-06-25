import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { join } from 'node:path'

/** @typedef {'macos' | 'windows' | 'linux' | 'wsl' | 'wslg'} DevPlatform */

/**
 * @returns {boolean}
 */
export function isWsl() {
  if (platform() !== 'linux') return false
  if (!existsSync('/proc/version')) return false
  return readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
}

/**
 * @returns {boolean}
 */
export function isWslg() {
  if (platform() !== 'linux') return false
  return existsSync('/mnt/wslg') || Boolean(process.env.WAYLAND_DISPLAY)
}

/**
 * @returns {DevPlatform}
 */
export function detectPlatform() {
  const os = platform()
  if (os === 'darwin') return 'macos'
  if (os === 'win32') return 'windows'
  if (os === 'linux') {
    if (isWslg()) return 'wslg'
    if (isWsl()) return 'wsl'
    return 'linux'
  }
  return 'linux'
}

/**
 * @returns {boolean}
 */
export function isWaylandAvailable() {
  const display = process.env.WAYLAND_DISPLAY
  if (!display) return false

  const runtimeDir = process.env.XDG_RUNTIME_DIR
  if (runtimeDir && existsSync(join(runtimeDir, display))) return true
  if (existsSync(join('/mnt/wslg/runtime-dir', display))) return true

  return false
}

/**
 * @param {DevPlatform} devPlatform
 * @returns {string[]}
 */
export function getDevElectronArgs(devPlatform) {
  switch (devPlatform) {
    case 'wslg':
      if (isWaylandAvailable() && process.env.DB_OPERATOR_USE_X11 !== '1') {
        return ['--no-sandbox', '--enable-features=UseOzonePlatform', '--ozone-platform=wayland']
      }
      return ['--no-sandbox']
    case 'wsl':
    case 'linux':
      return ['--no-sandbox']
    case 'macos':
    case 'windows':
    default:
      return []
  }
}

/**
 * @returns {string | undefined}
 */
export function getWslDisplayFallback() {
  if (!existsSync('/etc/resolv.conf')) return undefined
  const match = readFileSync('/etc/resolv.conf', 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('nameserver '))

  if (!match) return undefined
  const ip = match.split(/\s+/)[1]
  return ip ? `${ip}:0` : undefined
}

/**
 * @returns {string | undefined}
 */
export function getLocalElectronLibPath() {
  const libPath = join(process.cwd(), '.electron-libs/extracted/usr/lib/x86_64-linux-gnu')
  if (!existsSync(join(libPath, 'libnspr4.so'))) return undefined
  return libPath
}

/**
 * @returns {Record<string, string>}
 */
export function getLinuxDevEnv() {
  const env = { ...process.env }

  if (isWslg()) {
    const wslgRuntime = '/mnt/wslg/runtime-dir'
    const waylandDisplay = env.WAYLAND_DISPLAY || 'wayland-0'
    if (existsSync(join(wslgRuntime, waylandDisplay))) {
      env.XDG_RUNTIME_DIR = wslgRuntime
      env.WAYLAND_DISPLAY = waylandDisplay
    }
    if (!env.DISPLAY) {
      env.DISPLAY = ':0'
    }
  }

  const localLibPath = getLocalElectronLibPath()
  if (localLibPath) {
    const current = env.LD_LIBRARY_PATH
    env.LD_LIBRARY_PATH = current ? `${localLibPath}:${current}` : localLibPath
  }

  return env
}

/**
 * @returns {string[]}
 */
function getElectronMissingLibs() {
  const electronBin =
    platform() === 'win32'
      ? 'node_modules/electron/dist/electron.exe'
      : 'node_modules/electron/dist/electron'

  if (!existsSync(electronBin)) return ['Electron binary not found. Run npm install.']

  if (platform() === 'win32' || platform() === 'darwin') return []

  const localLibPath = getLocalElectronLibPath()
  const ldPath = localLibPath
    ? localLibPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : '')
    : process.env.LD_LIBRARY_PATH || ''

  try {
    const output = execSync(
      `${ldPath ? `LD_LIBRARY_PATH="${ldPath}" ` : ''}ldd "${electronBin}" 2>/dev/null || true`,
      { encoding: 'utf8' }
    )
    return output
      .split('\n')
      .filter((line) => line.includes('not found'))
      .map((line) => line.trim())
  } catch {
    return []
  }
}

/**
 * @param {DevPlatform} devPlatform
 * @returns {{ ok: boolean, platform: DevPlatform, checks: Array<{ level: 'ok' | 'warn' | 'fail', message: string }> }}
 */
export function checkEnvironment(devPlatform = detectPlatform()) {
  /** @type {Array<{ level: 'ok' | 'warn' | 'fail', message: string }>} */
  const checks = []

  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor >= 20) {
    checks.push({ level: 'ok', message: `Node.js ${process.versions.node}` })
  } else {
    checks.push({ level: 'fail', message: `Node.js ${process.versions.node} (requires 20+)` })
  }

  if (!existsSync('node_modules/electron/dist')) {
    checks.push({ level: 'fail', message: 'Electron not installed. Run npm install.' })
  } else {
    checks.push({ level: 'ok', message: 'Electron package present' })
  }

  switch (devPlatform) {
    case 'macos':
      checks.push({ level: 'ok', message: 'macOS native development' })
      break
    case 'windows':
      checks.push({ level: 'ok', message: 'Windows native development' })
      break
    case 'linux':
      checks.push({ level: 'ok', message: 'Linux native development' })
      break
    case 'wsl':
      checks.push({ level: 'ok', message: 'WSL development (X11 forwarding)' })
      if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
        const fallback = getWslDisplayFallback()
        checks.push({
          level: 'warn',
          message: fallback
            ? `DISPLAY is unset. Try: export DISPLAY=${fallback}`
            : 'DISPLAY is unset. Start an X server on Windows (VcXsrv) or enable WSLg.'
        })
      } else {
        checks.push({
          level: 'ok',
          message: `Display ready (DISPLAY=${process.env.DISPLAY || ''} WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY || ''})`
        })
      }
      break
    case 'wslg':
      checks.push({ level: 'ok', message: 'WSLg development' })
      if (existsSync('/mnt/wslg')) {
        checks.push({ level: 'ok', message: 'WSLg mount present (/mnt/wslg)' })
      } else {
        checks.push({ level: 'warn', message: 'WSLg mount missing. Run wsl --update on Windows.' })
      }
      if (process.env.WAYLAND_DISPLAY) {
        checks.push({ level: 'ok', message: `WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY}` })
      }
      if (process.env.DISPLAY) {
        checks.push({ level: 'ok', message: `DISPLAY=${process.env.DISPLAY}` })
      }
      break
  }

  if (devPlatform === 'linux' || devPlatform === 'wsl' || devPlatform === 'wslg') {
    const localLibPath = getLocalElectronLibPath()
    if (localLibPath) {
      checks.push({ level: 'ok', message: `Local Electron libs: ${localLibPath}` })
    }

    const missingLibs = getElectronMissingLibs()
    if (missingLibs.length === 0) {
      checks.push({ level: 'ok', message: 'Electron runtime libraries satisfied' })
    } else {
      for (const lib of missingLibs) {
        checks.push({ level: 'fail', message: lib })
      }
      checks.push({
        level: 'fail',
        message: 'Run: npm run setup:linux  (or npm run setup:linux:user without sudo)'
      })
    }
  }

  const ok = checks.every((check) => check.level !== 'fail')
  return { ok, platform: devPlatform, checks }
}

/**
 * @param {ReturnType<typeof checkEnvironment>} result
 */
export function printCheckResult(result) {
  console.log('== DB Operator dev environment ==')
  console.log(`Platform: ${result.platform}`)
  console.log()
  for (const check of result.checks) {
    const prefix = check.level === 'ok' ? '[ok]' : check.level === 'warn' ? '[warn]' : '[fail]'
    console.log(`${prefix} ${check.message}`)
  }
  console.log()
  if (result.ok) {
    console.log('Ready. Run: npm run dev')
  } else {
    console.log('Fix the [fail] items above before starting the app.')
  }
}
