import { fileURLToPath } from 'node:url'
import { codegen } from '@graphql-codegen/core'
import * as typescriptPlugin from '@graphql-codegen/typescript'
import * as typescriptOperationsPlugin from '@graphql-codegen/typescript-operations'
import { parse } from 'graphql'

async function main(): Promise<void> {
  const packageDirectoryUrl = new URL('../packages/github/', import.meta.url)
  const packageDirectory = fileURLToPath(packageDirectoryUrl)
  const outputUrl = new URL('src/types/github-types.ts', packageDirectoryUrl)
  const schema = parse(await Bun.file(new URL('schema.docs.graphql', packageDirectoryUrl)).text())
  const documentPaths: string[] = []

  for await (const documentPath of new Bun.Glob('src/**/*.{graphql,gql}').scan({
    cwd: packageDirectory,
    onlyFiles: true,
  })) {
    documentPaths.push(documentPath)
  }

  documentPaths.sort()

  const documents = await Promise.all(
    documentPaths.map(async (documentPath) => ({
      document: parse(await Bun.file(new URL(documentPath, packageDirectoryUrl)).text()),
      location: documentPath,
    })),
  )

  const output = await codegen({
    config: {},
    documents,
    filename: fileURLToPath(outputUrl),
    pluginMap: {
      typescript: typescriptPlugin,
      'typescript-operations': typescriptOperationsPlugin,
    },
    plugins: [{ typescript: {} }, { 'typescript-operations': {} }],
    schema,
  })

  await Bun.write(outputUrl, output)
  console.log(`Generated ${documentPaths.length} GraphQL documents at ${fileURLToPath(outputUrl)}`)
}

await main()
