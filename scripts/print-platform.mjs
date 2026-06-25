#!/usr/bin/env node
import { checkEnvironment } from './lib/platform.mjs'

const result = checkEnvironment()
process.stdout.write(`${result.platform}\n`)
process.exit(0)
