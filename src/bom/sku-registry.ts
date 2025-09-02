/**
 * SKU Registry - Chain of Responsibility for SKU Resolution
 * WP-BOMV1: Manages provider registration and SKU lookup
 */

import { SkuProvider, Sku, SkuMatchInput, GEN_PROVIDER } from './sku-provider';

// Active provider registry
const providers: SkuProvider[] = [GEN_PROVIDER];

/**
 * Register a new SKU provider
 * Higher priority providers override lower priority ones
 */
export const registerProvider = (provider: SkuProvider): void => {
  // Check for duplicate IDs
  const existing = providers.findIndex(p => p.id === provider.id);
  if (existing >= 0) {
    providers[existing] = provider; // Replace existing
  } else {
    providers.push(provider);
  }
  
  // Keep sorted by priority (descending)
  providers.sort((a, b) => b.priority - a.priority);
};

/**
 * Resolve SKU using chain of providers
 * Returns first match from highest priority provider
 */
export const resolveSku = (input: SkuMatchInput): Sku => {
  // Try each provider in priority order
  for (const provider of providers) {
    const sku = provider.match(input);
    if (sku) {
      return { ...sku, meta: { ...sku.meta, providerId: provider.id } };
    }
  }
  
  // Guaranteed fallback from GEN provider
  return GEN_PROVIDER.match(input)!;
};

/**
 * Get all registered providers
 */
export const getProviders = (): ReadonlyArray<SkuProvider> => {
  return [...providers];
};

/**
 * Clear all providers except GEN (for testing)
 */
export const resetProviders = (): void => {
  providers.length = 0;
  providers.push(GEN_PROVIDER);
};

/**
 * Check if a specific provider is registered
 */
export const hasProvider = (id: string): boolean => {
  return providers.some(p => p.id === id);
};

/**
 * Get provider by ID
 */
export const getProvider = (id: string): SkuProvider | undefined => {
  return providers.find(p => p.id === id);
};