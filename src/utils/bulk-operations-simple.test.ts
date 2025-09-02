// Simple Bulk Operations Test - WP-BULK1
import { describe, it, expect } from 'vitest'
import { applyRenamingPattern } from './bulk-operations'
import { RenamingPattern } from '../types/bulk-operations'

describe('Bulk Operations - Basic Tests', () => {
  describe('applyRenamingPattern', () => {
    it('should apply regex patterns correctly', () => {
      const pattern: RenamingPattern = {
        id: 'test',
        name: 'Test',
        type: 'regex',
        pattern: '^server-(.+)$',
        replacement: 'srv-$1',
        target: 'devices'
      }
      
      expect(applyRenamingPattern('server-web01', pattern)).toBe('srv-web01')
      expect(applyRenamingPattern('server-db02', pattern)).toBe('srv-db02')
      expect(applyRenamingPattern('leaf-switch01', pattern)).toBe('leaf-switch01') // no match
    })

    it('should apply prefix patterns correctly', () => {
      const pattern: RenamingPattern = {
        id: 'test',
        name: 'Test',
        type: 'prefix',
        pattern: '',
        replacement: 'prod-',
        target: 'devices'
      }
      
      expect(applyRenamingPattern('web01', pattern)).toBe('prod-web01')
      expect(applyRenamingPattern('database', pattern)).toBe('prod-database')
    })
  })
})