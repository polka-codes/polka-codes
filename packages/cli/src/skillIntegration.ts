import { type SkillContext, SkillDiscoveryService } from '@polka-codes/core'

export async function createSkillContext(cwd = process.cwd()): Promise<SkillContext> {
  return await new SkillDiscoveryService({ cwd }).createContext()
}
