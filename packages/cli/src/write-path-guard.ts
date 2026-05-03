import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { ToolProvider } from '@polka-codes/core'

type WritePathConstraint = {
  rawPath: string
  resolvedPath: string
  allowDirectory: boolean
}

function hasTrailingPathSeparator(inputPath: string): boolean {
  return inputPath.endsWith('/') || inputPath.endsWith('\\')
}

function resolveWritePath(inputPath: string, cwd: string): string {
  return path.normalize(path.resolve(cwd, inputPath))
}

async function buildConstraint(rawPath: string, cwd: string): Promise<WritePathConstraint> {
  const resolvedPath = resolveWritePath(rawPath, cwd)
  let allowDirectory = hasTrailingPathSeparator(rawPath)

  if (!allowDirectory) {
    try {
      allowDirectory = (await stat(resolvedPath)).isDirectory()
    } catch {
      allowDirectory = false
    }
  }

  return { rawPath, resolvedPath, allowDirectory }
}

function isWithinDirectory(candidatePath: string, directoryPath: string): boolean {
  const relativePath = path.relative(directoryPath, candidatePath)
  return relativePath === '' || (relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function isPathAllowedForWrite(candidatePath: string, constraints: WritePathConstraint[], cwd = process.cwd()): boolean {
  const resolvedCandidatePath = resolveWritePath(candidatePath, cwd)

  return constraints.some((constraint) => {
    if (constraint.allowDirectory) {
      return isWithinDirectory(resolvedCandidatePath, constraint.resolvedPath)
    }
    return resolvedCandidatePath === constraint.resolvedPath
  })
}

function formatAllowedPaths(constraints: WritePathConstraint[]): string {
  return constraints.map((constraint) => constraint.rawPath).join(', ')
}

export async function createWritePathGuardedProvider(
  provider: ToolProvider,
  allowedWritePaths: string[],
  cwd = process.cwd(),
): Promise<ToolProvider> {
  if (allowedWritePaths.length === 0) {
    return provider
  }

  const constraints = await Promise.all(allowedWritePaths.map((allowedPath) => buildConstraint(allowedPath, cwd)))

  const assertWritablePath = (targetPath: string) => {
    if (!isPathAllowedForWrite(targetPath, constraints, cwd)) {
      throw new Error(`Write to "${targetPath}" is outside allowedWritePaths: ${formatAllowedPaths(constraints)}`)
    }
  }

  const writeFile = provider.writeFile?.bind(provider)
  const removeFile = provider.removeFile?.bind(provider)
  const renameFile = provider.renameFile?.bind(provider)

  const guardedProvider: ToolProvider = { ...provider }

  if (writeFile) {
    guardedProvider.writeFile = async (targetPath, content) => {
      assertWritablePath(targetPath)
      return await writeFile(targetPath, content)
    }
  }

  if (removeFile) {
    guardedProvider.removeFile = async (targetPath) => {
      assertWritablePath(targetPath)
      return await removeFile(targetPath)
    }
  }

  if (renameFile) {
    guardedProvider.renameFile = async (sourcePath, targetPath) => {
      assertWritablePath(sourcePath)
      assertWritablePath(targetPath)
      return await renameFile(sourcePath, targetPath)
    }
  }

  return guardedProvider
}
