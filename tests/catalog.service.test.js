import { describe, it, expect } from 'vitest';
import { CatalogService } from '../src/catalog.service';
describe('CatalogService', () => {
    describe('getSwitchModel', () => {
        it('should return DS2000 leaf model', () => {
            const model = CatalogService.getSwitchModel('DS2000');
            expect(model).toEqual({
                id: 'DS2000',
                name: 'DataSwitch 2000',
                ports: 48,
                type: 'leaf'
            });
        });
        it('should return DS3000 spine model', () => {
            const model = CatalogService.getSwitchModel('DS3000');
            expect(model).toEqual({
                id: 'DS3000',
                name: 'DataSwitch 3000',
                ports: 64,
                type: 'spine'
            });
        });
        it('should return null for non-existent model', () => {
            const model = CatalogService.getSwitchModel('INVALID');
            expect(model).toBeNull();
        });
        it('should return null for empty string', () => {
            const model = CatalogService.getSwitchModel('');
            expect(model).toBeNull();
        });
        it('should return null for non-string input', () => {
            const model = CatalogService.getSwitchModel(null);
            expect(model).toBeNull();
            const model2 = CatalogService.getSwitchModel(123);
            expect(model2).toBeNull();
        });
        it('should be case sensitive', () => {
            const model = CatalogService.getSwitchModel('ds2000');
            expect(model).toBeNull();
        });
    });
    describe('getEndpointProfile', () => {
        it('should return standard 48-port profile', () => {
            const profile = CatalogService.getEndpointProfile('standard-48');
            expect(profile).toEqual({
                id: 'standard-48',
                name: 'Standard 48-port',
                endpointCount: 48,
                uplinksPerEndpoint: 2
            });
        });
        it('should return high density 96-port profile', () => {
            const profile = CatalogService.getEndpointProfile('high-density-96');
            expect(profile).toEqual({
                id: 'high-density-96',
                name: 'High Density 96-port',
                endpointCount: 96,
                uplinksPerEndpoint: 4
            });
        });
        it('should return null for non-existent profile', () => {
            const profile = CatalogService.getEndpointProfile('INVALID');
            expect(profile).toBeNull();
        });
        it('should return null for empty string', () => {
            const profile = CatalogService.getEndpointProfile('');
            expect(profile).toBeNull();
        });
        it('should return null for non-string input', () => {
            const profile = CatalogService.getEndpointProfile(null);
            expect(profile).toBeNull();
        });
    });
    describe('getAllSwitchModels', () => {
        it('should return all switch models', () => {
            const models = CatalogService.getAllSwitchModels();
            expect(models).toHaveLength(2);
            expect(models).toEqual([
                { id: 'DS2000', name: 'DataSwitch 2000', ports: 48, type: 'leaf' },
                { id: 'DS3000', name: 'DataSwitch 3000', ports: 64, type: 'spine' }
            ]);
        });
        it('should return a copy of the catalog (not reference)', () => {
            const models1 = CatalogService.getAllSwitchModels();
            const models2 = CatalogService.getAllSwitchModels();
            expect(models1).not.toBe(models2);
            expect(models1).toEqual(models2);
            // Modifying returned array should not affect subsequent calls
            models1.push({ id: 'TEST', name: 'Test', ports: 24, type: 'leaf' });
            const models3 = CatalogService.getAllSwitchModels();
            expect(models3).toHaveLength(2);
        });
    });
    describe('getAllEndpointProfiles', () => {
        it('should return all endpoint profiles', () => {
            const profiles = CatalogService.getAllEndpointProfiles();
            expect(profiles).toHaveLength(2);
            expect(profiles).toEqual([
                { id: 'standard-48', name: 'Standard 48-port', endpointCount: 48, uplinksPerEndpoint: 2 },
                { id: 'high-density-96', name: 'High Density 96-port', endpointCount: 96, uplinksPerEndpoint: 4 }
            ]);
        });
        it('should return a copy of the profiles (not reference)', () => {
            const profiles1 = CatalogService.getAllEndpointProfiles();
            const profiles2 = CatalogService.getAllEndpointProfiles();
            expect(profiles1).not.toBe(profiles2);
            expect(profiles1).toEqual(profiles2);
        });
    });
    describe('getSpineModels', () => {
        it('should return only spine models', () => {
            const spineModels = CatalogService.getSpineModels();
            expect(spineModels).toHaveLength(1);
            expect(spineModels[0]).toEqual({
                id: 'DS3000',
                name: 'DataSwitch 3000',
                ports: 64,
                type: 'spine'
            });
        });
        it('should not include leaf models', () => {
            const spineModels = CatalogService.getSpineModels();
            const hasLeafModel = spineModels.some(model => model.type === 'leaf');
            expect(hasLeafModel).toBe(false);
        });
    });
    describe('getLeafModels', () => {
        it('should return only leaf models', () => {
            const leafModels = CatalogService.getLeafModels();
            expect(leafModels).toHaveLength(1);
            expect(leafModels[0]).toEqual({
                id: 'DS2000',
                name: 'DataSwitch 2000',
                ports: 48,
                type: 'leaf'
            });
        });
        it('should not include spine models', () => {
            const leafModels = CatalogService.getLeafModels();
            const hasSpineModel = leafModels.some(model => model.type === 'spine');
            expect(hasSpineModel).toBe(false);
        });
    });
    describe('isValidModelPair', () => {
        it('should validate correct spine-leaf pair', () => {
            const isValid = CatalogService.isValidModelPair('DS3000', 'DS2000');
            expect(isValid).toBe(true);
        });
        it('should reject non-existent spine model', () => {
            const isValid = CatalogService.isValidModelPair('INVALID', 'DS2000');
            expect(isValid).toBe(false);
        });
        it('should reject non-existent leaf model', () => {
            const isValid = CatalogService.isValidModelPair('DS3000', 'INVALID');
            expect(isValid).toBe(false);
        });
        it('should reject leaf model as spine', () => {
            const isValid = CatalogService.isValidModelPair('DS2000', 'DS3000');
            expect(isValid).toBe(false);
        });
        it('should reject spine model as leaf', () => {
            const isValid = CatalogService.isValidModelPair('DS3000', 'DS3000');
            expect(isValid).toBe(false);
        });
        it('should reject same model for both spine and leaf', () => {
            const isValid = CatalogService.isValidModelPair('DS2000', 'DS2000');
            expect(isValid).toBe(false);
        });
        it('should handle empty strings', () => {
            const isValid1 = CatalogService.isValidModelPair('', 'DS2000');
            const isValid2 = CatalogService.isValidModelPair('DS3000', '');
            const isValid3 = CatalogService.isValidModelPair('', '');
            expect(isValid1).toBe(false);
            expect(isValid2).toBe(false);
            expect(isValid3).toBe(false);
        });
    });
    describe('Edge Cases and Error Handling', () => {
        it('should handle undefined inputs gracefully', () => {
            expect(CatalogService.getSwitchModel(undefined)).toBeNull();
            expect(CatalogService.getEndpointProfile(undefined)).toBeNull();
        });
        it('should handle null inputs gracefully', () => {
            expect(CatalogService.getSwitchModel(null)).toBeNull();
            expect(CatalogService.getEndpointProfile(null)).toBeNull();
        });
        it('should handle number inputs gracefully', () => {
            expect(CatalogService.getSwitchModel(123)).toBeNull();
            expect(CatalogService.getEndpointProfile(456)).toBeNull();
        });
        it('should handle object inputs gracefully', () => {
            expect(CatalogService.getSwitchModel({})).toBeNull();
            expect(CatalogService.getEndpointProfile([])).toBeNull();
        });
        it('should handle whitespace-only strings', () => {
            expect(CatalogService.getSwitchModel('   ')).toBeNull();
            expect(CatalogService.getEndpointProfile('   ')).toBeNull();
        });
    });
});
