import { z } from 'zod'

// Zod schemas for validation
export const EndpointProfileSchema = z.object({
  id: z.string().min(1, 'Profile ID is required'),
  name: z.string().min(1, 'Profile name is required'),
  endpointCount: z.number().int().positive('Endpoint count must be positive'),
  uplinksPerEndpoint: z.number().int().positive('Uplinks per endpoint must be positive')
})

export const SwitchModelSchema = z.object({
  id: z.string().min(1, 'Model ID is required'),
  name: z.string().min(1, 'Model name is required'),
  ports: z.number().int().positive('Port count must be positive'),
  type: z.enum(['spine', 'leaf'], { errorMap: () => ({ message: 'Type must be spine or leaf' }) })
})

export const FabricConfigSchema = z.object({
  name: z.string().min(1, 'Fabric name is required'),
  spineModelId: z.string().min(1, 'Spine model ID is required'),
  leafModelId: z.string().min(1, 'Leaf model ID is required'),
  uplinksPerLeaf: z.number().int().min(1, 'Uplinks per leaf must be at least 1').max(4, 'Uplinks per leaf cannot exceed 4'),
  endpointProfile: EndpointProfileSchema
})

export const ComputedTopologySchema = z.object({
  leavesNeeded: z.number().int().min(0, 'Leaves needed must be non-negative'),
  spinesNeeded: z.number().int().min(0, 'Spines needed must be non-negative'),
  totalCapacity: z.number().int().min(0, 'Total capacity must be non-negative'),
  oversubscriptionRatio: z.number().min(0, 'Oversubscription ratio must be non-negative'),
  isValid: z.boolean(),
  errors: z.array(z.string()).optional()
})

// TypeScript types derived from schemas
export type EndpointProfile = z.infer<typeof EndpointProfileSchema>
export type SwitchModel = z.infer<typeof SwitchModelSchema>
export type FabricConfig = z.infer<typeof FabricConfigSchema>
export type ComputedTopology = z.infer<typeof ComputedTopologySchema>

// State machine context
export interface FabricDesignContext {
  config: Partial<FabricConfig>
  computedTopology: ComputedTopology | null
  errors: string[]
  savedToFgd: boolean
}

// State machine events
export type FabricDesignEvent = 
  | { type: 'UPDATE_CONFIG'; data: Partial<FabricConfig> }
  | { type: 'COMPUTE_TOPOLOGY' }
  | { type: 'SAVE_TO_FGD' }
  | { type: 'RESET' }

export type FabricDesignState = 
  | 'configuring'
  | 'computed'
  | 'invalid'
  | 'saving'
  | 'saved'