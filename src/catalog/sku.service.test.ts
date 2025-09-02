/**
 * SKU Service Tests - WP-BOM2
 * Tests for SKU lookup, pricing, and catalog management
 */

import { describe, it, expect } from 'vitest'
import { SKUService, getOptimalMedium } from './sku.service'

describe('SKU Service', () => {
  describe('Transceiver SKU Selection', () => {
    it('should return appropriate transceiver for 25G speed', () => {
      const sku = SKUService.getTransceiverSKU('25G')
      expect(sku).toContain('25G')
      expect(sku).toContain('SFP28')
    })

    it('should return appropriate transceiver for 100G speed', () => {
      const sku = SKUService.getTransceiverSKU('100G')
      expect(sku).toContain('100G')
      expect(sku).toContain('QSFP28')
    })

    it('should return appropriate transceiver for 400G speed', () => {
      const sku = SKUService.getTransceiverSKU('400G')
      expect(sku).toContain('400G')
      expect(sku).toContain('QSFP-DD')
    })

    it('should prefer DAC for short reach by default', () => {
      const sku = SKUService.getTransceiverSKU('25G')
      expect(sku).toContain('DAC')
    })

    it('should use fiber for long reach when specified', () => {
      const sku = SKUService.getTransceiverSKU('100G', '10km', 'fiber')
      expect(sku).toContain('LR')
    })

    it('should throw error for unsupported speed', () => {
      expect(() => SKUService.getTransceiverSKU('1000G')).toThrow()
    })
  })

  describe('Breakout SKU Selection', () => {
    it('should return correct breakout SKU for 100G to 4x25G', () => {
      const sku = SKUService.getBreakoutSKU('100G', '25G', 4)
      expect(sku).toContain('QSFP28')
      expect(sku).toContain('4X25G')
    })

    it('should return correct breakout SKU for 400G to 4x100G', () => {
      const sku = SKUService.getBreakoutSKU('400G', '100G', 4)
      expect(sku).toContain('QSFP-DD')
      expect(sku).toContain('4X100G')
    })

    it('should prefer DAC for short reach breakouts', () => {
      const sku = SKUService.getBreakoutSKU('100G', '25G', 4, 'dac')
      expect(sku).toContain('DAC')
    })

    it('should use AOC for medium reach when specified', () => {
      const sku = SKUService.getBreakoutSKU('100G', '25G', 4, 'aoc')
      expect(sku).toContain('AOC')
    })

    it('should throw error for unsupported breakout pattern', () => {
      expect(() => SKUService.getBreakoutSKU('25G', '10G', 8)).toThrow()
    })
  })

  describe('Switch SKU Lookup', () => {
    it('should find SKU for known switch model', () => {
      const sku = SKUService.getSwitchSKU('DS2000')
      expect(sku).toContain('DS2000')
    })

    it('should find SKU for spine switch model', () => {
      const sku = SKUService.getSwitchSKU('DS3000')
      expect(sku).toContain('DS3000')
    })

    it('should generate fallback SKU for unknown model', () => {
      const sku = SKUService.getSwitchSKU('UNKNOWN-SWITCH')
      expect(sku).toContain('GEN-UNKNOWN-SWITCH-SWITCH')
    })
  })

  describe('SKU Details Lookup', () => {
    it('should return complete details for known SKU', () => {
      const details = SKUService.getSKUDetails('GEN-SFP28-25G-DAC')
      
      expect(details.sku).toBe('GEN-SFP28-25G-DAC')
      expect(details.description).toContain('25G')
      expect(details.price).toBeGreaterThan(0)
      expect(details.category).toBe('transceiver')
    })

    it('should return fallback for unknown SKU', () => {
      const details = SKUService.getSKUDetails('UNKNOWN-SKU')
      
      expect(details.sku).toBe('UNKNOWN-SKU')
      expect(details.description).toContain('Unknown SKU')
      expect(details.price).toBe(0)
    })

    it('should include specifications in details', () => {
      const details = SKUService.getSKUDetails('GEN-QSFP28-100G-SR4')
      
      expect(details.specifications).toBeDefined()
      expect(details.specifications?.speed).toBe('100G')
      expect(details.specifications?.form).toBe('QSFP28')
    })
  })

  describe('Pricing Calculations', () => {
    it('should calculate pricing for single item', () => {
      const items = [{ sku: 'GEN-SFP28-25G-DAC', quantity: 10 }]
      const pricing = SKUService.calculatePricing(items)
      
      expect(pricing.totalItems).toBe(10)
      expect(pricing.subtotal).toBeGreaterThan(0)
      expect(pricing.grandTotal).toBeGreaterThan(pricing.subtotal)
    })

    it('should calculate pricing for multiple items', () => {
      const items = [
        { sku: 'GEN-SFP28-25G-DAC', quantity: 5 },
        { sku: 'GEN-QSFP28-100G-SR4', quantity: 2 }
      ]
      const pricing = SKUService.calculatePricing(items)
      
      expect(pricing.totalItems).toBe(7)
      expect(pricing.categories.transceiver.items).toBe(7)
    })

    it('should include estimated shipping and tax', () => {
      const items = [{ sku: 'GEN-DS2000-48X25G', quantity: 1 }]
      const pricing = SKUService.calculatePricing(items)
      
      expect(pricing.estimatedShipping).toBeGreaterThan(0)
      expect(pricing.estimatedTax).toBeGreaterThan(0)
      expect(pricing.grandTotal).toBe(
        pricing.subtotal + pricing.estimatedShipping! + pricing.estimatedTax!
      )
    })

    it('should group items by category', () => {
      const items = [
        { sku: 'GEN-DS2000-48X25G', quantity: 1 },      // switch
        { sku: 'GEN-SFP28-25G-DAC', quantity: 10 },     // transceiver
        { sku: 'GEN-QSFP28-4X25G-DAC', quantity: 2 }    // breakout
      ]
      const pricing = SKUService.calculatePricing(items)
      
      expect(pricing.categories.switch).toBeDefined()
      expect(pricing.categories.transceiver).toBeDefined()
      expect(pricing.categories.breakout).toBeDefined()
      
      expect(pricing.categories.switch.items).toBe(1)
      expect(pricing.categories.transceiver.items).toBe(10)
      expect(pricing.categories.breakout.items).toBe(2)
    })
  })

  describe('Available Options Queries', () => {
    it('should return available transceivers for speed', () => {
      const transceivers = SKUService.getAvailableTransceivers('25G')
      
      expect(transceivers.length).toBeGreaterThan(0)
      transceivers.forEach(t => {
        expect(t.details.specifications?.speed).toBe('25G')
      })
    })

    it('should return available breakouts for parent speed', () => {
      const breakouts = SKUService.getAvailableBreakouts('100G')
      
      expect(breakouts.length).toBeGreaterThan(0)
      breakouts.forEach(b => {
        expect(b.details.specifications?.parentSpeed).toBe('100G')
        expect(b.pattern).toMatch(/\d+x\d+G/)
      })
    })
  })

  describe('SKU Validation', () => {
    it('should validate known SKUs', () => {
      expect(SKUService.validateSKU('GEN-SFP28-25G-DAC')).toBe(true)
      expect(SKUService.validateSKU('GEN-QSFP28-100G-SR4')).toBe(true)
      expect(SKUService.validateSKU('GEN-DS2000-48X25G')).toBe(true)
    })

    it('should reject unknown SKUs', () => {
      expect(SKUService.validateSKU('INVALID-SKU')).toBe(false)
      expect(SKUService.validateSKU('')).toBe(false)
    })
  })

  describe('Search Functionality', () => {
    it('should search by description', () => {
      const results = SKUService.searchSKUs('25G')
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        const matchesDescription = result.details.description.toLowerCase().includes('25g')
        const matchesSku = result.sku.toLowerCase().includes('25g')
        expect(matchesDescription || matchesSku).toBe(true)
      })
    })

    it('should search by category', () => {
      const results = SKUService.searchSKUs('', 'transceiver')
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.details.category).toBe('transceiver')
      })
    })

    it('should search by SKU partial match', () => {
      const results = SKUService.searchSKUs('SFP28')
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.sku).toContain('SFP28')
      })
    })
  })

  describe('Catalog Metadata', () => {
    it('should return catalog information', () => {
      const info = SKUService.getCatalogInfo()
      
      expect(info.version).toBeDefined()
      expect(info.description).toBeDefined()
      expect(info.currency).toBe('USD')
    })
  })
})

describe('Medium Optimization', () => {
  it('should default to DAC for short distances', () => {
    expect(getOptimalMedium('3m')).toBe('dac')
    expect(getOptimalMedium('1m')).toBe('dac')
  })

  it('should use AOC for medium distances', () => {
    expect(getOptimalMedium('10m')).toBe('aoc')
    expect(getOptimalMedium('50m')).toBe('aoc')
  })

  it('should use fiber for long distances', () => {
    expect(getOptimalMedium('1km')).toBe('fiber')
    expect(getOptimalMedium('10km')).toBe('fiber')
    expect(getOptimalMedium('200m')).toBe('fiber')
  })

  it('should default to DAC when no distance specified', () => {
    expect(getOptimalMedium()).toBe('dac')
    expect(getOptimalMedium('')).toBe('dac')
  })
})