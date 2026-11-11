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
const registryUrl = 'https://registry.npmjs.org/'
const publishVisibilityTimeoutMs = 30 * 60 * 1_000
const publishVisibilityInitialDelayMs = 15_000
const publishVisibilityMaxDelayMs = 60_000

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  return (await Bun.file(packageJsonPath).json()) as PackageJson
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function packageTarballUrl(packageName: string, version: string): string {
  const packageBasename = packageName.slice(packageName.lastIndexOf('/') + 1)
  return `${registryUrl}${packageName}/-/${packageBasename}-${version}.tgz`
}

async function isVersionPublished(packageName: string, version: string): Promise<boolean> {
  try {
    const response = await fetch(packageTarballUrl(packageName, version), {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok
  } catch {
    return false
  }
}

export function isStagedPublishConflict(output: string): boolean {
  return /cannot publish over previously staged version/i.test(output)
}

async function waitForPublishedVersion(packageName: string, version: string): Promise<void> {
  const startedAt = Date.now()
  let delayMs = publishVisibilityInitialDelayMs

  while (true) {
    if (await isVersionPublished(packageName, version)) {
      return
    }

    const elapsedMs = Date.now() - startedAt
    if (elapsedMs + delayMs > publishVisibilityTimeoutMs) {
      throw new Error(
        `Timed out waiting for ${packageName}@${version} to become installable after ${Math.round(elapsedMs / 1_000)} seconds. ` +
          'The package may still be staged by npm; rerun the release workflow after registry propagation completes.',
      )
    }

    console.log(`Waiting for ${packageName}@${version} to become installable on npm; retrying in ${delayMs / 1_000}s...`)
    await sleep(delayMs)
    delayMs = Math.min(delayMs * 2, publishVisibilityMaxDelayMs)
  }
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

      if (isStagedPublishConflict(output)) {
        console.log(`${packageJson.name}@${releaseVersion} is already staged by npm; waiting for it to become installable.`)
        await waitForPublishedVersion(packageJson.name, releaseVersion)
        continue
      }

      throw new Error(`Failed to publish ${packageJson.name}@${releaseVersion}.${output ? ` ${output}` : ''}`)
    }

    await waitForPublishedVersion(packageJson.name, releaseVersion)
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Error: Unknown publish failure')
    }

    process.exit(1)
  })
}
