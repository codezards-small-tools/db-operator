import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim()
}

function findDmgs(distDir) {
  const explicit = process.argv.slice(2)
  if (explicit.length > 0) return explicit

  const matches = readdirSync(distDir).filter((name) => /-(arm64|x64)\.dmg$/.test(name))
  if (matches.length === 0) {
    throw new Error(`No *-{arm64,x64}.dmg found in ${distDir}`)
  }
  return matches.map((name) => join(distDir, name))
}

function parseMinimumVersion(value) {
  const parts = value.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid LSMinimumSystemVersion: ${value}`)
  }
  return parts
}

function assertMinimumVersion(actual, expected) {
  const actualParts = parseMinimumVersion(actual)
  const expectedParts = parseMinimumVersion(expected)

  for (let index = 0; index < expectedParts.length; index += 1) {
    const actualPart = actualParts[index] ?? 0
    const expectedPart = expectedParts[index] ?? 0
    if (actualPart > expectedPart) return
    if (actualPart < expectedPart) {
      throw new Error(`LSMinimumSystemVersion ${actual} is lower than required ${expected}`)
    }
  }
}

function findAppBundle(mountPoint) {
  const entries = readdirSync(mountPoint, { withFileTypes: true })
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
  if (!app) {
    throw new Error(`No .app bundle found in mounted DMG at ${mountPoint}`)
  }
  return join(mountPoint, app.name)
}

function expectedArchitecture(dmgPath) {
  if (dmgPath.endsWith('-arm64.dmg')) return 'arm64'
  if (dmgPath.endsWith('-x64.dmg')) return 'x86_64'
  throw new Error(`Unable to infer architecture from ${dmgPath}`)
}

function verifyDmg(dmgPath) {
  console.log(`Verifying macOS artifact: ${dmgPath}`)

  const attachOutput = run(`hdiutil attach -nobrowse -readonly "${dmgPath}"`)
  const mountLine = attachOutput.split('\n').find((line) => line.includes('/Volumes/'))
  if (!mountLine) {
    throw new Error(`Unable to parse hdiutil attach output:\n${attachOutput}`)
  }

  const mountPoint = mountLine.split('\t').pop()?.trim()
  if (!mountPoint) {
    throw new Error(`Unable to determine mount point from:\n${attachOutput}`)
  }

  try {
    const appPath = findAppBundle(mountPoint)
    const infoPlist = join(appPath, 'Contents/Info.plist')
    const macOsDir = join(appPath, 'Contents/MacOS')
    const resourcesDir = join(appPath, 'Contents/Resources')

    for (const requiredPath of [infoPlist, macOsDir, resourcesDir]) {
      if (!existsSync(requiredPath)) {
        throw new Error(`Missing required app bundle path: ${requiredPath}`)
      }
    }

    const minimumVersion = run(`/usr/libexec/PlistBuddy -c "Print LSMinimumSystemVersion" "${infoPlist}"`)
    assertMinimumVersion(minimumVersion, '12.0')
    console.log(`LSMinimumSystemVersion: ${minimumVersion}`)

    const executableName = run(`/usr/libexec/PlistBuddy -c "Print CFBundleExecutable" "${infoPlist}"`)
    const executablePath = join(macOsDir, executableName)
    if (!existsSync(executablePath)) {
      throw new Error(`Missing executable: ${executablePath}`)
    }

    const lipoInfo = run(`lipo -info "${executablePath}"`)
    console.log(lipoInfo)

    const expected = expectedArchitecture(dmgPath)
    if (!lipoInfo.includes(expected)) {
      throw new Error(`Expected ${expected} binary, got: ${lipoInfo}`)
    }
  } finally {
    run(`hdiutil detach "${mountPoint}" -quiet`)
  }
}

function main() {
  const distDir = join(process.cwd(), 'dist')
  const dmgPaths = findDmgs(distDir)

  for (const dmgPath of dmgPaths) {
    verifyDmg(dmgPath)
  }

  console.log(`macOS artifact verification passed (${dmgPaths.length} DMG(s))`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
