import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DiscoveryStrategy, Task, WorkflowContext } from './types'
import { Priority } from './types'

/**
 * Advanced discovery strategies for continuous improvement
 *
 * These strategies go beyond basic build/test/lint to discover:
 * - Refactoring opportunities
 * - Documentation gaps
 * - Security vulnerabilities
 * - Test coverage gaps
 * - Performance issues
 *
 * biome-ignore lint/complexity/noStaticOnlyClass: This is a strategies registry pattern, not a utility class
 */
export class AdvancedDiscoveryStrategies {
  /**
   * Strategy: Discover refactoring opportunities
   *
   * Analyzes code for:
   * - Duplicated code patterns
   * - Long functions/methods
   * - Complex functions
   * - Code smells
   */
  static refactoringStrategy: DiscoveryStrategy = {
    name: 'refactoring',
    description: 'Find refactoring opportunities (duplicated code, long functions, code smells)',
    enabled: false, // Disabled by default - can be noisy
    checkChanges: true,
    execute: async (context) => this.discoverRefactoringOpportunities(context),
    priority: (_task) => ({ priority: Priority.LOW, reason: 'Code quality improvement' }),
  }

  /**
   * Strategy: Discover documentation gaps
   *
   * Checks for:
   * - Functions without JSDoc
   * - Missing README for modules
   * - Undocumented exports
   */
  static documentationStrategy: DiscoveryStrategy = {
    name: 'documentation',
    description: 'Find missing documentation (JSDoc, README, exports)',
    enabled: false, // Disabled by default - can be noisy
    checkChanges: true,
    execute: async (context) => this.discoverDocumentationGaps(context),
    priority: (_task) => ({ priority: Priority.TRIVIAL, reason: 'Documentation improvement' }),
  }

  /**
   * Strategy: Security analysis
   *
   * Looks for:
   * - Hardcoded secrets/credentials
   * - Unsafe eval usage
   * - SQL injection risks
   * - XSS vulnerabilities
   */
  static securityStrategy: DiscoveryStrategy = {
    name: 'security',
    description: 'Find security vulnerabilities (secrets, unsafe patterns)',
    enabled: true,
    checkChanges: true,
    execute: async (context) => this.discoverSecurityIssues(context),
    priority: (_task) => ({ priority: Priority.CRITICAL, reason: 'Security vulnerability' }),
  }

  /**
   * Strategy: Test coverage analysis
   *
   * Identifies:
   * - Files without tests
   * - Functions without test coverage
   * - Low coverage areas
   */
  static testCoverageStrategy: DiscoveryStrategy = {
    name: 'test-coverage',
    description: 'Find untested code and low coverage areas',
    enabled: true,
    checkChanges: true,
    execute: async (context) => this.discoverTestCoverageGaps(context),
    priority: (_task) => ({ priority: Priority.MEDIUM, reason: 'Improve test coverage' }),
  }

  /**
   * Strategy: Performance issues
   *
   * Detects:
   * - N+1 query patterns
   * - Inefficient loops
   * - Missing caching opportunities
   * - Large bundle sizes
   */
  static performanceStrategy: DiscoveryStrategy = {
    name: 'performance',
    description: 'Find performance issues (N+1 queries, inefficient code)',
    enabled: false, // Disabled by default - requires analysis
    checkChanges: true,
    execute: async (context) => this.discoverPerformanceIssues(context),
    priority: (_task) => ({ priority: Priority.MEDIUM, reason: 'Performance improvement' }),
  }

  /**
   * Discover refactoring opportunities
   */
  private static async discoverRefactoringOpportunities(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    context.logger.debug('[AdvancedDiscovery] Analyzing code for refactoring opportunities...')

    try {
      // Find TypeScript/JavaScript files
      const sourceFiles = await AdvancedDiscoveryStrategies.findSourceFiles(context.workingDir)

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8')

        // Check for long functions (>50 lines)
        const functionMatches = content.matchAll(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>)\s*{/g)
        for (const match of functionMatches) {
          const funcStart = match.index || 0
          const funcEnd = AdvancedDiscoveryStrategies.findFunctionEnd(content, funcStart)
          const funcLength = content.slice(funcStart, funcEnd).split('\n').length

          if (funcLength > 50) {
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('refactor-long-func'),
              type: 'refactoring',
              title: `Refactor long function in ${path.relative(context.workingDir, file)}`,
              description: `Function exceeds 50 lines (${funcLength} lines). Consider breaking it down into smaller functions.`,
              priority: Priority.LOW,
              complexity: 'medium',
              dependencies: [],
              estimatedTime: 30,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Refactor the long function in ${path.relative(context.workingDir, file)} to improve readability and maintainability. Break it down into smaller, well-named functions.`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }

        // Check for deeply nested code (>4 levels)
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const indent = line.search(/\S/)

          if (indent > 16) {
            // More than 16 spaces = 4+ levels
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('refactor-nesting'),
              type: 'refactoring',
              title: `Reduce nesting in ${path.relative(context.workingDir, file)}:${i + 1}`,
              description: `Deep nesting detected at line ${i + 1}. Consider extracting logic into separate functions or using early returns.`,
              priority: Priority.LOW,
              complexity: 'low',
              dependencies: [],
              estimatedTime: 15,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Reduce nesting complexity in ${path.relative(context.workingDir, file)} at line ${i + 1}. Extract complex conditions into well-named functions or use guard clauses.`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
            break // One task per file is enough
          }
        }
      }

      context.logger.info(`[AdvancedDiscovery] Found ${tasks.length} refactoring opportunities`)
    } catch (error) {
      context.logger.error('[AdvancedDiscovery] Failed to analyze refactoring opportunities', error as Error)
    }

    return tasks
  }

  /**
   * Discover documentation gaps
   */
  private static async discoverDocumentationGaps(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    context.logger.debug('[AdvancedDiscovery] Checking for documentation gaps...')

    try {
      // Find TypeScript/JavaScript files
      const sourceFiles = await AdvancedDiscoveryStrategies.findSourceFiles(context.workingDir)

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8')
        const relativePath = path.relative(context.workingDir, file)

        // Check for missing README in directories
        const dir = path.dirname(file)
        const hasReadme = await AdvancedDiscoveryStrategies.hasReadme(dir)

        if (!hasReadme && dir !== context.workingDir) {
          // Check if this directory has multiple source files (worth documenting)
          const dirFiles = (await AdvancedDiscoveryStrategies.findSourceFiles(dir)).length
          if (dirFiles > 2) {
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('docs-readme'),
              type: 'documentation',
              title: `Add README for ${path.relative(context.workingDir, dir)}`,
              description: `Directory contains ${dirFiles} source files but no README documentation.`,
              priority: Priority.TRIVIAL,
              complexity: 'low',
              dependencies: [],
              estimatedTime: 20,
              status: 'pending',
              files: [],
              workflow: 'code',
              workflowInput: {
                prompt: `Create a README.md file for the ${path.relative(context.workingDir, dir)} directory. Include:
1. Purpose of this module
2. Key exports and their usage
3. Important patterns or conventions`,
                files: [],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }

        // Check for exported functions without JSDoc
        const exportMatches = content.matchAll(/export\s+(?:(?:async\s+)?function\s+(\w+)|(?:const|class)\s+(\w+))/g)
        for (const match of exportMatches) {
          const exportName = match[1] || match[2]
          const exportStart = match.index || 0

          // Look backwards for JSDoc comment
          const beforeExport = content.slice(Math.max(0, exportStart - 500), exportStart)
          const hasJsDoc = beforeExport.trim().endsWith('*/') && beforeExport.includes('/**')

          if (!hasJsDoc) {
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('docs-jsdoc'),
              type: 'documentation',
              title: `Add JSDoc for ${exportName} in ${relativePath}`,
              description: `Exported function/class "${exportName}" lacks JSDoc documentation.`,
              priority: Priority.TRIVIAL,
              complexity: 'low',
              dependencies: [],
              estimatedTime: 5,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Add comprehensive JSDoc documentation for "${exportName}" in ${relativePath}. Include:
1. Description of what it does
2. @param tags for parameters with types and descriptions
3. @returns tag with type and description
4. @example tag if appropriate`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }
      }

      context.logger.info(`[AdvancedDiscovery] Found ${tasks.length} documentation gaps`)
    } catch (error) {
      context.logger.error('[AdvancedDiscovery] Failed to check documentation', error as Error)
    }

    return tasks
  }

  /**
   * Discover security issues
   */
  private static async discoverSecurityIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    context.logger.debug('[AdvancedDiscovery] Analyzing for security issues...')

    try {
      // Find all source files
      const files = await AdvancedDiscoveryStrategies.findSourceFiles(context.workingDir, [
        'ts',
        'js',
        'tsx',
        'jsx',
        'json',
        '.env.example',
      ])

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8')
        const relativePath = path.relative(context.workingDir, file)

        // Check for suspicious patterns
        const patterns = [
          {
            regex: /password\s*[:=]\s*['"]\w+['"]/i,
            type: 'Hardcoded password',
            severity: Priority.CRITICAL,
          },
          {
            regex: /api[_-]?key\s*[:=]\s*['"]\w+['"]/i,
            type: 'Hardcoded API key',
            severity: Priority.CRITICAL,
          },
          {
            regex: /secret\s*[:=]\s*['"]\w+['"]/i,
            type: 'Hardcoded secret',
            severity: Priority.CRITICAL,
          },
          {
            regex: /token\s*[:=]\s*['"]\w{20,}['"]/i,
            type: 'Hardcoded token',
            severity: Priority.CRITICAL,
          },
          {
            regex: /eval\s*\(/,
            type: 'Unsafe eval() usage',
            severity: Priority.HIGH,
          },
          {
            regex: /innerHTML\s*=/,
            type: 'Potential XSS vulnerability (innerHTML)',
            severity: Priority.HIGH,
          },
          {
            regex: /dangerouslySetInnerHTML/,
            type: 'Potential XSS vulnerability (dangerouslySetInnerHTML)',
            severity: Priority.HIGH,
          },
        ]

        for (const pattern of patterns) {
          const matches = content.matchAll(pattern.regex)
          for (const match of matches) {
            const lineNumber = content.slice(0, match.index || 0).split('\n').length

            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('security'),
              type: 'security',
              title: `Fix security issue: ${pattern.type} in ${relativePath}:${lineNumber}`,
              description: `${pattern.type} detected at line ${lineNumber}. This could be a security vulnerability.`,
              priority: pattern.severity,
              complexity: 'medium',
              dependencies: [],
              estimatedTime: 30,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Fix the security issue "${pattern.type}" in ${relativePath} at line ${lineNumber}. Use secure alternatives and ensure secrets are stored in environment variables.`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }
      }

      // Check for .env files in git
      try {
        const envResult = await context.tools.executeCommand({
          command: 'git',
          args: ['ls-files', '*.env'],
        })

        if (envResult.stdout.trim()) {
          const envFiles = envResult.stdout.trim().split('\n')
          for (const envFile of envFiles) {
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('security-env'),
              type: 'security',
              title: `Remove .env file from git: ${envFile}`,
              description: `.env file is tracked in git. This may expose sensitive credentials. Add to .gitignore and use .env.example instead.`,
              priority: Priority.CRITICAL,
              complexity: 'low',
              dependencies: [],
              estimatedTime: 5,
              status: 'pending',
              files: [envFile],
              workflow: 'code',
              workflowInput: {
                prompt: `Remove ${envFile} from git tracking:
1. Add ${envFile} to .gitignore
2. Create ${envFile}.example with placeholder values
3. Run 'git rm --cached ${envFile}'`,
                files: ['.gitignore'],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }
      } catch {
        // git command failed, skip this check
      }

      context.logger.info(`[AdvancedDiscovery] Found ${tasks.length} security issues`)
    } catch (error) {
      context.logger.error('[AdvancedDiscovery] Failed to analyze security', error as Error)
    }

    return tasks
  }

  /**
   * Discover test coverage gaps
   */
  private static async discoverTestCoverageGaps(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    context.logger.debug('[AdvancedDiscovery] Analyzing test coverage...')

    try {
      // Find source files
      const sourceFiles = await AdvancedDiscoveryStrategies.findSourceFiles(context.workingDir)

      for (const file of sourceFiles) {
        const relativePath = path.relative(context.workingDir, file)

        // Skip test files themselves
        if (relativePath.includes('.test.') || relativePath.includes('.spec.') || relativePath.includes('/__tests__/')) {
          continue
        }

        // Look for corresponding test file
        const testFilePatterns = [
          file.replace('.ts', '.test.ts'),
          file.replace('.ts', '.spec.ts'),
          file.replace('.ts', '.test.tsx'),
          file.replace('/src/', '/__tests__/'),
        ]

        let hasTest = false
        for (const testPattern of testFilePatterns) {
          try {
            await fs.access(testPattern)
            hasTest = true
            break
          } catch {
            // Test file doesn't exist
          }
        }

        if (!hasTest) {
          // Check if this is a significant file (more than 50 lines)
          const content = await fs.readFile(file, 'utf-8')
          const lineCount = content.split('\n').length

          if (lineCount > 50) {
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('test-coverage'),
              type: 'testing',
              title: `Add tests for ${relativePath}`,
              description: `Source file (${lineCount} lines) lacks test coverage.`,
              priority: Priority.MEDIUM,
              complexity: 'medium',
              dependencies: [],
              estimatedTime: 45,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Create comprehensive tests for ${relativePath}. Include:
1. Unit tests for exported functions
2. Edge case testing
3. Error handling tests
4. Integration tests if appropriate`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }
      }

      context.logger.info(`[AdvancedDiscovery] Found ${tasks.length} files without test coverage`)
    } catch (error) {
      context.logger.error('[AdvancedDiscovery] Failed to analyze test coverage', error as Error)
    }

    return tasks
  }

  /**
   * Discover performance issues
   */
  private static async discoverPerformanceIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    context.logger.debug('[AdvancedDiscovery] Analyzing for performance issues...')

    try {
      // This is a basic implementation - can be enhanced with static analysis tools
      const sourceFiles = await AdvancedDiscoveryStrategies.findSourceFiles(context.workingDir)

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8')
        const relativePath = path.relative(context.workingDir, file)

        // Check for loops with heavy operations
        const loopMatches = content.matchAll(/(?:for|while)\s*\([^)]*\)\s*{/g)
        for (const match of loopMatches) {
          const loopStart = match.index || 0
          const loopEnd = AdvancedDiscoveryStrategies.findFunctionEnd(content, loopStart)
          const loopBody = content.slice(loopStart, loopEnd)

          // Check for database queries or HTTP requests in loops
          if ((loopBody.match(/\.(fetch|query|find|execute)\(/g) || []).length > 1) {
            const lineNumber = content.slice(0, loopStart).split('\n').length
            tasks.push({
              id: AdvancedDiscoveryStrategies.generateId('perf-loop'),
              type: 'optimization',
              title: `Optimize loop in ${relativePath}:${lineNumber}`,
              description: 'Loop contains multiple database queries or HTTP requests. This could cause N+1 performance issues.',
              priority: Priority.MEDIUM,
              complexity: 'medium',
              dependencies: [],
              estimatedTime: 30,
              status: 'pending',
              files: [file],
              workflow: 'code',
              workflowInput: {
                prompt: `Optimize the loop in ${relativePath} at line ${lineNumber}. Use batch operations, eager loading, or parallel execution to avoid N+1 performance issues.`,
                files: [file],
              },
              retryCount: 0,
              createdAt: Date.now(),
            })
          }
        }
      }

      context.logger.info(`[AdvancedDiscovery] Found ${tasks.length} performance issues`)
    } catch (error) {
      context.logger.error('[AdvancedDiscovery] Failed to analyze performance', error as Error)
    }

    return tasks
  }

  /**
   * Helper: Find all TypeScript/JavaScript source files
   */
  private static async findSourceFiles(dir: string, extensions: string[] = ['ts', 'tsx', 'js', 'jsx']): Promise<string[]> {
    const files: string[] = []

    async function traverse(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)

          // Skip node_modules and common ignored directories
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.next' ||
            entry.name === 'coverage'
          ) {
            continue
          }

          if (entry.isDirectory()) {
            await traverse(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()
            if (ext && extensions.includes(ext)) {
              files.push(fullPath)
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await traverse(dir)
    return files
  }

  /**
   * Helper: Check if directory has README
   */
  private static async hasReadme(dir: string): Promise<boolean> {
    const readmeFiles = ['README.md', 'readme.md', 'README.MD']

    for (const readme of readmeFiles) {
      try {
        await fs.access(path.join(dir, readme))
        return true
      } catch {
        // File doesn't exist
      }
    }

    return false
  }

  /**
   * Helper: Find the end of a function (matching braces)
   */
  private static findFunctionEnd(content: string, start: number): number {
    let braceCount = 0
    let inString = false
    let stringChar = ''

    for (let i = start; i < content.length; i++) {
      const char = content[i]

      // Track string literals
      if ((char === '"' || char === "'" || char === '`') && content[i - 1] !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
      }

      // Count braces outside of strings
      if (!inString) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            return i + 1
          }
        }
      }
    }

    return content.length
  }

  /**
   * Generate unique task ID
   */
  private static generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
