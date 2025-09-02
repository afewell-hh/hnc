/**
 * SKU Catalog Service - WP-BOM2
 * Service for looking up SKUs, calculating pricing, and managing hardware catalogs
 */

// Import the SKU catalog
import skuCatalog from './sku.json'

export interface SKUDetails {
  sku: string
  description: string
  price: number
  category: 'switch' | 'transceiver' | 'breakout' | 'cable'
  specifications?: Record<string, any>
}

export interface PricingSummary {
  subtotal: number
  totalItems: number
  categories: Record<string, { items: number; cost: number }>
  estimatedShipping?: number
  estimatedTax?: number
  grandTotal?: number
}

/**
 * SKU Service for hardware catalog operations
 */
export class SKUService {
  /**
   * Get transceiver SKU based on speed and medium preference
   */
  static getTransceiverSKU(speed: string, reach?: string, medium: 'fiber' | 'dac' | 'aoc' = 'dac'): string {
    const transceivers = skuCatalog.transceivers
    
    // Priority order: DAC (short reach), SR (medium reach), LR (long reach)
    const candidates = Object.entries(transceivers)
      .filter(([_, spec]) => spec.speed === speed)
      .map(([sku, spec]) => ({ sku, spec }))

    if (candidates.length === 0) {
      throw new Error(`No transceiver found for speed ${speed}`)
    }

    // If reach is specified, try to match it
    if (reach) {
      const reachMatch = candidates.find(c => c.spec.reach === reach)
      if (reachMatch) return reachMatch.sku
    }

    // Medium preference matching
    const mediumMatch = candidates.find(c => c.spec.medium === medium)
    if (mediumMatch) return mediumMatch.sku

    // Default to first available (typically DAC for cost effectiveness)
    const defaultMatch = candidates.find(c => c.spec.medium === 'dac') || candidates[0]
    return defaultMatch.sku
  }

  /**
   * Get breakout cable SKU based on parent/child speeds and counts
   */
  static getBreakoutSKU(parentSpeed: string, childSpeed: string, childCount: number, medium: 'dac' | 'aoc' = 'dac'): string {
    const breakouts = skuCatalog.breakouts
    
    const candidates = Object.entries(breakouts)
      .filter(([_, spec]) => 
        spec.parentSpeed === parentSpeed && 
        spec.childSpeed === childSpeed && 
        spec.childCount === childCount
      )
      .map(([sku, spec]) => ({ sku, spec }))

    if (candidates.length === 0) {
      throw new Error(`No breakout cable found for ${parentSpeed} to ${childCount}x${childSpeed}`)
    }

    // Prefer specified medium
    const mediumMatch = candidates.find(c => c.spec.medium === medium)
    if (mediumMatch) return mediumMatch.sku

    // Default to DAC (cost effective for short reach)
    const defaultMatch = candidates.find(c => c.spec.medium === 'dac') || candidates[0]
    return defaultMatch.sku
  }

  /**
   * Get switch SKU by model ID
   */
  static getSwitchSKU(modelId: string): string {
    const switches = skuCatalog.switches
    const switchSku = Object.keys(switches).find(sku => 
      sku.includes(modelId) || switches[sku as keyof typeof switches].description.includes(modelId)
    )
    
    if (!switchSku) {
      // Generate fallback SKU for unknown models
      return `GEN-${modelId.toUpperCase()}-SWITCH`
    }
    
    return switchSku
  }

  /**
   * Get detailed information for a SKU
   */
  static getSKUDetails(sku: string): SKUDetails {
    // Search in all categories
    const allItems = {
      ...skuCatalog.switches,
      ...skuCatalog.transceivers,
      ...skuCatalog.breakouts,
      ...skuCatalog.cables
    }

    const item = allItems[sku as keyof typeof allItems]
    if (!item) {
      // Return fallback for unknown SKUs
      return {
        sku,
        description: `Unknown SKU: ${sku}`,
        price: 0,
        category: 'switch',
        specifications: {}
      }
    }

    return {
      sku,
      description: item.description,
      price: item.price,
      category: item.category as any,
      specifications: { ...item }
    }
  }

  /**
   * Calculate pricing summary for BOM items
   */
  static calculatePricing(items: Array<{ sku: string; quantity: number }>): PricingSummary {
    let subtotal = 0
    let totalItems = 0
    const categories: Record<string, { items: number; cost: number }> = {}

    for (const item of items) {
      const details = this.getSKUDetails(item.sku)
      const itemTotal = details.price * item.quantity

      subtotal += itemTotal
      totalItems += item.quantity

      if (!categories[details.category]) {
        categories[details.category] = { items: 0, cost: 0 }
      }
      categories[details.category].items += item.quantity
      categories[details.category].cost += itemTotal
    }

    // Estimate shipping (5% of subtotal, min $50)
    const estimatedShipping = Math.max(subtotal * 0.05, 50)
    
    // Estimate tax (8.5% - typical enterprise rate)
    const estimatedTax = subtotal * 0.085
    
    const grandTotal = subtotal + estimatedShipping + estimatedTax

    return {
      subtotal,
      totalItems,
      categories,
      estimatedShipping,
      estimatedTax, 
      grandTotal
    }
  }

  /**
   * Get all available transceivers for a speed
   */
  static getAvailableTransceivers(speed: string): Array<{ sku: string; details: SKUDetails }> {
    const transceivers = skuCatalog.transceivers
    
    return Object.entries(transceivers)
      .filter(([_, spec]) => spec.speed === speed)
      .map(([sku, _]) => ({
        sku,
        details: this.getSKUDetails(sku)
      }))
  }

  /**
   * Get available breakout options for a parent speed
   */
  static getAvailableBreakouts(parentSpeed: string): Array<{ sku: string; details: SKUDetails; pattern: string }> {
    const breakouts = skuCatalog.breakouts
    
    return Object.entries(breakouts)
      .filter(([_, spec]) => spec.parentSpeed === parentSpeed)
      .map(([sku, spec]) => ({
        sku,
        details: this.getSKUDetails(sku),
        pattern: `${spec.childCount}x${spec.childSpeed}`
      }))
  }

  /**
   * Validate that a SKU exists in the catalog
   */
  static validateSKU(sku: string): boolean {
    const allItems = {
      ...skuCatalog.switches,
      ...skuCatalog.transceivers, 
      ...skuCatalog.breakouts,
      ...skuCatalog.cables
    }

    return sku in allItems
  }

  /**
   * Get catalog metadata
   */
  static getCatalogInfo() {
    return skuCatalog.metadata
  }

  /**
   * Search SKUs by description or category
   */
  static searchSKUs(query: string, category?: string): Array<{ sku: string; details: SKUDetails }> {
    const allItems = {
      ...skuCatalog.switches,
      ...skuCatalog.transceivers,
      ...skuCatalog.breakouts,
      ...skuCatalog.cables
    }

    const results = Object.entries(allItems)
      .filter(([sku, item]) => {
        const matchesQuery = sku.toLowerCase().includes(query.toLowerCase()) || 
                           item.description.toLowerCase().includes(query.toLowerCase())
        const matchesCategory = !category || item.category === category
        return matchesQuery && matchesCategory
      })
      .map(([sku, _]) => ({
        sku,
        details: this.getSKUDetails(sku)
      }))

    return results.sort((a, b) => a.sku.localeCompare(b.sku))
  }
}

/**
 * Default medium selection based on distance and cost optimization
 */
export function getOptimalMedium(distance?: string): 'fiber' | 'dac' | 'aoc' {
  if (!distance) return 'dac' // Default to cost-effective DAC
  
  const distanceValue = parseFloat(distance.replace(/[^0-9.]/g, ''))
  const unit = distance.toLowerCase()

  if (unit.includes('km')) {
    return 'fiber' // Long reach always fiber
  }

  if (unit.includes('m')) {
    if (distanceValue <= 5) return 'dac'      // Short reach - DAC
    if (distanceValue <= 100) return 'aoc'    // Medium reach - AOC
    return 'fiber'                            // Long reach - Fiber
  }

  return 'dac' // Default fallback
}

/**
 * Export utilities for easy access
 */
export default SKUService