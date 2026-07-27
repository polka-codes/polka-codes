import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSkillContext } from './skillIntegration'

describe('createSkillContext', () => {
  const testDir = join(tmpdir(), `polka-test-skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const skillsDir = join(testDir, '.claude', 'skills')

  beforeEach(() => {
    mkdirSync(skillsDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  function createTestSkill(name: string, description: string) {
    const skillDir = join(skillsDir, name)
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: ${name}
description: ${description}
---

# Test Skill
`,
    )
  }

  it('discovers project skills', async () => {
    createTestSkill('skill-one', 'First skill')
    createTestSkill('skill-two', 'Second skill')

    const context = await createSkillContext(testDir)
    const projectSkillNames = context.availableSkills.filter((skill) => skill.source === 'project').map((skill) => skill.metadata.name)

    expect(projectSkillNames).toContain('skill-one')
    expect(projectSkillNames).toContain('skill-two')
    expect(context.activeSkill).toBeNull()
    expect(context.skillLoadingHistory).toEqual([])
  })

  it('returns no project skills for an empty directory', async () => {
    const context = await createSkillContext(testDir)

    expect(context.availableSkills.filter((skill) => skill.source === 'project')).toEqual([])
  })
})
