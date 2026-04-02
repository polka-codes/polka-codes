#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type ParsedArgs = {
  ref: string
  version: string | null
}

const usage = `Usage:
  bun release:publish
  bun release:publish 1.2.3
  bun release:publish --version 1.2.3
  bun release:publish --ref my-branch`

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function runGit(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

function readCurrentVersion(): string {
  const packageJsonPath = resolve(import.meta.dir, '..', 'packages', 'core', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }

  if (typeof packageJson.version !== 'string' || !isSemver(packageJson.version)) {
    throw new Error(`Could not determine release version from ${packageJsonPath}`)
  }

  return packageJson.version
}

function readCurrentRef(): string {
  const currentRef = runGit(['rev-parse', '--abbrev-ref', 'HEAD'])

  if (!currentRef || currentRef === 'HEAD') {
    throw new Error('Release publish must be run from a branch, not a detached HEAD.')
  }

  return currentRef
}

function parseArgs(argv: string[]): ParsedArgs {
  let ref: string | null = null
  let version: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      console.log(usage)
      process.exit(0)
    }

    if (argument === '--ref') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('`--ref` requires a git ref value')
      }

      ref = value
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

    if (isSemver(argument)) {
      version = argument
      continue
    }

    throw new Error(`Unknown release:publish argument: ${argument}\n\n${usage}`)
  }

  return { ref: ref ?? readCurrentRef(), version }
}

function main(): void {
  const { ref, version } = parseArgs(Bun.argv.slice(2))
  const releaseVersion = version ?? readCurrentVersion()
  const command = ['workflow', 'run', 'release.yml', '--ref', ref, '-f', `version=${releaseVersion}`]

  const result = spawnSync('gh', command, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error('Failed to trigger release workflow.')
  }
}

main()
