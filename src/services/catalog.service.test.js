/**
 * Catalog Service Tests
 * Basic validation tests for catalog functionality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import catalogService, { CatalogService, ModelNotFoundError } from './catalog.service.js';
describe('CatalogService', () => {
    let service;
    beforeEach(() => {
        service = new CatalogService();
        service.clearCache(); // Ensure clean state for each test
    });
    describe('loadCatalog', () => {
        it('should load catalog data successfully', async () => {
            const catalog = await service.loadCatalog();
            expect(catalog).toBeDefined();
            expect(catalog.version).toBe('1.0.0');
            expect(catalog.switches).toHaveLength(2);
            expect(catalog.switches[0]?.id).toBe('DS2000');
            expect(catalog.switches[1]?.id).toBe('DS3000');
        });
        it('should cache catalog data on subsequent calls', async () => {
            const catalog1 = await service.loadCatalog();
            const catalog2 = await service.loadCatalog();
            expect(catalog1).toBe(catalog2); // Should return same object reference
        });
    });
    describe('getSwitchModel', () => {
        it('should return DS2000 leaf switch model', async () => {
            const model = await service.getSwitchModel('DS2000');
            expect(model).toBeDefined();
            expect(model?.id).toBe('DS2000');
            expect(model?.name).toBe('DataSwitch 2000 Series');
            expect(model?.type).toBe('leaf');
            expect(model?.maxPorts).toBe(48);
            expect(model?.supportedSpeeds).toContain('10G');
            expect(model?.supportedSpeeds).toContain('25G');
        });
        it('should return DS3000 spine switch model', async () => {
            const model = await service.getSwitchModel('DS3000');
            expect(model).toBeDefined();
            expect(model?.id).toBe('DS3000');
            expect(model?.name).toBe('DataSwitch 3000 Series');
            expect(model?.type).toBe('spine');
            expect(model?.maxPorts).toBe(32);
            expect(model?.supportedSpeeds).toContain('100G');
            expect(model?.supportedSpeeds).toContain('400G');
        });
        it('should return null for unknown model', async () => {
            const model = await service.getSwitchModel('UNKNOWN');
            expect(model).toBeNull();
        });
        it('should throw error for invalid model ID', async () => {
            await expect(service.getSwitchModel('')).rejects.toThrow('Invalid model ID');
            await expect(service.getSwitchModel(null)).rejects.toThrow('Invalid model ID');
        });
    });
    describe('validateModelId', () => {
        it('should return true for valid model IDs', async () => {
            expect(await service.validateModelId('DS2000')).toBe(true);
            expect(await service.validateModelId('DS3000')).toBe(true);
        });
        it('should return false for invalid model IDs', async () => {
            expect(await service.validateModelId('UNKNOWN')).toBe(false);
            expect(await service.validateModelId('')).toBe(false);
        });
    });
    describe('getSwitchesByType', () => {
        it('should return only leaf switches', async () => {
            const leafSwitches = await service.getSwitchesByType('leaf');
            expect(leafSwitches).toHaveLength(1);
            expect(leafSwitches[0]?.id).toBe('DS2000');
            expect(leafSwitches[0]?.type).toBe('leaf');
        });
        it('should return only spine switches', async () => {
            const spineSwitches = await service.getSwitchesByType('spine');
            expect(spineSwitches).toHaveLength(1);
            expect(spineSwitches[0]?.id).toBe('DS3000');
            expect(spineSwitches[0]?.type).toBe('spine');
        });
    });
    describe('getSwitchModelOrThrow', () => {
        it('should return model for valid ID', async () => {
            const model = await service.getSwitchModelOrThrow('DS2000');
            expect(model.id).toBe('DS2000');
        });
        it('should throw ModelNotFoundError for invalid ID', async () => {
            await expect(service.getSwitchModelOrThrow('UNKNOWN'))
                .rejects.toThrow(ModelNotFoundError);
        });
    });
    describe('getAllSwitchModels', () => {
        it('should return all switch models', async () => {
            const models = await service.getAllSwitchModels();
            expect(models).toHaveLength(2);
            expect(models.some(m => m.id === 'DS2000')).toBe(true);
            expect(models.some(m => m.id === 'DS3000')).toBe(true);
        });
    });
    // Test singleton instance
    describe('singleton instance', () => {
        it('should work with default exported instance', async () => {
            const model = await catalogService.getSwitchModel('DS2000');
            expect(model?.id).toBe('DS2000');
        });
    });
});
