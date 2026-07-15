import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const declarationDirectory = resolve(Bun.argv[2] ?? 'dist')
const relativeModuleSpecifier = /(\b(?:from|import|require)\s*(?:\(\s*)?)(['"])(\.{1,2}\/[^'"]+)\2/g
const runtimeExtension = /\.(?:[cm]?js|json|node|wasm)$/

function toRuntimeSpecifier(declarationPath: string, specifier: string): string {
  if (runtimeExtension.test(specifier)) {
    return specifier
  }

  const targetPath = resolve(dirname(declarationPath), specifier)

  if (existsSync(`${targetPath}.d.ts`)) {
    return `${specifier}.js`
  }

  if (existsSync(join(targetPath, 'index.d.ts'))) {
    return `${specifier}/index.js`
  }

  throw new Error(`Cannot resolve declaration import ${specifier} from ${declarationPath}`)
}

let updatedFileCount = 0

for await (const relativePath of new Bun.Glob('**/*.d.ts').scan({
  cwd: declarationDirectory,
  onlyFiles: true,
})) {
  const declarationPath = join(declarationDirectory, relativePath)
  const original = await Bun.file(declarationPath).text()
  const updated = original.replace(relativeModuleSpecifier, (match, prefix: string, quote: string, specifier: string) => {
    const runtimeSpecifier = toRuntimeSpecifier(declarationPath, specifier)
    return runtimeSpecifier === specifier ? match : `${prefix}${quote}${runtimeSpecifier}${quote}`
  })

  if (updated !== original) {
    await Bun.write(declarationPath, updated)
    updatedFileCount += 1
  }
}

console.log(`Validated declaration imports in ${declarationDirectory}; updated ${updatedFileCount} files.`)
