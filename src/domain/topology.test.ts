import { describe, it, expect } from 'vitest'
import { computeDerived } from './topology'
import type { FabricSpec, LeafClass } from '../app.types'

describe('MC-LAG Validation', () => {
  const baseSpec: FabricSpec = {
    name: 'test-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000'
  }

  const createLeafClass = (id: string, count: number, mcLag?: boolean): LeafClass => ({
    id,
    name: `${id}-class`,
    role: 'standard',
    uplinksPerLeaf: 4,
    endpointProfiles: [
      { name: 'server', portsPerEndpoint: 1, count: count * 20 }
    ],
    count,
    mcLag
  })

  describe('Valid MC-LAG Scenarios', () => {
    it('should pass validation for even leaf count >= 2 with MC-LAG enabled', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 4, true), // 4 leaves - valid
          createLeafClass('class-b', 6, true)  // 6 leaves - valid
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(true)
      expect(result.guards).toHaveLength(0)
      expect(result.validationErrors).not.toContain(expect.stringMatching(/MC-LAG/))
    })

    it('should pass validation for 2 leaves with MC-LAG enabled', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 2, true) // 2 leaves - minimum valid
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(true)
      expect(result.guards).toHaveLength(0)
    })

    it('should pass validation when MC-LAG is disabled regardless of leaf count', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 3, false), // 3 leaves - would be invalid with MC-LAG
          createLeafClass('class-b', 1, false)  // 1 leaf - would be invalid with MC-LAG
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toHaveLength(0)
      // May still be invalid for other reasons, but no MC-LAG guards
    })

    it('should pass validation when MC-LAG is undefined (defaults to false)', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 3) // mcLag undefined, defaults to false
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toHaveLength(0)
    })
  })

  describe('Invalid MC-LAG Scenarios', () => {
    it('should fail validation for odd leaf count with MC-LAG enabled', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 3, true) // 3 leaves - invalid for MC-LAG
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(1)
      expect(result.guards[0]).toEqual({
        guardType: 'MC_LAG_ODD_LEAF_COUNT',
        message: "MC-LAG requires even leaf count >= 2, but class 'class-a' has 3 leaves",
        details: {
          classId: 'class-a',
          leafCount: 3,
          mcLagEnabled: true
        }
      })
    })

    it('should fail validation for 1 leaf with MC-LAG enabled', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 1, true) // 1 leaf - insufficient for MC-LAG
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(1)
      expect(result.guards[0]).toEqual({
        guardType: 'MC_LAG_ODD_LEAF_COUNT',
        message: "MC-LAG requires even leaf count >= 2, but class 'class-a' has 1 leaves",
        details: {
          classId: 'class-a',
          leafCount: 1,
          mcLagEnabled: true
        }
      })
    })

    it('should fail validation for 0 leaves with MC-LAG enabled', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          {
            id: 'class-a',
            name: 'class-a-name',
            role: 'standard',
            uplinksPerLeaf: 4,
            endpointProfiles: [],
            count: 0,
            mcLag: true
          }
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(1)
      expect(result.guards[0]).toEqual({
        guardType: 'MC_LAG_ODD_LEAF_COUNT',
        message: "MC-LAG requires even leaf count >= 2, but class 'class-a' has 0 leaves",
        details: {
          classId: 'class-a',
          leafCount: 0,
          mcLagEnabled: true
        }
      })
    })

    it('should generate multiple MC-LAG violations for multiple invalid classes', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('class-a', 1, true), // 1 leaf - invalid
          createLeafClass('class-b', 2, true), // 2 leaves - valid
          createLeafClass('class-c', 5, true)  // 5 leaves - invalid
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(2)
      
      // Check first violation
      expect(result.guards[0]).toEqual({
        guardType: 'MC_LAG_ODD_LEAF_COUNT',
        message: "MC-LAG requires even leaf count >= 2, but class 'class-a' has 1 leaves",
        details: {
          classId: 'class-a',
          leafCount: 1,
          mcLagEnabled: true
        }
      })
      
      // Check second violation
      expect(result.guards[1]).toEqual({
        guardType: 'MC_LAG_ODD_LEAF_COUNT',
        message: "MC-LAG requires even leaf count >= 2, but class 'class-c' has 5 leaves",
        details: {
          classId: 'class-c',
          leafCount: 5,
          mcLagEnabled: true
        }
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle mixed MC-LAG and non-MC-LAG classes correctly', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          createLeafClass('mclag-valid', 4, true),    // Valid MC-LAG
          createLeafClass('mclag-invalid', 3, true),  // Invalid MC-LAG
          createLeafClass('no-mclag-odd', 3, false),  // No MC-LAG, odd count - should be fine
          createLeafClass('no-mclag-even', 4)         // No MC-LAG (undefined), even count
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(1) // Only one MC-LAG violation
      expect((result.guards[0].details as any).classId).toBe('mclag-invalid')
    })

    it('should validate computed leaf count when count is not explicitly provided', () => {
      const spec: FabricSpec = {
        ...baseSpec,
        leafClasses: [
          {
            id: 'computed-class',
            name: 'computed-class-name',
            role: 'standard',
            uplinksPerLeaf: 4,
            endpointProfiles: [
              { name: 'server', portsPerEndpoint: 1, count: 132 } // This should compute to 3 leaves (132 / 44 downlinks per leaf)
            ],
            mcLag: true
            // count not provided - will be computed
          }
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.isValid).toBe(false)
      expect(result.guards).toHaveLength(1)
      expect((result.guards[0].details as any).leafCount).toBe(3) // Computed odd count
      expect((result.guards[0].details as any).classId).toBe('computed-class')
    })

    it('should validate that guards do not affect legacy single-class mode', () => {
      const legacySpec: FabricSpec = {
        ...baseSpec,
        uplinksPerLeaf: 4,
        endpointCount: 100,
        endpointProfile: { name: 'server', portsPerEndpoint: 1 }
        // No leafClasses - should use legacy mode
      }

      const result = computeDerived(legacySpec)
      
      expect(result.guards).toHaveLength(0) // Legacy mode should have empty guards array
      expect(result.guards).toBeDefined()
    })
  })
})

describe('Topology Computation Integration', () => {
  it('should maintain backwards compatibility with existing validation', () => {
    const spec: FabricSpec = {
      name: 'integration-test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      leafClasses: [
        {
          id: 'class-a',
          name: 'class-a-name',
          role: 'standard',
          uplinksPerLeaf: 50, // Too many uplinks - should trigger existing validation
          endpointProfiles: [
            { name: 'server', portsPerEndpoint: 1, count: 100 }
          ],
          count: 3,
          mcLag: true // Also invalid for MC-LAG
        }
      ]
    }

    const result = computeDerived(spec)
    
    // Should have both traditional validation errors AND guards
    expect(result.isValid).toBe(false)
    expect(result.validationErrors.length).toBeGreaterThan(0)
    expect(result.guards).toHaveLength(1)
    expect(result.guards[0].guardType).toBe('MC_LAG_ODD_LEAF_COUNT')
  })
})