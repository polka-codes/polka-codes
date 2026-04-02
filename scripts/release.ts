#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

type DependencyField = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'
type BumpType = 'patch' | 'minor' | 'major'
type PackageDependencies = Record<string, string>
type SpawnStdIo = 'inherit' | 'pipe'

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

type PreparedRelease = {
  didBump: boolean
  packageJsonPaths: string[]
  version: string
}

const dependencyFields: DependencyField[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const usage = `Usage:
  bun release
  bun release patch
  bun release minor
  bun release major
  bun release 1.2.3
  bun release --bump patch
  bun release --version 1.2.3`

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

function runCommand(command: string, args: string[], stdio: SpawnStdIo = 'pipe'): string {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio })

  if (result.status !== 0) {
    const output = result.stderr?.trim() || result.stdout?.trim()
    throw new Error(output || `${command} ${args.join(' ')} failed`)
  }

  return result.stdout?.trim() ?? ''
}

function ensureCleanWorkspace(): void {
  const status = runCommand('git', ['status', '--short'])
  if (status) {
    throw new Error('Workspace must be clean before release.')
  }
}

function ensureGhAuth(): void {
  runCommand('gh', ['auth', 'status'], 'inherit')
}

function readCurrentBranch(): string {
  const currentBranch = runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  if (!currentBranch || currentBranch === 'HEAD') {
    throw new Error('Release must be run from a branch, not a detached HEAD.')
  }

  return currentBranch
}

function hasUpstream(): boolean {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return result.status === 0
}

function stageAndCommit(packageJsonPaths: string[], version: string): void {
  runCommand('git', ['add', ...packageJsonPaths], 'inherit')
  runCommand('git', ['commit', '-m', `chore: release ${version}`], 'inherit')
}

function pushCurrentBranch(branch: string): void {
  if (hasUpstream()) {
    runCommand('git', ['push'], 'inherit')
    return
  }

  runCommand('git', ['push', '--set-upstream', 'origin', branch], 'inherit')
}

function triggerReleaseWorkflow(branch: string, version: string): void {
  runCommand('bun', ['run', 'scripts/trigger-release.ts', '--ref', branch, '--version', version], 'inherit')
}

async function prepareRelease({ bump, version }: ParsedArgs): Promise<PreparedRelease> {
  const packageDirs = listPublishablePackageDirs()
  const workspacePackages = await Promise.all(
    packageDirs.map(async (packageDir) => {
      const packageJsonPath = join(packageDir, 'package.json')
      return {
        packageJson: await readPackageJson(packageJsonPath),
        packageJsonPath,
      }
    }),
  )
  const publishablePackages = workspacePackages.filter(({ packageJson }) => packageJson.private !== true)
  const currentVersions = new Set(publishablePackages.map(({ packageJson }) => packageJson.version))

  if (currentVersions.size !== 1) {
    throw new Error(`Expected publishable packages to share one version, found: ${Array.from(currentVersions).join(', ')}`)
  }

  const currentVersion = Array.from(currentVersions)[0] as string
  const nextVersion = version ?? bumpVersion(currentVersion, bump)
  const workspacePackageNames = new Set(publishablePackages.map(({ packageJson }) => packageJson.name))

  if (compareSemver(nextVersion, currentVersion) < 0) {
    throw new Error(`Release version ${nextVersion} is lower than current version ${currentVersion}`)
  }

  const publishablePackageJsonPaths = publishablePackages.map(({ packageJsonPath }) => packageJsonPath)

  if (nextVersion === currentVersion) {
    return {
      didBump: false,
      packageJsonPaths: publishablePackageJsonPaths,
      version: nextVersion,
    }
  }

  for (const { packageJson, packageJsonPath } of publishablePackages) {
    const nextPackageJson: PackageJson = {
      ...packageJson,
      version: nextVersion,
    }

    for (const dependencyField of dependencyFields) {
      nextPackageJson[dependencyField] = rewriteInternalDependencyVersions(packageJson[dependencyField], nextVersion, workspacePackageNames)
    }

    writePackageJson(packageJsonPath, nextPackageJson)
  }

  return {
    didBump: true,
    packageJsonPaths: publishablePackageJsonPaths,
    version: nextVersion,
  }
}

async function main(): Promise<void> {
  const parsedArgs = parseArgs(Bun.argv.slice(2))

  ensureCleanWorkspace()
  ensureGhAuth()

  const branch = readCurrentBranch()
  const preparedRelease = await prepareRelease(parsedArgs)

  if (preparedRelease.didBump) {
    console.log(`Prepared release version ${preparedRelease.version}.`)
    stageAndCommit(preparedRelease.packageJsonPaths, preparedRelease.version)
  } else {
    console.log(`Release version is already ${preparedRelease.version}; no version bump needed.`)
  }

  pushCurrentBranch(branch)
  triggerReleaseWorkflow(branch, preparedRelease.version)

  console.log(`Triggered release workflow for ${preparedRelease.version} from ${branch}.`)
}

await main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
  } else {
    console.error('Error: Unknown release preparation failure')
  }

  process.exit(1)
})
