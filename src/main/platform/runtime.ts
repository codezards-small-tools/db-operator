import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export type DevPlatform = 'macos' | 'windows' | 'linux' | 'wsl' | 'wslg'

export function isWsl(): boolean {
  if (process.platform !== 'linux') return false
  return (
    existsSync('/proc/version') &&
    readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
  )
}

export function isWslg(): boolean {
  if (process.platform !== 'linux') return false
  return existsSync('/mnt/wslg') || Boolean(process.env.WAYLAND_DISPLAY)
}

export function detectDevPlatform(): DevPlatform {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'linux') {
    if (isWslg()) return 'wslg'
    if (isWsl()) return 'wsl'
    return 'linux'
  }
  return 'linux'
}

function getWslDisplayFallback(): string | undefined {
  if (!existsSync('/etc/resolv.conf')) return undefined
  const match = readFileSync('/etc/resolv.conf', 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('nameserver '))

  if (!match) return undefined
  const ip = match.split(/\s+/)[1]
  return ip ? `${ip}:0` : undefined
}

function configureWslDisplay(): void {
  if (!isWsl() || process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return

  const fallback = getWslDisplayFallback()
  if (fallback) {
    process.env.DISPLAY = fallback
  }
}

function isWaylandAvailable(): boolean {
  const display = process.env.WAYLAND_DISPLAY
  if (!display) return false

  const runtimeDir = process.env.XDG_RUNTIME_DIR
  if (runtimeDir && existsSync(join(runtimeDir, display))) return true
  if (existsSync(join('/mnt/wslg/runtime-dir', display))) return true

  return false
}

function configureWslgDisplay(): void {
  const wslgRuntime = '/mnt/wslg/runtime-dir'
  const waylandDisplay = process.env.WAYLAND_DISPLAY || 'wayland-0'

  if (existsSync(join(wslgRuntime, waylandDisplay))) {
    process.env.XDG_RUNTIME_DIR = wslgRuntime
    process.env.WAYLAND_DISPLAY = waylandDisplay
  }

  if (!process.env.DISPLAY) {
    process.env.DISPLAY = ':0'
  }
}

function configureLinuxRuntime(devPlatform: DevPlatform): void {
  app.commandLine.appendSwitch('no-sandbox')

  if (devPlatform === 'wslg') {
    configureWslgDisplay()
  }

  const useWayland =
    devPlatform === 'wslg' &&
    isWaylandAvailable() &&
    process.env.DB_OPERATOR_USE_X11 !== '1'

  if (useWayland) {
    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform')
    app.commandLine.appendSwitch('ozone-platform', 'wayland')
  }

  if (devPlatform === 'wsl') {
    configureWslDisplay()
  }
}

export function configureRuntime(): void {
  const devPlatform = detectDevPlatform()

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[db-operator] dev platform: ${devPlatform}`)
  }

  if (process.platform === 'linux') {
    configureLinuxRuntime(devPlatform)
  }
}
