/**
 * AIRE PropStream Cache Layer
 *
 * Caches PropStream property lookups to avoid redundant DB queries.
 * Uses a simple in-memory LRU cache with TTL for serverless environments.
 *
 * Cache strategy:
 * - Property lookups: 5 minute TTL (properties change rarely)
 * - Snapshot data: 1 hour TTL (snapshots update nightly)
 * - Cache size: 500 entries max (auto-evicts oldest)
 */

import { findByPropertyId, getLatestSnapshot, type PropertyClean, type MarketSnapshot } from '../db/queries/properties'
import { getLatestScore, type AireScore } from '../db/queries/scores'
import { normalizeAddress } from '../engines/normalize'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly maxSize: number
  private readonly ttlMs: number
  private hits = 0
  private misses = 0

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) { this.misses++; return null }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }
    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    this.hits++
    return entry.data
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest (first key)
      const oldest = this.cache.keys().next().value
      if (oldest) this.cache.delete(oldest)
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs })
  }

  stats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
    }
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }
}

// ── Cache instances ──────────────────────────────────────────────────────────

const propertyCache = new LRUCache<PropertyClean | null>(500, 5 * 60 * 1000)   // 5 min
const snapshotCache = new LRUCache<MarketSnapshot | null>(500, 60 * 60 * 1000)  // 1 hour
const scoreCache = new LRUCache<AireScore | null>(500, 60 * 60 * 1000)          // 1 hour

// ── Cached lookups ───────────────────────────────────────────────────────────

/**
 * Look up a property by ID or address, with caching.
 */
export async function cachedPropertyLookup(idOrAddress: string): Promise<PropertyClean | null> {
  // Determine property_id
  let propertyId = idOrAddress
  if (!idOrAddress.includes('-')) {
    // Looks like a raw address, normalize it
    const normalized = normalizeAddress(idOrAddress)
    if (!normalized) return null
    propertyId = normalized.property_id
  }

  const cached = propertyCache.get(propertyId)
  if (cached !== null) return cached

  const property = await findByPropertyId(propertyId)
  propertyCache.set(propertyId, property)
  return property
}

/**
 * Get latest market snapshot with caching.
 */
export async function cachedSnapshot(propertyId: string): Promise<MarketSnapshot | null> {
  const cached = snapshotCache.get(propertyId)
  if (cached !== null) return cached

  const snapshot = await getLatestSnapshot(propertyId)
  snapshotCache.set(propertyId, snapshot)
  return snapshot
}

/**
 * Get latest AIRE score with caching.
 */
export async function cachedScore(propertyId: string): Promise<AireScore | null> {
  const cached = scoreCache.get(propertyId)
  if (cached !== null) return cached

  const score = await getLatestScore(propertyId)
  scoreCache.set(propertyId, score)
  return score
}

/**
 * Full property enrichment: property + snapshot + score, all cached.
 */
export async function cachedPropertyEnrichment(idOrAddress: string): Promise<{
  property: PropertyClean | null
  snapshot: MarketSnapshot | null
  score: AireScore | null
}> {
  const property = await cachedPropertyLookup(idOrAddress)
  if (!property) return { property: null, snapshot: null, score: null }

  const [snapshot, score] = await Promise.all([
    cachedSnapshot(property.property_id),
    cachedScore(property.property_id),
  ])

  return { property, snapshot, score }
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats() {
  return {
    property: propertyCache.stats(),
    snapshot: snapshotCache.stats(),
    score: scoreCache.stats(),
  }
}

/**
 * Clear all caches (e.g., after data import).
 */
export function clearAllCaches() {
  propertyCache.clear()
  snapshotCache.clear()
  scoreCache.clear()
}
