/**
 * SKU Provider Tests
 * WP-BOMV1: Validate vendor overlay functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  resolveSku, 
  registerProvider, 
  resetProviders, 
  hasProvider,
  getProviders 
} from './sku-registry';
import { GEN_PROVIDER, SkuProvider } from './sku-provider';
import { FS_PROVIDER } from './providers/fs-provider';

describe('SKU Provider System', () => {
  beforeEach(() => {
    resetProviders(); // Start with only GEN provider
  });

  describe('GEN Provider (Baseline)', () => {
    it('should resolve spine switches with GEN SKUs', () => {
      const sku = resolveSku({ role: 'spine' });
      expect(sku.sku).toBe('GEN-SPINE-32x400G');
      expect(sku.unitPrice).toBe(45000);
      expect(sku.meta?.providerId).toBe('GEN');
    });

    it('should resolve leaf switches with GEN SKUs', () => {
      const sku = resolveSku({ role: 'leaf' });
      expect(sku.sku).toBe('GEN-LEAF-48x100G');
      expect(sku.unitPrice).toBe(25000);
    });

    it('should resolve 100G optics with GEN SKUs', () => {
      const sku = resolveSku({ 
        role: 'optic',
        form: 'QSFP28',
        speedGbps: 100 
      });
      expect(sku.sku).toBe('GEN-QSFP28-100G');
      expect(sku.unitPrice).toBe(200);
    });

    it('should provide fallback for unknown components', () => {
      const sku = resolveSku({ role: 'border' });
      expect(sku.sku).toBe('GEN-BORDER-UNKNOWN');
      expect(sku.meta?.needsQuote).toBe(true);
    });
  });

  describe('Vendor Overlay (FS Provider)', () => {
    beforeEach(() => {
      registerProvider(FS_PROVIDER);
    });

    it('should override optics with FS SKUs when registered', () => {
      const sku = resolveSku({
        role: 'optic',
        form: 'QSFP28',
        speedGbps: 100
      });
      
      expect(sku.sku).toBe('FS-QSFP28-100G-SR4');
      expect(sku.unitPrice).toBe(129.00); // FS price, not GEN's 200
      expect(sku.meta?.vendor).toBe('FS.COM');
      expect(sku.meta?.providerId).toBe('FS');
    });

    it('should fall back to GEN for items FS doesn\'t provide', () => {
      const sku = resolveSku({ role: 'spine' });
      
      expect(sku.sku).toBe('GEN-SPINE-32x400G');
      expect(sku.meta?.providerId).toBe('GEN'); // Fallback to GEN
    });

    it('should resolve breakout cables with FS SKUs', () => {
      const sku = resolveSku({
        role: 'cable',
        breakout: '4x',
        speedGbps: 100
      });
      
      expect(sku.sku).toBe('FS-DAC-QSFP28-4xSFP28-1m');
      expect(sku.unitPrice).toBe(59.00);
      expect(sku.meta?.length).toBe('1m');
    });
  });

  describe('Priority Chain Resolution', () => {
    it('should respect provider priority ordering', () => {
      // Create a higher priority provider
      const customProvider: SkuProvider = {
        id: 'CUSTOM',
        priority: 200, // Higher than FS (100)
        match: ({ role }) => {
          if (role === 'optic') {
            return { 
              sku: 'CUSTOM-OPTIC', 
              desc: 'Custom Optic', 
              unitPrice: 999 
            };
          }
          return null;
        }
      };

      registerProvider(FS_PROVIDER);
      registerProvider(customProvider);

      const sku = resolveSku({
        role: 'optic',
        form: 'QSFP28',
        speedGbps: 100
      });

      expect(sku.sku).toBe('CUSTOM-OPTIC'); // Custom wins over FS
      expect(sku.meta?.providerId).toBe('CUSTOM');
    });

    it('should handle provider replacement by ID', () => {
      registerProvider(FS_PROVIDER);
      expect(hasProvider('FS')).toBe(true);

      // Replace with modified version
      const modifiedFS: SkuProvider = {
        ...FS_PROVIDER,
        priority: 50, // Lower priority
      };
      
      registerProvider(modifiedFS);
      
      const providers = getProviders();
      const fsProvider = providers.find(p => p.id === 'FS');
      expect(fsProvider?.priority).toBe(50);
    });
  });

  describe('Mixed Resolution Scenarios', () => {
    it('should handle complete BOM with mixed providers', () => {
      registerProvider(FS_PROVIDER);

      const bomItems = [
        { role: 'spine' as const },
        { role: 'leaf' as const },
        { role: 'optic' as const, form: 'QSFP28' as const, speedGbps: 100 },
        { role: 'optic' as const, form: 'SFP28' as const, speedGbps: 25 },
        { role: 'cable' as const, breakout: '4x' as const, speedGbps: 100 },
      ];

      const skus = bomItems.map(item => resolveSku(item));

      // Switches from GEN
      expect(skus[0].meta?.providerId).toBe('GEN');
      expect(skus[1].meta?.providerId).toBe('GEN');
      
      // Optics from FS
      expect(skus[2].meta?.providerId).toBe('FS');
      expect(skus[3].meta?.providerId).toBe('FS');
      
      // Cable from FS
      expect(skus[4].meta?.providerId).toBe('FS');
    });

    it('should calculate correct total with vendor pricing', () => {
      registerProvider(FS_PROVIDER);

      const items = [
        { input: { role: 'optic' as const, form: 'QSFP28' as const, speedGbps: 100 }, qty: 10 },
        { input: { role: 'optic' as const, form: 'SFP28' as const, speedGbps: 25 }, qty: 20 },
        { input: { role: 'cable' as const, breakout: '4x' as const, speedGbps: 100 }, qty: 5 },
      ];

      const total = items.reduce((sum, item) => {
        const sku = resolveSku(item.input);
        return sum + (sku.unitPrice * item.qty);
      }, 0);

      // 10 * 129 (FS 100G) + 20 * 29 (FS 25G) + 5 * 59 (FS cable)
      expect(total).toBe(1290 + 580 + 295);
      expect(total).toBe(2165);
    });
  });

  describe('Registry Management', () => {
    it('should track registered providers', () => {
      expect(hasProvider('GEN')).toBe(true);
      expect(hasProvider('FS')).toBe(false);

      registerProvider(FS_PROVIDER);
      
      expect(hasProvider('FS')).toBe(true);
      expect(getProviders()).toHaveLength(2);
    });

    it('should reset to baseline state', () => {
      registerProvider(FS_PROVIDER);
      expect(getProviders()).toHaveLength(2);

      resetProviders();
      
      expect(getProviders()).toHaveLength(1);
      expect(hasProvider('GEN')).toBe(true);
      expect(hasProvider('FS')).toBe(false);
    });
  });
});