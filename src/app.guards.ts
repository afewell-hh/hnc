import { FabricDesignContext, FabricSpecSchema } from './app.state.js'

export const isValidConfig = ({ context }: { context: FabricDesignContext }): boolean => {
  try {
    const config = FabricSpecSchema.parse(context.config)
    return config.uplinksPerLeaf % 2 === 0 // Critical: even uplinks only
  } catch { 
    return false 
  }
}

export const canSaveTopology = ({ context }: { context: FabricDesignContext }): boolean => {
  const t = context.computedTopology
  return Boolean(t?.isValid && t.leavesNeeded > 0 && t.spinesNeeded > 0 && t.oversubscriptionRatio <= 4.0)
}