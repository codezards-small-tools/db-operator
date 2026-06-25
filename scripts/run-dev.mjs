#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { detectPlatform, getDevElectronArgs, getLinuxDevEnv } from './lib/platform.mjs'

const devPlatform = detectPlatform()
const electronArgs = getDevElectronArgs(devPlatform)
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

/** @type {string[]} */
const args = ['electron-vite', 'dev']
if (electronArgs.length > 0) {
  args.push('--', ...electronArgs)
}

const env =
  devPlatform === 'linux' || devPlatform === 'wsl' || devPlatform === 'wslg'
    ? getLinuxDevEnv()
    : process.env

console.log(`[dev] platform=${devPlatform}`)
if (electronArgs.length > 0) {
  console.log(`[dev] electron args: ${electronArgs.join(' ')}`)
}
if (env.LD_LIBRARY_PATH && env.LD_LIBRARY_PATH !== process.env.LD_LIBRARY_PATH) {
  console.log(`[dev] LD_LIBRARY_PATH=${env.LD_LIBRARY_PATH}`)
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: false,
  env
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
