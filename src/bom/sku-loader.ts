/**
 * SKU Provider Loader
 * WP-BOMV1: Conditionally loads vendor providers based on feature flags
 */

import { registerProvider } from './sku-registry';
import { FS_PROVIDER } from './providers/fs-provider';

/**
 * Initialize SKU providers based on environment configuration
 */
export const initializeSkuProviders = (): void => {
  // GEN provider is always loaded by default in sku-registry
  
  // Check feature flag for vendor SKU support
  const vendorSkuEnabled = process.env.FEATURE_VENDOR_SKU === 'true' ||
                           process.env.REACT_APP_FEATURE_VENDOR_SKU === 'true';
  
  if (vendorSkuEnabled) {
    console.log('[SKU] Loading vendor providers...');
    
    // Register FS.COM provider
    registerProvider(FS_PROVIDER);
    console.log('[SKU] FS.COM provider registered');
    
    // Future: Add more vendor providers here
    // if (process.env.VENDOR_MELLANOX === 'true') {
    //   registerProvider(MELLANOX_PROVIDER);
    // }
    // if (process.env.VENDOR_DELL === 'true') {
    //   registerProvider(DELL_PROVIDER);
    // }
  } else {
    console.log('[SKU] Using GEN provider only (vendor SKUs disabled)');
  }
};

/**
 * Get current SKU configuration status
 */
export const getSkuConfiguration = () => {
  return {
    vendorSkuEnabled: process.env.FEATURE_VENDOR_SKU === 'true' ||
                     process.env.REACT_APP_FEATURE_VENDOR_SKU === 'true',
    providers: {
      gen: true,
      fs: process.env.FEATURE_VENDOR_SKU === 'true',
      mellanox: false, // Future
      dell: false,     // Future
    }
  };
};