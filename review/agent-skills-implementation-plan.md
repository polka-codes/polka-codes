# Agent Skills Implementation Plan

**Author**: Claude (with Happy)
**Date**: 2025-12-25
**Status**: Planning Phase
**Related Issue**: N/A (Feature Proposal)

## Executive Summary

This document outlines a comprehensive plan to integrate Claude-style **Agent Skills** into polka-codes. Agent Skills are modular, composable capabilities that extend AI agent functionality through organized folders containing instructions, scripts, and resources.

**Key Goals:**
1. Adopt the Agent Skills open standard for cross-platform compatibility
2. Enable skills-driven specialization for polka-codes agents
3. Provide progressive disclosure for efficient context management
4. Support personal, project, and plugin skill distributions
5. Maintain backward compatibility with existing custom scripts

**Estimated Effort**: Medium (~2-3 weeks with focused development)

---

## 1. Background & Motivation

### 1.1 What Are Agent Skills?

Based on [Anthropic's Agent Skills specification](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), Agent Skills are:

- **Model-Invoked**: Claude autonomously decides when to use them based on task context
- **Modular**: Self-contained folders with `SKILL.md` + optional supporting files
- **Progressive**: 3-level loading strategy (metadata → main instructions → supporting files)
- **Composable**: Multiple skills can work together for complex tasks

### 1.2 Why Add Skills to polka-codes?

| Current State | With Skills |
|--------------|-------------|
| Custom scripts are user-invoked via `polka run <script>` | Agents can autonomously invoke skills based on context |
| Single execution model (shell command or TypeScript) | Rich instruction-based capabilities with code examples |
| Limited context awareness | Progressive disclosure reduces token usage |
| Project-scoped only | Personal, project, and plugin skill distributions |
| No standard for sharing | Cross-platform compatible skill format |

### 1.3 Use Cases

1. **Domain Expertise**: Package React, Node.js, testing best practices
2. **Team Conventions**: Share coding standards, git workflows, PR templates
3. **Tool Integrations**: Teach agents how to use your CI/CD, deployment tools
4. **Process Automation**: Multi-step workflows with checkpoints and validation
5. **Plugin Ecosystem**: Community-contributed skills via npm packages

---

## 2. Architecture Design

### 2.1 Skill Storage Locations

```typescript
// Skills directory structure
~/.claude/skills/                    // Personal skills (user-specific)
.claude/skills/                      // Project skills (git-tracked)
node_modules/@polka-codes/skill-*/   // Plugin skills (npm packages)
```

**Priority Order** (for conflicting skill names):
1. Project skills (highest priority - most specific)
2. Personal skills (user customization)
3. Plugin skills (default behaviors)

### 2.2 Skill File Format

**Required Structure:**
```
my-skill/
├── SKILL.md              # Required: Metadata and instructions
├── reference.md          # Optional: Detailed documentation
├── examples.md           # Optional: Usage examples
├── scripts/              # Optional: Executable utilities
│   └── helper.py
└── templates/            # Optional: File templates
    └── config.yaml
```

**SKILL.md Format:**
```markdown
---
name: react-component-generator
description: Generate React components with TypeScript, Tailwind, and testing. Use when creating new UI components, modifying existing components, or refactoring React code.
allowed-tools: Read, Write, Glob, Grep
---

# React Component Generator

## Instructions

When generating React components:

1. Use TypeScript with strict type checking
2. Apply Tailwind utility classes for styling
3. Include prop-types interface exports
4. Add unit tests with Vitest

## Component Structure

```tsx
interface Props {
  // ...
}

export function ComponentName({ props }: Props) {
  return (
    // ...
  )
}
```

See [examples.md](examples.md) for detailed patterns.
```

### 2.3 Progressive Disclosure Loading

```
┌─────────────────────────────────────────────────────────┐
│ System Prompt + Skill Metadata (name + description)     │
│ Lightweight: ~100 tokens per skill                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Agent detects relevance
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Full SKILL.md content                                   │
│ Medium: ~500-1000 tokens                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Agent needs detail
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Supporting files (reference.md, scripts/, etc.)         │
│ Heavy: Loaded only as needed                            │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Integration with Existing polka-codes Architecture

**Current Flow:**
```
User Request → Meta Command → Agent Selection → Workflow Execution
```

**With Skills:**
```
User Request
    ↓
Meta Command
    ↓
Skill Discovery (match description to task)
    ↓
Skill Loading (progressive disclosure)
    ↓
Agent Selection (augmented with skill context)
    ↓
Workflow Execution (skill-aware)
```

**Key Integration Points:**

1. **Config Schema** (`packages/core/src/config.ts`)
   - Add `skills` section to config schema
   - Support skill directories configuration
   - Skill metadata validation

2. **Agent System** (`packages/core/src/Agent/`)
   - Inject skill metadata into system prompts
   - Add skill loading to tool registry
   - Skill-aware agent selection

3. **CLI Commands** (`packages/cli/src/commands/`)
   - `polka init skill <name>` - Create skill template
   - `polka skills list` - List available skills
   - `polka skills show <name>` - Display skill details
   - `polka skills validate` - Validate skill format

4. **Tool Execution** (`packages/core/src/tools/`)
   - Add `LoadSkillTool` for progressive loading
   - Add `ListSkillsTool` for discovery
   - Skill-scoped tool permissions

---

## 3. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Basic skill discovery and loading

#### 1.1 Skill Schema & Types
**File**: `packages/core/src/skills/types.ts`

```typescript
import { z } from 'zod'

export const skillMetadataSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "Skill name must be lowercase letters, numbers, and hyphens")
    .max(64, "Skill name must be at most 64 characters"),
  description: z.string().max(1024, "Description must be at most 1024 characters"),
  allowedTools: z.array(z.string()).optional(),
})

export type SkillMetadata = z.infer<typeof skillMetadataSchema>

export interface Skill {
  metadata: SkillMetadata
  content: string // SKILL.md content without frontmatter
  files: Map<string, string> // Additional files
  path: string // Absolute path to skill directory
  source: 'personal' | 'project' | 'plugin'
}

export interface SkillContext {
  activeSkill: Skill | null
  availableSkills: Skill[]
  skillLoadingHistory: string[]
}
```

#### 1.2 Skill Discovery Service
**File**: `packages/core/src/skills/discovery.ts`

```typescript
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Skill, skillMetadataSchema } from './types'
import { parse } from 'yaml'

export class SkillDiscoveryError extends Error {
  constructor(message: string, public path: string) {
    super(message)
    this.name = 'SkillDiscoveryError'
  }
}

export class SkillDiscoveryService {
  private personalSkillsDir: string
  private projectSkillsDir: string
  private pluginSkillsDirs: string[]

  constructor(options: {
    cwd: string
    personalSkillsDir?: string
  }) {
    this.personalSkillsDir = options.personalSkillsDir ?? join(process.env.HOME ?? '', '.claude', 'skills')
    this.projectSkillsDir = join(options.cwd, '.claude', 'skills')
    this.pluginSkillsDirs = [] // TODO: Load from node_modules
  }

  /**
   * Discover all available skills from all sources
   */
  async discoverAll(): Promise<Skill[]> {
    const skills: Skill[] = []

    // Load with priority: project > personal > plugin
    const projectSkills = await this.discoverInDirectory(this.projectSkillsDir, 'project')
    const personalSkills = await this.discoverInDirectory(this.personalSkillsDir, 'personal')
    const pluginSkills = await this.discoverPlugins()

    // Filter out duplicates (project skills take priority)
    const seenNames = new Set<string>()
    const allSkills = [...projectSkills, ...personalSkills, ...pluginSkills]

    for (const skill of allSkills) {
      if (!seenNames.has(skill.metadata.name)) {
        seenNames.add(skill.metadata.name)
        skills.push(skill)
      }
    }

    return skills
  }

  /**
   * Discover skills in a specific directory
   */
  async discoverInDirectory(dir: string, source: 'personal' | 'project' | 'plugin'): Promise<Skill[]> {
    if (!existsSync(dir)) {
      return []
    }

    const skills: Skill[] = []
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const skillPath = join(dir, entry.name)
      const skillMdPath = join(skillPath, 'SKILL.md')

      if (!existsSync(skillMdPath)) {
        continue
      }

      try {
        const skill = await this.loadSkill(skillPath, source)
        skills.push(skill)
      } catch (error) {
        if (error instanceof SkillDiscoveryError) {
          console.warn(`Warning: ${error.message} (path: ${error.path})`)
        } else {
          throw error
        }
      }
    }

    return skills
  }

  /**
   * Load a single skill from its directory
   */
  async loadSkill(skillPath: string, source: 'personal' | 'project' | 'plugin'): Promise<Skill> {
    const skillMdPath = join(skillPath, 'SKILL.md')

    if (!existsSync(skillMdPath)) {
      throw new SkillDiscoveryError('SKILL.md not found', skillPath)
    }

    const content = readFileSync(skillMdPath, 'utf-8')
    const { metadata, content: instructions } = this.parseSkillMd(content)

    // Load additional files
    const files = new Map<string, string>()
    const entries = readdirSync(skillPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name === 'SKILL.md') {
        continue
      }

      const filePath = join(skillPath, entry.name)

      if (entry.isFile()) {
        files.set(entry.name, readFileSync(filePath, 'utf-8'))
      } else if (entry.isDirectory()) {
        // Recursively load directory contents
        this.loadDirectoryFiles(filePath, entry.name, files)
      }
    }

    return {
      metadata,
      content: instructions,
      files,
      path: skillPath,
      source,
    }
  }

  /**
   * Parse SKILL.md content and extract frontmatter
   */
  private parseSkillMd(content: string): { metadata: SkillMetadata; content: string } {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
      throw new SkillDiscoveryError('SKILL.md must begin with YAML frontmatter enclosed in ---', '')
    }

    const frontmatter = match[1]
    const instructions = match[2]

    try {
      const metadata = skillMetadataSchema.parse(parse(frontmatter))
      return { metadata, content: instructions }
    } catch (error) {
      throw new SkillDiscoveryError(`Invalid frontmatter: ${error}`, '')
    }
  }

  private loadDirectoryFiles(dirPath: string, prefix: string, files: Map<string, string>): void {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const filePath = join(dirPath, entry.name)
      const key = `${prefix}/${entry.name}`

      if (entry.isFile()) {
        files.set(key, readFileSync(filePath, 'utf-8'))
      } else if (entry.isDirectory()) {
        this.loadDirectoryFiles(filePath, key, files)
      }
    }
  }

  private async discoverPlugins(): Promise<Skill[]> {
    // TODO: Scan node_modules for @polka-codes/skill-* packages
    return []
  }
}
```

#### 1.3 Skill Loading Tool
**File**: `packages/core/src/tools/loadSkill.ts`

```typescript
import { tool } from 'ai-suite'
import type { Skill, SkillContext } from '../skills/types'

export const loadSkillTool = tool({
  description: 'Load a skill by name to access its instructions and resources. Use this when you need specialized knowledge or capabilities for a specific task.',
  parameters: z.object({
    skillName: z.string().describe('The name of the skill to load'),
  }),
  execute: async ({ skillName }, context: SkillContext) => {
    const skill = context.availableSkills.find(s => s.metadata.name === skillName)

    if (!skill) {
      return {
        success: false,
        error: `Skill '${skillName}' not found`,
      }
    }

    // Load full skill content
    context.activeSkill = skill
    context.skillLoadingHistory.push(skillName)

    return {
      success: true,
      skill: {
        name: skill.metadata.name,
        description: skill.metadata.description,
        content: skill.content,
        files: Array.from(skill.files.keys()),
      },
    }
  },
})
```

#### 1.4 Tests for Core Infrastructure
**File**: `packages/core/src/skills/__tests__/discovery.test.ts`

```typescript
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { SkillDiscoveryService, SkillDiscoveryError } from '../discovery'

describe('SkillDiscoveryService', () => {
  const testDir = join(process.cwd(), 'test-skills-discovery')

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('discoverInDirectory', () => {
    it('should discover skills with valid SKILL.md', async () => {
      const skillDir = join(testDir, 'test-skill')
      mkdirSync(skillDir)

      writeFileSync(join(skillDir, 'SKILL.md'), `---
name: test-skill
description: A test skill
---

# Test Skill

Instructions here
`)

      const service = new SkillDiscoveryService({ cwd: testDir })
      const skills = await service.discoverInDirectory(testDir, 'project')

      expect(skills).toHaveLength(1)
      expect(skills[0].metadata.name).toBe('test-skill')
      expect(skills[0].content).toContain('Instructions here')
    })

    it('should reject skills with invalid names', async () => {
      const skillDir = join(testDir, 'Invalid_Name')
      mkdirSync(skillDir)

      writeFileSync(join(skillDir, 'SKILL.md'), `---
name: Invalid_Name
description: Test
---
`)

      const service = new SkillDiscoveryService({ cwd: testDir })
      const skills = await service.discoverInDirectory(testDir, 'project')

      expect(skills).toHaveLength(0)
    })

    it('should load additional files', async () => {
      const skillDir = join(testDir, 'multi-file-skill')
      mkdirSync(skillDir)

      writeFileSync(join(skillDir, 'SKILL.md'), `---
name: multi-file-skill
description: Test
---

See [reference.md](reference.md)
`)

      writeFileSync(join(skillDir, 'reference.md'), '# Reference')

      const service = new SkillDiscoveryService({ cwd: testDir })
      const skills = await service.discoverInDirectory(testDir, 'project')

      expect(skills[0].files.has('reference.md')).toBe(true)
      expect(skills[0].files.get('reference.md')).toContain('# Reference')
    })
  })
})
```

---

### Phase 2: CLI Integration (Week 1-2)

**Goal**: User-facing commands for skill management

#### 2.1 Skill Management Commands
**File**: `packages/cli/src/commands/skills.ts`

```typescript
import { Command } from 'commander'
import { createLogger } from '../logger'
import { SkillDiscoveryService } from '@polka-codes/core'
import { createSkillTemplate } from '../utils/skillTemplate'

export const skillsCommand = new Command('skills')
  .description('Manage Agent Skills')

// List available skills
skillsCommand
  .command('list')
  .description('List all available skills')
  .action(async () => {
    const logger = createLogger({ verbose: 0 })

    const service = new SkillDiscoveryService({ cwd: process.cwd() })
    const skills = await service.discoverAll()

    if (skills.length === 0) {
      logger.info('No skills found.')
      logger.info('Create a skill with: polka init skill <name>')
      return
    }

    logger.info(`Found ${skills.length} skill${skills.length !== 1 ? 's' : ''}:`)

    for (const skill of skills) {
      const sourceIcon = skill.source === 'project' ? '📁' : skill.source === 'personal' ? '🏠' : '🔌'
      logger.info(`  ${sourceIcon} ${skill.metadata.name}`)
      logger.info(`     ${skill.metadata.description}`)
    }
  })

// Show skill details
skillsCommand
  .command('show')
  .description('Show details for a specific skill')
  .argument('<skill-name>', 'Name of the skill')
  .option('--full', 'Show full content including supporting files')
  .action(async (skillName, options) => {
    const logger = createLogger({ verbose: 0 })

    const service = new SkillDiscoveryService({ cwd: process.cwd() })
    const skills = await service.discoverAll()
    const skill = skills.find(s => s.metadata.name === skillName)

    if (!skill) {
      logger.error(`Skill '${skillName}' not found`)
      logger.info('Run "polka skills list" to see available skills')
      process.exit(1)
    }

    logger.info(`# ${skill.metadata.name}`)
    logger.info(`Source: ${skill.source}`)
    logger.info(`Path: ${skill.path}`)
    logger.info(``)
    logger.info(`## Description`)
    logger.info(skill.metadata.description)
    logger.info(``)
    logger.info(`## Content`)

    if (options.full) {
      logger.info(skill.content)

      if (skill.files.size > 0) {
        logger.info(``)
        logger.info(`## Supporting Files`)
        for (const [name, content] of skill.files) {
          logger.info(`### ${name}`)
          logger.info(content)
        }
      }
    } else {
      const preview = skill.content.split('\n').slice(0, 10).join('\n')
      logger.info(preview)
      if (skill.content.length > preview.length) {
        logger.info('...')
        logger.info(`(Use --full to see complete content)`)
      }
    }
  })

// Validate skill
skillsCommand
  .command('validate')
  .description('Validate a skill\'s structure and content')
  .argument('[skill-name]', 'Name of the skill (validates all if not provided)')
  .action(async (skillName) => {
    const logger = createLogger({ verbose: 0 })

    const service = new SkillDiscoveryService({ cwd: process.cwd() })
    const skills = await service.discoverAll()

    const skillsToValidate = skillName
      ? skills.filter(s => s.metadata.name === skillName)
      : skills

    if (skillsToValidate.length === 0) {
      logger.error(`No skill${skillName ? ` '${skillName}'` : 's'} found`)
      process.exit(1)
    }

    let hasErrors = false

    for (const skill of skillsToValidate) {
      logger.info(`Validating ${skill.metadata.name}...`)

      // Check metadata
      if (!skill.metadata.name.match(/^[a-z0-9-]+$/)) {
        logger.error(`  ❌ Invalid name format`)
        hasErrors = true
      }

      if (skill.metadata.name.length > 64) {
        logger.error(`  ❌ Name too long (${skill.metadata.name.length} > 64)`)
        hasErrors = true
      }

      if (skill.metadata.description.length > 1024) {
        logger.error(`  ❌ Description too long (${skill.metadata.description.length} > 1024)`)
        hasErrors = true
      }

      // Check required files
      if (!skill.content) {
        logger.error(`  ❌ No content in SKILL.md`)
        hasErrors = true
      }

      // Validate file references
      const refs = skill.content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
      for (const ref of refs) {
        const match = ref.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (match) {
          const [, , filepath] = match
          if (!skill.files.has(filepath) && !filepath.startsWith('http')) {
            logger.warn(`  ⚠️  Referenced file not found: ${filepath}`)
          }
        }
      }

      if (!hasErrors) {
        logger.info(`  ✅ Valid`)
      }
    }

    if (hasErrors) {
      process.exit(1)
    }
  })
```

#### 2.2 Extend Init Command for Skills
**File**: `packages/cli/src/commands/init.ts` (modify existing)

```typescript
// Add skill generation to init command
async function createSkill(name: string, logger: Logger, interactive: boolean) {
  // Validate skill name (same rules as Agent Skills)
  if (!name.match(/^[a-z0-9-]+$/)) {
    throw new Error('Skill name must contain only lowercase letters, numbers, and hyphens')
  }

  if (name.length > 64) {
    throw new Error('Skill name must be at most 64 characters')
  }

  const skillDir = join('.claude', 'skills', name)

  // Check if skill already exists
  if (existsSync(skillDir)) {
    if (interactive) {
      const proceed = await confirm({
        message: `Skill '${name}' already exists. Overwrite?`,
        default: false,
      })
      if (!proceed) {
        logger.info('Skill creation cancelled')
        return
      }
    } else {
      throw new Error(`Skill already exists: ${skillDir}`)
    }
  }

  // Create skill directory
  mkdirSync(skillDir, { recursive: true })
  logger.info(`Created skill directory: ${skillDir}`)

  // Generate skill template
  const template = createSkillTemplate(name)
  writeFileSync(join(skillDir, 'SKILL.md'), template)
  logger.info(`Created SKILL.md`)

  logger.info(``)
  logger.info(`Skill '${name}' created successfully!`)
  logger.info(``)
  logger.info(`Next steps:`)
  logger.info(`  1. Edit ${skillDir}/SKILL.md to add your instructions`)
  logger.info(`  2. Add supporting files (reference.md, examples.md, etc.)`)
  logger.info(`  3. Validate with: polka skills validate ${name}`)
  logger.info(`  4. Test by asking Claude to use the skill`)
}
```

**File**: `packages/cli/src/utils/skillTemplate.ts`

```typescript
export function createSkillTemplate(name: string): string {
  const capitalized = name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

  return `---
name: ${name}
description: Brief description of what this skill does and when to use it. Include trigger terms like "when the user mentions..." or "for tasks involving..."
---

# ${capitalized}

## Instructions

Provide clear, step-by-step guidance for Claude here.

### When to Use This Skill

Use this skill when:
- The user asks about [specific topics]
- Working with [specific technologies/file types]
- [other trigger conditions]

### Step-by-Step Process

1. First step
2. Second step
3. Continue as needed

## Examples

### Example 1: Simple usage

\`\`\`
Input: [user input example]
Output: [expected response]
\`\`\`

## Best Practices

- Tip 1
- Tip 2
- Tip 3

## Troubleshooting

### Common Issues

**Problem**: Description of problem
**Solution**: How to fix it

## Resources

Add additional files like:
- \`reference.md\` - Detailed documentation
- \`examples.md\` - More usage examples
- \`scripts/\` - Helper scripts
- \`templates/\` - File templates
`
}
```

---

### Phase 3: Agent Integration (Week 2)

**Goal**: Agents can discover and use skills autonomously

#### 3.1 Inject Skill Metadata into System Prompts
**File**: `packages/core/src/Agent/AgentBase.ts` (modify)

```typescript
import type { Skill } from '../skills/types'

export abstract class AgentBase<Config extends AgentConfig = AgentConfig> {
  // ... existing code ...

  protected buildSystemPrompt(additionalContext?: string): string {
    let prompt = this.systemPrompt

    // Inject available skills
    if (this.skillContext && this.skillContext.availableSkills.length > 0) {
      prompt += '\n\n## Available Skills\n\n'
      prompt += 'You have access to the following skills that provide specialized knowledge and capabilities:\n\n'

      for (const skill of this.skillContext.availableSkills) {
        prompt += `**${skill.metadata.name}**: ${skill.metadata.description}\n`
      }

      prompt += '\nTo use a skill, invoke the loadSkill tool with the skill name. '
      prompt += 'Skills are model-invoked - choose to load them based on the task context.\n'
    }

    // ... rest of existing system prompt building ...

    return prompt
  }
}
```

#### 3.2 Add ListSkills Tool for Discovery
**File**: `packages/core/src/tools/listSkills.ts`

```typescript
import { tool } from 'ai-suite'
import type { SkillContext } from '../skills/types'

export const listSkillsTool = tool({
  description: 'List all available skills with their descriptions. Use this to discover what specialized capabilities are available.',
  parameters: z.object({
    filter: z.string().optional().describe('Optional filter string to match against skill names and descriptions'),
  }),
  execute: async ({ filter }, context: SkillContext) => {
    let skills = context.availableSkills

    if (filter) {
      const filterLower = filter.toLowerCase()
      skills = skills.filter(s =>
        s.metadata.name.includes(filterLower) ||
        s.metadata.description.toLowerCase().includes(filterLower)
      )
    }

    return {
      skills: skills.map(s => ({
        name: s.metadata.name,
        description: s.metadata.description,
        source: s.source,
      })),
    }
  },
})
```

#### 3.3 Skill-Scoped Tool Permissions
**File**: `packages/core/src/skills/permissions.ts`

```typescript
import type { AgentToolRegistry } from '../workflow/agent.workflow'

export function applySkillPermissions(
  registry: AgentToolRegistry,
  allowedTools: string[] | undefined
): AgentToolRegistry {
  if (!allowedTools) {
    return registry
  }

  // Filter registry to only allowed tools
  const filtered: AgentToolRegistry = {}

  for (const [name, tool] of Object.entries(registry)) {
    if (allowedTools.includes(name)) {
      filtered[name] = tool
    }
  }

  return filtered
}
```

#### 3.4 Update getAvailableTools to Include Skills
**File**: `packages/core/src/getAvailableTools.ts` (modify)

```typescript
import { loadSkillTool, listSkillsTool } from './tools/loadSkill'
import type { SkillContext } from './skills/types'

export async function getAvailableTools(
  options: GetAvailableToolsOptions = {}
): Promise<AgentToolRegistry> {
  const {
    todoItemStore,
    memoryStore,
    skillContext,
  } = options

  const tools: AgentToolRegistry = {
    // ... existing tools ...

    // Skill tools
    loadSkill: loadSkillTool,
    listSkills: listSkillsTool,
  }

  // Apply active skill permissions if a skill is loaded
  if (skillContext?.activeSkill?.metadata.allowedTools) {
    return applySkillPermissions(tools, skillContext.activeSkill.metadata.allowedTools)
  }

  return tools
}
```

---

### Phase 4: Testing & Documentation (Week 2-3)

#### 4.1 Integration Tests
**File**: `packages/cli/src/skills/__tests__/integration.test.ts`

```typescript
import { describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SkillDiscoveryService } from '@polka-codes/core'

describe('Skills Integration Tests', () => {
  const testProjectDir = join(process.cwd(), 'test-skills-integration')
  const skillsDir = join(testProjectDir, '.claude', 'skills')

  beforeEach(() => {
    mkdirSync(skillsDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testProjectDir, { recursive: true, force: true })
  })

  describe('Skill lifecycle', () => {
    it('should create, discover, and use a skill', async () => {
      // Create skill
      const skillName = 'test-generator'
      const skillPath = join(skillsDir, skillName)
      mkdirSync(skillPath)

      writeFileSync(join(skillPath, 'SKILL.md'), `---
name: test-generator
description: Generate test files. Use when the user asks to create tests, add test coverage, or write unit tests.
allowed-tools: [Write, Read]
---

# Test Generator

## Instructions

When generating tests:

1. Use bun:test framework
2. Name test files *.test.ts
3. Include describe, it, expect blocks
4. Mock external dependencies

## Example

\`\`\`typescript
describe('MyComponent', () => {
  it('should work', () => {
    expect(true).toBe(true)
  })
})
\`\`\`
`)

      // Discover skill
      const service = new SkillDiscoveryService({ cwd: testProjectDir })
      const skills = await service.discoverAll()

      expect(skills).toHaveLength(1)
      expect(skills[0].metadata.name).toBe('test-generator')
      expect(skills[0].metadata.allowedTools).toEqual(['Write', 'Read'])

      // Validate skill content
      expect(skills[0].content).toContain('Test Generator')
      expect(skills[0].content).toContain('bun:test')
    })

    it('should handle multiple skills with priority', async () => {
      // Create project skill
      const projectSkillDir = join(skillsDir, 'my-formatter')
      mkdirSync(projectSkillDir)
      writeFileSync(join(projectSkillDir, 'SKILL.md'), `---
name: my-formatter
description: Project-specific formatter
---
`)

      // Create personal skill with same name
      const personalDir = join(process.env.HOME ?? '', '.claude', 'skills', 'my-formatter')
      mkdirSync(personalDir, { recursive: true })
      writeFileSync(join(personalDir, 'SKILL.md'), `---
name: my-formatter
description: Personal formatter
---
`)

      const service = new SkillDiscoveryService({ cwd: testProjectDir })
      const skills = await service.discoverAll()

      // Project skill should take priority
      expect(skills).toHaveLength(1)
      expect(skills[0].source).toBe('project')
      expect(skills[0].metadata.description).toBe('Project-specific formatter')

      // Cleanup
      rmSync(personalDir, { recursive: true, force: true })
    })
  })

  describe('Progressive disclosure', () => {
    it('should load supporting files on demand', async () => {
      const skillPath = join(skillsDir, 'multi-file')
      mkdirSync(skillPath, { recursive: true })

      writeFileSync(join(skillPath, 'SKILL.md'), `---
name: multi-file
description: Test multi-file loading
---

See [reference](reference.md) for details.
`)

      writeFileSync(join(skillPath, 'reference.md'), '# Reference Documentation')
      writeFileSync(join(skillPath, 'examples.md'), '# Examples')

      const service = new SkillDiscoveryService({ cwd: testProjectDir })
      const skills = await service.discoverAll()

      expect(skills[0].files.size).toBe(2)
      expect(skills[0].files.get('reference.md')).toContain('# Reference Documentation')
      expect(skills[0].files.get('examples.md')).toContain('# Examples')
    })
  })
})
```

#### 4.2 Documentation Updates
**File**: `README.md` (add section)

```markdown
## Agent Skills

Agent Skills are modular capabilities that extend polka-codes functionality through organized instruction sets. Skills enable agents to autonomously specialize for specific tasks, technologies, or workflows.

### What Are Skills?

Skills are folders containing:
- **SKILL.md**: Required file with metadata and instructions
- **Supporting files**: Optional documentation, examples, scripts, templates

Skills are **model-invoked** - agents automatically choose when to use them based on task context.

### Skill Locations

| Location | Scope | Git Tracked | Purpose |
|----------|-------|-------------|---------|
| `.claude/skills/` | Project | ✅ Yes | Team conventions, project-specific workflows |
| `~/.claude/skills/` | Personal | ❌ No | Individual preferences, experimental skills |
| `node_modules/@polka-codes/skill-*/` | Plugin | ✅ Yes | Community-contributed skills |

### Creating Skills

Generate a new skill template:

```bash
polka init skill my-skill
```

This creates `.claude/skills/my-skill/SKILL.md` with a template.

### Skill Format

**SKILL.md Structure:**

\`\`\`markdown
---
name: react-component-generator
description: Generate React components with TypeScript and Tailwind. Use when creating UI components or refactoring React code.
allowed-tools: Read, Write, Glob
---

# React Component Generator

## Instructions

1. Use TypeScript with strict type checking
2. Apply Tailwind utility classes
3. Include prop-types interface
4. Add Vitest unit tests

## Examples

### Component Template

\`\`\`tsx
interface Props {
  title: string
}

export function Component({ title }: Props) {
  return <div>{title}</div>
}
\`\`\`

See [examples.md](examples.md) for more patterns.
\`\`\`

### Managing Skills

```bash
# List all available skills
polka skills list

# Show skill details
polka skills show react-component-generator

# Show full content with supporting files
polka skills show react-component-generator --full

# Validate skill format
polka skills validate
polka skills validate react-component-generator
```

### How Skills Work

1. **Startup**: Agent loads skill metadata (name + description) into context
2. **Task Analysis**: Agent compares user request to skill descriptions
3. **Skill Activation**: Agent invokes `loadSkill` tool for relevant skills
4. **Progressive Loading**: Full SKILL.md loads, then supporting files on demand
5. **Execution**: Agent follows skill instructions to complete task

### Best Practices

- **Keep Skills Focused**: One skill = one capability (e.g., "react-component-generator" not "frontend-tools")
- **Write Specific Descriptions**: Include trigger terms (e.g., "Use when working with PDF files, forms, or document extraction")
- **Use Supporting Files**: Move rarely-used content to reference.md, examples.md
- **Set Tool Permissions**: Restrict with `allowed-tools` for security (e.g., read-only skills)
- **Test Thoroughly**: Validate with `polka skills validate` before sharing

### Example Skills

#### Project Skill: Team Conventions

\`\`\`markdown
---
name: team-conventions
description: Apply team coding standards for this project. Use when writing new code, refactoring, or reviewing.
---

# Team Conventions

## Code Style

- Use TypeScript strict mode
- No \`any\` types without justification
- Max function length: 50 lines
- Max file length: 300 lines

## Naming Conventions

- Components: PascalCase (e.g., \`UserProfile\`)
- Functions: camelCase (e.g., \`getUserData\`)
- Constants: UPPER_SNAKE_CASE (e.g., \`API_BASE_URL\`)
\`\`\`

#### Personal Skill: Git Workflow

\`\`\`markdown
---
name: my-git-workflow
description: Use personal Git commit conventions. Use when committing changes or writing commit messages.
---

# My Git Workflow

## Commit Message Format

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## Types

- feat: New feature
- fix: Bug fix
- refactor: Code change without feature/fix
- test: Adding tests
- docs: Documentation changes
\`\`\`

---

**For more details**, see [Agent Skills documentation](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).
```

---

## 4. Migration & Compatibility

### 4.1 Backward Compatibility

**Custom Scripts → Skills Migration Path:**

| Custom Script | Skill Equivalent | Notes |
|--------------|------------------|-------|
| `script: .polka-scripts/deploy.ts` | Not directly applicable | Scripts remain executable via `polka run` |
| `command: bun test` | Not directly applicable | Scripts remain for simple commands |
| N/A | Skills | New capability for instruction-based behaviors |

**Key Differences:**

| Aspect | Custom Scripts | Skills |
|--------|---------------|--------|
| Invocation | User-invoked (`polka run`) | Model-invoked (automatic) |
| Primary Use | Execution/automation | Instruction/knowledge |
| Format | TypeScript code | Markdown instructions |
| Arguments | Command-line args | Context-based |
| Best For | Deployments, builds, scripts | Conventions, patterns, expertise |

**Coexistence Strategy:**

- **Keep Custom Scripts** for automation tasks (deployments, builds, CI/CD)
- **Use Skills** for knowledge transfer (coding standards, best practices, domain expertise)
- **Skills Can Invoke Scripts**: Skills can reference custom scripts in their instructions

### 4.2 Configuration Schema Changes

**File**: `packages/core/src/config.ts` (extend existing)

```typescript
// Add to configSchema
export const configSchema = z
  .object({
    // ... existing fields ...

    // Skills configuration
    skills: z
      .object({
        directories: z.array(z.string()).optional(), // Additional skill directories
        autoLoad: z.array(z.string()).optional(), // Skills to auto-load on startup
        disabled: z.array(z.string()).optional(), // Skills to disable
      })
      .optional(),
  })
  .strict()
```

**Example .polkacodes.yml:**

```yaml
defaultProvider: deepseek
defaultModel: deepseek-chat

scripts:
  test: bun test
  lint: bun lint

skills:
  directories:
    - .claude/skills
    - .polka-codes/skills  # Additional directory
  autoLoad:
    - team-conventions     # Always load this skill
  disabled:
    - experimental-skill   # Don't use this skill
```

---

## 5. Security Considerations

### 5.1 Skill Validation

**Validation Rules:**
1. **Path Traversal Protection**: Skills must be within designated directories
2. **Name Validation**: Only lowercase letters, numbers, hyphens (max 64 chars)
3. **Description Limits**: Max 1024 characters to prevent prompt injection
4. **Frontmatter Validation**: Strict YAML parsing with Zod schema
5. **File Size Limits**: Max 1MB per skill file, 10MB total per skill

**File**: `packages/core/src/skills/validation.ts`

```typescript
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Skill } from './types'

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_SKILL_SIZE = 10 * 1024 * 1024 // 10MB

export class SkillValidationError extends Error {
  constructor(message: string, public path: string) {
    super(message)
    this.name = 'SkillValidationError'
  }
}

export function validateSkillSecurity(skill: Skill): void {
  // Check file sizes
  let totalSize = 0

  for (const [filename, content] of skill.files) {
    const fileSize = Buffer.byteLength(content, 'utf8')

    if (fileSize > MAX_FILE_SIZE) {
      throw new SkillValidationError(
        `File ${filename} exceeds size limit (${fileSize} > ${MAX_FILE_SIZE})`,
        join(skill.path, filename)
      )
    }

    totalSize += fileSize
  }

  if (totalSize > MAX_SKILL_SIZE) {
    throw new SkillValidationError(
      `Skill total size exceeds limit (${totalSize} > ${MAX_SKILL_SIZE})`,
      skill.path
    )
  }

  // Check for suspicious patterns (basic XSS/injection detection)
  const suspiciousPatterns = [
    /<script[^>]*>.*<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript URLs
    /on\w+\s*=/gi, // Event handlers (onclick, onload, etc.)
  ]

  for (const [filename, content] of skill.files) {
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new SkillValidationError(
          `Suspicious content detected in ${filename}`,
          join(skill.path, filename)
        )
      }
    }
  }
}
```

### 5.2 Tool Permission Enforcement

**Security Levels:**

| Level | allowed-tools | Use Case |
|-------|---------------|----------|
| None | Not specified | All tools available (default) |
| Read-only | `[Read, Grep, Glob]` | Documentation, analysis skills |
| Restricted | `[Read, Write]` | Code generation without execution |
| Full | `[Read, Write, Execute, ...]` | Automation skills |

**Enforcement:**

```typescript
// In AgentBase.executeTool()
if (this.skillContext?.activeSkill?.metadata.allowedTools) {
  if (!this.skillContext.activeSkill.metadata.allowedTools.includes(toolName)) {
    throw new Error(
      `Tool '${toolName}' is not allowed by active skill '${this.skillContext.activeSkill.metadata.name}'. ` +
      `Allowed tools: ${this.skillContext.activeSkill.metadata.allowedTools.join(', ')}`
    )
  }
}
```

### 5.3 External Resource Restrictions

**Warnings in SKILL.md:**

Skills should not:
- Connect to external network resources without user consent
- Execute arbitrary code from supporting files
- Access files outside project directory
- Modify system configuration

**Validation:**

```typescript
export function validateSkillReferences(skill: Skill): void {
  // Check for external network references
  const externalRefs = skill.content.match(/https?:\/\/[^\s\])]+/g) || []

  if (externalRefs.length > 0 && !skill.metadata.description.includes('external')) {
    console.warn(
      `Warning: Skill '${skill.metadata.name}' contains external references. ` +
      `Consider adding 'external' to description for transparency.`
    )
  }

  // Check for absolute paths outside skill directory
  const absolutePaths = skill.content.match(/\/[\w\s.-]+/g) || []

  for (const path of absolutePaths) {
    if (!path.startsWith(skill.path)) {
      console.warn(
        `Warning: Skill '${skill.metadata.name}' references absolute path '${path}'. ` +
        `Use relative paths instead.`
      )
    }
  }
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Coverage Goals:**
- SkillDiscoveryService: 90%+
- Skill validation: 95%+
- Tool permissions: 90%+
- Progressive disclosure: 85%+

**Test Files:**
- `packages/core/src/skills/__tests__/discovery.test.ts`
- `packages/core/src/skills/__tests__/validation.test.ts`
- `packages/core/src/skills/__tests__/permissions.test.ts`
- `packages/core/src/tools/__tests__/loadSkill.test.ts`
- `packages/core/src/tools/__tests__/listSkills.test.ts`

### 6.2 Integration Tests

**Scenarios:**
1. Create skill → Discover → Load → Use
2. Multiple skills with priority conflicts
3. Progressive disclosure (metadata → main → supporting)
4. Tool permission enforcement
5. Skill lifecycle (create, validate, update, delete)
6. Agent skill invocation in workflows

**Test File:**
- `packages/cli/src/skills/__tests__/integration.test.ts`

### 6.3 End-to-End Tests

**Manual Test Scenarios:**

1. **Basic Skill Creation**
   ```bash
   polka init skill test-helper
   # Edit .claude/skills/test-helper/SKILL.md
   polka skills validate test-helper
   polka skills list
   ```

2. **Agent Skill Usage**
   ```bash
   # Start epic with task that should trigger skill
   polka "help me write tests for UserService"
   # Agent should discover and load test-helper skill
   ```

3. **Skill Conflicts**
   ```bash
   # Create project skill
   mkdir -p .claude/skills/my-skill
   # Create personal skill with same name
   mkdir -p ~/.claude/skills/my-skill
   polka skills list
   # Should show project skill (higher priority)
   ```

4. **Tool Permissions**
   ```bash
   # Create read-only skill
   # allowed-tools: [Read, Grep]
   # Try to use Write tool
   # Should fail with permission error
   ```

---

## 7. Rollout Plan

### 7.1 Phased Release

**Phase 1: Alpha (Internal Testing)**
- Core infrastructure implementation
- Basic CLI commands
- Integration with one agent (CoderAgent)
- Internal testing by team

**Phase 2: Beta (Early Adopters)**
- Full agent integration
- Documentation complete
- Testing by select users
- Feedback collection

**Phase 3: Stable (Public Release)**
- All features complete
- Comprehensive tests passing
- Documentation reviewed
- Migration guide available
- Release notes published

### 7.2 Migration Guide for Users

**For Existing Projects:**

```markdown
# Migrating to Agent Skills

## What's New?

Agent Skills are a new way to package domain expertise and best practices for polka-codes agents.

## Should I Migrate?

- **Keep using custom scripts** for: Automation, deployments, builds
- **Consider adding skills** for: Coding standards, team conventions, best practices

## Quick Start

1. Create your first skill:
   \`\`\`bash
   polka init skill team-conventions
   \`\`\`

2. Edit `.claude/skills/team-conventions/SKILL.md` with your team's practices

3. Commit to git:
   \`\`\`bash
   git add .claude/skills/
   git commit -m "Add team conventions skill"
   \`\`\`

4. Team members pull and the skill is automatically available

## Examples

See [skills-examples](https://github.com/polka-codes/skills-examples) for community skills.
```

---

## 8. Open Questions & Decisions

### 8.1 Technical Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Plugin skills loading** | Scan node_modules vs explicit registration | Start with explicit registration, consider auto-discovery later |
| **Skill versioning** | Embed in name vs frontmatter field | Add `version` field to frontmatter (optional) |
| **Skill dependencies** | Declare in SKILL.md vs separate file | Add `requires` field to frontmatter (future) |
| **Skill marketplace** | Build vs partner vs community | Start with GitHub examples, evaluate marketplace later |
| **Skill hot-reloading** | Watch for changes vs restart required | Start with restart required, consider hot-reload for v2 |

### 8.2 Future Enhancements

**Post-MVP Features:**

1. **Skill Dependencies**: Skills can require other skills
   ```yaml
   requires:
     - react-best-practices
     - typescript-strict-mode
   ```

2. **Skill Versioning & Compatibility**: Declare minimum polka-codes version
   ```yaml
   engine: ">=1.5.0"
   ```

3. **Skill Parameters**: Configurable skill behavior
   ```yaml
   parameters:
     testFramework:
       default: "vitest"
       options: ["vitest", "jest", "mocha"]
   ```

4. **Skill Composition**: Combine multiple skills into workflows
   ```yaml
   workflows:
     - name: create-feature
       skills: [plan, code, test, review]
   ```

5. **Skill Marketplace**: Browse and install community skills
   ```bash
   polka skills search react
   polka skills install @polka-codes/skill-react-components
   ```

6. **Skill Analytics**: Track which skills are used most
   ```bash
   polka skills stats
   ```

---

## 9. Success Criteria

### 9.1 Technical Metrics

- ✅ All unit tests passing (90%+ coverage)
- ✅ All integration tests passing
- ✅ Zero critical security vulnerabilities
- ✅ Performance: <100ms to discover 100 skills
- ✅ Memory: <10MB overhead for skill system

### 9.2 User Experience Metrics

- ✅ Skill creation takes <2 minutes
- ✅ Agent autonomously uses skills for relevant tasks
- ✅ Documentation covers all use cases
- ✅ Migration guide clear and concise
- ✅ Example skills provided for common scenarios

### 9.3 Adoption Metrics

- ✅ 5+ example skills created
- ✅ Community feedback positive
- ✅ Skills featured in release notes
- ✅ Blog post published

---

## 10. Timeline & Milestones

### Week 1: Foundation
- [ ] Core infrastructure (Skill types, discovery, loading)
- [ ] Unit tests for core functionality
- [ ] Basic CLI commands (list, show, validate)

### Week 2: Integration
- [ ] Agent system integration
- [ ] Tool permission enforcement
- [ ] Progressive disclosure implementation
- [ ] Integration tests

### Week 3: Polish & Release
- [ ] Documentation (README, migration guide)
- [ ] Example skills creation
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Release preparation

---

## 11. References

- [Agent Skills Documentation](https://code.claude.com/docs/en/skills)
- [Agent Skills Engineering Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Anthropic Skills GitHub](https://github.com/anthropics/skills)
- [polka-codes Custom Scripts Documentation](README.md#custom-scripts)

---

## Appendix A: Example Skills

### A.1 React Component Generator Skill

**File**: `.claude/skills/react-component-generator/SKILL.md`

```markdown
---
name: react-component-generator
description: Generate React components with TypeScript, Tailwind CSS, and Vitest. Use when creating new UI components, modifying existing components, or refactoring React code.
allowed-tools: [Read, Write, Glob, Grep]
---

# React Component Generator

## Component Structure

When creating React components, follow this structure:

\`\`\`tsx
import { cn } from '@/lib/utils'

export interface ComponentNameProps {
  // Prop definitions with TypeScript types
}

export function ComponentName({ props }: ComponentNameProps) {
  return (
    <div className="tailwind-classes">
      {/* Component JSX */}
    </div>
  )
}
\`\`\`

## Styling Guidelines

1. Use Tailwind utility classes for all styling
2. Use \`cn()\` utility for conditional classes
3. Avoid inline styles
4. Use semantic HTML elements

## TypeScript Rules

- Use \`interface\` for props (extensible)
- Use \`type\` for unions/intersections
- Export prop interfaces for reuse
- No \`any\` types

## Testing

Create companion test file: \`ComponentName.test.tsx\`

\`\`\`tsx
import { describe, expect, it } from 'bun:test'
import { render, screen } from 'react-testing-library'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  it('should render', () => {
    render(<ComponentName {...props} />)
    expect(screen.getByText('content')).toBeTruthy()
  })
})
\`\`\`

## File Organization

\`\`\`
components/
  ui/
    Button.tsx
    Button.test.tsx
  forms/
    FormField.tsx
    FormField.test.tsx
\`\`\`

See [examples.md](examples.md) for more component patterns.
```

### A.2 Git Commit Convention Skill

**File**: `.claude/skills/git-commit-conventions/SKILL.md`

```markdown
---
name: git-commit-conventions
description: Apply conventional commit format with specific types and scopes. Use when writing commit messages, reviewing commit history, or cleaning up commits.
allowed-tools: [Read, Execute]
---

# Git Commit Conventions

## Commit Message Format

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## Types

- **feat**: New feature (user-facing)
- **fix**: Bug fix (user-facing)
- **refactor**: Code change without feature/fix
- **perf**: Performance improvement
- **test**: Adding/updating tests
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **build**: Build system or dependencies
- **ci**: CI/CD changes
- **chore**: Maintenance tasks

## Scopes

Common scopes:
- \`core\`: Core packages
- \`cli\`: CLI commands
- \`agents\`: Agent implementations
- \`docs\`: Documentation
- \`tests\`: Test infrastructure

## Examples

\`\`\`
feat(cli): add skills management commands

- Add \`polka skills list\` to display available skills
- Add \`polka skills show <name>\` to display skill details
- Add \`polka skills validate\` to check skill format

Closes #123
\`\`\`

\`\`\`
fix(agents): correct timeout handling in CoderAgent

Previous implementation did not clear timeout handles
on early completion, causing resource leaks.

Fixes #456
\`\`\`

## When to Use

Use this skill when:
- Writing commit messages
- Reviewing commit history
- Cleaning up commit messages
- Squashing commits

## Process

1. Identify the type of change
2. Determine the scope
3. Write a clear subject (imperative mood, max 50 chars)
4. Add body explaining what and why (not how)
5. Add footer with issue references
```

---

## Appendix B: Migration Checklist

### For Teams Adopting Skills

- [ ] Identify team conventions and best practices
- [ ] Create skills for each convention area
- [ ] Validate skills with `polka skills validate`
- [ ] Commit skills to `.claude/skills/`
- [ ] Update onboarding documentation
- [ ] Train team members on skill usage
- [ ] Gather feedback after 1 week
- [ ] Iterate on skill content

### For Individual Users

- [ ] Review existing custom scripts
- [ ] Identify scripts that could become skills
- [ ] Create first skill with `polka init skill`
- [ ] Test skill in real workflow
- [ ] Create personal skills directory if needed
- [ ] Document personal workflows in skills
- [ ] Share useful skills with team

---

**End of Implementation Plan**

Generated by [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
