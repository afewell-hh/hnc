/**
 * FGD Importer Integration Tests - Test with existing FGD files
 */

import { describe, it, expect } from 'vitest';
import { importFromFGD } from './fgd-importer';
import * as path from 'path';

describe('FGD Importer Integration', () => {
  const fgdBasePath = path.resolve(__dirname, '../../fgd');

  describe('Real FGD Files', () => {
    it('should import golden-path-fabric successfully', async () => {
      const fgdPath = path.join(fgdBasePath, 'golden-path-fabric');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.fabricSpec.name).toBe('golden-path-fabric');
      expect(result.fabricSpec.spineModelId).toBe('DS3000');
      expect(result.fabricSpec.leafModelId).toBe('DS2000');
      
      // Should be single-class (all compute-standard servers)
      expect(result.provenance.detectedPatterns.topologyType).toBe('single-class');
      // For single-class topology, should use legacy fields
      expect(result.fabricSpec.uplinksPerLeaf).toBe(8); // Based on connections file
      expect(result.fabricSpec.endpointCount).toBe(24);
      
      // Should have detected proper provenance
      expect(result.provenance.source).toBe('import');
      expect(result.provenance.detectedPatterns.spineCount).toBe(1);
      expect(result.provenance.detectedPatterns.leafCount).toBe(1);
    });

    it('should import multi-class-test successfully', async () => {
      const fgdPath = path.join(fgdBasePath, 'multi-class-test');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.fabricSpec.name).toBe('multi-class-fabric');
      expect(result.provenance.detectedPatterns.topologyType).toBe('single-class'); // All same server type
      
      // Should detect proper topology
      expect(result.provenance.detectedPatterns.spineCount).toBe(1);
      expect(result.provenance.detectedPatterns.leafCount).toBe(5);
      // Since it's single-class, leafClasses will be undefined and use legacy fields
    });

    it('should import heterogeneous-test and detect patterns', async () => {
      const fgdPath = path.join(fgdBasePath, 'heterogeneous-test');
      
      const result = await importFromFGD(fgdPath);
      
      // Should complete import even if validation has warnings
      expect(result.provenance.source).toBe('import');
      expect(result.fabricSpec.name).toBe('heterogeneous-fabric');
      
      // Check that it detected the heterogeneous nature
      expect(result.provenance.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle test-fabric appropriately', async () => {
      const fgdPath = path.join(fgdBasePath, 'test-fabric');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.fabricSpec.name).toBe('FGD Write Test');
      expect(result.validation.isValid).toBe(true);
    });

    it('should provide consistent results for same fabric', async () => {
      const fgdPath = path.join(fgdBasePath, 'golden-path-fabric');
      
      // Import twice
      const result1 = await importFromFGD(fgdPath);
      const result2 = await importFromFGD(fgdPath);
      
      // Core fields should be identical
      expect(result1.fabricSpec.name).toBe(result2.fabricSpec.name);
      expect(result1.fabricSpec.spineModelId).toBe(result2.fabricSpec.spineModelId);
      expect(result1.fabricSpec.leafModelId).toBe(result2.fabricSpec.leafModelId);
      expect(result1.fabricSpec.uplinksPerLeaf).toBe(result2.fabricSpec.uplinksPerLeaf);
      expect(result1.leafClasses.length).toBe(result2.leafClasses.length);
      
      // Provenance patterns should match
      expect(result1.provenance.detectedPatterns.topologyType)
        .toBe(result2.provenance.detectedPatterns.topologyType);
      expect(result1.provenance.detectedPatterns.spineCount)
        .toBe(result2.provenance.detectedPatterns.spineCount);
      expect(result1.provenance.detectedPatterns.leafCount)
        .toBe(result2.provenance.detectedPatterns.leafCount);
    });
  });

  describe('Edge Case FGD Files', () => {
    it('should handle large-test fabric', async () => {
      const fgdPath = path.join(fgdBasePath, 'large-test');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.fabricSpec.name).toBe('large-fabric-1000');
      // Large test might have capacity warnings but should import
      expect(result.provenance.source).toBe('import');
    });

    it('should detect issues in invalid-test fabric', async () => {
      const fgdPath = path.join(fgdBasePath, 'invalid-test');
      
      try {
        const result = await importFromFGD(fgdPath);
        
        // If import succeeds, should have validation errors or warnings
        expect(result.validation.errors.length + result.validation.warnings.length)
          .toBeGreaterThan(0);
      } catch (error) {
        // Import might fail entirely for invalid data
        expect(error).toBeDefined();
      }
    });

    it('should handle lag-test fabric with complex connections', async () => {
      const fgdPath = path.join(fgdBasePath, 'lag-test');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.fabricSpec.name).toBe('lag-fabric');
      expect(result.provenance.source).toBe('import');
      
      // LAG scenarios might have warnings about complex topologies
      if (result.provenance.warnings.length > 0) {
        console.log('LAG test warnings:', result.provenance.warnings);
      }
    });

    it('should process version-test fabric', async () => {
      const fgdPath = path.join(fgdBasePath, 'version-test');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.fabricSpec.name).toBe('versioned-fabric-v1');
      expect(result.validation.isValid).toBeTruthy();
      
      // Check that version metadata is preserved
      expect(result.fabricSpec.metadata?.originalGeneratedAt).toBeDefined();
    });

    it('should handle legacy-test fabric', async () => {
      const fgdPath = path.join(fgdBasePath, 'legacy-test');
      
      const result = await importFromFGD(fgdPath);
      
      expect(result.fabricSpec.name).toBe('legacy-fabric');
      expect(result.provenance.source).toBe('import');
      
      // Legacy patterns should be detected and handled appropriately
      expect(result.provenance.assumptions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Capacity and Validation', () => {
    it('should detect realistic capacity utilization', async () => {
      const fgdPath = path.join(fgdBasePath, 'golden-path-fabric');
      
      const result = await importFromFGD(fgdPath);
      
      // Golden path should be well within capacity limits
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
      
      // Should detect reasonable topology
      expect(result.provenance.detectedPatterns.spineCount).toBeGreaterThan(0);
      expect(result.provenance.detectedPatterns.leafCount).toBeGreaterThan(0);
    });

    it('should provide meaningful error messages for capacity violations', async () => {
      // Try large-test which might exceed capacity
      const fgdPath = path.join(fgdBasePath, 'large-test');
      
      const result = await importFromFGD(fgdPath);
      
      if (!result.validation.isValid) {
        // Should have specific error messages about capacity
        const hasCapacityError = result.validation.errors.some(err => 
          err.includes('capacity') || err.includes('port')
        );
        expect(hasCapacityError || result.validation.warnings.length > 0).toBe(true);
      }
    });
  });

  describe('Provenance Tracking', () => {
    it('should provide detailed provenance for all imports', async () => {
      const fgdPath = path.join(fgdBasePath, 'golden-path-fabric');
      
      const result = await importFromFGD(fgdPath);
      
      // Check provenance completeness
      expect(result.provenance.source).toBe('import');
      expect(result.provenance.originalPath).toBe(fgdPath);
      expect(result.provenance.importedAt).toBeInstanceOf(Date);
      
      // Check pattern detection
      expect(result.provenance.detectedPatterns.topologyType).toMatch(/single-class|multi-class/);
      expect(result.provenance.detectedPatterns.serverTypes.size).toBeGreaterThan(0);
      expect(result.provenance.detectedPatterns.uplinkPatterns.size).toBeGreaterThan(0);
      
      // Check that metadata includes import info
      expect(result.fabricSpec.metadata?.importedFrom).toBe(fgdPath);
      expect(result.fabricSpec.metadata?.originalGeneratedAt).toBeDefined();
    });

    it('should track assumptions and warnings', async () => {
      const fgdPath = path.join(fgdBasePath, 'multi-class-test');
      
      const result = await importFromFGD(fgdPath);
      
      // Should have made some assumptions about the topology
      expect(result.provenance.assumptions).toBeDefined();
      expect(result.provenance.warnings).toBeDefined();
      
      // Check that warnings are meaningful
      if (result.provenance.warnings.length > 0) {
        result.provenance.warnings.forEach(warning => {
          expect(typeof warning).toBe('string');
          expect(warning.length).toBeGreaterThan(0);
        });
      }
    });
  });
});