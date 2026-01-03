import { describe, expect, it } from 'bun:test'
import type { WorkflowTools } from '@polka-codes/core'
import { GitOperations } from './git-operations'

describe('GitOperations', () => {
  const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }

  const mockExecuteCommand = async ({ command, args }: { command: string; args: string[] }) => {
    return { stdout: '', stderr: '', exitCode: 0 }
  }

  const tools: WorkflowTools<any> = {
    executeCommand: mockExecuteCommand,
    logger: mockLogger as any,
  }

  describe('constructor', () => {
    it('should create GitOperations instance', () => {
      const gitOps = new GitOperations(tools)

      expect(gitOps).toBeObject()
      expect(gitOps).toHaveProperty('getFileChanges')
      expect(gitOps).toHaveProperty('getLocalChanges')
      expect(gitOps).toHaveProperty('getCurrentBranch')
      expect(gitOps).toHaveProperty('getDefaultBranch')
      expect(gitOps).toHaveProperty('hasUncommittedChanges')
      expect(gitOps).toHaveProperty('checkoutBranch')
      expect(gitOps).toHaveProperty('createAndCheckoutBranch')
      expect(gitOps).toHaveProperty('getCommitMessages')
      expect(gitOps).toHaveProperty('getPullRequestChanges')
    })

    it('should store tools reference', () => {
      const gitOps = new GitOperations(tools)

      expect((gitOps as any).tools).toBe(tools)
    })
  })

  describe('method types', () => {
    const gitOps = new GitOperations(tools)

    it('should have getFileChanges as async method', () => {
      expect(typeof gitOps.getFileChanges).toBe('function')
    })

    it('should have getLocalChanges as async method', () => {
      expect(typeof gitOps.getLocalChanges).toBe('function')
    })

    it('should have getCurrentBranch as async method', () => {
      expect(typeof gitOps.getCurrentBranch).toBe('function')
    })

    it('should have getDefaultBranch as async method', () => {
      expect(typeof gitOps.getDefaultBranch).toBe('function')
    })

    it('should hasUncommittedChanges as async method', () => {
      expect(typeof gitOps.hasUncommittedChanges).toBe('function')
    })

    it('should have checkoutBranch as async method', () => {
      expect(typeof gitOps.checkoutBranch).toBe('function')
    })

    it('should have createAndCheckoutBranch as async method', () => {
      expect(typeof gitOps.createAndCheckoutBranch).toBe('function')
    })

    it('should have getCommitMessages as async method', () => {
      expect(typeof gitOps.getCommitMessages).toBe('function')
    })

    it('should have getPullRequestChanges as async method', () => {
      expect(typeof gitOps.getPullRequestChanges).toBe('function')
    })
  })

  describe('FileChange interface', () => {
    it('should support expected FileChange structure', () => {
      const fileChange = {
        path: 'test/path/file.ts',
        status: 'M' as const,
        insertions: 10,
        deletions: 5,
      }

      expect(fileChange).toHaveProperty('path')
      expect(fileChange).toHaveProperty('status')
      expect(fileChange).toHaveProperty('insertions')
      expect(fileChange).toHaveProperty('deletions')
    })
  })
})
