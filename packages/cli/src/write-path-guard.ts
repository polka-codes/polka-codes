import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { Logger, ToolProvider } from '@polka-codes/core'
import { createWorkflowProgressEmitter, type WorkflowProgressCallback } from './workflow-events'

type WritePathConstraint = {
  rawPath: string
  resolvedPath: string
  allowDirectory: boolean
}

type WritePathRejection = {
  kind: 'write-path-rejected'
  path: string
  reason: string
}

type WritePathCheckResult = { kind: 'allowed' } | WritePathRejection

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
  onEvent?: WorkflowProgressCallback,
  logger?: Pick<Logger, 'warn'>,
): Promise<ToolProvider> {
  if (allowedWritePaths.length === 0) {
    return provider
  }

  const constraints = await Promise.all(allowedWritePaths.map((allowedPath) => buildConstraint(allowedPath, cwd)))
  const emitProgress = createWorkflowProgressEmitter(onEvent, logger ?? { warn: () => {} })

  const checkWritablePath = (targetPath: string): WritePathCheckResult => {
    if (isPathAllowedForWrite(targetPath, constraints, cwd)) {
      return { kind: 'allowed' }
    }

    return {
      kind: 'write-path-rejected',
      path: targetPath,
      reason: `Write to "${targetPath}" is outside allowedWritePaths: ${formatAllowedPaths(constraints)}`,
    }
  }

  const rejectWrite = async (result: WritePathRejection) => {
    await emitProgress({ kind: 'write-rejected', path: result.path, reason: result.reason })
    throw new Error(result.reason)
  }

  const enforceWritablePath = async (targetPath: string) => {
    const result = checkWritablePath(targetPath)
    if (result.kind === 'write-path-rejected') {
      await rejectWrite(result)
    }
  }

  const writeFile = provider.writeFile?.bind(provider)
  const removeFile = provider.removeFile?.bind(provider)
  const renameFile = provider.renameFile?.bind(provider)

  const guardedProvider: ToolProvider = { ...provider }

  if (writeFile) {
    guardedProvider.writeFile = async (targetPath, content) => {
      await emitProgress({ kind: 'write-attempted', path: targetPath })
      await enforceWritablePath(targetPath)
      await writeFile(targetPath, content)
      await emitProgress({ kind: 'write-finished', path: targetPath })
    }
  }

  if (removeFile) {
    guardedProvider.removeFile = async (targetPath) => {
      await emitProgress({ kind: 'write-attempted', path: targetPath })
      await enforceWritablePath(targetPath)
      await removeFile(targetPath)
      await emitProgress({ kind: 'write-finished', path: targetPath })
    }
  }

  if (renameFile) {
    guardedProvider.renameFile = async (sourcePath, targetPath) => {
      await emitProgress({ kind: 'write-attempted', path: sourcePath })
      await emitProgress({ kind: 'write-attempted', path: targetPath })
      await enforceWritablePath(sourcePath)
      await enforceWritablePath(targetPath)
      await renameFile(sourcePath, targetPath)
      await emitProgress({ kind: 'write-finished', path: sourcePath })
      await emitProgress({ kind: 'write-finished', path: targetPath })
    }
  }

  return guardedProvider
}
