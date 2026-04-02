#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

type BumpType = 'patch' | 'minor' | 'major'

type ParsedArgs = {
  bump: BumpType
  version: string | null
}

const usage = `Usage:
  bun release
  bun release patch
  bun release minor
  bun release major
  bun release 1.2.3
  bun release --bump patch
  bun release --version 1.2.3`

function isBumpType(value: string): value is BumpType {
  return value === 'patch' || value === 'minor' || value === 'major'
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function parseArgs(argv: string[]): ParsedArgs {
  let bump: BumpType = 'patch'
  let version: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      console.log(usage)
      process.exit(0)
    }

    if (argument === '--bump') {
      const value = argv[index + 1]
      if (!value || !isBumpType(value)) {
        throw new Error('`--bump` must be one of: patch, minor, major')
      }

      bump = value
      index += 1
      continue
    }

    if (argument === '--version') {
      const value = argv[index + 1]
      if (!value || !isSemver(value)) {
        throw new Error('`--version` must be a semver like 1.2.3')
      }

      version = value
      index += 1
      continue
    }

    if (isBumpType(argument)) {
      bump = argument
      continue
    }

    if (isSemver(argument)) {
      version = argument
      continue
    }

    throw new Error(`Unknown release argument: ${argument}\n\n${usage}`)
  }

  return { bump, version }
}

function main(): void {
  const { bump, version } = parseArgs(Bun.argv.slice(2))
  const command = ['workflow', 'run', 'release.yml', '--ref', 'master']

  if (version) {
    command.push('-f', `version=${version}`)
  } else {
    command.push('-f', `bump=${bump}`)
  }

  const result = spawnSync('gh', command, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error('Failed to trigger release workflow.')
  }
}

main()
