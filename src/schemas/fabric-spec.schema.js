import { z } from 'zod';
// Switch model catalog - constrained to DS2000/DS3000
export const SwitchModelSchema = z.enum(['DS2000', 'DS3000']);
// Endpoint profile schema with validation
export const EndpointProfileSchema = z.object({
    name: z.string().min(1, 'Profile name is required'),
    type: z.enum(['server', 'storage', 'compute', 'network']),
    count: z.number().int().min(1, 'Must have at least 1 endpoint').max(1000, 'Maximum 1000 endpoints'),
    bandwidth: z.number().positive('Bandwidth must be positive'),
    redundancy: z.boolean().default(false),
    metadata: z.record(z.string(), z.any()).optional(),
});
// Core FabricSpec schema with comprehensive validation
export const FabricSpecSchema = z.object({
    name: z.string()
        .min(3, 'Fabric name must be at least 3 characters')
        .max(50, 'Fabric name must be less than 50 characters')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Name can only contain alphanumeric characters, hyphens, and underscores'),
    spineModelId: SwitchModelSchema.refine((model) => model === 'DS3000', 'Spine must use DS3000 model'),
    leafModelId: SwitchModelSchema.refine((model) => model === 'DS2000', 'Leaf must use DS2000 model'),
    uplinksPerLeaf: z.number()
        .int('Uplinks must be an integer')
        .min(1, 'Minimum 1 uplink per leaf')
        .max(4, 'Maximum 4 uplinks per leaf'),
    endpointProfiles: z.array(EndpointProfileSchema)
        .min(1, 'At least one endpoint profile is required')
        .max(10, 'Maximum 10 endpoint profiles allowed'),
    // Optional metadata for future extensibility
    metadata: z.record(z.string(), z.any()).optional(),
    // Version for schema evolution
    version: z.string().default('1.0.0'),
    // Creation timestamp
    createdAt: z.date().default(() => new Date()),
});
// Input validation schema (before processing)
export const FabricSpecInputSchema = FabricSpecSchema.omit({
    createdAt: true,
    version: true,
}).extend({
    createdAt: z.string().datetime().optional(),
    version: z.string().optional(),
});
// Refined schema with cross-field validation
export const ValidatedFabricSpecSchema = FabricSpecSchema
    .refine((data) => {
    const totalEndpoints = data.endpointProfiles.reduce((sum, profile) => sum + profile.count, 0);
    return totalEndpoints <= 2000; // Reasonable upper bound
}, {
    message: 'Total endpoints across all profiles cannot exceed 2000',
    path: ['endpointProfiles'],
})
    .refine((data) => {
    // Validate that redundant profiles have even endpoint counts
    const redundantProfiles = data.endpointProfiles.filter(p => p.redundancy);
    return redundantProfiles.every(p => p.count % 2 === 0);
}, {
    message: 'Redundant endpoint profiles must have even endpoint counts',
    path: ['endpointProfiles'],
});
// Schema validation functions
export const validateFabricSpec = (input) => {
    return ValidatedFabricSpecSchema.parse(input);
};
export const validateFabricSpecSafe = (input) => {
    return ValidatedFabricSpecSchema.safeParse(input);
};
// Partial update schema for incremental changes  
export const FabricSpecUpdateSchema = FabricSpecSchema.partial();
