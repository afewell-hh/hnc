/**
 * SKU Provider Interface for Vendor Catalog Support
 * WP-BOMV1: Feature-flagged vendor SKU overlays
 */

export type Sku = {
  sku: string;
  desc: string;
  unitPrice: number;
  uom?: string;
  meta?: Record<string, any>;
};

export type SkuMatchInput = {
  role: 'spine' | 'leaf' | 'border' | 'endpoint' | 'optic' | 'cable';
  speedGbps?: number;
  form?: 'SFP28' | 'QSFP28' | 'QSFP-DD' | 'RJ45';
  breakout?: '1x' | '2x' | '4x' | '8x';
  vendorHint?: string;
};

export interface SkuProvider {
  /** Unique provider identifier */
  id: string; // 'GEN' | 'FS' | 'Mellanox' | 'Dell' ...
  
  /** Priority for conflict resolution (higher wins) */
  priority: number;
  
  /** Attempt to match SKU based on input criteria */
  match(input: SkuMatchInput): Sku | null;
}

/**
 * Default GEN provider for baseline SKUs
 * Always available as fallback
 */
export const GEN_PROVIDER: SkuProvider = {
  id: 'GEN',
  priority: 0, // Lowest priority (fallback)
  match: ({ role, speedGbps, form, breakout }) => {
    // Spine switches
    if (role === 'spine') {
      return { 
        sku: 'GEN-SPINE-32x400G', 
        desc: 'Generic Spine Switch 32x400G', 
        unitPrice: 45000 
      };
    }
    
    // Leaf switches
    if (role === 'leaf') {
      return { 
        sku: 'GEN-LEAF-48x100G', 
        desc: 'Generic Leaf Switch 48x100G', 
        unitPrice: 25000 
      };
    }
    
    // Optics
    if (role === 'optic') {
      if (form === 'QSFP28' && speedGbps === 100) {
        return { 
          sku: 'GEN-QSFP28-100G', 
          desc: 'Generic 100G QSFP28', 
          unitPrice: 200 
        };
      }
      if (form === 'SFP28' && speedGbps === 25) {
        return { 
          sku: 'GEN-SFP28-25G', 
          desc: 'Generic 25G SFP28', 
          unitPrice: 50 
        };
      }
      if (form === 'QSFP-DD' && speedGbps === 400) {
        return { 
          sku: 'GEN-QSFP-DD-400G', 
          desc: 'Generic 400G QSFP-DD', 
          unitPrice: 800 
        };
      }
    }
    
    // Cables
    if (role === 'cable') {
      if (breakout === '4x' && speedGbps === 100) {
        return { 
          sku: 'GEN-DAC-100G-4x25G', 
          desc: 'Generic 100G→4×25G DAC', 
          unitPrice: 100 
        };
      }
      if (breakout === '1x' && speedGbps === 100) {
        return { 
          sku: 'GEN-DAC-100G', 
          desc: 'Generic 100G DAC', 
          unitPrice: 75 
        };
      }
    }
    
    // Default fallback
    return {
      sku: `GEN-${role.toUpperCase()}-UNKNOWN`,
      desc: `Generic ${role}`,
      unitPrice: 0,
      meta: { needsQuote: true }
    };
  }
};