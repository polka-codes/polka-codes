import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type PackageExport = {
  types: string
  import: string
}

type PackageJson = {
  name: string
  bin?: Record<string, string>
  exports?: {
    '.': PackageExport
  }
}

type PackFile = {
  path: string
}

type PackResult = {
  files: PackFile[]
}

type RunNodeOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

const projectRoot = resolve(import.meta.dir, '..')
const packagesRoot = join(projectRoot, 'packages')
const npmCache = join(tmpdir(), 'polka-codes-npm-cache')
const relativeModuleSpecifier = /(\b(?:from|import|require)\s*(?:\(\s*)?)(['"])(\.{1,2}\/[^'"]+)\2/g
const runtimeExtension = /\.(?:[cm]?js|json|node|wasm)$/

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function validateDeclarationImport(declarationPath: string, specifier: string): void {
  assert(runtimeExtension.test(specifier), `Declaration import lacks a runtime extension: ${declarationPath} -> ${specifier}`)

  const targetPath = resolve(dirname(declarationPath), specifier)

  if (specifier.endsWith('.js')) {
    const declarationTarget = `${targetPath.slice(0, -3)}.d.ts`
    assert(existsSync(declarationTarget), `Declaration import does not resolve: ${declarationPath} -> ${specifier}`)
    return
  }

  assert(existsSync(targetPath), `Declaration asset import does not resolve: ${declarationPath} -> ${specifier}`)
}

async function validateDeclarations(packageDirectory: string): Promise<number> {
  let declarationCount = 0

  for await (const relativePath of new Bun.Glob('dist/**/*.d.ts').scan({ cwd: packageDirectory, onlyFiles: true })) {
    assert(!relativePath.includes('/__tests__/'), `Test declaration would be published: ${relativePath}`)
    assert(!relativePath.includes('/testing/'), `Test declaration would be published: ${relativePath}`)
    assert(!relativePath.endsWith('.test.d.ts'), `Test declaration would be published: ${relativePath}`)
    assert(!relativePath.endsWith('/test-fixtures.d.ts'), `Test declaration would be published: ${relativePath}`)

    const declarationPath = join(packageDirectory, relativePath)
    const declaration = await Bun.file(declarationPath).text()

    for (const match of declaration.matchAll(relativeModuleSpecifier)) {
      const specifier = match[3]
      assert(Boolean(specifier), `Could not read declaration import in ${declarationPath}`)
      validateDeclarationImport(declarationPath, specifier as string)
    }

    declarationCount += 1
  }

  return declarationCount
}

function npmPackDryRun(packageDirectory: string): PackResult {
  const result = Bun.spawnSync({
    cmd: ['npm', 'pack', '--dry-run', '--json'],
    cwd: packageDirectory,
    env: { ...process.env, npm_config_cache: npmCache },
    stderr: 'pipe',
    stdout: 'pipe',
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `npm pack failed in ${packageDirectory}`)
  }

  const packResults = JSON.parse(result.stdout.toString()) as PackResult[]
  const packResult = packResults[0]
  assert(Boolean(packResult), `npm pack returned no package details in ${packageDirectory}`)
  return packResult as PackResult
}

function runNode(packageName: string, args: string[], failureDescription: string, options: RunNodeOptions = {}): void {
  const result = Bun.spawnSync({
    cmd: ['node', ...args],
    cwd: options.cwd ?? projectRoot,
    env: options.env,
    stderr: 'pipe',
    stdout: 'pipe',
  })

  if (result.exitCode !== 0) {
    const output = result.stderr.toString().trim() || result.stdout.toString().trim()
    throw new Error(`${packageName} ${failureDescription}${output ? `: ${output}` : ''}`)
  }
}

function expectedRuntimeAssets(packageName: string): string[] {
  if (packageName === '@polka-codes/cli' || packageName === '@polka-codes/cli-shared') {
    return ['dist/sql-wasm.wasm']
  }

  return []
}

function validateCliMemory(packageDirectory: string, packageJson: PackageJson): void {
  if (packageJson.name !== '@polka-codes/cli') {
    return
  }

  const binPath = packageJson.bin?.polka
  assert(binPath !== undefined, `${packageJson.name} is missing the polka binary`)

  const absoluteBinPath = join(packageDirectory, binPath)
  const distDirectory = dirname(absoluteBinPath)
  const isolatedHome = realpathSync(mkdtempSync(join(tmpdir(), 'polka-codes-publish-')))

  try {
    writeFileSync(join(isolatedHome, 'package.json'), '{}')
    runNode(
      packageJson.name,
      [
        '--permission',
        `--allow-fs-read=${distDirectory}`,
        `--allow-fs-read=${isolatedHome}`,
        `--allow-fs-write=${isolatedHome}`,
        absoluteBinPath,
        'memory',
        'list',
      ],
      'binary polka memory list failed in an isolated filesystem',
      {
        cwd: isolatedHome,
        env: { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome },
      },
    )
  } finally {
    rmSync(isolatedHome, { force: true, recursive: true })
  }
}

function validateRuntimeEntries(packageDirectory: string, packageJson: PackageJson, importPath: string): void {
  const importUrl = pathToFileURL(join(packageDirectory, importPath)).href
  runNode(packageJson.name, ['--input-type=module', '--eval', `await import(${JSON.stringify(importUrl)})`], 'root import failed')

  for (const [binName, binPath] of Object.entries(packageJson.bin ?? {})) {
    runNode(packageJson.name, [join(packageDirectory, binPath), '--help'], `binary ${binName} --help failed`)
  }
}

async function validatePackage(packageDirectory: string): Promise<void> {
  const packageJson = (await Bun.file(join(packageDirectory, 'package.json')).json()) as PackageJson
  const rootExport = packageJson.exports?.['.']
  assert(Boolean(rootExport), `${packageJson.name} is missing its root export`)
  assert(Object.keys(rootExport as PackageExport)[0] === 'types', `${packageJson.name} must list its types export first`)

  const { import: importPath, types: typesPath } = rootExport as PackageExport
  assert(typesPath.endsWith('.d.ts'), `${packageJson.name} types export must reference a declaration file`)

  const expectedFiles = [typesPath, importPath, ...Object.values(packageJson.bin ?? {}), ...expectedRuntimeAssets(packageJson.name)].map(
    (path) => path.replace(/^\.\//, ''),
  )

  for (const expectedFile of expectedFiles) {
    assert(existsSync(join(packageDirectory, expectedFile)), `${packageJson.name} is missing ${expectedFile}`)
  }

  validateRuntimeEntries(packageDirectory, packageJson, importPath)

  const declarationCount = await validateDeclarations(packageDirectory)
  assert(declarationCount > 0, `${packageJson.name} contains no declaration files`)

  const packResult = npmPackDryRun(packageDirectory)
  const packedFiles = new Set(packResult.files.map(({ path }) => path))

  for (const expectedFile of expectedFiles) {
    assert(packedFiles.has(expectedFile), `${packageJson.name} npm tarball is missing ${expectedFile}`)
  }

  for (const packedFile of packedFiles) {
    assert(!packedFile.endsWith('.test.d.ts'), `${packageJson.name} npm tarball contains ${packedFile}`)
    assert(!packedFile.includes('/__tests__/'), `${packageJson.name} npm tarball contains ${packedFile}`)
    assert(!packedFile.includes('/testing/'), `${packageJson.name} npm tarball contains ${packedFile}`)
    assert(!packedFile.endsWith('/test-fixtures.d.ts'), `${packageJson.name} npm tarball contains ${packedFile}`)
    assert(!packedFile.endsWith('.d.ts.map'), `${packageJson.name} npm tarball contains unusable declaration map ${packedFile}`)
  }

  validateCliMemory(packageDirectory, packageJson)

  console.log(`Validated ${packageJson.name}: ${declarationCount} declarations, ${packedFiles.size} packed files.`)
}

const packageDirectories = readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesRoot, entry.name))
  .filter((packageDirectory) => existsSync(join(packageDirectory, 'package.json')))
  .sort()

for (const packageDirectory of packageDirectories) {
  await validatePackage(packageDirectory)
}
