/**
 * HNC Catalog Types
 * Type definitions for switch models and catalog data
 */
export class CatalogError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CatalogError';
    }
}
export class ModelNotFoundError extends CatalogError {
    constructor(modelId) {
        super(`Switch model not found: ${modelId}`, 'MODEL_NOT_FOUND', { modelId });
    }
}
