/**
 * FS.COM Vendor SKU Provider
 * WP-BOMV1: Real vendor pricing for FS.COM components
 * Only loaded when FEATURE_VENDOR_SKU=true
 */

import { SkuProvider } from '../sku-provider';

export const FS_PROVIDER: SkuProvider = {
  id: 'FS',
  priority: 100, // Higher than GEN (0)
  
  match: ({ role, speedGbps, form, breakout }) => {
    // FS.COM Optics Catalog
    if (role === 'optic') {
      // 100G Optics
      if (form === 'QSFP28' && speedGbps === 100) {
        return { 
          sku: 'FS-QSFP28-100G-SR4', 
          desc: 'FS 100G QSFP28 SR4 850nm 100m', 
          unitPrice: 129.00,
          uom: 'ea',
          meta: { 
            vendor: 'FS.COM',
            wavelength: '850nm',
            reach: '100m',
            connector: 'MTP/MPO-12'
          }
        };
      }
      
      // 25G Optics
      if (form === 'SFP28' && speedGbps === 25) {
        return { 
          sku: 'FS-SFP28-25G-SR', 
          desc: 'FS 25G SFP28 SR 850nm 100m', 
          unitPrice: 29.00,
          uom: 'ea',
          meta: {
            vendor: 'FS.COM',
            wavelength: '850nm',
            reach: '100m',
            connector: 'LC Duplex'
          }
        };
      }
      
      // 400G Optics
      if (form === 'QSFP-DD' && speedGbps === 400) {
        return {
          sku: 'FS-QSFP-DD-400G-SR8',
          desc: 'FS 400G QSFP-DD SR8 850nm 100m',
          unitPrice: 699.00,
          uom: 'ea',
          meta: {
            vendor: 'FS.COM',
            wavelength: '850nm',
            reach: '100m',
            connector: 'MTP/MPO-16'
          }
        };
      }
    }
    
    // FS.COM DAC Cables
    if (role === 'cable') {
      // 100G to 4x25G Breakout
      if (breakout === '4x' && speedGbps === 100) {
        return { 
          sku: 'FS-DAC-QSFP28-4xSFP28-1m', 
          desc: 'FS 100G QSFP28 to 4x25G SFP28 DAC 1m', 
          unitPrice: 59.00,
          uom: 'ea',
          meta: {
            vendor: 'FS.COM',
            length: '1m',
            type: 'Passive DAC',
            awg: '30'
          }
        };
      }
      
      // 100G Direct Attach
      if (breakout === '1x' && speedGbps === 100) {
        return {
          sku: 'FS-DAC-QSFP28-100G-1m',
          desc: 'FS 100G QSFP28 DAC 1m',
          unitPrice: 45.00,
          uom: 'ea',
          meta: {
            vendor: 'FS.COM',
            length: '1m',
            type: 'Passive DAC',
            awg: '30'
          }
        };
      }
      
      // 400G to 4x100G Breakout
      if (breakout === '4x' && speedGbps === 400) {
        return {
          sku: 'FS-DAC-QSFP-DD-4xQSFP28-1m',
          desc: 'FS 400G QSFP-DD to 4x100G QSFP28 DAC 1m',
          unitPrice: 199.00,
          uom: 'ea',
          meta: {
            vendor: 'FS.COM',
            length: '1m',
            type: 'Passive DAC',
            awg: '26'
          }
        };
      }
    }
    
    // FS doesn't provide switches, fall back to GEN
    return null;
  }
};