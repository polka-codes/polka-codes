import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { convertPortkeyToModelInfo } from './converter.js'
import { fetchPricing } from './portkey-client.js'
import type { ModelInfo } from './types.js'

interface CachedPricing {
  pricing: ModelInfo
  timestamp: number
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export class PricingService {
  #fallbackPrices: Record<string, Record<string, ModelInfo>>
  #cacheFile: string
  #cache: Map<string, CachedPricing> | null = null
  #loadPromise: Promise<void> | null = null

  constructor(fallbackPrices: Record<string, Record<string, Partial<ModelInfo>>> = {}) {
    // Normalize fallback price keys (remove dots and dashes) to match lookup behavior
    const normalized: Record<string, Record<string, ModelInfo>> = {}
    for (const [provider, providerInfo] of Object.entries(fallbackPrices)) {
      const normalizedProvider = provider.split('-')[0]
      normalized[normalizedProvider] = {}
      for (const [model, modelInfo] of Object.entries(providerInfo)) {
        const normalizedModel = model.replace(/[.-]/g, '')
        normalized[normalizedProvider][normalizedModel] = {
          inputPrice: modelInfo.inputPrice ?? 0,
          outputPrice: modelInfo.outputPrice ?? 0,
          cacheWritesPrice: modelInfo.cacheWritesPrice ?? 0,
          cacheReadsPrice: modelInfo.cacheReadsPrice ?? 0,
        }
      }
    }
    this.#fallbackPrices = normalized
    this.#cacheFile = join(homedir(), '.config', 'polkacodes', 'pricing-cache.json')
  }

  async #load(): Promise<void> {
    // Use promise to avoid race condition
    if (this.#loadPromise) {
      return this.#loadPromise
    }

    this.#loadPromise = (async () => {
      this.#cache = new Map()

      try {
        const content = await readFile(this.#cacheFile, 'utf-8')
        const data = JSON.parse(content) as Record<string, CachedPricing>

        for (const [key, value] of Object.entries(data)) {
          this.#cache.set(key, value)
        }
      } catch {
        // Ignore errors (file doesn't exist or invalid JSON), start with empty cache
      }
    })()

    return this.#loadPromise
  }

  async #get(provider: string, model: string): Promise<ModelInfo | null> {
    await this.#load()

    const key = `${provider}:${model}`
    const entry = this.#cache?.get(key)

    if (!entry) {
      return null
    }

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.#cache?.delete(key)
      return null
    }

    return entry.pricing
  }

  async #set(provider: string, model: string, pricing: ModelInfo): Promise<void> {
    await this.#load()

    const key = `${provider}:${model}`
    this.#cache?.set(key, {
      pricing,
      timestamp: Date.now(),
    })

    await this.#save()
  }

  async #save(): Promise<void> {
    if (!this.#cache) {
      return
    }

    try {
      const dir = dirname(this.#cacheFile)
      await mkdir(dir, { recursive: true })

      const data: Record<string, CachedPricing> = {}
      for (const [key, value] of this.#cache.entries()) {
        data[key] = value
      }

      // Write to temp file first, then rename for atomic update
      const tempFile = `${this.#cacheFile}.${randomUUID()}.tmp`
      await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8')
      await rename(tempFile, this.#cacheFile)
    } catch {
      // Ignore save errors
    }
  }

  async getPricing(provider: string, model: string): Promise<ModelInfo> {
    // Normalize provider (e.g., google-vertex -> google)
    const normalizedProvider = provider.split('-')[0]

    // Normalize model for cache key and fallback lookup (remove dots and dashes to match UsageMeter behavior)
    const normalizedModel = model.replace(/[.-]/g, '')

    // Try cache first (using normalized model)
    const cached = await this.#get(normalizedProvider, normalizedModel)
    if (cached) {
      return cached
    }

    // Try fallback prices (config + hardcoded) using normalized model
    const fallbackPrice = this.#fallbackPrices[normalizedProvider]?.[normalizedModel]
    if (fallbackPrice) {
      return fallbackPrice
    }

    // Try Portkey API as last resort (using original model ID)
    const portkeyPricing = await fetchPricing(normalizedProvider, model)
    if (portkeyPricing) {
      const modelInfo = convertPortkeyToModelInfo(portkeyPricing)
      await this.#set(normalizedProvider, normalizedModel, modelInfo)
      return modelInfo
    }

    // Return zero pricing as absolute last resort
    return {
      inputPrice: 0,
      outputPrice: 0,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0,
    }
  }
}
