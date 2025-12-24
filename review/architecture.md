# Architecture Review: polka-codes Monorepo

**Date:** 2025-12-24
**Total Files:** 382 TypeScript files (122,899 lines of code)
**Packages:** 5 (core, cli, cli-shared, github, runner)
**Test Files:** 37

---

## 1. INCONSISTENT PATTERNS ACROSS PACKAGES

### Build System Inconsistencies
**Location:** Package root directories

**Issue:** Different build tools and configurations:
```jsonjson
// packages/core
"build": "tsup --experimental-dts"

// packages/cli, runner, cli-shared
"build": "bun build src/index.ts --target node --outdir ./dist"

// packages/github
"build": "tsup --format esm --external .gql=text"
```

**Impact:**
- Inconsistent output formats
- Declaration generation varies
- Build behavior differs between packages
- Harder to maintain

**Recommendation:** Standardize on `tsup` for all packages

---

### Config Type Duplication
**Locations:**
- `packages/core/src/config.ts` - `Config`, `ProviderConfig`
- `packages/cli/src/configPrompt.ts` - `ProviderConfig`
- `packages/cli/src/getModel.ts` - `ModelConfig`

**Issue:** Multiple type definitions for same concepts:
```typescript
// core/src/config.ts
export type ProviderConfig = z.infer<typeof providerConfigSchema>

// cli/src/configPrompt.ts
export type ProviderConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseURL?: string  // Note: different case!
}

// cli/src/getModel.ts
export type ModelConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string  // Note: different case!
}
```

**Impact:**
- Type confusion
- Potential mismatches
- Maintainability issues

**Recommendation:** Single source of truth for all config types in `@polka-codes/core`

---

### Export Pattern Inconsistencies
**Location:** All package `index.ts` files

**Issue:** Mix of wildcard exports and named exports:
```typescript
// core/src/index.ts - All wildcard
export * from './Agent'
export * from './config'
export * from './tool'

// cli-shared/src/index.ts - All wildcard
export * from './config'
export * from './provider'
export * from './utils'

// cli/src/index.ts - Mixed
export * from './api'  // Wildcard for API
// Plus 50+ lines of CLI setup code
```

**Impact:**
- Unpredictable public API surface
- Namespace pollution
- Hard to track exports
- Tree-shaking less effective

**Recommendation:** Use explicit named exports, minimize wildcard exports

---

## 2. CROSS-PACKAGE DUPLICATION

### Tool Implementation Duplication
**Locations:**
- `packages/core/src/tools/` (base tools)
- `packages/cli/src/tools/` (CLI-specific tools)
- `packages/cli/src/tool-implementations.ts` (503 lines)

**Issue:** Similar tool patterns across packages:
```typescript
// Both packages have nearly identical tool handler signatures
export const handler: ToolHandler<typeof toolInfo, TodoProvider> =
  async (provider, args) => {
    if (!provider.someMethod) {
      return {
        success: false,
        message: { type: 'error-text', value: 'Tool not supported' }
      }
    }
    // ...
  }
```

**Impact:**
- Code duplication
- Maintenance burden
- Inconsistent behavior

**Recommendation:** Centralize tool registry in core, use composition in cli

---

### Provider Logic Duplication
**Locations:**
- `packages/core/src/tools/provider.ts` (defines provider types)
- `packages/cli-shared/src/provider.ts` (implements providers - 397 lines)
- `packages/cli/src/getModel.ts` (AI provider creation - 259 lines)

**Issue:** Provider logic scattered across packages:
- Core defines interfaces (`ToolProvider`, `TodoProvider`, `MemoryProvider`)
- cli-shared implements `getProvider()` with tool injection
- CLI has separate `getModel()` for AI provider creation

**Impact:**
- Difficult to track implementations
- Potential for inconsistent behavior
- Unclear separation of concerns

**Recommendation:** Consolidate provider logic in single location

---

### Utility Function Duplication
**Locations:**
- `packages/core/src/tools/listFiles.ts`
- `packages/cli-shared/src/utils/listFiles.ts`
- `packages/core/src/tools/searchFiles.ts`
- `packages/cli-shared/src/utils/searchFiles.ts`

**Issue:** Similar file operations in both core and cli-shared with different signatures

**Impact:**
- Code duplication
- Potential for divergent behavior

**Recommendation:** Move shared utilities to cli-shared, have core use cli-shared

---

### Search Files Duplication
**Locations:**
- `packages/core/src/tools/search.ts` (1774 bytes)
- `packages/core/src/tools/searchFiles.ts` (2863 bytes)
- `packages/cli-shared/src/utils/searchFiles.ts` (2378 bytes)

**Issue:** Multiple search implementations with overlapping functionality

**Impact:**
- Maintenance overhead
- Potential inconsistencies

**Recommendation:** Consolidate to single search implementation

---

## 3. DEPENDENCY MANAGEMENT ISSUES

### Circular Dependency Risk
**Location:** Cross-package imports

**Dependency Graph:**
```
cli → cli-shared → core
cli → core
runner → cli-shared → core
github (standalone but references cli in README)
```

**Specific Issues:**
- `cli-shared` imports from `core` (correct direction)
- `cli` imports from both `core` and `cli-shared`
- Potential for circular dependencies if changes aren't coordinated

**Impact:** Risk of circular dependencies, hard to refactor

**Recommendation:** Document dependency graph, use dependency analysis tools

---

### Duplicate Dependencies
**Location:** package.json files

**Issue:** Same dependencies in multiple packages:
```json
// ALL packages have these:
"zod": "^4.1.13"
"yaml": "^2.8.2"

// cli and cli-shared both have:
"lodash-es": "^4.17.21"
"mime-types": "^3.0.2"
"@inquirer/prompts": "^8.0.2"
```

**Impact:**
- Larger bundle sizes
- Version mismatch potential
- Wasted disk space

**Recommendation:** Move shared dependencies to root package.json with workspaces

---

### AI SDK Version Alignment
**Location:** All package.json files

**Issue:** Multiple AI SDK packages:
```json
"@ai-sdk/anthropic": "^2.0.53"
"@ai-sdk/deepseek": "^1.0.31"
"@ai-sdk/google": "^2.0.45"
"@ai-sdk/google-vertex": "^3.0.87"
"@ai-sdk/openai": "^2.0.80"
"@ai-sdk/provider": "^2.0.0"
"@ai-sdk/provider-utils": "^3.0.18"
"@openrouter/ai-sdk-provider": "^1.5.0"
"ai": "^5.0.108"
```

**Impact:** Potential incompatibilities, security vulnerabilities

**Recommendation:** Pin to specific versions, use dependabot to track updates

---

### Zod Usage Inconsistency
**Location:** 46 files across all packages

**Issue:** Inconsistent Zod schema patterns:
```typescript
// Some use .optional()
z.string().optional()

// Others use .nullish()
z.string().nullish()

// Mix for similar validation
```

**Impact:** Code readability issues, potential validation errors

**Recommendation:** Document Zod pattern conventions

---

## 4. EXPORT/IMPORT ORGANIZATION

### Barrel File Proliferation
**Location:** Every directory has an `index.ts`

**Issue:** Heavy use of barrel files (wildcard re-exports):
```typescript
// 13 index.ts files just in core package
export * from './config'
export * from './provider'
export * from './utils'
```

**Impact:**
- Hard to track actual exports
- Tree-shaking less effective
- Potential circular dependencies
- IDE autocomplete cluttered

**Recommendation:** Reduce barrel files, use explicit exports

---

### Import Path Inconsistency
**Location:** All packages

**Issue:** Mix of relative and package imports:
```typescript
// Some files use package imports
import { Config } from '@polka-codes/core'

// Others use relative imports
import { Config } from '../../core/src/config'
```

**Impact:**
- Confusing dependency graph
- Refactoring difficulty

**Recommendation:** Enforce package imports over relative imports

---

### Internal Helper Exposure
**Location:** Various index.ts files

**Issue:** Internal implementation details exposed:
```typescript
// core/src/index.ts exports internal helpers
export { replaceInFile as replaceInFileHelper } from './tools/utils/replaceInFile'
```

**Impact:**
- Leaking internal APIs
- Breaking change risks

**Recommendation:** Only export public APIs, keep internals in separate files

---

## 5. NAMING CONSISTENCY

### Config/Provider Naming Confusion

**Issues:**
1. `Config` (core)
2. `ProviderConfig` (core - different from CLI)
3. `ModelConfig` (CLI)
4. `ProviderConfig` (CLI - different from core)

All represent similar concepts but with different fields

---

### Provider Naming Overlap

**Confusing overlap:**
- `ToolProvider` (core interface)
- `TodoProvider` (core interface)
- `MemoryProvider` (core interface)
- `CommandProvider` (core interface)
- `getProvider()` function (cli-shared)
- `getModel()` function (cli)

**Recommendation:** Rename functions to avoid confusion: `createToolProvider()`, `createLanguageModel()`

---

### Workflow Input Types

**Inconsistent patterns:**
- `WorkflowInput`
- `BaseWorkflowInput`
- `AgentWorkflowInput`
- `MetaWorkflowInput`
- `EpicWorkflowInput`

**Recommendation:** Establish naming convention for workflow types

---

### File Naming Issues

**Issues:**
- 13 files named `index.ts` (makes search difficult)
- `workflow.ts` appears in multiple contexts with different meanings
- `config.ts` appears in multiple packages with different content
- `types.ts` in multiple locations (non-descriptive)

**Recommendation:** Use descriptive names, avoid generic names

---

## 6. TESTING COVERAGE GAPS

### Critical Missing Tests

**1. runner (0 tests):**
- `packages/runner/src/runner.ts` (465 lines)
- `packages/runner/src/WebSocketManager.ts` (134 lines)

**Risk:** Critical runner logic untested

---

**2. github (2 tests only):**
- Only `github.test.ts` and `processBody.test.ts`
- Complex GraphQL integration untested

**Risk:** API integration failures

---

**3. cli (20% coverage):**

Missing tests for:
- `commands/workflow.ts` (282 lines)
- `commands/init.ts` (154 lines)
- `commands/review.ts` (128 lines)
- `tool-implementations.ts` (503 lines)
- `api.ts` (561 lines)

**Risk:** CLI failures in production

---

**4. core (43% coverage):**

Large untested files:
- `workflow/dynamic.ts` (543 lines)
- `workflow/dynamic-generator.workflow.ts` (490 lines)
- `workflow/prompts/dynamic-generator-prompts.ts` (333 lines)

**Risk:** Core workflow logic failures

---

### Test File Organization Issues
**Location:** Test directories

**Issue:** Inconsistent test organization:
```
core/src/tools/__snapshots__/
core/src/workflow/__snapshots__/
cli/src/tools/__snapshots__/
cli/src/utils/__snapshots__/
cli-shared/src/utils/__tests__/
```

**Impact:** Hard to find tests, inconsistent test patterns

**Recommendation:** Standardize test organization

---

### Test Dependencies
**Location:** Test files

**Issue:** Heavy reliance on test utilities and mocks:
- Multiple `MockProvider` implementations
- Custom test helpers scattered across packages
- No centralized test utilities

**Impact:** Test maintenance burden, inconsistent test patterns

**Recommendation:** Create shared test utilities package

---

## 7. SPECIFIC ARCHITECTURAL ISSUES

### God Object: epic.workflow.ts
**Location:** `packages/cli/src/workflows/epic.workflow.ts` (852 lines)

**Issue:** Massive file handling:
- Epic orchestration
- Todo item management
- Memory management
- Task execution
- Progress tracking

**Impact:** Difficult to maintain, test, and understand

**Recommendation:** Break into smaller, focused modules

---

### Massive Generated File
**Location:** `packages/github/src/types/github-types.ts` (32,435 lines)

**Issue:** Auto-generated GraphQL types included in repository
- Excluded from biome linting
- Makes codebase appear larger than it is
- Slow to parse/analyze

**Impact:** Tool performance, repository size

**Recommendation:** Keep generated types in separate branch or use declaration maps

---

### Config Complexity
**Location:** Multiple config files

**Issue:** Configuration spread across multiple files:
- `packages/cli/src/configPrompt.ts`
- `packages/cli/src/getProviderOptions.ts`
- `packages/cli/src/getModel.ts`
- `packages/core/src/config.ts`
- `packages/cli-shared/src/config.ts`

**Impact:** Difficult to understand config flow, potential for inconsistencies

**Recommendation:** Consolidate config logic

---

## 8. PACKAGE STRUCTURE ISSUES

### Package Responsibility Overlap

**Issue:** Unclear boundaries between packages:
- `core` - Has some CLI-specific tools
- `cli` - Has core workflow logic
- `cli-shared` - Has utilities that could be in core

**Recommendation:** Document package responsibilities clearly

---

### github Package Isolation
**Location:** `packages/github/`

**Issue:** Package references CLI in README but is standalone

**Impact:** Confusion about package purpose

**Recommendation:** Either integrate with CLI or document as standalone

---

## 9. ARCHITECTURAL RECOMMENDATIONS

### High Priority

1. **Consolidate Config Types**
   - Single source of truth in `@polka-codes/core`
   - Remove duplicate definitions

2. **Extract Tool Registry**
   - Centralize tool registration
   - Avoid duplication across packages

3. **Standardize Build**
   - Use same build tool across all packages (recommend tsup)
   - Consistent output formats

4. **Test Runner**
   - Add tests for runner package (critical)

5. **Document Dependencies**
   - Create dependency graph
   - Audit for circular dependencies

---

### Medium Priority

6. **Consolidate Providers**
   - Merge provider logic into single location
   - Clear separation between types and implementations

7. **Export Hygiene**
   - Use explicit exports instead of wildcards
   - Only export public APIs

8. **Dependency Deduplication**
   - Move shared dependencies to root package.json
   - Use workspace protocol

9. **Split Epic Workflow**
   - Break 852-line file into smaller modules
   - Separate concerns

10. **Standardize Naming**
    - Create naming convention guide
    - Apply consistently

---

### Low Priority

11. **Remove Generated Types**
    - Keep github-types.ts out of repo
    - Use declaration maps instead

12. **Test Utilities**
    - Create shared test utilities package
    - Standardize test patterns

13. **Document Architecture**
    - Create architecture decision records (ADRs)
    - Document package responsibilities

14. **Barrel File Reduction**
    - Reduce index.ts proliferation
    - Use explicit imports

15. **Import Standardization**
    - Enforce package imports over relative imports
    - Use lint rules

---

## 10. SUMMARY STATISTICS

| Metric | Value |
|--------|-------|
| Total TypeScript Files | 382 |
| Total Lines of Code | 122,899 |
| Test Files | 37 |
| Test Coverage | Varies (0% - 80%) |
| Packages | 5 |
| Build Tools | 2 (tsup, bun) |
| AI SDK Packages | 9 |
| Duplicate Dependency Types | 8+ |
| Barrel Files (index.ts) | 50+ |

### Critical Issues by Package

| Package | Critical Issues | Test Coverage |
|---------|----------------|---------------|
| core | 5 | 43% |
| cli | 8 | 20% |
| cli-shared | 4 | 80% |
| github | ? | ~5% |
| runner | ? | 0% |

### Architecture Debt Score: **HIGH**

**Overall Assessment:** The monorepo shows signs of rapid growth with insufficient architectural governance. Key strengths include good separation of concerns and strong typing. However, issues with duplication, inconsistent patterns, and testing gaps pose maintainability risks. The most critical issues are lack of tests in runner package and extensive code duplication.
