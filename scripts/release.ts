#!/usr/bin/env bun

import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

type DependencyField = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'
type BumpType = 'patch' | 'minor' | 'major'
type PackageDependencies = Record<string, string>

type PackageJson = {
  name: string
  version: string
  private?: boolean
  dependencies?: PackageDependencies
  devDependencies?: PackageDependencies
  optionalDependencies?: PackageDependencies
  peerDependencies?: PackageDependencies
  [key: string]: unknown
}

type ParsedArgs = {
  bump: BumpType
  version: string | null
}

const dependencyFields: DependencyField[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const usage = `Usage:
  bun run scripts/release.ts --bump patch
  bun run scripts/release.ts --bump minor
  bun run scripts/release.ts --bump major
  bun run scripts/release.ts --version 1.2.3`

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  return (await Bun.file(packageJsonPath).json()) as PackageJson
}

function writePackageJson(packageJsonPath: string, packageJson: PackageJson): void {
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function isBumpType(value: string): value is BumpType {
  return value === 'patch' || value === 'minor' || value === 'major'
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(version.trim())

  if (!match?.groups) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  return {
    major: Number.parseInt(match.groups.major, 10),
    minor: Number.parseInt(match.groups.minor, 10),
    patch: Number.parseInt(match.groups.patch, 10),
  }
}

function compareSemver(left: string, right: string): number {
  const leftVersion = parseSemver(left)
  const rightVersion = parseSemver(right)

  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major
  }

  if (leftVersion.minor !== rightVersion.minor) {
    return leftVersion.minor - rightVersion.minor
  }

  return leftVersion.patch - rightVersion.patch
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

    throw new Error(`Unknown release argument: ${argument}\n\n${usage}`)
  }

  return { bump, version }
}

function listPublishablePackageDirs(packagesRoot = resolve('packages')): string[] {
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .filter((packageDir) => existsSync(join(packageDir, 'package.json')))
}

function bumpVersion(currentVersion: string, bump: BumpType): string {
  const { major, minor, patch } = parseSemver(currentVersion)

  if (bump === 'major') {
    return `${major + 1}.0.0`
  }

  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`
  }

  return `${major}.${minor}.${patch + 1}`
}

function rewriteInternalDependencyVersions(
  dependencies: PackageDependencies | undefined,
  nextVersion: string,
  workspacePackageNames: ReadonlySet<string>,
): PackageDependencies | undefined {
  if (!dependencies) {
    return dependencies
  }

  return Object.fromEntries(
    Object.entries(dependencies).map(([name, spec]) => [name, workspacePackageNames.has(name) ? `^${nextVersion}` : spec]),
  )
}

async function main(): Promise<void> {
  const { bump, version } = parseArgs(Bun.argv.slice(2))
  const packageDirs = listPublishablePackageDirs()
  const packageJsonPaths = packageDirs.map((packageDir) => join(packageDir, 'package.json'))
  const packageJsons = await Promise.all(packageJsonPaths.map((packageJsonPath) => readPackageJson(packageJsonPath)))
  const publishablePackages = packageJsons.filter((packageJson) => packageJson.private !== true)
  const currentVersions = new Set(publishablePackages.map((packageJson) => packageJson.version))

  if (currentVersions.size !== 1) {
    throw new Error(`Expected publishable packages to share one version, found: ${Array.from(currentVersions).join(', ')}`)
  }

  const currentVersion = Array.from(currentVersions)[0] as string
  const nextVersion = version ?? bumpVersion(currentVersion, bump)
  const workspacePackageNames = new Set(publishablePackages.map((packageJson) => packageJson.name))

  if (compareSemver(nextVersion, currentVersion) < 0) {
    throw new Error(`Release version ${nextVersion} is lower than current version ${currentVersion}`)
  }

  if (nextVersion === currentVersion) {
    console.log(`Release version is already ${nextVersion}; no version bump needed.`)
    return
  }

  for (let index = 0; index < packageJsons.length; index += 1) {
    const packageJson = packageJsons[index]
    const packageJsonPath = packageJsonPaths[index]

    if (packageJson.private === true) {
      continue
    }

    const nextPackageJson: PackageJson = {
      ...packageJson,
      version: nextVersion,
    }

    for (const dependencyField of dependencyFields) {
      nextPackageJson[dependencyField] = rewriteInternalDependencyVersions(packageJson[dependencyField], nextVersion, workspacePackageNames)
    }

    writePackageJson(packageJsonPath, nextPackageJson)
  }

  console.log(`Prepared release version ${nextVersion}.`)
}

await main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
  } else {
    console.error('Error: Unknown release preparation failure')
  }

  process.exit(1)
})
