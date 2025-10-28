import { describe, expect, it } from 'bun:test'
import { simplifyToolParameters } from '../parameterSimplifier'

describe('simplifyToolParameters', () => {
  describe('replaceInFile', () => {
    it('should simplify replaceInFile parameters', () => {
      const result = simplifyToolParameters('replaceInFile', {
        path: 'src/main.ts',
        diff: '<<<<<<< SEARCH\n...very large diff...\n>>>>>>> REPLACE',
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('writeToFile', () => {
    it('should simplify writeToFile parameters', () => {
      const result = simplifyToolParameters('writeToFile', {
        path: 'src/app.ts',
        content: 'export default function App() {\n  return <div>Hello World</div>\n}',
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('readFile', () => {
    it('should simplify readFile parameters', () => {
      const result = simplifyToolParameters('readFile', {
        path: ['src/main.ts', 'src/utils.ts'],
        includeIgnored: false,
      })
      expect(result).toMatchSnapshot()
    })

    it('should handle includeIgnored true', () => {
      const result = simplifyToolParameters('readFile', {
        path: ['src/main.ts'],
        includeIgnored: true,
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('listFiles', () => {
    it('should simplify listFiles parameters with default maxCount', () => {
      const result = simplifyToolParameters('listFiles', {
        path: 'src',
        recursive: true,
        maxCount: 2000,
      })
      expect(result).toMatchSnapshot()
    })

    it('should include maxCount when non-default', () => {
      const result = simplifyToolParameters('listFiles', {
        path: 'src',
        recursive: false,
        maxCount: 100,
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('searchFiles', () => {
    it('should return all searchFiles parameters', () => {
      const result = simplifyToolParameters('searchFiles', {
        path: 'src',
        regex: '^import',
        filePattern: '*.ts',
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('executeCommand', () => {
    it('should simplify executeCommand parameters', () => {
      const result = simplifyToolParameters('executeCommand', {
        command: 'npm run build',
        requiresApproval: false,
      })
      expect(result).toMatchSnapshot()
    })

    it('should handle requiresApproval true', () => {
      const result = simplifyToolParameters('executeCommand', {
        command: 'rm -rf node_modules',
        requiresApproval: true,
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('updateMemory', () => {
    it('should omit content from updateMemory parameters', () => {
      const result = simplifyToolParameters('updateMemory', {
        operation: 'append',
        topic: 'context',
        content: 'This is a very long content that should be omitted from the simplified parameters',
      })
      expect(result).toMatchSnapshot()
    })

    it('should handle replace operation', () => {
      const result = simplifyToolParameters('updateMemory', {
        operation: 'replace',
        topic: 'notes',
        content: 'More content to be omitted',
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('default fallback', () => {
    it('should use default fallback for unknown tools', () => {
      const result = simplifyToolParameters('unknownTool', {
        someParam: 'value',
        anotherParam: 123,
      })
      expect(result).toMatchSnapshot()
    })

    it('should return all parameters for unregistered tool', () => {
      const result = simplifyToolParameters('customTool', {
        config: { option1: true, option2: 'test' },
        data: [1, 2, 3],
      })
      expect(result).toMatchSnapshot()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined params', () => {
      const result = simplifyToolParameters('replaceInFile', undefined)
      expect(result).toMatchSnapshot()
    })

    it('should handle null params', () => {
      const result = simplifyToolParameters('writeToFile', null as unknown as undefined)
      expect(result).toMatchSnapshot()
    })

    it('should handle empty params object', () => {
      const result = simplifyToolParameters('readFile', {})
      expect(result).toMatchSnapshot()
    })

    it('should handle params with missing expected fields', () => {
      const result = simplifyToolParameters('replaceInFile', {
        unexpectedField: 'value',
      })
      expect(result).toMatchSnapshot()
    })
  })
})
