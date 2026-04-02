#!/usr/bin/env bun

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { $ } from 'bun'

type PackageDependencies = Record<string, string>

type PackageJson = {
  name: string
  version: string
  private?: boolean
  dependencies?: PackageDependencies
  [key: string]: unknown
}

type WorkspacePackage = {
  directory: string
  packageJson: PackageJson
}

const projectRoot = resolve(import.meta.dir, '..')
const shell = $.cwd(projectRoot)
const registryUrl = 'https://registry.npmjs.org/'
const publishVisibilityRetryCount = 12
const publishVisibilityRetryDelayMs = 5_000

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  return (await Bun.file(packageJsonPath).json()) as PackageJson
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function isVersionPublished(packageName: string, version: string): Promise<boolean> {
  const publishedVersion = await shell`npm view ${`${packageName}@${version}`} version --registry=${registryUrl}`.quiet().nothrow()
  return publishedVersion.exitCode === 0 && publishedVersion.stdout.toString().trim() === version
}

async function waitForPublishedVersion(packageName: string, version: string): Promise<void> {
  for (let attempt = 1; attempt <= publishVisibilityRetryCount; attempt += 1) {
    if (await isVersionPublished(packageName, version)) {
      return
    }

    if (attempt < publishVisibilityRetryCount) {
      console.log(
        `Waiting for ${packageName}@${version} to become visible in the npm registry (${attempt}/${publishVisibilityRetryCount})...`,
      )
      await sleep(publishVisibilityRetryDelayMs)
    }
  }

  throw new Error(`Timed out waiting for ${packageName}@${version} to become visible in ${registryUrl}`)
}

async function listPublishablePackages(packagesRoot = resolve('packages')): Promise<WorkspacePackage[]> {
  const packageDirs = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .filter((packageDir) => existsSync(join(packageDir, 'package.json')))

  const packages = await Promise.all(
    packageDirs.map(async (directory) => ({
      directory,
      packageJson: await readPackageJson(join(directory, 'package.json')),
    })),
  )

  return packages.filter(({ packageJson }) => packageJson.private !== true)
}

function sortPackagesForPublish(packages: WorkspacePackage[]): WorkspacePackage[] {
  const packageMap = new Map(packages.map((workspacePackage) => [workspacePackage.packageJson.name, workspacePackage]))
  const sorted: WorkspacePackage[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(packageName: string): void {
    if (visited.has(packageName)) {
      return
    }

    if (visiting.has(packageName)) {
      throw new Error(`Detected a cycle in publishable workspace dependencies at ${packageName}`)
    }

    const workspacePackage = packageMap.get(packageName)
    if (!workspacePackage) {
      return
    }

    visiting.add(packageName)

    for (const dependencyName of Object.keys(workspacePackage.packageJson.dependencies ?? {})) {
      if (packageMap.has(dependencyName)) {
        visit(dependencyName)
      }
    }

    visiting.delete(packageName)
    visited.add(packageName)
    sorted.push(workspacePackage)
  }

  for (const workspacePackage of packages) {
    visit(workspacePackage.packageJson.name)
  }

  return sorted
}

async function main(): Promise<void> {
  process.chdir(projectRoot)

  const publishablePackages = await listPublishablePackages()
  const versions = new Set(publishablePackages.map(({ packageJson }) => packageJson.version))

  if (versions.size !== 1) {
    throw new Error(`Expected publishable packages to share one version, found: ${Array.from(versions).join(', ')}`)
  }

  const releaseVersion = Array.from(versions)[0] as string
  const orderedPackages = sortPackagesForPublish(publishablePackages)

  for (const workspacePackage of orderedPackages) {
    const { directory, packageJson } = workspacePackage

    if (await isVersionPublished(packageJson.name, releaseVersion)) {
      console.log(`${packageJson.name}@${releaseVersion} is already published; skipping.`)
      continue
    }

    console.log(`Publishing ${packageJson.name}@${releaseVersion}...`)

    const publishResult = await $.cwd(directory)`npm publish --access public --registry=${registryUrl}`.nothrow()
    if (publishResult.exitCode !== 0) {
      const stderr = publishResult.stderr.toString().trim()
      const stdout = publishResult.stdout.toString().trim()
      const output = stderr || stdout
      throw new Error(`Failed to publish ${packageJson.name}@${releaseVersion}.${output ? ` ${output}` : ''}`)
    }

    await waitForPublishedVersion(packageJson.name, releaseVersion)
  }
}

await main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
  } else {
    console.error('Error: Unknown publish failure')
  }

  process.exit(1)
})
