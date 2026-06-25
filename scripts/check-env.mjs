#!/usr/bin/env node
import { checkEnvironment, printCheckResult } from './lib/platform.mjs'

const quiet = process.argv.includes('--quiet')
const result = checkEnvironment()

if (!quiet) {
  printCheckResult(result)
}

process.exit(result.ok ? 0 : 1)
