import { beforeEach, describe, expect, it } from 'bun:test'
import { CommandExecutionError, FileSystemAccessError, JSONParseError, logAndSuppress, safeJSONParse } from './error-handling'

describe('error-handling', () => {
  describe('logAndSuppress', () => {
    let mockLogger: any
    let logs: string[]

    beforeEach(() => {
      logs = []
      mockLogger = {
        debug: (msg: string) => logs.push(`debug: ${msg}`),
        warn: (msg: string) => logs.push(`warn: ${msg}`),
        error: (msg: string) => logs.push(`error: ${msg}`),
      }
    })

    it('should log error with debug level by default', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext')

      expect(logs).toHaveLength(2) // message + stack
      expect(logs[0]).toContain('debug: [TestContext] Test error')
    })

    it('should log at warn level when specified', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext', { level: 'warn' })

      expect(logs).toHaveLength(1)
      expect(logs[0]).toContain('warn: [TestContext] Test error')
    })

    it('should log at error level when specified', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext', { level: 'error' })

      expect(logs).toHaveLength(2) // message + stack
      expect(logs[0]).toContain('error: [TestContext] Test error')
    })

    it('should include context in log message', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext', {
        context: { key: 'value' },
      })

      expect(logs[0]).toContain('key')
      expect(logs[0]).toContain('value')
    })

    it('should handle non-Error objects', () => {
      logAndSuppress(mockLogger, 'string error', 'TestContext')

      expect(logs).toHaveLength(1)
      expect(logs[0]).toContain('debug: [TestContext] string error')
    })

    it('should be silent when silent option is true', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext', { silent: true })

      expect(logs).toHaveLength(0)
    })

    it('should include stack trace for Error objects', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext')

      expect(logs).toHaveLength(2)
      expect(logs[1]).toContain('Stack:')
    })

    it('should not include stack trace for non-Error objects', () => {
      logAndSuppress(mockLogger, 'string error', 'TestContext')

      expect(logs).toHaveLength(1)
    })

    it('should handle empty context object', () => {
      const error = new Error('Test error')
      logAndSuppress(mockLogger, error, 'TestContext', {
        context: {},
      })

      expect(logs).toHaveLength(2)
      expect(logs[0]).not.toContain('{')
    })
  })

  describe('FileSystemAccessError', () => {
    it('should create error with path and operation', () => {
      const error = new FileSystemAccessError('/test/path', 'read')

      expect(error.name).toBe('FileSystemAccessError')
      expect(error.path).toBe('/test/path')
      expect(error.operation).toBe('read')
      expect(error.message).toContain('Failed to read /test/path')
    })

    it('should accept cause error', () => {
      const cause = new Error('Permission denied')
      const error = new FileSystemAccessError('/test/path', 'write', cause)

      expect(error.cause).toBe(cause)
    })

    it('should work without cause', () => {
      const error = new FileSystemAccessError('/test/path', 'delete')

      expect(error.cause).toBeUndefined()
    })
  })

  describe('CommandExecutionError', () => {
    it('should create error with command, exit code, and stderr', () => {
      const error = new CommandExecutionError('npm install', 1, 'EACCES')

      expect(error.name).toBe('CommandExecutionError')
      expect(error.command).toBe('npm install')
      expect(error.exitCode).toBe(1)
      expect(error.stderr).toBe('EACCES')
      expect(error.message).toContain('Command failed with code 1: npm install')
    })

    it('should accept cause error', () => {
      const cause = new Error('Network timeout')
      const error = new CommandExecutionError('curl test.com', 28, 'Timeout', cause)

      expect(error.cause).toBe(cause)
    })

    it('should work without cause', () => {
      const error = new CommandExecutionError('ls', 0, '')

      expect(error.cause).toBeUndefined()
    })
  })

  describe('JSONParseError', () => {
    it('should create error with file path and content', () => {
      const content = '{invalid json'
      const error = new JSONParseError('/test/config.json', content)

      expect(error.name).toBe('JSONParseError')
      expect(error.filePath).toBe('/test/config.json')
      expect(error.rawContent).toBe(content)
      expect(error.message).toContain('Failed to parse JSON from /test/config.json')
    })

    it('should accept cause error', () => {
      const cause = new Error('Unexpected token')
      const error = new JSONParseError('/test/data.json', '{}', cause)

      expect(error.cause).toBe(cause)
    })

    it('should work without cause', () => {
      const error = new JSONParseError('/test/config.json', '{}')

      expect(error.cause).toBeUndefined()
    })
  })

  describe('safeJSONParse', () => {
    it('should parse valid JSON', () => {
      const content = '{"key":"value"}'
      const result = safeJSONParse<{ key: string }>(content, '/test.json')

      expect(result.key).toBe('value')
    })

    it('should parse JSON arrays', () => {
      const content = '[1,2,3]'
      const result = safeJSONParse<number[]>(content, '/test.json')

      expect(result).toEqual([1, 2, 3])
    })

    it('should parse nested objects', () => {
      const content = '{"user":{"name":"test","age":25}}'
      const result = safeJSONParse<{ user: { name: string; age: number } }>(content, '/test.json')

      expect(result.user.name).toBe('test')
      expect(result.user.age).toBe(25)
    })

    it('should throw JSONParseError for invalid JSON', () => {
      const content = '{invalid'

      expect(() => safeJSONParse(content, '/test.json')).toThrow(JSONParseError)
    })

    it('should include file path in error', () => {
      const content = '{invalid'

      try {
        safeJSONParse(content, '/config/test.json')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(JSONParseError)
        expect((error as JSONParseError).filePath).toBe('/config/test.json')
      }
    })

    it('should include raw content in error', () => {
      const content = '{invalid json'

      try {
        safeJSONParse(content, '/test.json')
        expect(true).toBe(false)
      } catch (error) {
        expect((error as JSONParseError).rawContent).toBe(content)
      }
    })

    it('should handle empty JSON object', () => {
      const content = '{}'
      const result = safeJSONParse(content, '/test.json')

      expect(result).toEqual({})
    })

    it('should handle null JSON', () => {
      const content = 'null'
      const result = safeJSONParse(content, '/test.json')

      expect(result).toBeNull()
    })

    it('should handle boolean values', () => {
      expect(safeJSONParse('true', '/test.json')).toBe(true)
      expect(safeJSONParse('false', '/test.json')).toBe(false)
    })

    it('should handle numbers', () => {
      expect(safeJSONParse('42', '/test.json')).toBe(42)
      expect(safeJSONParse('3.14', '/test.json')).toBe(3.14)
      expect(safeJSONParse('-10', '/test.json')).toBe(-10)
    })
  })
})
