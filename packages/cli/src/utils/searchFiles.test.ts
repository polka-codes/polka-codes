/**
 * Tests for searchFiles utility
 * Generated by polka.codes
 */
import { describe, expect, it, spyOn } from 'bun:test'
import * as child_process from 'node:child_process'
import { EventEmitter } from 'node:events'
import { searchFiles } from './searchFiles'

describe('searchFiles', () => {
  it('should execute ripgrep with correct arguments', async () => {
    const mockSpawn = spyOn(child_process, 'spawn')

    // Create mock process
    const mockProcess = new EventEmitter() as any
    mockProcess.stdout = new EventEmitter()
    mockProcess.stderr = new EventEmitter()
    mockSpawn.mockImplementation(() => mockProcess)

    // Start search
    const searchPromise = searchFiles('src', 'test', '*.ts', '/test/path')

    // Verify arguments
    expect(mockSpawn).toHaveBeenCalled()
    const args = mockSpawn.mock.calls[0][1]
    expect(args).toContain('--line-number')
    expect(args).toContain('--context=5')
    expect(args).toContain('--glob')
    expect(args).toContain('*.ts')
    expect(args).toContain('test')
    expect(args).toContain('src')

    // Simulate successful search
    mockProcess.stdout.emit('data', 'file1.ts:10:test match\n')
    mockProcess.emit('close', 0)

    const results = await searchPromise
    expect(results).toEqual(['file1.ts:10:test match'])
  })

  it('should handle no matches gracefully', async () => {
    const mockSpawn = spyOn(child_process, 'spawn')

    const mockProcess = new EventEmitter() as any
    mockProcess.stdout = new EventEmitter()
    mockProcess.stderr = new EventEmitter()
    mockSpawn.mockImplementation(() => mockProcess)

    const searchPromise = searchFiles('src', 'nonexistent', '*.ts', '/test/path')

    mockProcess.emit('close', 1) // Exit code 1 means no matches

    const results = await searchPromise
    expect(results).toEqual([])
  })

  it('should handle errors', async () => {
    const mockSpawn = spyOn(child_process, 'spawn')

    const mockProcess = new EventEmitter() as any
    mockProcess.stdout = new EventEmitter()
    mockProcess.stderr = new EventEmitter()
    mockSpawn.mockImplementation(() => mockProcess)

    const searchPromise = searchFiles('src', 'test', '*.ts', '/test/path')

    mockProcess.emit('error', new Error('Test error'))

    await expect(searchPromise).rejects.toThrow('Failed to execute ripgrep')
  })
})
