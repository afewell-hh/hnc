/**
 * HNC Catalog Service - Manages switch model catalog data
 */
import fs from 'fs/promises';
import path from 'path';
import { CatalogError, ModelNotFoundError, } from '../types/catalog.types.js';
class CatalogServiceImpl {
    catalogCache = null;
    catalogPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../fixtures/catalog.json');
    async loadCatalog() {
        if (this.catalogCache)
            return this.catalogCache;
        try {
            const fileContent = await fs.readFile(this.catalogPath, 'utf-8');
            const catalogData = JSON.parse(fileContent);
            if (!catalogData.switches?.length || !catalogData.version) {
                throw new CatalogError('Invalid catalog format', 'INVALID_FORMAT');
            }
            this.catalogCache = catalogData;
            return catalogData;
        }
        catch (error) {
            if (error instanceof CatalogError)
                throw error;
            if (error.code === 'ENOENT') {
                throw new CatalogError(`Catalog file not found: ${this.catalogPath}`, 'FILE_NOT_FOUND');
            }
            throw new CatalogError('Failed to load catalog', 'LOAD_ERROR', error);
        }
    }
    async getSwitchModel(id) {
        if (!id || typeof id !== 'string') {
            throw new CatalogError('Invalid model ID: must be non-empty string', 'INVALID_MODEL_ID');
        }
        const catalog = await this.loadCatalog();
        return catalog.switches.find(switch_ => switch_.id === id) ?? null;
    }
    async validateModelId(id) {
        try {
            const model = await this.getSwitchModel(id);
            return model !== null;
        }
        catch (error) {
            if (error instanceof CatalogError && error.code === 'INVALID_MODEL_ID')
                return false;
            throw error;
        }
    }
    async getAllSwitchModels() {
        const catalog = await this.loadCatalog();
        return catalog.switches;
    }
    async getSwitchesByType(type) {
        const catalog = await this.loadCatalog();
        return catalog.switches.filter(switch_ => switch_.type === type);
    }
    clearCache() {
        this.catalogCache = null;
    }
    async getSwitchModelOrThrow(id) {
        const model = await this.getSwitchModel(id);
        if (!model)
            throw new ModelNotFoundError(id);
        return model;
    }
}
// Singleton instance for application use
const catalogService = new CatalogServiceImpl();
// Export the singleton instance and the class for testing
export default catalogService;
export { CatalogServiceImpl as CatalogService };
export { CatalogError, ModelNotFoundError, } from '../types/catalog.types.js';
