import { z } from 'zod';

// Switch model catalog - constrained to DS2000/DS3000
export const SwitchModelSchema = z.enum(['DS2000', 'DS3000']);

// LAG constraints schema for future WPs
export const LAGConstraintsSchema = z.object({
  esLag: z.object({
    enabled: z.boolean(),
    minMembers: z.number().int().min(1).max(8).optional(),
    maxMembers: z.number().int().min(2).max(16).optional(),
    loadBalancing: z.enum(['round-robin', 'hash-based']).optional(),
  }).optional(),
  mcLag: z.object({
    enabled: z.boolean(),
    peerLinkCount: z.number().int().min(1).max(4).optional(),
    keepAliveInterval: z.number().int().min(100).max(10000).optional(),
    systemPriority: z.number().int().min(1).max(65535).optional(),
  }).optional(),
}).optional();

// Enhanced endpoint profile schema with validation
export const EndpointProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required'),
  portsPerEndpoint: z.number().int().min(1).max(4).default(1),
  type: z.enum(['server', 'storage', 'compute', 'network']).optional(),
  count: z.number().int().min(1, 'Must have at least 1 endpoint').max(1000, 'Maximum 1000 endpoints').optional(),
  bandwidth: z.number().positive('Bandwidth must be positive').optional(),
  redundancy: z.boolean().default(false).optional(),
  esLag: z.boolean().default(false).optional(), // ES-LAG intent flag
  nics: z.number().int().min(1).max(8).default(1).optional(), // NIC count per endpoint
});

// LeafClass schema for multi-class fabric support
export const LeafClassSchema = z.object({
  id: z.string()
    .min(1, 'Leaf class ID is required')
    .max(20, 'Leaf class ID must be less than 20 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'ID can only contain alphanumeric characters, hyphens, and underscores'),
  
  name: z.string()
    .min(1, 'Leaf class name is required')
    .max(50, 'Leaf class name must be less than 50 characters'),
  
  role: z.enum(['standard', 'border'], {
    errorMap: () => ({ message: "Role must be 'standard' or 'border'" })
  }),
  
  leafModelId: SwitchModelSchema.optional(), // defaults to global leaf model
  
  uplinksPerLeaf: z.number()
    .int('Uplinks must be an integer')
    .min(1, 'Minimum 1 uplink per leaf')
    .max(4, 'Maximum 4 uplinks per leaf'),
  
  endpointProfiles: z.array(EndpointProfileSchema)
    .min(1, 'At least one endpoint profile is required per leaf class')
    .max(10, 'Maximum 10 endpoint profiles per leaf class'),
  
  lag: LAGConstraintsSchema,
  count: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Core FabricSpec schema with multi-class and backwards compatibility
export const FabricSpecSchema = z.object({
  name: z.string()
    .min(3, 'Fabric name must be at least 3 characters')
    .max(50, 'Fabric name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Name can only contain alphanumeric characters, hyphens, and underscores'),
  
  spineModelId: SwitchModelSchema.refine(
    (model) => model === 'DS3000',
    'Spine must use DS3000 model'
  ),
  
  leafModelId: SwitchModelSchema.refine(
    (model) => model === 'DS2000',
    'Leaf must use DS2000 model'
  ),
  
  // Multi-class support (new)
  leafClasses: z.array(LeafClassSchema)
    .min(1, 'At least one leaf class is required')
    .max(10, 'Maximum 10 leaf classes allowed')
    .optional(),
  
  // Legacy single-class support (backwards compatibility)
  uplinksPerLeaf: z.number()
    .int('Uplinks must be an integer')
    .min(1, 'Minimum 1 uplink per leaf')
    .max(4, 'Maximum 4 uplinks per leaf')
    .optional(),
  
  endpointProfile: EndpointProfileSchema.optional(),
  endpointCount: z.number().int().min(1).max(10000).optional(),
  
  // Common fields
  metadata: z.record(z.string(), z.any()).optional(),
  version: z.string().default('1.0.0'),
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
  .refine(
    (data) => {
      // Either leafClasses OR legacy fields must be present, not both
      const hasLeafClasses = data.leafClasses && data.leafClasses.length > 0;
      const hasLegacyFields = data.uplinksPerLeaf !== undefined && data.endpointProfile !== undefined;
      
      return hasLeafClasses !== hasLegacyFields; // XOR: exactly one should be true
    },
    {
      message: 'Either leafClasses OR legacy fields (uplinksPerLeaf, endpointProfile) must be specified, not both',
      path: ['leafClasses'],
    }
  )
  .refine(
    (data) => {
      if (!data.leafClasses) return true; // skip if using legacy mode
      
      // Validate uplinksPerLeaf % spines === 0 per class (assuming max 4 spines)
      const maxSpines = 4; // reasonable assumption for validation
      return data.leafClasses.every(leafClass => 
        leafClass.uplinksPerLeaf <= maxSpines && maxSpines % leafClass.uplinksPerLeaf === 0
      );
    },
    {
      message: 'Each leaf class uplinksPerLeaf must evenly divide into spine count for proper load distribution',
      path: ['leafClasses'],
    }
  )
  .refine(
    (data) => {
      if (!data.leafClasses) return true; // skip if using legacy mode
      
      // Validate deterministic ordering: leaf class IDs must be sorted
      const ids = data.leafClasses.map(lc => lc.id);
      const sortedIds = [...ids].sort();
      return ids.every((id, index) => id === sortedIds[index]);
    },
    {
      message: 'Leaf classes must be ordered by ID for deterministic processing',
      path: ['leafClasses'],
    }
  )
  .refine(
    (data) => {
      if (!data.leafClasses) return true; // skip if using legacy mode
      
      // Validate unique leaf class IDs
      const ids = data.leafClasses.map(lc => lc.id);
      const uniqueIds = new Set(ids);
      return ids.length === uniqueIds.size;
    },
    {
      message: 'Leaf class IDs must be unique',
      path: ['leafClasses'],
    }
  )
  .refine(
    (data) => {
      if (!data.leafClasses) return true; // skip if using legacy mode
      
      // Calculate total endpoints across all leaf classes
      let totalEndpoints = 0;
      for (const leafClass of data.leafClasses) {
        for (const profile of leafClass.endpointProfiles) {
          totalEndpoints += (profile.count || 1) * (leafClass.count || 1);
        }
      }
      return totalEndpoints <= 10000; // Reasonable upper bound
    },
    {
      message: 'Total endpoints across all leaf classes cannot exceed 10000',
      path: ['leafClasses'],
    }
  )
  .refine(
    (data) => {
      if (!data.leafClasses) return true; // skip if using legacy mode
      
      // ES-LAG validation: endpoints with ES-LAG enabled must have >= 2 NICs
      for (const leafClass of data.leafClasses) {
        for (const profile of leafClass.endpointProfiles) {
          if (profile.esLag && (profile.nics || 1) < 2) {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: 'ES-LAG enabled endpoints must have at least 2 NICs',
      path: ['leafClasses'],
    }
  )
  .transform(
    (data) => {
      // Apply leafModelId defaults: use global leafModelId if class doesn't specify one
      if (data.leafClasses) {
        data.leafClasses = data.leafClasses.map(leafClass => ({
          ...leafClass,
          leafModelId: leafClass.leafModelId || data.leafModelId
        }));
      }
      return data;
    }
  );

// Type exports
export type SwitchModel = z.infer<typeof SwitchModelSchema>;
export type LAGConstraints = z.infer<typeof LAGConstraintsSchema>;
export type LeafClass = z.infer<typeof LeafClassSchema>;
export type EndpointProfile = z.infer<typeof EndpointProfileSchema>;
export type FabricSpec = z.infer<typeof FabricSpecSchema>;
export type FabricSpecInput = z.infer<typeof FabricSpecInputSchema>;
export type ValidatedFabricSpec = z.infer<typeof ValidatedFabricSpecSchema>;

// Schema validation functions
export const validateFabricSpec = (input: unknown): FabricSpec => {
  return ValidatedFabricSpecSchema.parse(input);
};

export const validateFabricSpecSafe = (input: unknown) => {
  return ValidatedFabricSpecSchema.safeParse(input);
};

// Partial update schema for incremental changes  
export const FabricSpecUpdateSchema = FabricSpecSchema.partial();

export type FabricSpecUpdate = z.infer<typeof FabricSpecUpdateSchema>;