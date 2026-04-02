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
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/'
const PUBLISH_VISIBILITY_RETRY_COUNT = 12
const PUBLISH_VISIBILITY_RETRY_DELAY_MS = 5_000

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

async function ensureNpmAuth(): Promise<void> {
  const whoami = await shell`npm whoami --registry=${NPM_REGISTRY_URL}`.quiet().nothrow()

  if (whoami.exitCode !== 0) {
    throw new Error('npm authentication is not configured. Run `npm login` or configure `NPM_CONFIG_TOKEN` before releasing.')
  }
}

async function hasStagedChanges(paths: string[]): Promise<boolean> {
  const diff = await shell`git diff --cached --quiet -- ${paths}`.quiet().nothrow()

  if (diff.exitCode === 0) {
    return false
  }

  if (diff.exitCode === 1) {
    return true
  }

  throw new Error(`Failed to inspect staged changes: ${diff.stderr.toString().trim()}`)
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function isVersionPublished(packageName: string, version: string): Promise<boolean> {
  const publishedVersion = await shell`npm view ${`${packageName}@${version}`} version --registry=${NPM_REGISTRY_URL}`.quiet().nothrow()
  return publishedVersion.exitCode === 0 && publishedVersion.stdout.toString().trim() === version
}

async function waitForPublishedVersion(packageName: string, version: string): Promise<void> {
  for (let attempt = 1; attempt <= PUBLISH_VISIBILITY_RETRY_COUNT; attempt += 1) {
    if (await isVersionPublished(packageName, version)) {
      return
    }

    if (attempt < PUBLISH_VISIBILITY_RETRY_COUNT) {
      console.log(
        `Waiting for ${packageName}@${version} to become visible in the npm registry (${attempt}/${PUBLISH_VISIBILITY_RETRY_COUNT})...`,
      )
      await sleep(PUBLISH_VISIBILITY_RETRY_DELAY_MS)
    }
  }

  throw new Error(`Timed out waiting for ${packageName}@${version} to become visible in ${NPM_REGISTRY_URL}`)
}

async function prepareAndPublishPackage(packageDir: string, version: string, workspacePackageNames: ReadonlySet<string>): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'polka-release-'))

  try {
    // Bun resolves workspace:* dependencies from bun.lock, but we need exact versions
    // for published packages. Create a rewritten copy with pinned versions.
    const preparedDirectory = await preparePublishDirectory(packageDir, version, tempRoot, workspacePackageNames)
    const packageJson = await readPackageJson(join(preparedDirectory, 'package.json'))

    if (await isVersionPublished(packageJson.name, version)) {
      console.log(`${packageJson.name}@${version} is already published; skipping.`)
      return
    }

    console.log(`Publishing ${packageJson.name}@${version}...`)

    const publishResult = await $.cwd(
      preparedDirectory,
    )`npm publish --access public --ignore-scripts --registry=${NPM_REGISTRY_URL}`.nothrow()
    if (publishResult.exitCode !== 0) {
      const stderr = publishResult.stderr.toString().trim()
      const stdout = publishResult.stdout.toString().trim()
      const output = stderr || stdout
      throw new Error(
        `Failed to publish ${packageJson.name}@${version}.${output ? ` ${output}` : ''} Check npm authentication and scope access before retrying.`,
      )
    }

    await waitForPublishedVersion(packageJson.name, version)
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

async function main(): Promise<void> {
  process.chdir(projectRoot)

  const version = await resolveReleaseVersion(Bun.argv[2])

  await ensureCleanWorktree()
  await ensureMasterBranch()
  await ensureNpmAuth()
  await shell`git pull`

  await updateWorkspaceVersions(version)
  console.log(`Version bumped to ${version} in all package.json files under packages directory`)

  const allPackages = listWorkspacePackageDirs()
  const packageJsonPaths = allPackages.map((packageDir) => `${packageDir}/package.json`)
  await shell`git add ${packageJsonPaths}`

  if (await hasStagedChanges(packageJsonPaths)) {
    await shell`git commit -m ${`chore: release ${version}`}`
  } else {
    console.log(`Package versions are already set to ${version}; skipping release version commit.`)
  }

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
