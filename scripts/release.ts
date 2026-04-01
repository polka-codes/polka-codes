#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { $ } from 'bun'

type DependencyField = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'

type PackageDependencies = Record<string, string>

type PackageJson = {
  name: string
  version: string
  dependencies?: PackageDependencies
  devDependencies?: PackageDependencies
  optionalDependencies?: PackageDependencies
  peerDependencies?: PackageDependencies
  [key: string]: unknown
}

const dependencyFields: DependencyField[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const projectRoot = resolve(import.meta.dir, '..')
const shell = $.cwd(projectRoot)
const RELEASE_BRANCH = process.env.RELEASE_BRANCH || 'master'

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  return (await Bun.file(packageJsonPath).json()) as PackageJson
}

function writePackageJson(packageJsonPath: string, packageJson: PackageJson): void {
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

export function listWorkspacePackageDirs(packagesRoot = resolve('packages')): string[] {
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .filter((packageDir) => existsSync(join(packageDir, 'package.json')))
    .sort()
}

export async function getWorkspacePackageNames(packagesRoot = resolve('packages')): Promise<Set<string>> {
  const packageNames = new Set<string>()
  for (const packageDir of listWorkspacePackageDirs(packagesRoot)) {
    const packageJson = await readPackageJson(join(packageDir, 'package.json'))
    packageNames.add(packageJson.name)
  }
  return packageNames
}

function rewriteDependencyVersions(
  dependencies: PackageDependencies | undefined,
  version: string,
  workspacePackageNames: ReadonlySet<string>,
): PackageDependencies | undefined {
  if (!dependencies) {
    return dependencies
  }

  return Object.fromEntries(Object.entries(dependencies).map(([name, spec]) => [name, workspacePackageNames.has(name) ? version : spec]))
}

export function createReleaseManifest(packageJson: PackageJson, version: string, workspacePackageNames: ReadonlySet<string>): PackageJson {
  const releaseManifest: PackageJson = {
    ...packageJson,
    version,
  }

  for (const dependencyField of dependencyFields) {
    releaseManifest[dependencyField] = rewriteDependencyVersions(packageJson[dependencyField], version, workspacePackageNames)
  }

  return releaseManifest
}

export async function updateWorkspaceVersions(version: string, packagesRoot = resolve('packages')): Promise<void> {
  for (const packageDir of listWorkspacePackageDirs(packagesRoot)) {
    const packageJsonPath = join(packageDir, 'package.json')
    const packageJson = await readPackageJson(packageJsonPath)
    writePackageJson(packageJsonPath, {
      ...packageJson,
      version,
    })
  }
}

export async function preparePublishDirectory(
  packageDir: string,
  version: string,
  outputRoot: string,
  workspacePackageNames: ReadonlySet<string>,
): Promise<string> {
  const sourceDir = resolve(packageDir)
  const destinationDir = join(resolve(outputRoot), basename(sourceDir))
  const packageJsonPath = join(destinationDir, 'package.json')
  const nodeModulesSegment = `${sep}node_modules`

  mkdirSync(outputRoot, { recursive: true })
  cpSync(sourceDir, destinationDir, {
    recursive: true,
    filter: (source) => !source.includes(nodeModulesSegment),
  })

  const packageJson = await readPackageJson(packageJsonPath)
  writePackageJson(packageJsonPath, createReleaseManifest(packageJson, version, workspacePackageNames))

  return destinationDir
}

export function bumpPatchVersion(currentVersion: string): string {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(currentVersion.trim())

  if (!match?.groups) {
    throw new Error(`Invalid semver version: ${currentVersion}`)
  }

  const { major, minor, patch } = match.groups
  return `${major}.${minor}.${Number.parseInt(patch, 10) + 1}`
}

async function readCorePackageVersion(): Promise<string> {
  const packageJson = await readPackageJson(join(projectRoot, 'packages/core/package.json'))

  if (!packageJson.version) {
    throw new Error('Could not read current version from packages/core/package.json')
  }

  return packageJson.version
}

async function resolveReleaseVersion(inputVersion: string | undefined): Promise<string> {
  if (inputVersion) {
    console.log(`Using specified version: ${inputVersion}`)
    return inputVersion
  }

  console.log('No version specified, auto-bumping patch version...')

  const currentVersion = await readCorePackageVersion()
  console.log(`Current version: ${currentVersion}`)

  const version = bumpPatchVersion(currentVersion)
  console.log(`Bumping to version: ${version}`)

  return version
}

async function ensureCleanWorktree(): Promise<void> {
  const status = (await shell`git status --porcelain`.quiet().text()).trim()

  if (status) {
    throw new Error('Unstaged changes detected. Commit or stash them before running this script.')
  }
}

async function ensureMasterBranch(): Promise<void> {
  const currentBranch = (await shell`git rev-parse --abbrev-ref HEAD`.quiet().text()).trim()

  if (currentBranch !== RELEASE_BRANCH) {
    throw new Error(`Must be on ${RELEASE_BRANCH} branch to release.`)
  }
}

async function prepareAndPublishPackage(packageDir: string, version: string, workspacePackageNames: ReadonlySet<string>): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'polka-release-'))

  try {
    // Bun resolves workspace:* dependencies from bun.lock, but we need exact versions
    // for published packages. Create a rewritten copy with pinned versions.
    const preparedDirectory = await preparePublishDirectory(packageDir, version, tempRoot, workspacePackageNames)
    const tarball = (await $.cwd(preparedDirectory)`npm pack --ignore-scripts --silent`.quiet().text()).trim()

    await shell`bun publish --access public ${join(preparedDirectory, tarball)}`
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

async function main(): Promise<void> {
  process.chdir(projectRoot)

  const version = await resolveReleaseVersion(Bun.argv[2])

  await ensureCleanWorktree()
  await ensureMasterBranch()
  await shell`git pull`

  await updateWorkspaceVersions(version)
  console.log(`Version bumped to ${version} in all package.json files under packages directory`)

  const allPackages = listWorkspacePackageDirs()
  await shell`git add ${allPackages.map((packageDir) => `${packageDir}/package.json`)}`
  await shell`git commit -m ${`chore: release ${version}`}`

  await shell`bun run clean`
  await shell`bun run build`

  const workspacePackageNames = await getWorkspacePackageNames()
  const releasePackages = ['core', 'github', 'cli-shared', 'cli', 'runner']
    .map((name) => allPackages.find((pkg) => pkg.endsWith(name)))
    .filter((pkg): pkg is string => pkg !== undefined)

  for (const packageDir of releasePackages) {
    await prepareAndPublishPackage(packageDir, version, workspacePackageNames)
  }

  console.log('Creating git tag...')
  const tagResult = await shell`git tag ${`v${version}`}`.quiet()
  if (tagResult.exitCode !== 0) {
    throw new Error(`Failed to create tag: ${tagResult.stderr.toString()}`)
  }

  console.log('Pushing tag to origin...')
  const pushTagResult = await shell`git push origin ${`v${version}`}`.quiet()
  if (pushTagResult.exitCode !== 0) {
    throw new Error(`Failed to push tag: ${pushTagResult.stderr.toString()}`)
  }

  console.log('Pushing to origin...')
  const pushResult = await shell`git push`.quiet()
  if (pushResult.exitCode !== 0) {
    throw new Error(`Failed to push: ${pushResult.stderr.toString()}`)
  }

  console.log('Creating GitHub release...')
  const ghRelease = await shell`gh release create ${`v${version}`} --generate-notes`.quiet().nothrow()
  if (ghRelease.exitCode !== 0) {
    console.warn(`Warning: Failed to create GitHub release: ${ghRelease.stderr.toString().trim()}`)
    console.warn('You can create it manually at: https://github.com/your-org/your-repo/releases/new')
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Error: Unknown failure during release')
    }

    process.exit(1)
  })
}
