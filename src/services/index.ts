/**
 * HNC Services Index
 * Central export point for all service modules
 */

export { default as catalogService, CatalogService } from './catalog.service.js';

// Re-export catalog types for convenience
export type {
  CatalogData,
  SwitchModel,
  SwitchType,
  SwitchPort,
  PortSpeed,
  CatalogService as ICatalogService,
} from '../types/catalog.types.js';

export {
  CatalogError,
  ModelNotFoundError,
} from '../types/catalog.types.js';