// source: https://github.com/cline/cline/blob/ac53dbb12209e0eb66c0036865273bf4694bc50a/src/services/tree-sitter/index.ts

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { listFiles } from '../listFiles'
import { type LanguageParser, loadRequiredLanguageParsers } from './languageParser'

// TODO: implement caching behavior to avoid having to keep analyzing project for new tasks.
export async function parseSourceCodeForDefinitionsTopLevel(dirPath: string, cwd: string, excldueFiles?: string[]): Promise<string> {
  // Get all files at top level (not gitignored)
  const [allFiles] = await listFiles(dirPath, false, 200, cwd, excldueFiles)

  // Separate files to parse and remaining files
  const { filesToParse } = separateFiles(allFiles)
  const languageParsers = await loadRequiredLanguageParsers(filesToParse)

  // Parse specific files we have language parsers for

  const results: string[] = []

  for (const file of filesToParse) {
    const abspath = path.resolve(dirPath, file)
    const definitions = await parseFile(abspath, languageParsers)
    if (definitions) {
      results.push(`${file}\n-------------\n${definitions}\n`)
    }
  }

  return results.length > 0 ? results.join('\n=============\n') : 'No source code definitions found.'
}

export function separateFiles(allFiles: string[]): {
  filesToParse: string[]
  remainingFiles: string[]
} {
  const extensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'java', 'php', 'swift'].map(
    (e) => `.${e}`,
  )
  const filesToParse = allFiles.filter((file) => extensions.includes(path.extname(file))).slice(0, 50) // 50 files max
  const remainingFiles = allFiles.filter((file) => !filesToParse.includes(file))
  return { filesToParse, remainingFiles }
}

/*
Parsing files using tree-sitter

1. Parse the file content into an AST (Abstract Syntax Tree) using the appropriate language grammar (set of rules that define how the components of a language like keywords, expressions, and statements can be combined to create valid programs).
2. Create a query using a language-specific query string, and run it against the AST's root node to capture specific syntax elements.
    - We use tag queries to identify named entities in a program, and then use a syntax capture to label the entity and its name. A notable example of this is GitHub's search-based code navigation.
	- Our custom tag queries are based on tree-sitter's default tag queries, but modified to only capture definitions.
3. Sort the captures by their position in the file, output the name of the definition, and format by i.e. adding "|----\n" for gaps between captured sections.

This approach allows us to focus on the most relevant parts of the code (defined by our language-specific queries) and provides a concise yet informative view of the file's structure and key elements.

- https://github.com/tree-sitter/node-tree-sitter/blob/master/test/query_test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/helper.js
- https://tree-sitter.github.io/tree-sitter/code-navigation-systems
*/
export async function parseFile(filePath: string, languageParsers: LanguageParser): Promise<string | undefined> {
  const fileContent = await fs.readFile(filePath, 'utf8')
  const ext = path.extname(filePath).toLowerCase().slice(1)

  const { parser, query } = languageParsers[ext] || {}
  if (!parser || !query) {
    return `Unsupported file type: ${filePath}`
  }

  let formattedOutput = ''

  try {
    // Parse the file content into an Abstract Syntax Tree (AST), a tree-like representation of the code
    const tree = parser.parse(fileContent)

    if (!tree) {
      return `Failed to parse file: ${filePath}`
    }

    // Apply the query to the AST and get the captures
    // Captures are specific parts of the AST that match our query patterns, each capture represents a node in the AST that we're interested in.
    const captures = query.captures(tree.rootNode)

    // Sort captures by their start position
    captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

    // Split the file content into individual lines
    const lines = fileContent.split('\n')

    // Keep track of the last line we've processed
    let lastLine = -1

    for (const capture of captures) {
      const { node, name } = capture
      const startLine = node.startPosition.row
      const endLine = node.endPosition.row

      if (lastLine !== -1 && startLine > lastLine + 1) {
        formattedOutput += '|----\n'
      }
      if (name.includes('name') && lines[startLine]) {
        formattedOutput += `│${lines[startLine]}\n`
      }

      lastLine = endLine
    }
  } catch (error) {
    console.log(`Error parsing file: ${error}\n`)
  }

  if (formattedOutput.length > 0) {
    return `|----\n${formattedOutput}|----\n`
  }
  return undefined
}
